import { Router } from "express";
import { SAMPLE_POSTS } from "../data/mockPosts";
import { MOCK_LEADS } from "../data/mockLeads";
import { scoreAll, scorePost, quickFilter, ruleScore } from "../services/intentScorer";
import { scrapeXSearch, hasAuth, poolSize } from "../lib/xScraper";
import { detectCategory, hueFromHandle, timeAgo, formatFollowers, formatTimestamp } from "../lib/apify";
import type { Keywords, Lead } from "../types";
import type { ScoredPost } from "../services/intentScorer";
import type { XPost } from "../data/mockPosts";

const router = Router();

const MIN_LEADS = 100;
const GROQ_LIMIT = 120; // Groq scores the top 120 in background (~40-60s)

// Two-tier cache:
//   ruleCache  — instant rule-based scores, always available
//   groqCache  — Groq-improved scores, populated ~30s after first load
let ruleCache: Lead[] = [];
let groqCache: Lead[] = [];
let ruleCacheHash = "";
let groqCacheHash = "";
let groqBusy = false;

function kwHash(keywords: Keywords): string {
  return [
    ...keywords.leadFinding,
    ...keywords.competitorAnalysis,
    ...keywords.marketResearch,
  ].sort().join("|");
}

function mapToLead(scored: ScoredPost, keywords: Keywords): Lead {
  const { post, score, confidence, matchedKeywords, rationale } = scored;
  return {
    id: post.id,
    name: post.authorName,
    handle: post.authorHandle,
    avatarHue: hueFromHandle(post.authorHandle),
    followers: formatFollowers(post.authorFollowers),
    time: timeAgo(post.createdAt),
    timestamp: formatTimestamp(post.createdAt),
    score,
    scoreTier: score >= 7 ? "hi" : score >= 4 ? "md" : "lo",
    confidence,
    matched: matchedKeywords,
    primaryKeyword: detectCategory(post.text, keywords),
    post: post.text,
    bio: post.authorBio,
    location: "",
    website: "",
    hearts: post.metrics.likes,
    reposts: post.metrics.retweets,
    replies: post.metrics.replies,
    isReply: false,
    rationale,
    recentPosts: post.recentPosts,
    platform: "x",
  };
}

function buildRuleLeads(posts: XPost[], keywords: Keywords): Lead[] {
  const scored = posts.map(ruleScore);
  const sorted = scored.sort((a, b) => b.score - a.score);
  const good = sorted.filter((s) => s.score >= 4);
  const filler = sorted.filter((s) => s.score === 3);
  // Always include filler to pad up to MIN_LEADS; cap total at 300 to stay snappy
  const needed = Math.max(MIN_LEADS - good.length, 0);
  const combined = [...good, ...filler.slice(0, needed)].slice(0, 300);
  return combined.map((s) => mapToLead(s, keywords));
}

function triggerGroqBackground(posts: XPost[], keywords: Keywords, hash: string) {
  if (groqBusy || groqCacheHash === hash) return;
  groqBusy = true;
  const candidates = quickFilter(posts, keywords, GROQ_LIMIT);
  scoreAll(candidates)
    .then((scored) => {
      const good = scored.filter((s) => s.score >= 4);
      const filler = scored.filter((s) => s.score === 3);
      const needed = Math.max(MIN_LEADS - good.length, 0);
      const combined = [...good, ...filler.slice(0, needed)];
      groqCache = combined.map((s) => mapToLead(s, keywords));
      groqCacheHash = hash;
      console.log(`[leads] Groq background done — ${groqCache.length} leads scored`);
    })
    .catch((e) => console.error("[leads] Groq background failed:", e.message))
    .finally(() => { groqBusy = false; });
}

router.post("/search", async (req, res) => {
  const raw = req.body?.keywords as Partial<Keywords> | undefined;
  if (!raw) {
    res.json({ leads: MOCK_LEADS, source: "mock", pool: 0 });
    return;
  }
  const keywords: Keywords = {
    leadFinding: raw.leadFinding ?? [],
    competitorAnalysis: raw.competitorAnalysis ?? [],
    marketResearch: raw.marketResearch ?? [],
  };

  if (!hasAuth()) {
    res.json({ leads: MOCK_LEADS, source: "mock", pool: 0 });
    return;
  }

  try {
    const allPosts = await scrapeXSearch(keywords);
    if (allPosts.length === 0) {
      res.json({ leads: MOCK_LEADS, source: "mock", pool: 0 });
      return;
    }

    const hash = kwHash(keywords);
    const currentPool = poolSize();

    // If Groq cache is warm for these keywords, serve it (best quality, instant)
    if (groqCache.length > 0 && groqCacheHash === hash) {
      console.log(`[leads] Groq cache hit — ${groqCache.length} leads`);
      res.json({ leads: groqCache, source: "live", pool: currentPool });
      // Kick off background refresh if pool grew a lot
      if (currentPool - (ruleCache.length + groqCache.length) > 100) {
        triggerGroqBackground(allPosts, keywords, hash + "-refresh");
      }
      return;
    }

    // Serve rule-based scores instantly (< 50ms for 500 posts)
    if (ruleCacheHash !== hash) {
      ruleCache = buildRuleLeads(allPosts, keywords);
      ruleCacheHash = hash;
    }

    console.log(`[leads] Rule cache — ${ruleCache.length} leads, kicking off Groq in background`);
    res.json({ leads: ruleCache, source: "live", pool: currentPool });

    // Groq scores the best 80 in background — available on next request
    triggerGroqBackground(allPosts, keywords, hash);
  } catch (err) {
    console.error("[leads/search]", err);
    res.json({ leads: MOCK_LEADS, source: "mock", pool: 0 });
  }
});

router.get("/pool-stats", (_req, res) => {
  res.json({ pool: poolSize() });
});

router.get("/", async (_req, res) => {
  const scored = await scoreAll(SAMPLE_POSTS);
  res.json({ leads: scored, total: scored.length, updatedAt: new Date().toISOString() });
});

router.get("/:id", async (req, res) => {
  const post = SAMPLE_POSTS.find((p) => p.id === req.params.id);
  if (!post) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json(await scorePost(post));
});

export default router;
