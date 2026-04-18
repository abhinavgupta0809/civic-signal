"use client";

import type { Claim, ClaimStatus } from "@/lib/types";

interface ClaimsListProps {
  claims: Claim[];
}

const STATUS_STYLES: Record<ClaimStatus, string> = {
  Supported: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Disputed: "bg-rose-100 text-rose-800 border-rose-200",
  Unverified: "bg-amber-100 text-amber-800 border-amber-200",
};

export function ClaimsList({ claims }: ClaimsListProps) {
  if (claims.length === 0) return null;

  return (
    <section className="animate-slide-up rounded-2xl border border-border bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        Extracted claims
      </h2>
      <ul className="mt-4 divide-y divide-border">
        {claims.map((c, idx) => (
          <li key={idx} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:gap-4">
            <span
              className={`inline-flex h-fit shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status]}`}
            >
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
        ))}
      </ul>
    </section>
  );
}
