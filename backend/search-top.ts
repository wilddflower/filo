import "dotenv/config";
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const AUTH_JSON_PATH = path.join(process.cwd(), "auth.json");

const QUERIES = [
  "how do I get my first users",
  "how to get first paying customers saas",
  "struggling to get users founder",
  "what distribution channels actually work",
  "how to find customers for my startup",
  "can't get traction founder",
  "how to get users for my saas",
  "nobody is signing up for my product",
  "how did you get your first 100 users",
  "looking for distribution advice founder",
];

function parseCount(text: string): number {
  if (!text) return 0;
  const clean = text.trim().replace(",", "");
  if (clean.endsWith("K")) return Math.round(parseFloat(clean) * 1_000);
  if (clean.endsWith("M")) return Math.round(parseFloat(clean) * 1_000_000);
  return parseInt(clean) || 0;
}

async function searchTop(query: string, ctx: any, maxScrolls = 8) {
  const page = await ctx.newPage();
  const found: any[] = [];
  const seenIds = new Set<string>();
  try {
    const url = `https://x.com/search?q=${encodeURIComponent(query)}&f=top`;
    console.log(`\nSearching: "${query}"`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(3_000);
    const gotTweets = await page.waitForSelector('article[data-testid="tweet"]', { timeout: 12_000 }).then(() => true).catch(() => false);
    if (!gotTweets) { console.log(`  → no tweets`); return []; }

    for (let scroll = 0; scroll < maxScrolls; scroll++) {
      const articles = page.locator('article[data-testid="tweet"]');
      const count = await articles.count();
      for (let i = 0; i < count; i++) {
        const article = articles.nth(i);
        const linkHref = await article.locator('a[href*="/status/"]').first().getAttribute("href").catch(() => null);
        const tweetId = linkHref?.split("/status/")?.[1]?.split("?")?.[0];
        if (!tweetId || seenIds.has(tweetId)) continue;
        seenIds.add(tweetId);
        const text = await article.locator('[data-testid="tweetText"]').first().innerText().catch(() => "");
        if (!text || text.length < 30) continue;
        const timeEl = await article.locator("time").first().getAttribute("datetime").catch(() => "");
        const handle = ((await article.locator('[data-testid="User-Name"] a').first().getAttribute("href").catch(() => "/unknown")) ?? "/unknown").replace("/", "");
        const displayName = (await article.locator('[data-testid="User-Name"]').first().innerText().catch(() => handle)).split("\n")[0].trim();
        const likes = parseCount(await article.locator('[data-testid="like"] span').first().innerText().catch(() => "0"));
        const retweets = parseCount(await article.locator('[data-testid="retweet"] span').first().innerText().catch(() => "0"));
        const replies = parseCount(await article.locator('[data-testid="reply"] span').first().innerText().catch(() => "0"));
        found.push({ id: tweetId, handle, name: displayName, text: text.trim(), likes, retweets, replies, date: timeEl });
      }
      await page.evaluate("window.scrollBy(0, 1500)");
      await page.waitForTimeout(1_500 + Math.random() * 800);
    }
    console.log(`  → ${found.length} posts`);
    return found;
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"] });
  const ctx = await browser.newContext({ storageState: AUTH_JSON_PATH, userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript("Object.defineProperty(navigator, 'webdriver', { get: () => undefined })");

  console.log("Warming up...");
  const warmPage = await ctx.newPage();
  await warmPage.goto("https://x.com/home", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await warmPage.waitForTimeout(4_000);
  const ok = await warmPage.waitForSelector('[data-testid="primaryColumn"]', { timeout: 12_000 }).then(() => true).catch(() => false);
  await warmPage.close();
  if (!ok) { console.error("Auth failed"); await browser.close(); process.exit(1); }
  console.log("Auth OK\n");

  const all: any[] = [];
  const seen = new Set<string>();
  for (const query of QUERIES) {
    const results = await searchTop(query, ctx);
    for (const r of results) { if (!seen.has(r.id)) { seen.add(r.id); all.push(r); } }
    await new Promise(r => setTimeout(r, 2_000));
  }
  await ctx.close();
  await browser.close();

  // Filter: must look like a genuine question/ask, not a tip thread or self-promo
  const asking = all.filter(p => {
    const t = p.text.toLowerCase();
    const isAsk = /\?/.test(t) || /struggling|can't get|nobody|no one|how do i|how did|how to|anyone|advice|help|what worked|what channel|looking for/.test(t);
    const isFounder = /founder|saas|startup|indie|build|launch|product|mrr|app/.test(t);
    const notNoise = !/taylor swift|kpop|trump|crypto|nft|bitcoin|anime|manga|god|prayer|congress|fursuit|polymarket|nigeria|kenya|instagram|tiktok|youtube|onlyfans/i.test(t);
    const notPitch = !/i help|dm me|book a call|check out my|follow me|link in bio|buy now|sign up|my tool|my product|i built|i made/i.test(t);
    return isAsk && isFounder && notNoise && notPitch;
  });

  asking.sort((a, b) => (b.likes + b.retweets * 2 + b.replies) - (a.likes + a.retweets * 2 + a.replies));

  console.log(`\n${"=".repeat(60)}`);
  console.log(`ASKING POSTS: ${asking.length} of ${all.length} total`);
  console.log("=".repeat(60));
  asking.slice(0, 20).forEach((p, i) => {
    console.log(`\n--- #${i+1} @${p.handle} | ${p.likes}L ${p.retweets}RT ${p.replies}R | ${p.date} ---`);
    console.log(p.text);
  });

  fs.writeFileSync("ask-results.json", JSON.stringify(asking, null, 2));
  console.log("\nSaved to ask-results.json");
})();
