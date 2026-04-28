import { chromium, type Browser, type BrowserContext } from "playwright";
import * as fs from "fs";
import * as path from "path";
import type { XPost } from "../data/mockPosts";
import type { Keywords } from "../types";
import { upsertPosts, fetchCachedPosts, isSupabaseConfigured } from "./supabase";

const AUTH_JSON_PATH = path.join(process.cwd(), "auth.json");

// ── Persistent tweet pool ────────────────────────────────────────────────────
const pool = new Map<string, XPost>();
let poolKeyHash = "";
let lastRefresh = 0;
let lastKeywords: Keywords | null = null;
const REFRESH_INTERVAL = 10 * 60 * 1000;
let fillInProgress = false;

// ── Browser singleton ────────────────────────────────────────────────────────
let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
      ],
    });
  }
  return browser;
}

// ── Auth helpers ─────────────────────────────────────────────────────────────
function authJsonHasToken(): boolean {
  try {
    const raw = fs.readFileSync(AUTH_JSON_PATH, "utf8");
    const data = JSON.parse(raw);
    return (data.cookies ?? []).some((c: { name: string }) => c.name === "auth_token");
  } catch {
    return false;
  }
}

export function hasAuth(): boolean {
  return authJsonHasToken() || !!process.env.X_AUTH_TOKEN;
}

// ── Context factory ──────────────────────────────────────────────────────────
async function makeContext(b: Browser): Promise<BrowserContext> {
  const useStorageState = authJsonHasToken();
  const ctx = useStorageState
    ? await b.newContext({
        storageState: AUTH_JSON_PATH,
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 900 },
      })
    : await b.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 900 },
      });

  await ctx.addInitScript(
    "Object.defineProperty(navigator, 'webdriver', { get: () => undefined })"
  );

  // If no storageState, inject auth_token from env so X can set ct0 on warm-up
  if (!useStorageState && process.env.X_AUTH_TOKEN) {
    await ctx.addCookies([
      {
        name: "auth_token",
        value: process.env.X_AUTH_TOKEN,
        domain: ".x.com",
        path: "/",
        secure: true,
        httpOnly: true,
      },
    ]);
  }

  return ctx;
}

// ── Warm-up: visit home so X sets ct0 and other session cookies ──────────────
// auth_token alone is not enough — X requires ct0 for authenticated API calls.
// Visiting x.com/home while auth_token is set causes X's server to generate ct0.
async function warmUp(ctx: BrowserContext): Promise<boolean> {
  const page = await ctx.newPage();
  try {
    console.log("[xScraper] Warming up session (visiting x.com/home)...");
    await page.goto("https://x.com/home", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(4_000);

    const loggedIn = await page
      .waitForSelector('[data-testid="primaryColumn"]', { timeout: 12_000 })
      .then(() => true)
      .catch(() => false);

    if (loggedIn) {
      console.log("[xScraper] Auth OK — session established");
    } else {
      console.warn("[xScraper] Auth FAILED — x.com/home did not show logged-in feed");
    }
    return loggedIn;
  } finally {
    await page.close();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseCount(text: string): number {
  if (!text) return 0;
  const clean = text.trim().replace(",", "");
  if (clean.endsWith("K")) return Math.round(parseFloat(clean) * 1_000);
  if (clean.endsWith("M")) return Math.round(parseFloat(clean) * 1_000_000);
  return parseInt(clean) || 0;
}

function cacheKey(keywords: Keywords): string {
  return [...keywords.leadFinding, ...keywords.competitorAnalysis, ...keywords.marketResearch]
    .sort()
    .join("|");
}

// ── Single-keyword scrape using an already-authenticated shared context ───────
async function scrapeKeywordPage(
  keyword: string,
  ctx: BrowserContext,
  maxScrolls = 15
): Promise<XPost[]> {
  const page = await ctx.newPage();
  const found: XPost[] = [];
  const seenIds = new Set<string>();

  try {
    const url = `https://x.com/search?q=${encodeURIComponent(keyword)}&f=live`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2_500);

    const currentUrl = page.url();
    console.log(`[xScraper] "${keyword}" → ${currentUrl}`);

    const feedLoaded = await page
      .waitForSelector('[data-testid="primaryColumn"]', { timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    if (!feedLoaded) {
      console.warn(`[xScraper] No primaryColumn for "${keyword}" (url: ${currentUrl})`);
      return [];
    }

    // Wait for tweets; if X shows "Something went wrong" error, click Retry then reload
    let gotTweets = await page
      .waitForSelector('article[data-testid="tweet"]', { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!gotTweets) {
      const hasError = (await page.locator('text=Something went wrong').count()) > 0;
      if (hasError) {
        console.warn(`[xScraper] "${keyword}" — X error, clicking Retry...`);
        await page.locator('text=Retry').first().click().catch(() => {});
        await page.waitForTimeout(3_000);
        gotTweets = await page
          .waitForSelector('article[data-testid="tweet"]', { timeout: 12_000 })
          .then(() => true)
          .catch(() => false);
      }
    }

    if (!gotTweets) {
      console.warn(`[xScraper] "${keyword}" — reloading as last resort...`);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForTimeout(3_500);
      gotTweets = await page
        .waitForSelector('article[data-testid="tweet"]', { timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
    }

    if (!gotTweets) {
      console.warn(`[xScraper] No tweets rendered for "${keyword}" — empty results or rate-limited`);
      return [];
    }

    for (let scroll = 0; scroll < maxScrolls; scroll++) {
      const articles = page.locator('article[data-testid="tweet"]');
      const count = await articles.count();

      for (let i = 0; i < count; i++) {
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
          authorId: handle,
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
          recentPosts: [],
        });
      }

      await page.evaluate("window.scrollBy(0, 1500)");
      await page.waitForTimeout(1_500 + Math.random() * 1_000);
    }

    console.log(`[xScraper] "${keyword}" → ${found.length} tweets`);
    return found;
  } finally {
    await page.close();
  }
}

// ── Full keyword set scrape → fills the pool ─────────────────────────────────
async function fillPool(keywords: Keywords): Promise<void> {
  const allKeywords = [
    ...keywords.leadFinding,
    ...keywords.competitorAnalysis,
    ...keywords.marketResearch,
  ].filter(Boolean);

  if (allKeywords.length === 0) return;

  const b = await getBrowser();
  // One shared context for the whole fill — avoids re-creating browser contexts per keyword
  const ctx = await makeContext(b);

  try {
    // Warm up: let X set ct0 and other session cookies before hitting search
    const authed = await warmUp(ctx);
    if (!authed) {
      console.warn("[xScraper] Aborting fill — not authenticated");
      return;
    }

    const CONCURRENCY = 3; // 3 parallel searches within the same context
    const before = pool.size;

    for (let i = 0; i < allKeywords.length; i += CONCURRENCY) {
      const batch = allKeywords.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((kw) => scrapeKeywordPage(kw, ctx, 15))
      );
      results.forEach((r, j) => {
        if (r.status === "fulfilled") {
          r.value.forEach((post) => pool.set(post.id, post));
        } else {
          console.error(`[xScraper] "${batch[j]}" failed:`, r.reason?.message ?? r.reason);
        }
      });
      if (i + CONCURRENCY < allKeywords.length) {
        await new Promise((r) => setTimeout(r, 2_000));
      }
    }

    // Save full session state (ct0 + auth_token) so next run doesn't need warm-up
    try {
      await ctx.storageState({ path: AUTH_JSON_PATH });
      console.log("[xScraper] Session saved to auth.json");
    } catch {}

    lastRefresh = Date.now();
    const added = pool.size - before;
    console.log(`[xScraper] Pool: ${before} → ${pool.size} tweets (+${added})`);

    // Persist new posts to Supabase so the next server restart skips scraping
    if (added > 0 && isSupabaseConfigured()) {
      upsertPosts(Array.from(pool.values()), poolKeyHash).catch((e) =>
        console.error("[xScraper] Supabase upsert failed:", e.message)
      );
    }
  } finally {
    await ctx.close();
  }
}

function triggerBackgroundFill(keywords: Keywords): void {
  if (fillInProgress) return;
  fillInProgress = true;
  fillPool(keywords)
    .catch((e) => console.error("[xScraper] Background fill failed:", e.message))
    .finally(() => { fillInProgress = false; });
}

// ── Public API ───────────────────────────────────────────────────────────────
// Stale-while-revalidate: always return cached data instantly, refresh in background.
// Only blocks on the very first load when nothing exists anywhere.
export async function scrapeXSearch(keywords: Keywords): Promise<XPost[]> {
  const key = cacheKey(keywords);
  lastKeywords = keywords;

  if (poolKeyHash !== key) {
    pool.clear();
    poolKeyHash = key;
    lastRefresh = 0;
  }

  const stale = Date.now() - lastRefresh > REFRESH_INTERVAL;

  // 1. In-memory pool has data — return immediately
  if (pool.size > 0) {
    if (stale) triggerBackgroundFill(keywords);
    return Array.from(pool.values());
  }

  // 2. Check Supabase (fast ~100ms) — accept up to 60min stale for instant response
  if (isSupabaseConfigured()) {
    const cached = await fetchCachedPosts(key, 60 * 60 * 1000);
    if (cached && cached.length > 0) {
      cached.forEach((p) => pool.set(p.id, p));
      lastRefresh = Date.now();
      console.log(`[xScraper] Serving ${cached.length} posts from Supabase, refreshing in background`);
      triggerBackgroundFill(keywords);
      return Array.from(pool.values());
    }
  }

  // 3. Nothing cached anywhere — block on first scrape only
  console.log("[xScraper] Cold start — blocking on first scrape");
  if (!fillInProgress) {
    fillInProgress = true;
    try {
      await fillPool(keywords);
    } finally {
      fillInProgress = false;
    }
  } else {
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (!fillInProgress) { clearInterval(check); resolve(); }
      }, 500);
    });
  }

  return Array.from(pool.values());
}

// ── Background refresh loop ──────────────────────────────────────────────────
export function startBackgroundScraper(): void {
  const tick = async () => {
    try {
      if (lastKeywords && hasAuth()) {
        await fillPool(lastKeywords);
      }
    } catch (err) {
      console.error("[xScraper background]", err);
    } finally {
      setTimeout(tick, REFRESH_INTERVAL);
    }
  };
  setTimeout(tick, REFRESH_INTERVAL);
  console.log("[xScraper] Background scraper scheduled (every 10 min)");
}

export function poolSize(): number {
  return pool.size;
}
