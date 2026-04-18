"use client";

import { useEffect, useState } from "react";
import { scoreToColor } from "@/lib/scoring";
import type { Verdict } from "@/lib/types";

interface ScoreCardProps {
  score: number;
  verdict: Verdict;
  summary: string;
}

const COLOR_STYLES: Record<
  ReturnType<typeof scoreToColor>,
  { text: string; ring: string; badge: string; dot: string }
> = {
  green: {
    text: "text-emerald-600",
    ring: "ring-emerald-200 bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  amber: {
    text: "text-amber-600",
    ring: "ring-amber-200 bg-amber-50",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  red: {
    text: "text-rose-600",
    ring: "ring-rose-200 bg-rose-50",
    badge: "bg-rose-100 text-rose-800 border-rose-200",
    dot: "bg-rose-500",
  },
};

export function ScoreCard({ score, verdict, summary }: ScoreCardProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const color = scoreToColor(score);
  const styles = COLOR_STYLES[color];

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
    <section className="animate-slide-up rounded-2xl border border-border bg-white p-8 shadow-sm">
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-6">
          <div
            className={`flex h-32 w-32 items-center justify-center rounded-full ring-8 ${styles.ring}`}
          >
            <div className="text-center">
              <div className={`text-5xl font-semibold leading-none ${styles.text}`}>
                {displayScore}
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted">
                / 100
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted">
              Credibility score
            </div>
            <span
              className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${styles.badge}`}
            >
              <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
              {verdict}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-6 text-[15px] leading-relaxed text-foreground/80">
        {summary}
      </p>
    </section>
  );
}
