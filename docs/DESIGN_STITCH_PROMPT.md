# Google Stitch prompt — CivicSignal website

Paste the **Master prompt** into [stitch.withgoogle.com](https://stitch.withgoogle.com)
(choose **Web**), generate, then use the **Per-screen prompts** to refine each
view. Export to Figma or copy the generated HTML/CSS and rebuild it in the
existing Next.js components (see "Keep these" below so it stays API-compatible).

---

## Master prompt

> Design a responsive **web app** called **CivicSignal** — an AI-powered news
> credibility assistant that helps readers judge whether a news article is
> trustworthy. The mood is **calm, editorial, and trustworthy** — like a modern
> newsroom / journalism product, serious but approachable. Not flashy, not
> "AI-gimmicky."
>
> **Visual style**
> - Content-first and spacious, with generous whitespace and a clear hierarchy.
> - Support **light and dark** themes.
> - **Typography:** an editorial **serif for headlines** (e.g. Fraunces or
>   Newsreader) paired with a clean **sans-serif for UI/body** (e.g. Inter).
> - **Palette:** warm off-white and near-black ink as the neutral base, with a
>   single restrained brand accent (**emerald green**). Reserve strong color for
>   results only — **green = credible, amber = mixed, red = low credibility.**
> - Rounded (2xl) cards with thin borders and soft shadows. Restrained, not glossy.
> - A reading-column max width (~720px) on desktop; single column on mobile.
>
> **Screens and states:**
>
> **1) Home / input screen**
> - Small brand mark "CivicSignal" with a tiny emerald status dot.
> - Large serif headline: "Credibility analysis for the news you read." with a
>   one-line subhead: "Analyze an article's credibility and surface its checkable claims."
> - A primary input card with a prominent **URL field** labeled "Article link,"
>   placeholder "https://apnews.com/article/…", and an "Analyze" button. Helper
>   text: "We fetch the page and detect the source automatically to ground the score."
> - A divider that reads "or paste text instead," then a large multi-line
>   **textarea** labeled "Article text" and an optional "Source domain" input.
> - Buttons: primary "Analyze," secondary "Reset."
> - Quiet footer line: "An assistive credibility signal, not a final source of truth."
>
> **2) Results screen (the hero of the product)**
> - An optional **amber "Election-related" warning banner** across the top.
> - A **Score card**: a large **circular score gauge (0–100)**, color-coded
>   green/amber/red, with the number centered; beside it a **verdict badge**
>   (one of: "High Confidence," "Mostly Credible," "Mixed Evidence,"
>   "Low Credibility," "Unverifiable") and a 1–2 sentence plain-English summary.
> - A **Signal breakdown card**: four horizontal labeled progress bars, each
>   scored **0–25** — "Source credibility," "Claim corroboration,"
>   "Fact-check match," "Manipulation language." The "Source credibility" bar
>   shows a small **"MBFC verified" badge** and a caption like
>   "Associated Press · High factual (MBFC)" when the source is grounded.
> - A **Checkable claims card**: a list of 3–5 claims, each with a colored
>   **status pill** — "Supported" (green), "Disputed" (red), "Unverified" (amber)
>   — followed by the claim sentence.
> - A quiet "Copy results" action.
>
> **3) Loading state:** skeleton placeholders for the score ring, the four bars,
> and the claims list.
>
> **4) Error state:** a friendly inline message card, e.g. "Couldn't read that
> link — it may be paywalled. Paste the article text instead."
>
> Populate every screen with **realistic sample content**: a score of 78, verdict
> "Mostly Credible," four partially-filled bars, and 3–4 example claims with a mix
> of Supported / Disputed / Unverified pills. Make it fully responsive.

---

## Per-screen refinement prompts

- **Input:** "Make the URL field the clear primary action — larger, with the
  Analyze button attached. De-emphasize the paste-text area as a secondary path
  below a subtle divider."
- **Score card:** "Make the circular 0–100 gauge the focal point, with a thick
  colored progress arc and the number in a large serif. Put the verdict badge and
  summary to its right on desktop, stacked below on mobile."
- **Signal bars:** "Show four labeled bars with the value as 'x / 25' on the
  right. Add a small check-badge 'MBFC verified' inline with the first bar's label."
- **Claims:** "Render claims as a clean list with a rounded status pill on the
  left of each row; color the pill green/red/amber by status."
- **Dark mode:** "Show the dark theme: near-black background, off-white text,
  same emerald accent and same green/amber/red signal colors."

---

## Design tokens (keep the build consistent)

| Token | Light | Dark |
| --- | --- | --- |
| background | `#FAFAF7` (warm off-white) | `#0B0B0C` |
| surface / card | `#FFFFFF` | `#151518` |
| text (ink) | `#0F172A` | `#F5F5F4` |
| muted text | `#64748B` | `#A1A1AA` |
| border | `#E7E5E4` | `#27272A` |
| brand accent | `#10B981` (emerald) | `#10B981` |

Semantic **signal** colors (both themes): green `#16A34A`, amber `#F59E0B`,
red `#EF4444`. Score thresholds already used by the app: **green ≥ 70, amber ≥ 40,
red < 40**. Radius: 16px cards, 12px inputs. Headline serif + Inter body.

---

## Keep these (so the redesign still matches the backend)

The API response shape is fixed (`lib/types.ts`). Whatever the visuals, the UI must
render all of it:

- **score** 0–100 · **verdict** one of the five labels above · **summary** (1–2 sentences)
- **election_related** boolean → the banner
- **signals**: `source_credibility`, `claim_corroboration`, `fact_check_match`,
  `manipulation_language`, each **0–25**
- **claims**: 3–5 items, each `{ claim, status: Supported|Disputed|Unverified }`
- **mbfc** (optional): `{ name, factualReporting, bias, credibility }` → the
  "MBFC verified" badge + caption (absent when the source is unknown — show no badge)
- The four **states**: input · loading · result · error
- **URL-first** input with **paste-text** fallback

Rebuild the Stitch output inside the existing components
(`components/ScoreCard.tsx`, `SignalBars.tsx`, `ClaimsList.tsx`, `ElectionBanner.tsx`,
`app/page.tsx`) rather than replacing the data flow — then it pushes to GitHub and
hosts on Replit unchanged.
