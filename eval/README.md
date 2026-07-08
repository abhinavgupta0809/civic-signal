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

> Honesty note: gold labels are a curated reliability consensus, not absolute
> truth, and the article corpus is small and illustrative. Treat results as
> directional evidence that grounding works, not as a benchmark score.
