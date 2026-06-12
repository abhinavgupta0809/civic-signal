"use client";

import { mbfcSearchUrl } from "@/lib/mbfc";
import type { MbfcRating, Signals } from "@/lib/types";

interface SignalBarsProps {
  signals: Signals;
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

function barColor(value: number): string {
  const pct = (value / 25) * 100;
  if (pct >= 70) return "bg-emerald-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

export function SignalBars({ signals, mbfc }: SignalBarsProps) {
  return (
    <section className="animate-slide-up rounded-2xl border border-border bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        Signal breakdown
      </h2>
      <div className="mt-4 space-y-4">
        {LABELS.map(({ key, label, hint }) => {
          const value = signals[key] ?? 0;
          const pct = Math.max(0, Math.min(100, (value / 25) * 100));
          const isMbfcVerified = key === "source_credibility" && !!mbfc;
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {label}
                    </span>
                    {isMbfcVerified && (
                      <a
                        href={mbfcSearchUrl(mbfc)}
                        target="_blank"
                        rel="noreferrer"
                        title="Rating from Media Bias/Fact Check — click to verify"
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100"
                      >
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
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
                  <div className="text-xs text-muted">
                    {isMbfcVerified
                      ? `${mbfc.name} · ${mbfc.factualReporting} factual · ${mbfc.bias} · ${mbfc.credibility} credibility`
                      : hint}
                  </div>
                </div>
                <div className="text-sm tabular-nums text-foreground/80">
                  {value}
                  <span className="text-muted"> / 25</span>
                </div>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border/60">
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ease-out ${barColor(value)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {mbfc && (
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
          Source credibility is taken from{" "}
          <a
            href={mbfcSearchUrl(mbfc)}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground/70 underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            Media Bias/Fact Check
          </a>
          , not estimated by the model.
        </p>
      )}
    </section>
  );
}
