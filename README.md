# CivicSignal

A minimal, demo-first MVP that analyzes an article's credibility and surfaces checkable claims.

Paste an article → click **Analyze** → get a 0–100 credibility score, verdict badge, plain-English summary, a four-signal breakdown, 3–5 extracted claims with Supported / Disputed / Unverified pills, and an election-warning banner when relevant.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS, and the Anthropic Claude API.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure your API key
cp .env.local.example .env.local
# then open .env.local and set ANTHROPIC_API_KEY=sk-ant-...

# 3. Run the dev server
npm run dev
```

Open <http://localhost:3000>.

Get an Anthropic API key at <https://console.anthropic.com/>.

---

## How it works

```
app/page.tsx ──POST──▶ /api/analyze/route.ts
                           │
                           ├─ detectElectionContent()   (lib/scoring.ts)
                           ├─ buildAnalysisPrompt()     (lib/anthropic.ts)
                           ├─ callClaude()              (claude-haiku-4-5)
                           └─ parseModelResponse()      (zod + safe fallback)
```

- **`lib/scoring.ts`** – keyword-based election detection, score→color mapping, and a verdict-band fallback if the model ever returns an invalid label.
- **`lib/anthropic.ts`** – prompt builder, Claude client, and a tolerant JSON parser that validates with zod and never crashes on malformed output.
- **`app/api/analyze/route.ts`** – thin orchestrator: validates input, runs the pipeline, returns structured JSON or a friendly error.

The `lib/` folder has zero Next.js dependencies, so the same modules can later be reused from a Chrome-extension background service worker.

---

## Extending it

The pipeline is split into named stages so real fact-checking slots in cleanly:

| Stage | Where to add it |
| --- | --- |
| Google Fact Check Claim Search | Call after `detectElectionContent`, before `buildAnalysisPrompt`. Pass results into the prompt as `RELATED FACT CHECKS`. |
| Tavily / Serper live search | Wrap per-claim: extract claims in a first Claude pass, search each, then run the scoring prompt with results. |
| Chrome extension (MV3) | Reuse `lib/scoring.ts` + `lib/anthropic.ts` from `background.js`. Build a popup that calls the same prompt/parsing code. |

---

## Project structure

```
app/
  layout.tsx
  page.tsx
  globals.css
  api/analyze/route.ts
components/
  ScoreCard.tsx
  SignalBars.tsx
  ClaimsList.tsx
  ElectionBanner.tsx
  ExampleLoader.tsx
lib/
  types.ts
  scoring.ts
  anthropic.ts
```

---

## Notes

- No database, no auth, no caching. MVP scope only.
- The analysis is an assistive signal, not a verdict. The footer disclaimer says as much.
- Claude is asked for JSON only; if the response is malformed the app returns an `Unverifiable` result instead of crashing.
