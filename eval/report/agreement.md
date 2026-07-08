# MBFC snapshot vs. gold labels — dataset agreement

_Generated 2026-07-08 13:13 UTC · deterministic (no API) · run via `npm run eval`_

> Grades the curated MBFC snapshot in `lib/mbfc.ts` against an independent reliability consensus (`eval/fixtures/gold-sources.json`). Gold labels are a curated consensus, not absolute truth.

| Metric | Value |
| --- | --- |
| Gold sources | 52 |
| Covered by snapshot | 43 (82.7%) |
| Agreement on overlap | 43/43 (100.0%) |
| Disagreements | 0 (dangerous High↔Low: 0) |

## Confusion matrix (rows = gold, cols = snapshot)

| gold \ snapshot | High | Medium | Low |
| --- | --- | --- | --- |
| High | 25 |  |  |
| Medium |  | 11 |  |
| Low |  |  | 7 |

## Coverage gaps — in gold set, missing from the snapshot (9)

These are sources to add next to extend coverage:

- `rt.com` (consensus: Low)
- `sputniknews.com` (consensus: Low)
- `theepochtimes.com` (consensus: Low)
- `thegrayzone.com` (consensus: Low)
- `naturalnews.com` (consensus: Low)
- `dailycaller.com` (consensus: Medium)
- `motherjones.com` (consensus: High)
- `reason.com` (consensus: High)
- `thedailybeast.com` (consensus: Medium)

**OK:** no dangerous disagreements. Coverage gaps above are opportunities to extend the dataset.
