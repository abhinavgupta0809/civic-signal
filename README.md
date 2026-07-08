# CivicSignal

**CivicSignal is an AI-powered credibility assistant that helps people evaluate news articles** — it extracts the checkable claims, scores credibility across four signals, grounds the most important signal in a human-reviewed source-rating dataset, and explains *why* it reached its verdict. Built with a special focus on election-related misinformation.

Paste an article (or analyze the current tab via the Chrome extension) → get a **0–100 credibility score**, a verdict badge, a plain-English summary, a **four-signal breakdown**, **3–5 extracted claims** with Supported / Disputed / Unverified pills, and an **election-warning banner** when relevant.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS, and the Anthropic Claude API.

---

## 🚦 Two ways to use CivicSignal — pick one

This repo ships **two separate, independent builds**. Choose whichever fits you:

| | 🌐 **Option 1: The website (hosted)** | 🧩 **Option 2: The Chrome extension (bring your own key)** |
| --- | --- | --- |
| **What it is** | A hosted web app — paste a link or article text | An unofficial Manifest V3 extension — analyze the tab you're on in one click |
| **Whose API key** | **Mine** (the maintainer's) — you don't need any key or account | **Yours** — you paste your own Anthropic API key into the extension |
| **Setup** | None. Open the link and use it | Enable Chrome **Developer mode**, load the folder, add your key |
| **Cost to you** | Free (rate-limited to protect my API budget) | You pay Anthropic directly — fractions of a cent per analysis on Claude Haiku |
| **Limits** | Per-IP and daily global caps; may pause when the daily budget is spent | Only Anthropic's own rate limits on your key |
| **Privacy** | Article text is sent to my server, then to Anthropic | Article text goes from your browser straight to Anthropic; your key never leaves your machine |

### 🌐 Option 1 — use the hosted website (zero setup)

> **Live app:** `https://YOUR-DEPLOYMENT.replit.app` *(maintainer: replace with your deployed Replit URL)*

Open the link, paste an article URL or its text, and hit **Analyze**. That's it.

**Be aware:** the hosted site runs on **my** Anthropic API key, so it is deliberately rate-limited (per-IP per-minute/per-day caps and a global daily budget kill-switch). If you hit a limit or the daily budget is exhausted, either try again tomorrow or switch to Option 2 / self-host with your own key.

### 🧩 Option 2 — install the Chrome extension (your own key)

This extension is **not published on the Chrome Web Store**, so it installs as an "unpacked" extension via Chrome's developer mode. It is fully standalone — it does **not** talk to my server at all. It runs the entire analysis pipeline locally and calls the Anthropic API **directly with your own key**.

1. **Get the code** — clone or [download this repo as a ZIP](https://github.com/abhinavgupta0809/civic-signal/archive/refs/heads/main.zip). You only need the [`extension/`](extension/) folder.
2. **Get an Anthropic API key** — sign up at [console.anthropic.com](https://console.anthropic.com/), create a key (`sk-ant-…`), and add a few dollars of credit. Each analysis costs a fraction of a cent on Claude Haiku.
3. **Load the extension**
   - Open `chrome://extensions` in Chrome.
   - Toggle **Developer mode** (top-right corner).
   - Click **Load unpacked** and select the `extension/` folder.
4. **Add your key** — click the CivicSignal icon in the toolbar. On first run it opens the key screen; paste your `sk-ant-…` key and hit **Save key**. You can change or remove it any time via the ⚙ button.
5. **Analyze** — open any news article and click the CivicSignal icon. The popup shows the score, verdict, summary, signal bars (with the MBFC badge), and extracted claims.

**Where your key lives:** in `chrome.storage.local` on your machine only. It is attached to requests to `https://api.anthropic.com` and nowhere else — the extension's `host_permissions` allow exactly that one origin, which you can verify in [`extension/manifest.json`](extension/manifest.json).

**Debugging:** popup logs via right-click → *Inspect popup*; background logs via the *service worker* link on the extension card. All logs use the `[CivicSignal]` prefix.

---

## 🎯 The problem

Today's information ecosystem is hard to navigate. Readers constantly hit:

- Misinformation and unverified claims
- Emotionally manipulative framing
- Conflicting narratives across sources

Verifying any of it by hand is slow and unrealistic at the speed people actually read.

## 💡 The solution

CivicSignal acts as a **real-time credibility assistant** in two surfaces that share the same scoring pipeline:

- **🌐 Web app** — paste any article link or text and get claims, a credibility score, and the reasoning behind it. Runs the pipeline server-side (`lib/`).
- **🧩 Chrome extension (MV3)** — analyze the page you're on in one click. Runs the same pipeline inside the extension (`extension/lib.js`) using your own key.

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

A pure-LLM credibility score is unverifiable and can be hallucinated. So when a request includes a domain (typed in the web app, or auto-detected from the link/tab), CivicSignal looks it up in a curated [Media Bias/Fact Check](https://mediabiasfactcheck.com) dataset (`lib/mbfc.ts`) and treats that rating as authoritative:

1. **Injected as ground truth** — the MBFC rating is passed into the prompt so Claude's reasoning and summary stay consistent with it.
2. **Deterministic override** — after parsing, `applyMbfcOverride()` replaces `source_credibility` with a fixed score derived from MBFC's Factual Reporting level (Very High → 25 … Very Low → 1). No model guesswork.
3. **Credibility cap** — MBFC's credibility bucket caps the overall score: a `Low`-credibility outlet can't exceed the "Low Credibility" band, and a `Medium` one can't reach "High Confidence" — *no matter how clean the article reads.* The verdict is re-derived from the capped score.

When no rating exists for a domain, the model estimates the signal and the UI shows no "MBFC verified" badge — the tool is explicit about which signals are grounded vs. estimated. To extend coverage, swap the curated array in `lib/mbfc.ts` (and its mirror in `extension/lib.js`) for the full official MBFC dataset; the lookup and scoring code stays the same.

> **Why this matters:** it turns "trust the AI's number" into "trust a human-reviewed rating, with the AI doing the reading." That distinction — grounding model output in authoritative data and being transparent about confidence — is the core product idea.

---

## 🧪 Evaluating accuracy — is MBFC actually helping?

A grounding claim is only as good as its evidence, so CivicSignal ships an eval
system ([`eval/`](eval/)) with two layers.

**Layer 1 — deterministic, free (`npm run eval`).** Vitest checks the snapshot's
integrity (no duplicate/non-canonical domains, valid enums, factual↔credibility
consistency) and the scoring logic (`applyMbfcOverride` override + caps + verdict
re-derivation across *every* entry), then grades the snapshot against an
**independent gold-label set** ([`eval/fixtures/gold-sources.json`](eval/fixtures/gold-sources.json)).
Latest run — see [`eval/report/agreement.md`](eval/report/agreement.md):

| Metric | Result |
| --- | --- |
| Snapshot vs. gold **agreement** (overlap) | **100%** (43/43) |
| **Coverage** of the gold set | 82.7% |
| Dangerous (High↔Low) disagreements | 0 |
| Coverage gaps surfaced (sources to add) | 9 |

**Layer 2 — live end-to-end ablation (`npm run eval:live`).** Runs a labeled
corpus through the real pipeline **with MBFC grounding on vs. off**, written to
[`eval/report/latest.md`](eval/report/latest.md). Latest 15-article run:

| Result | Value |
| --- | --- |
| Questionable-source articles that **escaped** the Low-Credibility band *without* MBFC | **3 of 7** |
| Held at "Low Credibility" **with** MBFC grounding | **7 of 7** |
| Reliable vs. questionable **score separation** | **53 pts** (77.8 vs. 24.4) |

Those three "escapes" are the whole point: straight-news-style articles from
Low-credibility outlets (Breitbart, Newsmax, The Sun) that the ungrounded model
rated **"Mostly Credible" (62–72)** — MBFC grounding capped all three to **39
("Low Credibility")**. The model alone gets fooled by clean writing; grounding
the source signal in human-reviewed data is what catches it.

See [`eval/README.md`](eval/README.md) for the full methodology and honesty notes.

---

## 🤖 Claude as the core intelligence layer

Claude isn't just an API call here — it's the reasoning engine, used for **structured extraction, scoring, and explainability**, not free-form text.

**1. Claim extraction** — Claude turns raw article text into structured data, pulling 3–5 *checkable* claims (events, policies, statistics) and skipping opinion and prediction.

**2. Structured credibility scoring** — Claude returns a strict JSON object the app parses and validates (zod on the server, a structural validator in the extension), falling back to a safe `Unverifiable` result rather than crashing on malformed output:

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

**Build 1 — the website** (server-side pipeline, maintainer's key):

```
app/page.tsx ──POST──▶ /api/analyze/route.ts
                           │
                           ├─ checkRateLimit()          (lib/rate-limit.ts)   ◀ protects the hosted key
                           ├─ fetchArticle(url)         (lib/extract.ts)      ◀ SSRF-guarded fetch + extraction
                           ├─ detectElectionContent()   (lib/scoring.ts)
                           ├─ lookupMbfc(domain)        (lib/mbfc.ts)         ◀ authoritative source rating
                           ├─ buildAnalysisPrompt()     (lib/anthropic.ts)    — MBFC injected as ground truth
                           ├─ callClaude()              (claude-haiku-4-5)
                           ├─ parseModelResponse()      (zod + safe fallback)
                           └─ applyMbfcOverride()       (lib/mbfc.ts)         ◀ MBFC governs source_credibility + caps score
```

**Build 2 — the Chrome extension** (in-browser pipeline, your key):

```
News article tab
  └─ extension/content.js       (extracts title / url / domain / text)
       └─ extension/popup.js     (key management + rendering)
            └─ extension/background.js
                 └─ extension/lib.js   (same pipeline, ported: election detection,
                                        MBFC lookup/override, prompt, parsing)
                      └─ POST https://api.anthropic.com/v1/messages   (YOUR key)
```

- **`lib/scoring.ts`** — keyword-based election detection, score→color mapping, and a verdict-band fallback if the model returns an invalid label.
- **`lib/mbfc.ts`** — curated MBFC dataset, domain lookup (with subdomain fallback), deterministic scoring, and the override that makes MBFC authoritative.
- **`lib/anthropic.ts`** — prompt builder, Claude client, and a tolerant JSON parser that validates with zod.
- **`lib/extract.ts`** — guarded server-side URL fetching (protocol allow-list, private-IP/DNS blocking on every redirect hop, timeout, size cap) + article extraction.
- **`lib/rate-limit.ts`** — per-IP and global budget caps that protect the hosted deployment's key.
- **`app/api/analyze/route.ts`** — thin orchestrator: validates input, runs the pipeline, returns structured JSON or a friendly error.
- **`extension/lib.js`** — dependency-free port of the pipeline for the standalone extension build. Keep it in sync with `lib/` when scoring logic changes.

---

## 🚀 Run the website locally (your own key)

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

## ☁️ Deploy your own website on Replit

Want your own hosted copy instead of using mine? CivicSignal is ready to host on [Replit](https://replit.com) — the repo ships a `.replit` config, and `next start` binds to `0.0.0.0` so Replit can serve it.

1. **Import** — In Replit: *Create Repl → Import from GitHub* → paste this repo's URL.
2. **Add your key as a Secret** — *Tools → Secrets* → add `ANTHROPIC_API_KEY = sk-ant-…`.
   Never put the key in code; Secrets keeps it server-side.
3. **Preview** — Click **Run** to start a dev server and open the webview.
4. **Publish a stable URL** — Click **Deploy** (Autoscale). The `.replit` deployment block
   already sets *build* = `npm ci && npm run build` and *run* = `npm run start`. Put the
   resulting `*.replit.app` URL in this README so users can find it.

### 💸 Cost protection (built in)

Because a public URL spends **your** Anthropic key on every analysis, `/api/analyze` is rate
limited out of the box ([`lib/rate-limit.ts`](lib/rate-limit.ts)): per-IP per-minute and
per-day caps, plus a **global daily budget kill-switch** that hard-stops the service once a
day's analysis quota is hit. All limits are tunable via Secrets (defaults in parentheses):

| Secret | Default | Meaning |
| --- | --- | --- |
| `RATE_IP_PER_MIN` | 8 | Max analyses per IP per minute |
| `RATE_IP_PER_DAY` | 40 | Max analyses per IP per day |
| `RATE_GLOBAL_PER_DAY` | 500 | Hard daily cap across all users (budget kill-switch) |

> Limits are stored in-process — perfect for a single Replit instance. If you scale to
> multiple Autoscale machines, move the counters to a shared store (e.g. Upstash Redis);
> `lib/rate-limit.ts` is isolated so that swap is localized.

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

## 🗺️ Limitations & roadmap

The pipeline is split into named stages so real fact-checking slots in cleanly:

| Stage | Status |
| --- | --- |
| MBFC source rating | ✅ Done — looked up before the prompt and applied as an authoritative override. Swap the curated array for the full MBFC dataset to extend coverage. |
| Chrome extension (MV3) | ✅ Done — standalone build with the user's own key stored locally. |
| Google Fact Check Claim Search | Planned — call after `lookupMbfc`, pass results into the prompt as `RELATED FACT CHECKS`. |
| Tavily / Serper live search | Planned — extract claims in a first pass, search each, then score with results in hand. |

Other notes:
- The MBFC dataset is a curated snapshot of well-known publishers, not the full live database. MBFC ratings change over time; refresh from the official dataset for production.
- MBFC grounding only applies when a domain is available — the extension auto-detects it from the tab; the website auto-detects it from a pasted link, or you can type it in on the paste-text path.
- Article extraction in the extension is a simple `article` → `main` → `body.innerText` heuristic; script-heavy pages may yield noisy text (Mozilla Readability could be added).
- No database or auth — analysis is stateless. The extension keeps a per-session in-memory cache by URL.
- The scoring pipeline exists twice by design (TypeScript in `lib/`, JavaScript in `extension/lib.js`) so the extension needs no build step or server. If you change scoring logic or the MBFC data, update both.

---

CivicSignal is an **assistive credibility signal, not a final source of truth.** Always verify voting procedures, deadlines, and eligibility against your official state or provincial election authority.
