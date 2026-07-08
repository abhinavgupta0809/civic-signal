"use client";

import { useEffect, useState } from "react";
import { scoreToColor } from "@/lib/scoring";
import type { MbfcRating, Verdict } from "@/lib/types";

interface ScoreCardProps {
  score: number;
  verdict: Verdict;
  summary: string;
  /** 0–100 score for the article text alone (excludes source reputation). */
  articleAccuracy: number;
  /** The source-credibility signal (0–25), MBFC-derived when mbfc is set. */
  sourceCredibility: number;
  mbfc?: MbfcRating | null;
}

const COLOR_STYLES: Record<
  ReturnType<typeof scoreToColor>,
  { text: string; stroke: string; badge: string }
> = {
  green: {
    text: "text-emerald-600 dark:text-emerald-400",
    stroke: "stroke-emerald-600 dark:stroke-emerald-400",
    badge:
      "bg-emerald-600/10 text-emerald-700 border-emerald-600/25 dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/25",
  },
  amber: {
    text: "text-amber-600 dark:text-amber-400",
    stroke: "stroke-amber-600 dark:stroke-amber-400",
    badge:
      "bg-amber-600/10 text-amber-700 border-amber-600/25 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/25",
  },
  red: {
    text: "text-rose-600 dark:text-rose-400",
    stroke: "stroke-rose-600 dark:stroke-rose-400",
    badge:
      "bg-rose-600/10 text-rose-700 border-rose-600/25 dark:bg-rose-400/10 dark:text-rose-300 dark:border-rose-400/25",
  },
};

export function ScoreCard({
  score,
  verdict,
  summary,
  articleAccuracy,
  sourceCredibility,
  mbfc,
}: ScoreCardProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const styles = COLOR_STYLES[scoreToColor(score)];

  // Source trust on the same 0–100 scale as article accuracy.
  const sourceTrust = Math.round((sourceCredibility / 25) * 100);
  const accuracyStyles = COLOR_STYLES[scoreToColor(articleAccuracy)];
  const trustStyles = COLOR_STYLES[scoreToColor(sourceTrust)];

  // When the two numbers tell different stories, say so in plain English.
  const lowTrust = mbfc?.credibility === "Low" || sourceTrust < 40;
  const highTrust = mbfc?.credibility === "High" || sourceTrust >= 70;
  let divergenceNote: string | null = null;
  if (articleAccuracy >= 60 && lowTrust) {
    divergenceNote =
      "This article's content largely checks out, but the publisher's track record drags the overall score down. Verify key claims with a second source before sharing.";
  } else if (articleAccuracy < 45 && highTrust) {
    divergenceNote =
      "This outlet is generally reliable, but this particular article has weak corroboration. Treat its specific claims with care.";
  }

  useEffect(() => {
    const duration = 700;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const progress = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(score * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  return (
    <section className="animate-slide-up flex flex-col items-center gap-8 rounded-2xl border border-border bg-card p-8 shadow-sm md:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
          <path
            className="fill-none stroke-border/60"
            strokeWidth="3.8"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className={`gauge-arc fill-none ${styles.stroke}`}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0, Math.min(100, score))}, 100`}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-serif text-5xl font-bold leading-none ${styles.text}`}>
            {displayScore}
          </span>
          <span className="mt-1 text-xs font-semibold text-muted">/100</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center md:items-start md:text-left">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${styles.badge}`}
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M16.403 12.652a3 3 0 0 0 0-5.304 3 3 0 0 0-3.75-3.751 3 3 0 0 0-5.305 0 3 3 0 0 0-3.751 3.75 3 3 0 0 0 0 5.305 3 3 0 0 0 3.75 3.751 3 3 0 0 0 5.305 0 3 3 0 0 0 3.751-3.75Zm-2.546-4.46a.75.75 0 0 0-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
              clipRule="evenodd"
            />
          </svg>
          {verdict}
        </span>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-foreground">
          Credibility assessment
        </h2>
        <p className="text-[15px] leading-relaxed text-muted">{summary}</p>

        <div className="mt-4 grid w-full gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card-subtle p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Article accuracy
            </p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${accuracyStyles.text}`}>
              {articleAccuracy}
              <span className="text-sm font-normal text-muted">/100</span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              The text alone: corroboration, fact-check alignment, and framing.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card-subtle p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Source trust
            </p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${trustStyles.text}`}>
              {sourceTrust}
              <span className="text-sm font-normal text-muted">/100</span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {mbfc
                ? `${mbfc.name}: ${mbfc.factualReporting} factual reporting (Media Bias/Fact Check).`
                : "Unrecognized outlet — estimated cautiously from the text."}
            </p>
          </div>
        </div>

        {divergenceNote && (
          <p className="mt-2 w-full rounded-xl border border-amber-600/25 bg-amber-600/10 p-3 text-left text-[13px] leading-relaxed text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200">
            {divergenceNote}
          </p>
        )}
      </div>
    </section>
  );
}
