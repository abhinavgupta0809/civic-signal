# CivicSignal

**CivicSignal is an AI-powered credibility assistant that helps people evaluate news articles** — it extracts the checkable claims, scores credibility across four signals, grounds the most important signal in a human-reviewed source-rating dataset, and explains *why* it reached its verdict. Built with a special focus on election-related misinformation.

Paste an article (or analyze the current tab via the Chrome extension) → get a **0–100 credibility score**, a verdict badge, a plain-English summary, a **four-signal breakdown**, **3–5 extracted claims** with Supported / Disputed / Unverified pills, and an **election-warning banner** when relevant.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS, and the Anthropic Claude API.

---

## 🎯 The problem

Today's information ecosystem is hard to navigate. Readers constantly hit:

- Misinformation and unverified claims
- Emotionally manipulative framing
- Conflicting narratives across sources

Verifying any of it by hand is slow and unrealistic at the speed people actually read.

## 💡 The solution

CivicSignal acts as a **real-time credibility assistant** in two surfaces that share one backend:

- **🌐 Web app** — paste any article and get claims, a credibility score, and the reasoning behind it.
- **🧩 Chrome extension (MV3)** — analyze the page you're on in one click. The extension never calls Claude directly; it sends page text to your local `/api/analyze` route so your API key stays server-side.

---

## 🧠 How credibility is scored

The score is the sum of four signals (each 0–25). Three are reasoned by Claude; the most consequential one — **source credibility — is grounded in real data, not the model's memory.**

| Signal | Source of truth |
| --- | --- |
| **Source credibility** | **Media Bias/Fact Check (MBFC)** human-reviewed ratings — *authoritative when the publisher is known* |
| Claim corroboration | Claude's structured reasoning |
| Fact-check alignment | Claude's structured reasoning |
| Manipulation language | Claude's structured reasoning |

### Source credibility is grounded, not guessed

A pure-LLM credibility score is unverifiable and can be hallucinated. So when a request includes a domain (typed in the web app, or auto-detected by the extension), CivicSignal looks it up in a curated [Media Bias/Fact Check](https://mediabiasfactcheck.com) dataset (`lib/mbfc.ts`) and treats that rating as authoritative:

1. **Injected as ground truth** — the MBFC rating is passed into the prompt so Claude's reasoning and summary stay consistent with it.
2. **Deterministic override** — after parsing, `applyMbfcOverride()` replaces `source_credibility` with a fixed score derived from MBFC's Factual Reporting level (Very High → 25 … Very Low → 1). No model guesswork.
3. **Credibility cap** — MBFC's credibility bucket caps the overall score: a `Low`-credibility outlet can't exceed the "Low Credibility" band, and a `Medium` one can't reach "High Confidence" — *no matter how clean the article reads.* The verdict is re-derived from the capped score.

When no rating exists for a domain, the model estimates the signal and the UI shows no "MBFC verified" badge — the tool is explicit about which signals are grounded vs. estimated. To extend coverage, swap the curated array in `lib/mbfc.ts` for the full official MBFC dataset; the lookup and scoring code stays the same.

> **Why this matters:** it turns "trust the AI's number" into "trust a human-reviewed rating, with the AI doing the reading." That distinction — grounding model output in authoritative data and being transparent about confidence — is the core product idea.

---

## 🤖 Claude as the core intelligence layer

Claude isn't just an API call here — it's the reasoning engine, used for **structured extraction, scoring, and explainability**, not free-form text.

**1. Claim extraction** — Claude turns raw article text into structured data, pulling 3–5 *checkable* claims (events, policies, statistics) and skipping opinion and prediction.

**2. Structured credibility scoring** — Claude returns a strict JSON object the app parses and validates with zod, falling back to a safe `Unverifiable` result rather than crashing on malformed output:

```json
{
  "score": 42,
  "verdict": "Mixed Evidence",
  "summary": "The article makes several claims with limited corroboration and uses emotionally loaded language.",
  "election_related": false,
  "signals": {
    "source_credibility": 10,
    "claim_corroboration": 12,
    "fact_check_match": 8,
    "manipulation_language": 12
  },
  "claims": [
    { "claim": "…", "status": "Unverified", "source": "Model assessment" }
  ]
}
```

---

## 🏗️ Architecture

```
app/page.tsx ──POST──▶ /api/analyze/route.ts
                           │
                           ├─ detectElectionContent()   (lib/scoring.ts)
                           ├─ lookupMbfc(domain)        (lib/mbfc.ts)       ◀ authoritative source rating
                           ├─ buildAnalysisPrompt()     (lib/anthropic.ts)  — MBFC injected as ground truth
                           ├─ callClaude()              (claude-haiku-4-5)
                           ├─ parseModelResponse()      (zod + safe fallback)
                           └─ applyMbfcOverride()       (lib/mbfc.ts)       ◀ MBFC governs source_credibility + caps score
```

- **`lib/scoring.ts`** — keyword-based election detection, score→color mapping, and a verdict-band fallback if the model returns an invalid label.
- **`lib/mbfc.ts`** — curated MBFC dataset, domain lookup (with subdomain fallback), deterministic scoring, and the override that makes MBFC authoritative.
- **`lib/anthropic.ts`** — prompt builder, Claude client, and a tolerant JSON parser that validates with zod.
- **`app/api/analyze/route.ts`** — thin orchestrator: validates input, runs the pipeline, returns structured JSON or a friendly error.

The `lib/` modules have zero Next.js dependencies, so the same code can be reused from a service worker or other runtime.

---

## 🚀 Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure your API key
cp .env.local.example .env.local
# then open .env.local and set ANTHROPIC_API_KEY=sk-ant-...

# 3. Run the dev server
npm run dev
```

Open <http://localhost:3000>. Get an Anthropic API key at <https://console.anthropic.com/>.

No key is needed for MBFC lookups — the curated dataset ships in `lib/mbfc.ts`.

---

## 🧩 Running the Chrome extension

The Manifest V3 extension in [`extension/`](extension/) is a second UI on top of the same backend. It sends extracted page text to your local `/api/analyze` route, so your API key never leaves the server.

```
News article tab
  └─ extension/content.js     (extracts title / url / domain / text)
       └─ extension/popup.js   (renders the result)
            └─ extension/background.js
                 └─ POST http://localhost:3000/api/analyze   (your Next.js app)
                      └─ Anthropic Claude
```

1. Start the backend (`npm run dev`) — the extension expects it at `http://localhost:3000`. If Next.js falls back to another port, free up 3000 or update `API_URL` in [`extension/background.js`](extension/background.js).
2. Open `chrome://extensions`, toggle **Developer mode**, click **Load unpacked**, and select the `extension/` folder.
3. Open any news article, click the CivicSignal icon, and the popup renders the score, verdict, summary, signal bars (with the MBFC badge), and claims.

**Debugging:** popup logs via right-click → *Inspect popup*; background logs via the *service worker* link on the extension card. All logs use the `[CivicSignal]` prefix.

---

## 📁 Project structure

```
app/
  layout.tsx
  page.tsx
  globals.css
  api/analyze/route.ts
components/
  ScoreCard.tsx
  SignalBars.tsx        (renders the MBFC "verified" badge)
  ClaimsList.tsx
  ElectionBanner.tsx
  ExampleLoader.tsx
lib/
  types.ts
  scoring.ts
  mbfc.ts               (MBFC dataset, lookup, deterministic override)
  anthropic.ts
extension/
  manifest.json  background.js  content.js  popup.html  popup.css  popup.js
```

---

## 🗺️ Limitations & roadmap

The pipeline is split into named stages so real fact-checking slots in cleanly:

| Stage | Status |
| --- | --- |
| MBFC source rating | ✅ Done — looked up before the prompt and applied as an authoritative override. Swap the curated array for the full MBFC dataset to extend coverage. |
| Chrome extension (MV3) | ✅ Done — shares the backend; API key stays server-side. |
| Google Fact Check Claim Search | Planned — call after `lookupMbfc`, pass results into the prompt as `RELATED FACT CHECKS`. |
| Tavily / Serper live search | Planned — extract claims in a first pass, search each, then score with results in hand. |

Other notes:
- The MBFC dataset is a curated snapshot of well-known publishers, not the full live database. MBFC ratings change over time; refresh from the official dataset for production.
- MBFC grounding only applies when a domain is provided — the extension auto-detects it; in the web app, enter the source domain to enable it.
- Article extraction in the extension is a simple `article` → `main` → `body.innerText` heuristic; script-heavy pages may yield noisy text (Mozilla Readability could be added).
- No database or auth — analysis is stateless. The extension keeps a per-session in-memory cache by URL.

---

CivicSignal is an **assistive credibility signal, not a final source of truth.** Always verify voting procedures, deadlines, and eligibility against your official state or provincial election authority.
