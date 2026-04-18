"use client";

import type { Signals } from "@/lib/types";

interface SignalBarsProps {
  signals: Signals;
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

export function SignalBars({ signals }: SignalBarsProps) {
  return (
    <section className="animate-slide-up rounded-2xl border border-border bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        Signal breakdown
      </h2>
      <div className="mt-4 space-y-4">
        {LABELS.map(({ key, label, hint }) => {
          const value = signals[key] ?? 0;
          const pct = Math.max(0, Math.min(100, (value / 25) * 100));
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {label}
                  </div>
                  <div className="text-xs text-muted">{hint}</div>
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
    </section>
  );
}
