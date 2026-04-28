import { createClient } from "@supabase/supabase-js";
import type { XPost } from "../data/mockPosts";

export function isSupabaseConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
}

function getClient() {
  if (!isSupabaseConfigured()) return null;
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
}

export async function upsertPosts(posts: XPost[], keywordHash: string): Promise<void> {
  const db = getClient();
  if (!db || posts.length === 0) return;

  const rows = posts.map((p) => ({
    id: p.id,
    text: p.text,
    author_handle: p.authorHandle,
    author_name: p.authorName,
    author_followers: p.authorFollowers,
    author_bio: p.authorBio,
    created_at_x: p.createdAt,
    likes: p.metrics.likes,
    retweets: p.metrics.retweets,
    replies_count: p.metrics.replies,
    keyword_set_hash: keywordHash,
    scraped_at: new Date().toISOString(),
  }));

  const { error } = await db.from("scraped_posts").upsert(rows, { onConflict: "id" });
  if (error) console.error("[supabase] upsert error:", error.message);
  else console.log(`[supabase] Upserted ${rows.length} posts`);
}

export async function fetchCachedPosts(
  keywordHash: string,
  maxAgeMs = 10 * 60 * 1000
): Promise<XPost[] | null> {
  const db = getClient();
  if (!db) return null;

  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();

  // Try exact hash match first
  let { data, error } = await db
    .from("scraped_posts")
    .select("*")
    .eq("keyword_set_hash", keywordHash)
    .gte("scraped_at", cutoff)
    .order("scraped_at", { ascending: false })
    .limit(500);

  // Fall back 1: mega-scrape posts (permanent reference data, no age limit)
  if (!error && (!data || data.length === 0)) {
    const mega = await db
      .from("scraped_posts")
      .select("*")
      .eq("keyword_set_hash", "mega-scrape")
      .order("scraped_at", { ascending: false })
      .limit(500);
    data = mega.data;
    error = mega.error;
    if (data && data.length > 0) console.log(`[supabase] Serving ${data.length} mega-scrape posts`);
  }

  // Fall back 2: any posts from last 30 days (catches keyword-hash changes)
  if (!error && (!data || data.length === 0)) {
    const fallback = await db
      .from("scraped_posts")
      .select("*")
      .gte("scraped_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("scraped_at", { ascending: false })
      .limit(500);
    data = fallback.data;
    error = fallback.error;
    if (data && data.length > 0) console.log(`[supabase] Hash miss — serving ${data.length} posts from last 30 days`);
  }

  if (error) {
    console.error("[supabase] fetch error:", error.message);
    return null;
  }
  if (!data || data.length === 0) return null;

  const valid = data.filter((row) => row.id && row.text && row.author_handle);
  console.log(`[supabase] Cache hit — ${valid.length}/${data.length} valid posts for hash ${keywordHash}`);
  return valid.map((row) => ({
    id: String(row.id),
    text: row.text ?? "",
    authorId: row.author_handle ?? "unknown",
    authorHandle: row.author_handle ?? "unknown",
    authorName: row.author_name ?? row.author_handle ?? "Unknown",
    authorFollowers: row.author_followers ?? 0,
    authorBio: row.author_bio ?? "",
    createdAt: row.created_at_x ?? new Date().toISOString(),
    metrics: {
      likes: row.likes ?? 0,
      retweets: row.retweets ?? 0,
      replies: row.replies_count ?? 0,
    },
    recentPosts: [],
  }));
}
