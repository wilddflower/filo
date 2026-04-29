# X Scraping — How It Works

## Overview

The scraper is a Playwright-based browser automation layer that logs into X (Twitter) as a real user, runs keyword searches, and pulls tweet data from the live page. It does **not** use the official X API (too expensive, banned for scraping use cases). Instead it drives a real Chromium browser using saved session cookies.

---

## Authentication

### One-time setup: `save-auth.js`

Run `node save-auth.js` from the `backend/` directory. This opens a **real, visible Chrome window** and navigates to `x.com/login`. You log in manually with your X username and password (Google Sign-In does NOT work — it requires a real popup flow Playwright can't handle). Once you're redirected to the home feed, the script saves the full browser session — all cookies including `auth_token` and `ct0` — to `backend/auth.json`.

```
node save-auth.js
# → browser window opens
# → you log in manually
# → window closes, auth.json saved
# → restart backend
```

### What `auth.json` contains

It's a Playwright storage state file: a JSON blob with every cookie from `x.com` and `twitter.com`, including:

- **`auth_token`** — the session token that identifies your account
- **`ct0`** — the CSRF token X requires on every API call; expires and must be refreshed
- `twid`, `guest_id`, and a dozen other tracking cookies X uses internally

### Alternative: `X_AUTH_TOKEN` env var

If you set `X_AUTH_TOKEN` in `.env`, the scraper injects the raw token as a cookie instead of reading `auth.json`. However, `ct0` is missing in this path so a warm-up visit to `x.com/home` is required to let X generate it.

`hasAuth()` returns true if either `auth.json` has an `auth_token` cookie OR `X_AUTH_TOKEN` is set.

---

## Session Warm-Up

Before any keyword search, the scraper calls `warmUp()`:

1. Opens a new page in the shared browser context
2. Navigates to `https://x.com/home` and waits 4 seconds
3. Checks for `[data-testid="primaryColumn"]` — X's main feed container
4. If found → session is live, ct0 is set, proceed
5. If not found → logs a warning, aborts the fill

This is necessary because `auth_token` alone is not enough. X's server generates `ct0` dynamically when you visit the site. Without ct0, authenticated search requests return 403s or redirect to login.

After every fill, the updated session (including refreshed `ct0`) is saved back to `auth.json` so the next fill skips warm-up or has a faster one.

---

## The Scrape Loop

### `fillPool(keywords)`

Called on first load and every 10 minutes in the background.

1. Combines all keywords from all three buckets (lead finding, competitor analysis, market research)
2. Launches one shared Playwright browser context (one browser, one login session)
3. Runs warm-up
4. Iterates through keywords in batches of 3 (parallel within the same context)
5. For each keyword: calls `scrapeKeywordPage()`
6. All found posts are merged into the in-memory `pool` Map (deduped by tweet ID)
7. After all keywords: saves updated session back to `auth.json`
8. If Supabase is configured and new posts were added: upserts the full pool to Supabase in the background

### `scrapeKeywordPage(keyword, ctx, maxScrolls = 15)`

For each keyword:

1. Opens `https://x.com/search?q=<keyword>&f=live` (`f=live` = "Latest" tab — chronological, not algorithmic)
2. Waits for `article[data-testid="tweet"]` to appear
3. If X shows "Something went wrong": clicks Retry, waits, tries again
4. If still no tweets: does a hard `page.reload()` as last resort
5. Scrolls 15 times (1500px per scroll, 1.5–2.5s delay each, randomized to avoid rate limiting)
6. On each scroll, reads all visible tweet `<article>` elements and extracts:

| Field | Selector |
|---|---|
| Tweet ID | `a[href*="/status/"]` → parse the status ID |
| Text | `[data-testid="tweetText"]` |
| Timestamp (ISO) | `<time datetime="...">` |
| Handle | `[data-testid="User-Name"] a[href]` → strip leading `/` |
| Display name | `[data-testid="User-Name"]` innerText, first line |
| Likes | `[data-testid="like"] span` |
| Retweets | `[data-testid="retweet"] span` |
| Replies | `[data-testid="reply"] span` |

7. Skips duplicates by tracking `seenIds` per page
8. Skips posts with text shorter than 10 characters

**What is NOT scraped:** follower count and bio. These require navigating to each user's profile page — too slow to do for hundreds of posts. That's why `authorFollowers` is always `0` and `authorBio` is always `""` for live-scraped posts. The rule-based scorer handles missing bio gracefully (bio is a secondary signal only).

### Engagement count parsing (`parseCount`)

X renders counts as `"1.2K"`, `"3.4M"`, or plain integers. `parseCount()` handles all three and returns a number.

---

## In-Memory Pool (Stale-While-Revalidate)

```
const pool = new Map<string, XPost>()  // tweet ID → XPost
```

The pool is a singleton Map that lives for the lifetime of the backend process.

Cache key = all keywords sorted and joined with `|`. If keywords change, pool is cleared.

**Request flow:**

```
POST /api/leads/search
  ↓
pool.size > 0?  → YES → return pool immediately
                          if stale (>10 min): trigger background fill
  ↓ NO
Supabase configured?  → YES → fetch cached posts (up to 60min old)
                              load into pool, trigger background fill, return
  ↓ NO / empty
Cold start: block on fillPool()  → scrape all keywords synchronously
                                    return result
```

First load with no cache takes ~60–90 seconds (warm-up + 15 scrolls × N keywords). Every subsequent request is instant (pool is already warm). Background fill keeps the pool fresh every 10 minutes without blocking any requests.

---

## Supabase Persistence Layer

When Supabase is configured (`SUPABASE_URL` + `SUPABASE_ANON_KEY` in `.env`), the scraper writes to and reads from the `scraped_posts` table:

**Schema (relevant columns):**
```sql
id                text PRIMARY KEY
text              text
author_handle     text
author_name       text
author_followers  int
author_bio        text
created_at_x      timestamptz  -- the tweet's original timestamp
likes             int
retweets          int
replies_count     int
keyword_set_hash  text         -- which keyword set produced this post
scraped_at        timestamptz  -- when we scraped it
```

**Fetch fallback chain (3 tiers):**

1. Exact `keyword_set_hash` match, scraped within the last 60 minutes
2. `keyword_set_hash = "mega-scrape"` — a one-time bulk scrape of ~976 posts, no age limit (permanent reference data)
3. Any posts scraped in the last 30 days (catches hash changes from keyword edits)

The mega-scrape is the current data source since the X session is only active when explicitly configured. Those 976 posts scored through the rule-based filter produce ~20 quality leads (score ≥ 4).

---

## Background Refresh Loop

`startBackgroundScraper()` is called once at server startup. It fires `fillPool()` every 10 minutes using a self-scheduling `setTimeout` chain (not `setInterval`, so it can't stack up). It only runs if `hasAuth()` is true — if no X session is configured the loop is a no-op.

```
server start
  → startBackgroundScraper()
  → waits 10 min
  → fillPool(lastKeywords)
  → waits 10 min
  → fillPool(lastKeywords)
  → ...
```

`lastKeywords` is updated every time `scrapeXSearch()` is called, so the background loop always refreshes with the most recent keyword set.

---

## Known Limitations

| Limitation | Why |
|---|---|
| No follower count or bio | Requires a profile page visit per user — too slow at scale |
| Rate limiting | X can throttle search results if too many queries hit in quick succession; the 2s batch delay + randomized scroll delay mitigates this but doesn't eliminate it |
| Session expiry | `auth_token` and `ct0` can expire; if `warmUp()` fails the fill is aborted silently and stale data is served |
| ~2% signal rate | 976 posts in pool, ~20 pass score ≥ 4 filter; pool quality depends on keyword specificity |
| headless detection | Anti-bot measures on X are aggressive; the scraper patches `navigator.webdriver` and uses a real Chrome user-agent string, but fingerprinting can still fail |
| No profile scraping | `authorBio` is always empty for live posts, so the bio-based scoring bonus never fires on live data |

---

## Setup Checklist

```bash
cd backend

# 1. Install dependencies (includes playwright)
npm install
npx playwright install chromium

# 2. Create .env
echo "GROQ_API_KEY=your_key" >> .env
echo "SUPABASE_URL=your_url" >> .env        # optional
echo "SUPABASE_ANON_KEY=your_key" >> .env   # optional

# 3. Save X session
node save-auth.js
# → log in to x.com in the window that opens
# → auth.json saved automatically

# 4. Start backend
npm run dev
# → "[xScraper] Background scraper scheduled (every 10 min)"
# → first POST /api/leads/search triggers cold fill (~60-90s)
```
