# LinkedIn post: CivicSignal

Attach a short screen recording or 2 to 3 screenshots (paste a link, then show the score, the MBFC badge, and the claims).
Live app: https://civic-signal.replit.app
Repo: https://github.com/abhinavgupta0809/civic-signal

---

## Primary draft (story angle: grounding + eval)

I built CivicSignal, an AI credibility assistant for news, and the most interesting part is not the AI. It is what I did not let the AI decide.

The problem: ask an LLM "is this article credible?" and it will hand you a confident number. But that number cannot be verified. It can be hallucinated, and "trust me" is exactly the wrong answer for a news-literacy tool.

So CivicSignal splits the work:
🔹 Claude reads. It pulls out the claims you can actually check and reasons about corroboration and manipulative language.
🔹 Humans decide source credibility. The source signal is grounded in Media Bias/Fact Check's human-reviewed ratings, applied as a deterministic override and a hard cap. A known low-credibility outlet cannot score as trustworthy, no matter how clean the writing reads.

Then I did the part people usually skip. I evaluated it.
✅ A deterministic test suite grades the ratings dataset against an independent consensus set: 100% agreement on overlapping sources, 0 dangerous mismatches, and it even surfaces which sources to add next.
✅ A live ablation runs real articles through the pipeline with grounding on and off. Straight-news-style articles from low-credibility outlets scored "Mostly Credible" (62 to 72) with the model alone, and MBFC grounding capped every one of them to "Low Credibility" (39). The model on its own gets fooled by clean writing. Grounding is what stops it.

Paste a link and get a score from 0 to 100, a verdict, the extracted claims, and a clear breakdown of which signals are grounded and which are estimated.

Built with Next.js, TypeScript, and the Claude API, deployed on Replit, with a companion Chrome extension. Try it: https://civic-signal.replit.app

Feedback welcome, especially from anyone working on misinformation or news literacy.

#AI #MachineLearning #NewsLiteracy #Misinformation #LLM #ClaudeAI #NextJS #BuildInPublic

---

## Shorter draft (punchy)

Most "AI fact-checkers" ask you to trust a number the AI made up.

I built CivicSignal to do the opposite. Claude reads the article and pulls the claims you can check, but source credibility is grounded in human-reviewed MBFC ratings and applied as a hard cap, so polished writing from a questionable source cannot fake its way to a high score.

And I shipped the receipts: an eval suite (100% agreement with an independent label set) plus a grounding on/off ablation that shows exactly what the cap prevents.

Paste a link and get a score, a verdict, the claims, and which signals are grounded vs estimated. Next.js and Claude, on Replit, plus a Chrome extension.

Try it: https://civic-signal.replit.app

#AI #NewsLiteracy #LLM #ClaudeAI #Misinformation

---

## Notes and talking points (for comments or an interview)

- Why the cap matters: MBFC's credibility bucket sets a ceiling on the overall score (Low is 39, Medium is 79). The verdict is re-derived from the capped score, so the score, the badge, and the verdict never contradict each other.
- Honesty about confidence: when no rating exists for a domain, the UI shows no "MBFC verified" badge. The tool is clear about grounded vs estimated.
- Eval honesty: gold labels are a curated consensus, not absolute truth, and the ablation corpus is small and illustrative. It is directional evidence, not a benchmark.
- Not a source of truth: it is an assistive signal. Always verify official voting and election info with the real authority.
