# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RedRover for X — AI-powered buyer intent agent for X (Twitter). Monitors X posts for buying signals, scores them via LLM (1–10 intent confidence), and surfaces a prioritized lead dashboard with AI-drafted reply suggestions. Built for Clover Labs TPM application by Pavni Labade.

## Commands

### Frontend (Next.js — port 3000)

```bash
cd frontend
npm install
npm run dev        # dev server
npm run build      # production build
npm run type-check # TypeScript check without building
npm run lint       # ESLint
```

### Backend (Node.js/Express — port 3001)

```bash
cd backend
npm install
npm run dev        # tsx watch (hot reload)
npm run build      # tsc → dist/
npm run start      # run compiled output
```

Both must run simultaneously for the full app. Frontend proxies `/api/*` → `http://localhost:3001` via `next.config.ts`.

## Architecture

### Frontend (`frontend/src/`)

- **App Router** (`app/`) — pages: `/dashboard`, `/analytics`, `/saved`, `/settings`. Root redirects to `/dashboard`.
- **`components/layout/AppShell`** — outer chrome: floating left icon rail + top nav pill bar. Wraps every page. Active page is passed as a prop.
- **`components/leads/`** — core feature components:
  - `LeadDashboard` — state owner for filters + selected lead. Renders `LeadListPanel` + `LeadDetail` in a 40/60 split.
  - `LeadListPanel` — score/follower filters, scrollable list of `LeadCard`s.
  - `LeadCard` — compact card showing score chip, keyword pill, avatar, excerpt.
  - `LeadDetail` — full post context, intent score + rationale, Reply/DM/Save action tabs with tone selector and AI reply templates.
- **`lib/types.ts`** — shared TypeScript types (`Lead`, `LeadFilters`, `ScoreTier`, `Tone`, etc.)
- **`lib/data/mockLeads.ts`** — 10 hardcoded X posts with full lead metadata, reply templates per tone (`helpful` / `informative` / `promotional`), and DM templates. This is the MVP data layer — no API calls yet.
- **Styling** — CSS Modules (`.module.css` per component) + `styles/globals.css` for design tokens. Design language: glassy frosted surfaces (`backdrop-filter: blur`), `--accent: #FF5833` orange-red, Geist font, `oklch()` avatar gradients.

### Backend (`backend/src/`)

- **`data/mockPosts.ts`** — 12 hardcoded `XPost` objects (10 high-signal buying intent + 2 low-signal noise), plus `INTENT_KEYWORDS` array.
- **`services/intentScorer.ts`** — rule-based scorer for MVP. Produces score (1–10), confidence level, matched keywords, and rationale bullets. Scoring factors: keyword match, competitor mention, follower count, ICP bio keywords, urgency terms. **Replace with Claude API call in next iteration.**
- **Routes**: `GET /api/leads` returns all posts scored + sorted; `POST /api/scoring` scores an arbitrary post body; `GET /api/health`.

### Key design decisions

- **No auto-posting** — a hard constraint from the PRD. All reply/DM actions are copy-to-clipboard only. The `LeadDetail` component enforces this with a visible disclaimer.
- **Score tiers**: `hi` = 7–10 (accent red), `md` = 4–6 (amber), `lo` = 1–3 (grey). Used for card color coding and filter segmented control.
- **Intent scorer is swappable** — the `scorePost(post: XPost): ScoredPost` interface in `intentScorer.ts` is designed so the rule-based logic can be replaced with a Claude API call without changing any routes or frontend types.
- **CSS Modules** — each component has its own `.module.css`. Global design tokens live in `globals.css` as CSS custom properties. Do not add Tailwind or CSS-in-JS.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. The
skill has multi-step workflows, checklists, and quality gates that produce better
results than an ad-hoc answer. When in doubt, invoke the skill. A false positive is
cheaper than a false negative.

Key routing rules:

- Product ideas, "is this worth building", brainstorming → invoke /office-hours
- Strategy, scope, "think bigger", "what should we build" → invoke /plan-ceo-review
- Architecture, "does this design make sense" → invoke /plan-eng-review
- Design system, brand, "how should this look" → invoke /design-consultation
- Design review of a plan → invoke /plan-design-review
- Developer experience of a plan → invoke /plan-devex-review
- "Review everything", full review pipeline → invoke /autoplan
- Bugs, errors, "why is this broken", "wtf", "this doesn't work" → invoke /investigate
- Test the site, find bugs, "does this work" → invoke /qa (or /qa-only for report only)
- Code review, check the diff, "look at my changes" → invoke /review
- Visual polish, design audit, "this looks off" → invoke /design-review
- Developer experience audit, try onboarding → invoke /devex-review
- Ship, deploy, create a PR, "send it" → invoke /ship
- Merge + deploy + verify → invoke /land-and-deploy
- Configure deployment → invoke /setup-deploy
- Post-deploy monitoring → invoke /canary
- Update docs after shipping → invoke /document-release
- Weekly retro, "how'd we do" → invoke /retro
- Second opinion, codex review → invoke /codex
- Safety mode, careful mode, lock it down → invoke /careful or /guard
- Restrict edits to a directory → invoke /freeze or /unfreeze
- Upgrade gstack → invoke /gstack-upgrade
- Save progress, "save my work" → invoke /context-save
- Resume, restore, "where was I" → invoke /context-restore
- Security audit, OWASP, "is this secure" → invoke /cso
- Make a PDF, document, publication → invoke /make-pdf
- Launch real browser for QA → invoke /open-gstack-browser
- Import cookies for authenticated testing → invoke /setup-browser-cookies
- Performance regression, page speed, benchmarks → invoke /benchmark
- Review what gstack has learned → invoke /learn
- Tune question sensitivity → invoke /plan-tune
- Code quality dashboard → invoke /health
