/**
 * One-time deep scrape — fills Supabase with real X posts.
 *
 * Usage (from backend/ directory):
 *   npx tsx scripts/mega-scrape.ts
 *
 * What it does:
 *   1. Opens Playwright with your saved auth.json session
 *   2. Searches each keyword one at a time (no parallelism → avoids X rate limits)
 *   3. Scrolls deeper than normal (30 scrolls ≈ 300-400 tweets per keyword)
 *   4. Saves to Supabase after EVERY keyword so partial results survive crashes
 *   5. Logs progress and a final summary
 *
 * You can Ctrl-C at any time — whatever scraped so far is already in Supabase.
 */

import "dotenv/config";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const AUTH_JSON_PATH = path.join(process.cwd(), "auth.json");

// ── Keyword list — broad founder growth signals ───────────────────────────────
const KEYWORDS = [
  "first 100 users",
  "need more users",
  "getting traction startup",
  "no one is signing up",
  "struggling to grow app",
  "user acquisition problem",
  "can't get users",
  "low user engagement startup",
  "need to grow my app",
  "how to get first customers",
  "indie hacker growth",
  "startup distribution",
  "product market fit struggling",
  "launch failed startup",
  "nobody using my app",
  "how to get traction startup",
  "need beta users",
  "how to grow startup",
  "launch strategy founders",
  "zero users startup",
  "first 1000 users",
  "founder growth problem",
  "b2c startup growth",
  "startup marketing help",
  "no traction yet",
  "startup user growth",
  "app launch growth",
  "finding first users",
  "early stage traction",
  "growth channel startup",
];

const SCROLL_DEPTH = 12; // 12 scrolls ≈ 120-160 tweets per keyword (stable on Windows)
const PAUSE_BETWEEN_KW = 10_000; // 10 seconds between keywords

// ── Supabase ──────────────────────────────────────────────────────────────────
function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env");
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

interface Post {
  id: string;
  text: string;
  authorHandle: string;
  authorName: string;
  authorFollowers: number;
  authorBio: string;
  createdAt: string;
  metrics: { likes: number; retweets: number; replies: number };
}

async function upsert(db: ReturnType<typeof getSupabase>, posts: Post[], keyword: string) {
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
    keyword_set_hash: "mega-scrape",
    scraped_at: new Date().toISOString(),
  }));

  const { error } = await db.from("scraped_posts").upsert(rows, { onConflict: "id" });
  if (error) {
    console.error(`  [supabase] upsert error for "${keyword}":`, error.message);
  } else {
    console.log(`  [supabase] Saved ${rows.length} posts from "${keyword}"`);
  }
}

// ── Playwright helpers ────────────────────────────────────────────────────────
function parseCount(text: string): number {
  if (!text) return 0;
  const clean = text.trim().replace(",", "");
  if (clean.endsWith("K")) return Math.round(parseFloat(clean) * 1_000);
  if (clean.endsWith("M")) return Math.round(parseFloat(clean) * 1_000_000);
  return parseInt(clean) || 0;
}

async function warmUp(ctx: BrowserContext): Promise<boolean> {
  const page = await ctx.newPage();
  try {
    console.log("[warm-up] Visiting x.com/home...");
    await page.goto("https://x.com/home", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(4_000);
    const loggedIn = await page
      .waitForSelector('[data-testid="primaryColumn"]', { timeout: 12_000 })
      .then(() => true)
      .catch(() => false);
    console.log(loggedIn ? "[warm-up] Auth OK ✓" : "[warm-up] Auth FAILED ✗");
    return loggedIn;
  } finally {
    await page.close();
  }
}

async function scrapeKeyword(keyword: string, ctx: BrowserContext, maxScrolls: number): Promise<Post[]> {
  const page = await ctx.newPage();
  const found: Post[] = [];
  const seenIds = new Set<string>();

  try {
    const url = `https://x.com/search?q=${encodeURIComponent(keyword)}&f=live`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2_500);

    const feedLoaded = await page
      .waitForSelector('[data-testid="primaryColumn"]', { timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    if (!feedLoaded) {
      console.log(`  [skip] No feed for "${keyword}" — rate-limited or redirected`);
      return [];
    }

    let gotTweets = await page
      .waitForSelector('article[data-testid="tweet"]', { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!gotTweets) {
      const hasError = (await page.locator('text=Something went wrong').count()) > 0;
      if (hasError) {
        await page.locator('text=Retry').first().click().catch(() => {});
        await page.waitForTimeout(3_000);
        gotTweets = await page
          .waitForSelector('article[data-testid="tweet"]', { timeout: 12_000 })
          .then(() => true)
          .catch(() => false);
      }
    }

    if (!gotTweets) {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForTimeout(3_500);
      gotTweets = await page
        .waitForSelector('article[data-testid="tweet"]', { timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
    }

    if (!gotTweets) {
      console.log(`  [skip] No tweets for "${keyword}" after retries`);
      return [];
    }

    for (let scroll = 0; scroll < maxScrolls; scroll++) {
      try {
        const articles = page.locator('article[data-testid="tweet"]');
        const count = await articles.count();

        for (let i = 0; i < count; i++) {
          try {
            const article = articles.nth(i);

            const linkHref = await article
              .locator('a[href*="/status/"]')
              .first()
              .getAttribute("href")
              .catch(() => null);
            const tweetId = linkHref?.split("/status/")?.[1]?.split("?")?.[0];
            if (!tweetId || seenIds.has(tweetId)) continue;
            seenIds.add(tweetId);

            const text = await article
              .locator('[data-testid="tweetText"]')
              .first()
              .innerText()
              .catch(() => "");
            if (!text || text.length < 10) continue;

            const timeIso = await article
              .locator("time")
              .first()
              .getAttribute("datetime")
              .catch(() => new Date().toISOString());

            const usernameHref = await article
              .locator('[data-testid="User-Name"] a')
              .first()
              .getAttribute("href")
              .catch(() => "/unknown");
            const handle = (usernameHref ?? "/unknown").replace("/", "");

            const displayName = await article
              .locator('[data-testid="User-Name"]')
              .first()
              .innerText()
              .catch(() => handle);

            const likeText = await article
              .locator('[data-testid="like"] span')
              .first()
              .innerText()
              .catch(() => "0");
            const retweetText = await article
              .locator('[data-testid="retweet"] span')
              .first()
              .innerText()
              .catch(() => "0");
            const replyText = await article
              .locator('[data-testid="reply"] span')
              .first()
              .innerText()
              .catch(() => "0");

            found.push({
              id: tweetId,
              text: text.trim(),
              authorHandle: handle,
              authorName: displayName.split("\n")[0].trim(),
              authorFollowers: 0,
              authorBio: "",
              createdAt: timeIso ?? new Date().toISOString(),
              metrics: {
                likes: parseCount(likeText),
                retweets: parseCount(retweetText),
                replies: parseCount(replyText),
              },
            });
          } catch {
            // Skip individual tweet parse errors
          }
        }

        await page.evaluate("window.scrollBy(0, 1500)");
        await page.waitForTimeout(1_200 + Math.random() * 600);
      } catch (scrollErr) {
        const msg = scrollErr instanceof Error ? scrollErr.message : String(scrollErr);
        if (msg.includes("Target crashed") || msg.includes("closed")) {
          console.log(`  [warn] Page crashed at scroll ${scroll}, keeping ${found.length} tweets collected`);
          break;
        }
        throw scrollErr;
      }
    }

    return found;
  } finally {
    await page.close();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Filo Mega-Scrape — one-time X data collection");
  console.log(`  Keywords: ${KEYWORDS.length}  ·  Scrolls per keyword: ${SCROLL_DEPTH}`);
  console.log("  Results saved to Supabase incrementally.");
  console.log("  Ctrl-C at any time — progress is not lost.");
  console.log("═══════════════════════════════════════════════════\n");

  const db = getSupabase();

  const authExists = fs.existsSync(AUTH_JSON_PATH);
  if (!authExists) {
    console.error("No auth.json found. Run the auth setup first.");
    process.exit(1);
  }

  const browser: Browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-background-networking",
      "--js-flags=--max-old-space-size=512",
    ],
  });

  const ctx = await browser.newContext({
    storageState: AUTH_JSON_PATH,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });
  await ctx.addInitScript("Object.defineProperty(navigator, 'webdriver', { get: () => undefined })");

  const authed = await warmUp(ctx);
  if (!authed) {
    console.error("Not authenticated. Check auth.json.");
    await browser.close();
    process.exit(1);
  }

  let totalSaved = 0;
  let skippedKeywords = 0;

  for (let i = 0; i < KEYWORDS.length; i++) {
    const keyword = KEYWORDS[i];
    console.log(`\n[${i + 1}/${KEYWORDS.length}] Scraping: "${keyword}"`);

    try {
      const posts = await scrapeKeyword(keyword, ctx, SCROLL_DEPTH);
      console.log(`  Found ${posts.length} tweets`);

      if (posts.length > 0) {
        await upsert(db, posts, keyword);
        totalSaved += posts.length;
      } else {
        skippedKeywords++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Error scraping "${keyword}":`, msg.slice(0, 120));
      skippedKeywords++;
    }

    // Save session state periodically
    if ((i + 1) % 5 === 0) {
      await ctx.storageState({ path: AUTH_JSON_PATH }).catch(() => {});
      console.log("  [session] Saved auth.json");
    }

    if (i < KEYWORDS.length - 1) {
      console.log(`  Waiting ${PAUSE_BETWEEN_KW / 1000}s before next keyword...`);
      await new Promise((r) => setTimeout(r, PAUSE_BETWEEN_KW));
    }
  }

  await ctx.storageState({ path: AUTH_JSON_PATH }).catch(() => {});
  await browser.close();

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  DONE. Total posts saved to Supabase: ${totalSaved}`);
  console.log(`  Keywords skipped (rate-limited/empty): ${skippedKeywords}/${KEYWORDS.length}`);
  console.log("  Dashboard will now serve these on next load.");
  console.log("═══════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
