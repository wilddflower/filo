import Groq from "groq-sdk";
import type { XPost } from "../data/mockPosts";
import type { Keywords } from "../types";

export interface ScoredPost {
  post: XPost;
  score: number;
  confidence: "high" | "med" | "low";
  matchedKeywords: string[];
  rationale: { tag: string; text: string }[];
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Try models in order — each has its own daily quota
const MODELS = [
  "llama-3.1-8b-instant",    // 500k/day — primary (unlikely to be exhausted)
  "llama-3.3-70b-specdec",   // 2nd fallback
  "llama-3.3-70b-versatile", // original (may be exhausted)
];

export async function scorePost(post: XPost): Promise<ScoredPost> {
  const prompt = `You are a growth intelligence assistant for Clover Labs, which builds AI-powered growth agents that help founders get distribution for their B2C products.

Analyze this X (Twitter) post and score how likely the author is a founder who is struggling with growth, user acquisition, or distribution — and would benefit from an AI growth agent.

Post: "${post.text}"
Author bio: "${post.authorBio}"
Followers: ${post.authorFollowers}

Respond ONLY with valid JSON in this exact shape:
{
  "score": <integer 1-10>,
  "matchedKeywords": [<phrases that signal founder growth pain>],
  "rationale": [
    { "tag": "<Pain|Stage|ICP|Urgency|Mismatch>", "text": "<one sentence>" }
  ]
}

Scoring guide:
- 8-10: founder explicitly struggling to get users, traction, or growth RIGHT NOW — active pain, urgency, or frustration with distribution
- 6-7: founder actively building something + talking about growth challenges, acquisition, launching, or distribution — even if not in crisis
- 4-5: clearly a founder/indie hacker + mentions growth, users, launch, or distribution in a relevant way
- 1-3: general advice tweets, thought leadership with no product, B2B enterprise focus, sports/entertainment/unrelated topics, or someone who just has "founder" in bio but the tweet is completely off-topic

A 4 requires BOTH a founder signal AND a growth-related tweet. Bio alone is not enough for a 4. Score 3 or below if the tweet topic is unrelated to building or growing a product.`;

  for (const model of MODELS) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 400,
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");

      const parsed = JSON.parse(jsonMatch[0]);
      const score = Math.min(Math.max(Number(parsed.score) || 1, 1), 10);

      return {
        post,
        score,
        confidence: score >= 7 ? "high" : score >= 5 ? "med" : "low",
        matchedKeywords: parsed.matchedKeywords ?? [],
        rationale: parsed.rationale ?? [],
      };
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      const isRateLimit = msg.includes("rate limit") || msg.includes("429") || msg.includes("quota");
      if (isRateLimit && model !== MODELS[MODELS.length - 1]) {
        console.warn(`[scorer] ${model} rate-limited, trying ${MODELS[MODELS.indexOf(model) + 1]}...`);
        continue;
      }
      // Non-rate-limit error or all models exhausted → rule-based fallback
      return fallbackScore(post);
    }
  }
  return fallbackScore(post);
}

export async function scoreAll(posts: XPost[]): Promise<ScoredPost[]> {
  const BATCH = 10;
  const results: ScoredPost[] = [];
  for (let i = 0; i < posts.length; i += BATCH) {
    const batch = posts.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(scorePost));
    results.push(...batchResults);
    if (i + BATCH < posts.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return results.sort((a, b) => b.score - a.score);
}

// Rule-based pre-filter: scores every post cheaply, returns top N candidates for Groq scoring.
export function quickFilter(posts: XPost[], keywords: Keywords, limit: number): XPost[] {
  const allKw = [
    ...keywords.leadFinding,
    ...keywords.competitorAnalysis,
    ...keywords.marketResearch,
  ].map((k) => k.toLowerCase());

  const INTENT_SIGNALS = [
    "looking for", "need a", "recommend", "alternative", "switching from",
    "replacing", "best tool", "anyone use", "tried", "comparison", "vs ",
    "frustrat", "annoyed with", "problem with", "help with", "anyone know",
    "suggestions", "advice", "which is better", "worth it", "budget for",
    "deciding between", "evaluating", "demo", "free trial", "pricing",
  ];

  const scored = posts.map((post) => {
    const lower = post.text.toLowerCase();
    const kwHits = allKw.filter((k) => lower.includes(k)).length;
    const signalHits = INTENT_SIGNALS.filter((s) => lower.includes(s)).length;
    const engagementBoost = Math.log1p(post.metrics.likes + post.metrics.retweets) * 0.5;
    const priority = kwHits * 3 + signalHits * 2 + engagementBoost;
    return { post, priority };
  });

  return scored
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
    .map((s) => s.post);
}

export { fallbackScore as ruleScore };

// Founder-growth rule-based fallback — used when all Groq models are rate-limited.
// Scores generously so the dashboard stays full during API outages.
function fallbackScore(post: XPost): ScoredPost {
  const text = post.text.toLowerCase();
  const bio = (post.authorBio ?? "").toLowerCase();

  const HIGH_PAIN = [
    "can't get users", "no one is using", "struggling to grow", "need more users",
    "0 users", "zero users", "no traction", "nobody signing up", "still no traction",
    "first 100 users", "getting first users", "can't find users", "hard to get users",
    "nobody cares", "crickets", "ghost town", "struggling with growth",
    "nobody wants", "nobody buys", "no conversions", "no signups",
  ];

  // Specific terms — single words only if they're startup-domain-specific
  const FOUNDER_GROWTH = [
    // identity (safe single words — rare outside startup context)
    "founder", "startup", "saas", "bootstrapped",
    "indie hacker", "indiehacker", "solo founder", "co-founder", "solopreneur",
    // growth phrases
    "user acquisition", "getting traction", "go-to-market", "gtm",
    "growth hack", "word of mouth", "product market fit", "pmf",
    "organic growth", "viral loop", "building in public",
    // outreach
    "cold email", "cold outreach", "cold dm",
    // launch / funnel
    "landing page", "waitlist", "early adopters", "early users",
    "launch strategy", "pre-launch", "product hunt", "hacker news", "show hn",
    "just launched", "just shipped", "we launched", "i launched",
    "i built", "i made", "my startup", "my saas", "building my",
    "i'm building", "im building", "we're building",
    // customers
    "paying customers", "first customers", "getting customers",
    "get customers", "find customers", "no customers",
    "first users", "get users", "getting users",
    // metrics
    "mrr", "arr", "burn rate", "ramen profitable", "default alive",
    "churn rate", "activation rate",
  ];

  const FOUNDER_BIO = [
    "founder", "co-founder", "indie hacker", "indiehacker",
    "bootstrapped", "building in public", "solopreneur", "saas",
  ];

  const PAIN_SIGNALS = [
    "how do i get", "how to get more", "how to find",
    "struggling with", "stuck on", "frustrated with",
    "what works for", "any suggestions", "anyone tried",
    "what am i doing wrong", "tried everything", "nothing is working",
    "need help", "help me", "any advice",
    "plateau", "stagnant",
  ];

  const highPainHits = HIGH_PAIN.filter((k) => text.includes(k)).length;
  const growthHits = FOUNDER_GROWTH.filter((k) => text.includes(k) || bio.includes(k)).length;
  const painHits = PAIN_SIGNALS.filter((k) => text.includes(k)).length;
  const founderBio = FOUNDER_BIO.some((k) => bio.includes(k));

  let score: number;
  if (highPainHits >= 1) {
    score = 8;
  } else if (growthHits >= 4 && painHits >= 1) {
    score = 7;
  } else if (growthHits >= 3 && painHits >= 1) {
    score = 7;
  } else if (growthHits >= 2 && painHits >= 1) {
    score = 6;
  } else if (growthHits >= 3) {
    score = 5;
  } else if (growthHits >= 2) {
    score = 5;
  } else if (growthHits >= 1 && painHits >= 1) {
    score = 5;
  } else if (growthHits >= 1 || (founderBio && painHits >= 1)) {
    score = 4;
  } else if (founderBio && growthHits === 0) {
    score = 3;
  } else {
    score = 2;
  }

  const matched = [...HIGH_PAIN, ...FOUNDER_GROWTH, ...PAIN_SIGNALS].filter((k) => text.includes(k));

  return {
    post,
    score,
    confidence: score >= 7 ? "high" : score >= 5 ? "med" : "low",
    matchedKeywords: matched.slice(0, 5),
    rationale: [{ tag: "Fallback", text: "Rule-based score (LLM temporarily unavailable)" }],
  };
}
