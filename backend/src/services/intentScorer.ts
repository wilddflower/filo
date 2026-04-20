import type { XPost } from "../data/mockPosts";
import { INTENT_KEYWORDS } from "../data/mockPosts";

export interface ScoredPost {
  post: XPost;
  score: number;
  confidence: "high" | "med" | "low";
  matchedKeywords: string[];
  rationale: { tag: string; text: string }[];
}

// Rule-based intent scorer for MVP — replace with Claude API in production
export function scorePost(post: XPost): ScoredPost {
  const text = post.text.toLowerCase();
  const matchedKeywords = INTENT_KEYWORDS.filter((kw) => text.includes(kw.toLowerCase()));

  let score = 0;
  const rationale: { tag: string; text: string }[] = [];

  // Keyword signals (0–4 pts)
  if (matchedKeywords.length > 0) {
    const pts = Math.min(matchedKeywords.length * 2, 4);
    score += pts;
    rationale.push({ tag: "Intent", text: `Matched intent keywords: ${matchedKeywords.join(", ")}` });
  }

  // Competitor mention (0–2 pts)
  const competitors = ["sprout", "hootsuite", "brandwatch", "mention", "buffer", "hubspot", "salesforce"];
  const mentionedCompetitors = competitors.filter((c) => text.includes(c));
  if (mentionedCompetitors.length > 0) {
    score += 2;
    rationale.push({ tag: "Switch", text: `Competitor mentioned: ${mentionedCompetitors.join(", ")} — churn signal` });
  }

  // Follower authority (0–1 pt)
  if (post.authorFollowers >= 1000) {
    score += 1;
    rationale.push({ tag: "Authority", text: `${post.authorFollowers.toLocaleString()} followers — credible signal` });
  }

  // ICP role signal from bio (0–2 pts)
  const icpKeywords = ["founder", "ceo", "head of", "vp", "growth", "marketing", "sales", "demand gen"];
  const icpMatch = icpKeywords.find((k) => post.authorBio.toLowerCase().includes(k));
  if (icpMatch) {
    score += 2;
    rationale.push({ tag: "Role", text: `Bio signal: ${icpMatch} — matches buyer ICP` });
  }

  // Urgency signal (0–1 pt)
  const urgencyTerms = ["this month", "this quarter", "asap", "today", "urgently", "right now"];
  const urgencyMatch = urgencyTerms.find((t) => text.includes(t));
  if (urgencyMatch) {
    score += 1;
    rationale.push({ tag: "Urgency", text: `Time signal: "${urgencyMatch}" — near-term decision` });
  }

  // Off-topic penalty: no ICP keywords and no competitor mentions = likely noise
  if (matchedKeywords.length === 0 && mentionedCompetitors.length === 0) {
    score = Math.max(score - 2, 1);
    rationale.push({ tag: "Mismatch", text: "No intent keywords or competitor mentions detected" });
  }

  score = Math.min(Math.max(score, 1), 10);

  const confidence: "high" | "med" | "low" =
    score >= 7 ? "high" : score >= 5 ? "med" : "low";

  return { post, score, confidence, matchedKeywords, rationale };
}

export function scoreAll(posts: XPost[]): ScoredPost[] {
  return posts
    .map(scorePost)
    .sort((a, b) => b.score - a.score);
}
