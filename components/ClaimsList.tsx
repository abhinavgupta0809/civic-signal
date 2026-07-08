"use client";

import type { ReactNode } from "react";
import type { Claim, ClaimStatus } from "@/lib/types";

interface ClaimsListProps {
  claims: Claim[];
}

const STATUS_STYLES: Record<ClaimStatus, { pill: string; icon: ReactNode }> = {
  Supported: {
    pill: "bg-emerald-600/10 text-emerald-700 border-emerald-600/25 dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/25",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  Disputed: {
    pill: "bg-rose-600/10 text-rose-700 border-rose-600/25 dark:bg-rose-400/10 dark:text-rose-300 dark:border-rose-400/25",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  Unverified: {
    pill: "bg-amber-600/10 text-amber-700 border-amber-600/25 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/25",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8.94 6.94a.75.75 0 1 1-1.061-1.061 3 3 0 1 1 2.871 5.026v.345a.75.75 0 0 1-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 1 0 8.94 6.94ZM10 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
};

export function ClaimsList({ claims }: ClaimsListProps) {
  if (claims.length === 0) return null;

  return (
    <section className="animate-slide-up rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
      <h2 className="border-b border-border pb-3 font-serif text-2xl font-semibold text-foreground">
        Identified claims
      </h2>
      <ul className="mt-5 flex flex-col gap-3">
        {claims.map((c, idx) => {
          const styles = STATUS_STYLES[c.status];
          return (
            <li
              key={idx}
              className="flex flex-col gap-3 rounded-xl border border-transparent bg-background p-4 transition-colors hover:border-border sm:flex-row sm:items-start sm:gap-4"
            >
              <span
                className={`inline-flex h-fit shrink-0 items-center gap-1 rounded border px-2 py-1 text-xs font-semibold ${styles.pill}`}
              >
                {styles.icon}
                {c.status}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-relaxed text-foreground">
                  {c.claim}
                </p>
                {c.source && c.source !== "Model assessment" && (
                  <p className="mt-1 text-xs text-muted">Source: {c.source}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
