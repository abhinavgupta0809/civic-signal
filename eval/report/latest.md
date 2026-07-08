# CivicSignal — Live Eval Report

_Generated 2026-07-08 10:52 UTC · Model: claude-haiku-4-5 · Corpus: 15 labeled articles_

> **Honesty note.** Gold labels are a curated reliability consensus, not absolute truth, and this is a small illustrative corpus of original synthetic articles. Treat the numbers as directional evidence that MBFC grounding works — not as a benchmark score.

## 🎯 Headline: MBFC grounding holds questionable sources to the Low-Credibility band

Questionable-source articles in corpus: **7**

| | Without MBFC (ungrounded) | With MBFC (grounded) |
| --- | --- | --- |
| Scored **≥40** (escaped the "Low Credibility" band) | **3 of 7** | 0 of 7 |
| Held at **≤39** ("Low Credibility") | 4 of 7 | **7 of 7** |

➡️ **3** questionable-source article(s) read credibly enough that the ungrounded model let them score ≥40. MBFC grounding pulled **7/7** down to the Low-Credibility band — the cap doing exactly its job.

## 📊 Source separation (grounded run)

- Reliable-source mean score: **77.8**
- Questionable-source mean score: **24.4**
- Separation gap: **53.4** points

## ✅ Verdict accuracy vs expected band (exact match)

- With MBFC: **8/15** (53%)
- Without MBFC: 10/15 (67%)

## 🗳️ Election detection

- Precision: 100% · Recall: 100% (tp=2, fp=0, fn=0)

## Confusion matrix — grounded (rows = expected, cols = predicted)

| expected \ predicted | High Confidence | Mostly Credible | Mixed Evidence | Low Credibility | Unverifiable |
| --- | --- | --- | --- | --- | --- |
| High Confidence |  |  |  |  |  |
| Mostly Credible | 2 | 2 |  |  |  |
| Mixed Evidence |  | 1 | 2 |  |  |
| Low Credibility |  |  |  | 3 | 4 |
| Unverifiable |  |  |  |  | 1 |

## Per-article detail

| domain | group | MBFC (factual/cred) | expected | grounded | ungrounded | election |
| --- | --- | --- | --- | --- | --- | --- |
| apnews.com | reliable | High / High | Mostly Credible | 85 High Confidence | 78 Mostly Credible |  |
| reuters.com | reliable | High / High | Mostly Credible | 75 Mostly Credible | 72 Mostly Credible |  |
| bbc.com | reliable | High / High | Mostly Credible | 80 High Confidence | 78 Mostly Credible |  |
| npr.org | reliable | High / High | Mostly Credible | 71 Mostly Credible | 62 Mostly Credible | ⚠︎ |
| cnn.com | mixed | Mixed / Medium | Mixed Evidence | 41 Mixed Evidence | 35 Low Credibility |  |
| foxnews.com | mixed | Mixed / Medium | Mixed Evidence | 43 Mixed Evidence | 42 Mixed Evidence |  |
| dailymail.co.uk | questionable | Low / Low | Low Credibility | 18 Unverifiable | 18 Low Credibility |  |
| infowars.com | questionable | Very Low / Low | Low Credibility | 11 Unverifiable | 15 Low Credibility |  |
| thegatewaypundit.com | questionable | Very Low / Low | Low Credibility | 11 Unverifiable | 15 Low Credibility | ⚠︎ |
| oann.com | questionable | Very Low / Low | Low Credibility | 14 Unverifiable | 18 Low Credibility |  |
| breitbart.com | questionable | Low / Low | Low Credibility | 39 Low Credibility | 62 Mostly Credible |  |
| newsmax.com | questionable | Low / Low | Low Credibility | 39 Low Credibility | 72 Mostly Credible |  |
| thesun.co.uk | questionable | Low / Low | Low Credibility | 39 Low Credibility | 68 Mostly Credible |  |
| smalltownexample.org | unknown | — | Mixed Evidence | 72 Mostly Credible | 72 Mostly Credible |  |
| myhotopinions.example | unknown | — | Unverifiable | 15 Unverifiable | 15 Unverifiable |  |
