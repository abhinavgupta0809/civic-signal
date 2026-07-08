"use client";

import { mbfcSearchUrl } from "@/lib/mbfc";
import type { MbfcRating, SignalExplanations, Signals } from "@/lib/types";

interface SignalBarsProps {
  signals: Signals;
  explanations?: SignalExplanations;
  mbfc?: MbfcRating | null;
}

const LABELS: Array<{ key: keyof Signals; label: string; hint: string }> = [
  {
    key: "source_credibility",
    label: "Source credibility",
    hint: "Publisher reputation and track record",
  },
  {
    key: "claim_corroboration",
    label: "Claim corroboration",
    hint: "How well claims align with independent sources",
  },
  {
    key: "fact_check_match",
    label: "Fact-check match",
    hint: "Alignment with existing fact-check findings",
  },
  {
    key: "manipulation_language",
    label: "Manipulation language",
    hint: "Absence of loaded or emotionally charged framing",
  },
];

function barStyles(value: number): { bar: string; value: string } {
  const pct = (value / 25) * 100;
  if (pct >= 70)
    return {
      bar: "bg-emerald-600 dark:bg-emerald-400",
      value: "text-emerald-700 dark:text-emerald-400",
    };
  if (pct >= 40)
    return {
      bar: "bg-amber-500 dark:bg-amber-400",
      value: "text-amber-700 dark:text-amber-400",
    };
  return {
    bar: "bg-rose-600 dark:bg-rose-400",
    value: "text-rose-700 dark:text-rose-400",
  };
}

export function SignalBars({ signals, explanations, mbfc }: SignalBarsProps) {
  return (
    <section className="animate-slide-up rounded-2xl border border-border bg-card-subtle p-6 shadow-sm md:p-8">
      <h2 className="border-b border-border pb-3 font-serif text-2xl font-semibold text-foreground">
        Signal breakdown
      </h2>
      <div className="mt-6 space-y-6">
        {LABELS.map(({ key, label, hint }) => {
          const value = signals[key] ?? 0;
          const pct = Math.max(0, Math.min(100, (value / 25) * 100));
          const styles = barStyles(value);
          const isMbfcVerified = key === "source_credibility" && !!mbfc;
          const explanation = explanations?.[key]?.trim();
          return (
            <div key={key}>
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-foreground">
                      {label}
                    </span>
                    {isMbfcVerified && (
                      <a
                        href={mbfcSearchUrl(mbfc)}
                        target="_blank"
                        rel="noreferrer"
                        title="Rating from Media Bias/Fact Check — click to verify"
                        className="inline-flex items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 text-[11px] font-semibold text-muted transition-colors hover:border-primary/50 hover:text-primary"
                      >
                        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path
                            fillRule="evenodd"
                            d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.34a1 1 0 0 1-1.42.006l-3.75-3.75a1 1 0 1 1 1.414-1.414l3.04 3.04 6.543-6.624a1 1 0 0 1 1.417-.006Z"
                            clipRule="evenodd"
                          />
                        </svg>
                        MBFC verified
                      </a>
                    )}
                  </div>
                  <span className="mt-0.5 block text-xs text-muted">
                    {isMbfcVerified
                      ? `${mbfc.name} · ${mbfc.factualReporting} factual (MBFC) · ${mbfc.bias}`
                      : hint}
                  </span>
                </div>
                <span className={`shrink-0 text-sm font-bold tabular-nums ${styles.value}`}>
                  {value}
                  <span className="font-normal text-muted">/25</span>
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border/50">
                <div
                  className={`h-full rounded-full transition-[width] duration-1000 ease-out ${styles.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {explanation && (
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  <span className="font-semibold text-foreground/70">Why: </span>
                  {explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {mbfc && (
        <p className="mt-6 border-t border-border pt-3 text-xs text-muted">
          Source credibility is taken from{" "}
          <a
            href={mbfcSearchUrl(mbfc)}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline decoration-dotted underline-offset-2 transition-colors hover:text-primary"
          >
            Media Bias/Fact Check
          </a>
          , not estimated by the model.
        </p>
      )}
      <details className="group mt-6 rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold text-foreground transition-colors hover:text-primary">
          How is this scored?
        </summary>
        <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-muted">
          <p>
            The overall score (0–100) is roughly the sum of the four signals
            above, each worth 0–25 points. Verdict bands: 80+ High Confidence,
            60–79 Mostly Credible, 40–59 Mixed Evidence, 20–39 Low Credibility,
            below 20 Unverifiable.
          </p>
          <p>
            <span className="font-medium text-foreground/80">Article accuracy vs source trust:</span>{" "}
            the two numbers above the signals separate what the text says
            (corroboration, fact-check alignment, framing) from who published it
            (the outlet&apos;s track record). An accurate article from an
            unreliable publisher — or vice versa — shows up as a gap between
            them.
          </p>
          <p>
            <span className="font-medium text-foreground/80">Source credibility</span>{" "}
            uses Media Bias/Fact Check&apos;s human-reviewed rating when the
            outlet is recognized — it is deterministic, not AI-estimated, and a
            low-credibility outlet also caps the overall score. When the outlet
            isn&apos;t recognized, the AI estimates cautiously from the text alone.
          </p>
          <p>
            <span className="font-medium text-foreground/80">The other three signals</span>{" "}
            are the AI model&apos;s judgment of this article against its general
            knowledge. It does not search the live web, so corroboration of very
            recent events may show as &quot;Unverified&quot; — that means
            &quot;couldn&apos;t confirm&quot;, not &quot;false&quot;.
          </p>
        </div>
      </details>
    </section>
  );
}
