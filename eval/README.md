# CivicSignal eval

Two layers that answer *"is MBFC giving us the right accuracy signal?"*

## Layer 1 — deterministic (free, no API) — `npm run eval`

Runs the Vitest suite, then the dataset-agreement report.

- **`mbfc-integrity.test.ts`** — structural checks on the snapshot (`lib/mbfc.ts`):
  no duplicate domains, valid enums, canonical domain form, factual↔credibility
  consistency, questionable⇒Low.
- **`mbfc-logic.test.ts`** — the scoring logic: `mbfcToScore` mapping, `lookupMbfc`
  subdomain/URL fallback, and `applyMbfcOverride` (source override, delta math,
  credibility caps, verdict re-derivation, failed-analysis handling) across
  *every* snapshot entry.
- **`mbfc-agreement.ts`** — grades the snapshot's credibility buckets against an
  independent gold set (`fixtures/gold-sources.json`): coverage, agreement,
  confusion matrix, disagreements, and coverage gaps. Writes
  [`report/agreement.md`](report/agreement.md). Exits non-zero only on a
  dangerous High↔Low mismatch.

## Layer 2 — live end-to-end + ablation (costs a few cents) — `npm run eval:live`

Needs `ANTHROPIC_API_KEY` (loaded from `.env.local`). Runs each labeled article
in `fixtures/articles/` through the real pipeline **twice** — MBFC grounding on
vs off — and writes [`report/latest.md`](report/latest.md) (+ `.json`):

- **Cap effectiveness (headline)** — how many questionable-source articles the
  ungrounded model let score ≥40, and how MBFC grounding holds them at the
  Low-Credibility band.
- **Source separation** — reliable vs questionable mean-score gap.
- **Verdict accuracy** vs expected band, grounded vs ungrounded.
- **Election-detection** precision/recall.

## Fixtures

- `fixtures/gold-sources.json` — independent reliability consensus labels.
- `fixtures/articles/` — original synthetic articles (no copyrighted text),
  labeled by source `group` and `expectedBand` in `index.json`.

## Case study — recent true news showed as "Unverified"

A real failure found in testing (July 8, 2026): an ESPN report that Jordan
Henderson broke his arm celebrating England's World Cup win over Mexico — true,
published hours earlier — came back with its core claims marked **Unverified**
("cannot be verified against training data"). Two distinct causes:

1. **MBFC verifies outlets, not claims.** MBFC grounding can say "ESPN is a
   High-factual publisher"; it can never say "England really does play Norway
   on Saturday". Claim-level verification of recent events needs live search.
2. **The model's knowledge has a cutoff.** Anything that happened after it was
   trained is unknowable from the weights alone — so honest output for recent
   news was "Unverified", even when the news was true.

The fix: the pipeline now enables Anthropic's built-in `web_search` tool
(capped per analysis, `WEB_SEARCH_MAX_USES`), so the model runs real searches
for the article's most important claims and marks them Supported/Disputed with
the corroborating outlet cited on the claim. `fixtures/articles/espn-recent-sports.txt`
is a synthetic reconstruction of that article, kept as a regression fixture:
run live with search enabled, its Central claims should resolve to
**Supported**; with `WEB_SEARCH_MAX_USES=0` they honestly fall back to
**Unverified** (never Disputed — recency alone is not grounds for dispute).

> Honesty note: gold labels are a curated reliability consensus, not absolute
> truth, and the article corpus is small and illustrative. Treat results as
> directional evidence that grounding works, not as a benchmark score.
