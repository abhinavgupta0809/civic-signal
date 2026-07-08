# CivicSignal

CivicSignal is an AI credibility assistant for news articles. It reads an article, pulls out the claims you can actually check, scores how credible it looks across four signals, and grounds the most important signal in a human-reviewed source-rating dataset. It also explains why it gave that score. It pays extra attention to election-related misinformation.

You paste an article, or you analyze the current tab with the Chrome extension. You get back a credibility score from 0 to 100, a verdict badge, a short plain-English summary, a breakdown of the four signals, 3 to 5 extracted claims (each marked Supported, Disputed, or Unverified), and an election warning banner when it is relevant.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS, and the Anthropic Claude API.

---

## 🚦 Two ways to use CivicSignal, pick one

This repo ships two separate builds. They do not depend on each other. Pick whichever suits you.

| | 🌐 Option 1: The website (hosted) | 🧩 Option 2: The Chrome extension (your own key) |
| --- | --- | --- |
| What it is | A hosted web app. Paste a link or the article text. | An unofficial Manifest V3 extension. Analyze the tab you are on in one click. |
| Whose API key | Mine (the maintainer's). You do not need any key or account. | Yours. You paste your own Anthropic key into the extension. |
| Setup | None. Just open the link and use it. | Turn on Chrome Developer mode, load the folder, add your key. |
| Cost to you | Free. It is rate-limited so my API bill stays safe. | You pay Anthropic directly. It is a fraction of a cent per analysis on Claude Haiku. |
| Limits | Per-IP and daily caps. It may pause when the daily budget is used up. | Only Anthropic's own rate limits on your key. |
| Privacy | Article text goes to my server, then to Anthropic. | Article text goes from your browser straight to Anthropic. Your key never leaves your machine. |

### 🌐 Option 1: use the hosted website (zero setup)

> Live app: `https://YOUR-DEPLOYMENT.replit.app` (maintainer: put your deployed Replit URL here)

Open the link, paste an article URL or its text, and click Analyze. That is it.

One thing to keep in mind. The hosted site runs on my Anthropic key, so it is rate-limited on purpose (per-IP per-minute and per-day caps, plus a global daily budget that stops the service once it is reached). If you hit a limit, or the daily budget is finished, try again tomorrow or use Option 2 with your own key.

### 🧩 Option 2: install the Chrome extension (your own key)

This extension is not on the Chrome Web Store, so you install it as an "unpacked" extension using Chrome's developer mode. It is fully standalone. It does not talk to my server at all. It runs the whole analysis inside the extension and calls the Anthropic API directly with your own key.

1. Get the code. Clone the repo, or [download it as a ZIP](https://github.com/abhinavgupta0809/civic-signal/archive/refs/heads/main.zip). You only need the [`extension/`](extension/) folder.
2. Get an Anthropic API key. Sign up at [console.anthropic.com](https://console.anthropic.com/), create a key (`sk-ant-...`), and add a few dollars of credit. Each analysis costs a fraction of a cent on Claude Haiku.
3. Load the extension.
   - Open `chrome://extensions` in Chrome.
   - Turn on Developer mode (top-right corner).
   - Click Load unpacked and select the `extension/` folder.
4. Add your key. Click the CivicSignal icon in the toolbar. On the first run it shows the key screen. Paste your `sk-ant-...` key and click Save key. You can change or remove it any time from the ⚙ button.
5. Analyze. Open any news article and click the CivicSignal icon. The popup shows the score, verdict, summary, signal bars (with the MBFC badge), and the extracted claims.

Where your key lives: in `chrome.storage.local`, on your machine only. It is sent only to `https://api.anthropic.com` and nowhere else. The extension's `host_permissions` allow exactly that one address, and you can check this yourself in [`extension/manifest.json`](extension/manifest.json).

Debugging: for popup logs, right-click and choose Inspect popup. For background logs, click the service worker link on the extension card. All logs start with the `[CivicSignal]` prefix.

---

## 🎯 The problem

Reading news today is hard. Readers keep running into:

- Misinformation and unverified claims
- Emotionally manipulative framing
- Different sources telling different stories

Checking all of this by hand is slow. Nobody can do it at the speed they actually read.

## 💡 The solution

CivicSignal works as a credibility assistant. It has two surfaces that share the same scoring pipeline:

- 🌐 Web app. Paste any article link or text and get the claims, a credibility score, and the reasoning behind it. The pipeline runs on the server (`lib/`).
- 🧩 Chrome extension (MV3). Analyze the page you are on in one click. The same pipeline runs inside the extension (`extension/lib.js`) using your own key.

---

## 🧠 How credibility is scored

The score is the sum of four signals, each worth 0 to 25. Claude reasons about three of them. The fourth and most important one, source credibility, comes from real data, not from the model's memory.

| Signal | Source of truth |
| --- | --- |
| Source credibility | Media Bias/Fact Check (MBFC) human-reviewed ratings. Trusted when the publisher is known. |
| Claim corroboration | Claude's structured reasoning |
| Fact-check alignment | Claude's structured reasoning |
| Manipulation language | Claude's structured reasoning |

### Source credibility is grounded, not guessed

A pure-LLM credibility score cannot be verified, and it can be hallucinated. So when a request has a domain (typed in the web app, or auto-detected from the link or tab), CivicSignal looks it up in a curated [Media Bias/Fact Check](https://mediabiasfactcheck.com) dataset (`lib/mbfc.ts`) and treats that rating as the source of truth:

1. Injected as ground truth. The MBFC rating goes into the prompt, so Claude's reasoning and summary stay consistent with it.
2. Deterministic override. After parsing, `applyMbfcOverride()` replaces `source_credibility` with a fixed score based on MBFC's Factual Reporting level (Very High gives 25, down to Very Low which gives 1). No guessing by the model.
3. Credibility cap. MBFC's credibility bucket caps the overall score. A `Low`-credibility outlet cannot go above the "Low Credibility" band, and a `Medium` one cannot reach "High Confidence", no matter how clean the article reads. The verdict is then re-derived from the capped score.

When there is no rating for a domain, the model estimates the signal and the UI shows no "MBFC verified" badge. The tool is honest about which signals are grounded and which are estimated. To cover more sources, swap the curated array in `lib/mbfc.ts` (and its copy in `extension/lib.js`) for the full official MBFC dataset. The lookup and scoring code stays the same.

> Why this matters: it changes "trust the AI's number" into "trust a human-reviewed rating, with the AI doing the reading". Grounding the model's output in real data, and being clear about confidence, is the core idea of the product.

---

## 🧪 Evaluating accuracy: is MBFC actually helping?

A grounding claim is only as good as its evidence, so CivicSignal ships an eval system ([`eval/`](eval/)) with two layers.

Layer 1: deterministic and free (`npm run eval`). Vitest checks the dataset for basic health (no duplicate or non-canonical domains, valid values, and factual and credibility levels that agree with each other). It also checks the scoring logic (`applyMbfcOverride`, the caps, and the verdict, across every entry). Then it grades the dataset against an independent gold-label set ([`eval/fixtures/gold-sources.json`](eval/fixtures/gold-sources.json)). Latest run, see [`eval/report/agreement.md`](eval/report/agreement.md):

| Metric | Result |
| --- | --- |
| Snapshot vs gold agreement (overlap) | 100% (43/43) |
| Coverage of the gold set | 82.7% |
| Dangerous (High vs Low) disagreements | 0 |
| Coverage gaps found (sources to add) | 9 |

Layer 2: live end-to-end ablation (`npm run eval:live`). It runs a labeled set of articles through the real pipeline twice, once with MBFC grounding on and once with it off, and writes the result to [`eval/report/latest.md`](eval/report/latest.md). Latest run of 15 articles:

| Result | Value |
| --- | --- |
| Questionable-source articles that escaped the Low-Credibility band without MBFC | 3 of 7 |
| Held at "Low Credibility" with MBFC grounding | 7 of 7 |
| Reliable vs questionable score separation | 53 points (77.8 vs 24.4) |

Those three escapes are the whole point. They are straight-news-style articles from low-credibility outlets (Breitbart, Newsmax, The Sun). The model on its own rated them "Mostly Credible" (62 to 72). With MBFC grounding, all three were capped to 39 ("Low Credibility"). The model alone gets fooled by clean writing. Grounding the source signal in human-reviewed data is what catches it.

See [`eval/README.md`](eval/README.md) for the full method and the honesty notes.

---

## 🤖 Claude as the core intelligence layer

Claude is not just an API call here. It is the reasoning engine. It is used for structured extraction, scoring, and explanation, not free text.

1. Claim extraction. Claude turns raw article text into structured data. It pulls out 3 to 5 claims you can actually check (events, policies, statistics) and skips opinion and prediction.

2. Structured credibility scoring. Claude returns a strict JSON object. The app parses and validates it (zod on the server, a structural validator in the extension), and falls back to a safe `Unverifiable` result instead of crashing on bad output:

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
    { "claim": "...", "status": "Unverified", "source": "Model assessment" }
  ]
}
```

---

## 🏗️ Architecture

Build 1: the website (server-side pipeline, maintainer's key):

```
app/page.tsx ──POST──▶ /api/analyze/route.ts
                           │
                           ├─ checkRateLimit()          (lib/rate-limit.ts)   ◀ protects the hosted key
                           ├─ fetchArticle(url)         (lib/extract.ts)      ◀ SSRF-guarded fetch + extraction
                           ├─ detectElectionContent()   (lib/scoring.ts)
                           ├─ lookupMbfc(domain)        (lib/mbfc.ts)         ◀ trusted source rating
                           ├─ buildAnalysisPrompt()     (lib/anthropic.ts)    : MBFC injected as ground truth
                           ├─ callClaude()              (claude-haiku-4-5)
                           ├─ parseModelResponse()      (zod + safe fallback)
                           └─ applyMbfcOverride()       (lib/mbfc.ts)         ◀ MBFC governs source_credibility + caps score
```

Build 2: the Chrome extension (in-browser pipeline, your key):

```
News article tab
  └─ extension/content.js       (extracts title / url / domain / text)
       └─ extension/popup.js     (key management + rendering)
            └─ extension/background.js
                 └─ extension/lib.js   (same pipeline, ported: election detection,
                                        MBFC lookup/override, prompt, parsing)
                      └─ POST https://api.anthropic.com/v1/messages   (YOUR key)
```

- `lib/scoring.ts`: keyword-based election detection, score-to-color mapping, and a verdict-band fallback if the model returns an invalid label.
- `lib/mbfc.ts`: curated MBFC dataset, domain lookup (with subdomain fallback), deterministic scoring, and the override that makes MBFC the source of truth.
- `lib/anthropic.ts`: prompt builder, Claude client, and a tolerant JSON parser that validates with zod.
- `lib/extract.ts`: guarded server-side URL fetching (protocol allow-list, private-IP and DNS blocking on every redirect hop, timeout, size cap) and article extraction.
- `lib/rate-limit.ts`: per-IP and global budget caps that protect the hosted deployment's key.
- `app/api/analyze/route.ts`: thin orchestrator. It validates input, runs the pipeline, and returns structured JSON or a friendly error.
- `extension/lib.js`: dependency-free port of the pipeline for the standalone extension build. Keep it in sync with `lib/` when the scoring logic changes.

---

## 🚀 Run the website locally (your own key)

```bash
# 1. Install dependencies
npm install

# 2. Set your API key
cp .env.local.example .env.local
# then open .env.local and set ANTHROPIC_API_KEY=sk-ant-...

# 3. Start the dev server
npm run dev
```

Open <http://localhost:3000>. Get an Anthropic API key at <https://console.anthropic.com/>.

You do not need a key for MBFC lookups. The curated dataset ships in `lib/mbfc.ts`.

---

## ☁️ Deploy your own website on Replit

Want your own hosted copy instead of using mine? CivicSignal is ready to host on [Replit](https://replit.com). The repo ships a `.replit` config, and `next start` binds to `0.0.0.0` so Replit can serve it.

1. Import. In Replit, click Create Repl, then Import from GitHub, then paste this repo's URL.
2. Add your key as a Secret. Go to Tools, then Secrets, and add `ANTHROPIC_API_KEY = sk-ant-...`. Never put the key in code. Secrets keeps it server-side.
3. Preview. Click Run to start a dev server and open the webview.
4. Publish a stable URL. Click Deploy (Autoscale). The `.replit` deployment block already sets build to `npm ci && npm run build` and run to `npm run start`. Put the resulting `*.replit.app` URL in this README so people can find it.

### 💸 Cost protection (built in)

A public URL spends your Anthropic key on every analysis, so `/api/analyze` is rate-limited out of the box ([`lib/rate-limit.ts`](lib/rate-limit.ts)): per-IP per-minute and per-day caps, plus a global daily budget that hard-stops the service once a day's quota is hit. All limits can be tuned with Secrets (defaults in the table):

| Secret | Default | Meaning |
| --- | --- | --- |
| `RATE_IP_PER_MIN` | 8 | Max analyses per IP per minute |
| `RATE_IP_PER_DAY` | 40 | Max analyses per IP per day |
| `RATE_GLOBAL_PER_DAY` | 500 | Hard daily cap across all users (budget stop) |

> The limits are kept in memory, which is fine for a single Replit instance. If you scale to many Autoscale machines, move the counters to a shared store like Upstash Redis. `lib/rate-limit.ts` is isolated, so that change stays in one place.

---

## 📁 Project structure

```
app/                    ← Build 1: the website
  layout.tsx
  page.tsx
  globals.css
  api/analyze/route.ts
components/
  SiteHeader.tsx        (brand + dark-mode toggle)
  ScoreCard.tsx
  SignalBars.tsx        (renders the MBFC "verified" badge)
  ClaimsList.tsx
  ElectionBanner.tsx
  ExampleLoader.tsx
lib/                    ← shared server pipeline
  types.ts
  scoring.ts
  mbfc.ts               (MBFC dataset, lookup, deterministic override)
  anthropic.ts
  extract.ts            (SSRF-guarded URL fetching)
  rate-limit.ts
extension/              ← Build 2: the standalone Chrome extension
  manifest.json  background.js  content.js  lib.js
  popup.html  popup.css  popup.js
eval/                   ← accuracy evals for the MBFC grounding
```

---

## 🗺️ Limitations and roadmap

The pipeline is split into named stages, so real fact-checking can slot in cleanly:

| Stage | Status |
| --- | --- |
| MBFC source rating | ✅ Done. Looked up before the prompt and applied as a trusted override. Swap the curated array for the full MBFC dataset to cover more sources. |
| Chrome extension (MV3) | ✅ Done. Standalone build with the user's own key stored locally. |
| Google Fact Check Claim Search | Planned. Call it after `lookupMbfc` and pass the results into the prompt as `RELATED FACT CHECKS`. |
| Tavily / Serper live search | Planned. Extract claims in a first pass, search each one, then score with the results in hand. |

A few more notes:
- The MBFC dataset is a curated snapshot of well-known publishers, not the full live database. MBFC ratings change over time, so refresh from the official dataset for production.
- MBFC grounding only works when a domain is available. The extension detects it from the tab. The website detects it from a pasted link, or you can type it in on the paste-text path.
- Article extraction in the extension uses a simple heuristic (`article`, then `main`, then `body.innerText`). Script-heavy pages can give noisy text, so Mozilla Readability could be added later.
- There is no database and no auth. Analysis is stateless. The extension keeps a small in-memory cache per URL for the session.
- The scoring pipeline exists twice on purpose (TypeScript in `lib/`, JavaScript in `extension/lib.js`), so the extension needs no build step and no server. If you change the scoring logic or the MBFC data, update both.

---

CivicSignal is an assistive credibility signal, not the final word. Always check voting procedures, deadlines, and eligibility with your official state or provincial election authority.
