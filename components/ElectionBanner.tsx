"use client";

export function ElectionBanner() {
  return (
    <div
      role="alert"
      className="animate-fade-in flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
    >
      <svg
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
      <div className="text-sm leading-relaxed">
        <div className="font-bold text-foreground">Election-related content</div>
        <p className="mt-0.5 text-muted">
          Apply extra scrutiny before sharing. For voting procedures, deadlines,
          or eligibility questions, verify against your official state election
          website.
        </p>
      </div>
    </div>
  );
}
