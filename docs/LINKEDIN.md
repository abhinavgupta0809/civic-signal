# LinkedIn post — CivicSignal

Fill in `{{LIVE_URL}}` with your Replit deployment link before posting. Attach a
short screen-recording or 2–3 screenshots (paste a link → score + MBFC badge +
claims). Repo: https://github.com/abhinavgupta0809/civic-signal

---

## Primary draft (story angle: grounding + eval)

I built **CivicSignal** — an AI credibility assistant for news — and the most
interesting part isn't the AI. It's what I *didn't* let the AI decide.

The problem: ask an LLM "is this article credible?" and it'll hand you a
confident number. But that number is unverifiable — it can be hallucinated, and
"trust me" is exactly the wrong answer for a news-literacy tool.

So CivicSignal splits the work:
🔹 **Claude reads** — it extracts the checkable claims and reasons about
corroboration and manipulative language.
🔹 **Humans decide source credibility** — the source signal is grounded in
Media Bias/Fact Check's human-reviewed ratings, applied as a deterministic
override *and* a hard cap. A known low-credibility outlet can't score as
trustworthy no matter how clean the writing reads.

Then I did the part people usually skip: I **evaluated** it.
✅ A deterministic test suite grades the ratings dataset against an independent
consensus set → **100% agreement** on overlapping sources, 0 dangerous
mismatches, and it auto-surfaces which sources to add next.
✅ A live ablation runs real articles through the pipeline **with grounding on
vs. off** — showing the model alone will wave through a well-written article
from a questionable source, and the MBFC cap is what stops it.

Paste a link, get a 0–100 score, a verdict, the extracted claims, and a
transparent breakdown of which signals are *grounded* vs. *estimated*.

Built with Next.js + TypeScript and the Claude API, deployed on Replit, with a
companion Chrome extension. Try it 👉 {{LIVE_URL}}

Feedback welcome — especially from anyone working on misinformation or news
literacy.

#AI #MachineLearning #NewsLiteracy #Misinformation #LLM #ClaudeAI #NextJS #BuildInPublic

---

## Shorter draft (punchy)

Most "AI fact-checkers" ask you to trust a number the AI made up.

I built **CivicSignal** to do the opposite: Claude reads the article and pulls
the checkable claims, but *source credibility* is grounded in human-reviewed
MBFC ratings — applied as a hard cap, so polished writing from a questionable
source can't fake its way to a high score.

And I shipped the receipts: an eval suite (100% agreement with an independent
label set) plus a grounding on/off ablation that shows exactly what the cap
prevents.

Paste a link → score, verdict, claims, and which signals are grounded vs.
estimated. Next.js + Claude, on Replit, + a Chrome extension.

👉 {{LIVE_URL}}

#AI #NewsLiteracy #LLM #ClaudeAI #Misinformation

---

## Notes / talking points (for comments or an interview)

- **Why the cap matters:** MBFC's credibility bucket ceilings the overall score
  (Low ≤ 39, Medium ≤ 79). The verdict is re-derived from the capped score, so
  score, badge, and verdict never contradict each other.
- **Honesty about confidence:** when no rating exists for a domain, the UI shows
  no "MBFC verified" badge — the tool is explicit about grounded vs. estimated.
- **Eval honesty:** gold labels are a curated consensus, not absolute truth, and
  the ablation corpus is small and illustrative — presented as directional
  evidence, not a benchmark.
- **Not a source of truth:** it's an assistive signal; always verify official
  voting/election info with the real authority.
