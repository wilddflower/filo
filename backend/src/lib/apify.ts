import type { XPost } from "../data/mockPosts";
import type { Keywords, PostCategory } from "../types";

interface ApifyTweet {
  id: string;
  url?: string;
  text: string;
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  isRetweet?: boolean;
  isQuote?: boolean;
  noResults?: boolean;
  // author may be absent — handle extracted from url as fallback
  author?: {
    id?: string;
    userName?: string;
    name?: string;
    followers?: number;
    description?: string;
  };
}

const cache = new Map<string, { data: XPost[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function cacheKey(keywords: Keywords): string {
  return [...keywords.leadFinding, ...keywords.competitorAnalysis, ...keywords.marketResearch]
    .sort()
    .join("|");
}

// Extract @handle from x.com/handle/status/... URL
function handleFromUrl(url: string): string {
  const match = url?.match(/(?:x|twitter)\.com\/([^/]+)\/status/);
  return match?.[1] ?? "unknown";
}

export function detectCategory(text: string, keywords: Keywords): PostCategory {
  const lower = text.toLowerCase();
  const lf = keywords.leadFinding.filter((k) => lower.includes(k.toLowerCase())).length;
  const ca = keywords.competitorAnalysis.filter((k) => lower.includes(k.toLowerCase())).length;
  const mr = keywords.marketResearch.filter((k) => lower.includes(k.toLowerCase())).length;
  if (ca > 0 && ca >= lf && ca >= mr) return "Competitor Analysis";
  if (mr > 0 && mr >= lf) return "Market Research";
  return "Lead Finding";
}

export function hueFromHandle(handle: string): number {
  let hash = 0;
  for (let i = 0; i < handle.length; i++) {
    hash = (hash * 31 + handle.charCodeAt(i)) & 0xffff;
  }
  return hash % 360;
}

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "recently";
  const ms = new Date(dateStr).getTime();
  if (isNaN(ms)) return "recently";
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d > 365) return "recently";
  return `${d}d ago`;
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatTimestamp(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

function mapApifyToXPost(tweet: ApifyTweet): XPost {
  const handle = tweet.author?.userName ?? handleFromUrl(tweet.url ?? "");
  return {
    id: tweet.id,
    text: tweet.text,
    authorId: tweet.author?.id ?? tweet.id,
    authorHandle: handle,
    authorName: tweet.author?.name ?? handle,
    authorFollowers: tweet.author?.followers ?? 0,
    authorBio: tweet.author?.description ?? "",
    createdAt: tweet.createdAt ?? new Date().toISOString(),
    metrics: {
      likes: tweet.likeCount ?? 0,
      retweets: tweet.retweetCount ?? 0,
      replies: tweet.replyCount ?? 0,
    },
    recentPosts: [],
  };
}

export async function searchTweets(keywords: Keywords): Promise<XPost[]> {
  const key = cacheKey(keywords);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const allKeywords = [
    ...keywords.leadFinding,
    ...keywords.competitorAnalysis,
    ...keywords.marketResearch,
  ].slice(0, 10);
  const query = allKeywords.join(" OR ");

  const token = process.env.APIFY_TOKEN!;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/apidojo~tweet-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchTerms: [query],
          maxItems: 25,
          queryType: "Latest",
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) throw new Error(`Apify ${response.status}`);

    const tweets = (await response.json()) as ApifyTweet[];
    const xPosts = tweets
      .filter((t) => !t.noResults && t.text && t.text.length > 20)
      .map(mapApifyToXPost);
    cache.set(key, { data: xPosts, ts: Date.now() });
    return xPosts;
  } finally {
    clearTimeout(timer);
  }
}
