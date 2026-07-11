# CivicSignal — Agent Savepoint

> Handoff doc so a fresh agent session can resume cheaply without re-reading the
> whole codebase/history. Last updated: 2026-07-11. Read this first, then only
> open the specific files you need.

## What the project is

CivicSignal — an AI news-credibility tool. Two builds sharing one pipeline:
- **Website** (Next.js 15 App Router, TS, Tailwind): server pipeline in `lib/`, API at `app/api/analyze/route.ts`. Uses the maintainer's Anthropic key.
- **Chrome extension (MV3)**: standalone, dependency-free port of the pipeline in `extension/lib.js`, calls Anthropic directly with the user's own key.

Deployed on Replit (Autoscale): <https://civic-signal.replit.app>
GitHub: `abhinavgupta0809/civic-signal` (branch `main`).

### CRITICAL deploy note
Replit does NOT auto-deploy from GitHub. After pushing, the user must, in the
Replit **Shell**: `git pull origin main` then **Republish**. Every past
"it's still broken" turn was because the Repl workspace hadn't pulled.

## Pipeline (how an analysis flows)
`route.ts` → `fetchArticle` (lib/extract.ts, SSRF-guarded) → `analyzeArticle`
(lib/analyze.ts) → election detect (lib/scoring.ts) → `lookupMbfc` (lib/mbfc.ts)
→ `buildAnalysisPrompt` + `callClaude` (lib/anthropic.ts, model `claude-haiku-4-5`)
→ `parseModelResponse` (zod, safe fallback) → `applyMbfcOverride`.
`extension/lib.js` mirrors ALL of this — keep the two in sync on any logic change.

## Work done this session (all committed & pushed to main)
- `019f823` Fix URL-fetch 403s: send browser-like headers (`BROWSER_HEADERS` in lib/extract.ts). Many publishers 403 a bot UA.
- `1140a3a` Transparency dashboard: per-signal one-sentence explanations (`signal_explanations`), claim relevance ranking (Central/Supporting/Peripheral) + per-claim `note`, "How is this scored?" panel, brand-level MBFC matching (dailymail.com matches dailymail.co.uk), temperature 0, today's-date in prompt (kills "anachronistic date" false alarm).
- `d0ebd83` Split score card: `article_accuracy` (text-only, 0-100) shown beside "source trust" tile, with a plain-English divergence note.
- `ef3986f` Live web search + ESPN fix: Anthropic built-in `web_search` tool (cap via `WEB_SEARCH_MAX_USES`, default 3, 0 disables) so recent true claims resolve to Supported w/ citation instead of Unverified. ESPN pages return empty HTTP 202 to server fetches → read via ESPN public API `now.core.api.espn.com/v1/sports/news/{id}` in lib/extract.ts. ESPN added to MBFC dataset. SDK upgraded to `@anthropic-ai/sdk` 0.110.0. Henderson case documented as fixture `eval/fixtures/articles/espn-recent-sports.txt` + case study in README.md and eval/README.md.

Current HEAD = origin/main = `ef3986f`. Working tree clean.

### 2026-07-11 savepoint
- Live URL wired in: README now has a top "Try it live" link, and
  `docs/LINKEDIN.md` uses the real `https://civic-signal.replit.app` and is
  dash-free (matches the user's "plain, human, no em-dash" preference).
- This SAVEPOINT.md is now committed (was previously untracked).
- Verified green before committing: `npm run typecheck`, `npm run build`,
  `npm run eval` (17 tests, 0 dangerous disagreements). `eval:live` NOT re-run
  (costs credits; would use the key the user is rotating).
- User is clearing context after this savepoint. They mentioned wanting to
  "fix an issue" (unspecified) next; the big planned task is still the
  Gemini + Claude tandem below.

## Key files
- `lib/anthropic.ts` — prompt, Claude call (web_search tool + graceful 400 fallback), zod parse, article_accuracy calc, claim relevance sort.
- `lib/mbfc.ts` — MBFC dataset, `lookupMbfc` (exact → subdomain → brand fallback), `applyMbfcOverride` (source override + credibility cap + MBFC-sourced explanation).
- `lib/extract.ts` — guarded fetch + `BROWSER_HEADERS` + `fetchEspnStory`.
- `lib/types.ts` — AnalysisResult incl. `article_accuracy`, `signal_explanations`, Claim `relevance`+`note`.
- `components/ScoreCard.tsx` — dual tiles + divergence note. `SignalBars.tsx` — per-signal "Why" + methodology panel. `ClaimsList.tsx` — relevance tiers.
- `extension/lib.js`, `extension/popup.js`, `extension/popup.css` — mirrored.
- Env knobs: `ANTHROPIC_API_KEY`, `RATE_IP_PER_MIN/DAY`, `RATE_GLOBAL_PER_DAY`, `WEB_SEARCH_MAX_USES`.

## Verify commands
- `npm run typecheck` — tsc.
- `npx vitest run` — 17 tests (mbfc integrity + logic). If you change AnalysisResult shape, update `eval/mbfc-logic.test.ts` baseResult().
- `npm run dev` then curl `http://localhost:3000/api/analyze` for live e2e (needs `.env.local` key; sandbox needs full_network permission).
- `npm run eval` — deterministic MBFC-vs-gold report.
- Sandbox gotchas: network calls need `required_permissions:["full_network"]`; tsx `-e` with top-level await fails (wrap in `.then()`); git push to main needs smart-mode approval.

## NEXT TASK (planned, NOT yet implemented): Gemini + Claude tandem
Goal: minimize cost, use both models. User has Google AI Ultra (Gemini grounding ~free).

Design:
- **Gemini 2.5 Flash = Researcher**: extract key claims + verify time-sensitive ones via built-in Google Search grounding (free) → return claim statuses + citations. Replaces Anthropic's billed web_search.
- **Claude Haiku = Judge**: take article + Gemini findings → final structured JSON (signals, scores, summary, relevance, notes). web_search tool OFF in tandem mode (saves the per-search fee).
- Net cost < today.

Implementation sketch:
- New `lib/gemini.ts` (Gemini client + grounded research call).
- New `lib/llm.ts` (mode selection).
- `LLM_MODE` env = `tandem` | `claude` | `gemini` (fallback/AB).
- Orchestrate in `lib/analyze.ts` (natural seam): [optional Gemini research if article time-sensitive] → Claude judge → MBFC override.
- `lib/anthropic.ts`: accept pre-verified findings, drop web_search when tandem.
- Add `GEMINI_API_KEY` + `LLM_MODE` to `.env.local.example` and `.replit`.
- Cost lever: run Gemini search only when recent dates/time words detected.
- Extension: keep single-provider for now (browser two-key juggling is messy); revisit.

Open decisions for user: exact Gemini model id (2.5 vs 2.0 flash); extension scope; default-on "search only when time-sensitive". Needs Google AI Studio key (aistudio.google.com) as a Replit secret.

## Standing user preferences
- Only commit/push when the user explicitly says so. Push is direct to `main` (their workflow) and needs approval.
- After pushing, remind them to `git pull` + Republish on Replit.
- The user's Anthropic key was pasted in chat earlier — advised rotating it.
