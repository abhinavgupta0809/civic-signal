"use client";

export const SAMPLE_ARTICLE = `Election officials in three swing states announced on Tuesday that mail-in ballot requests have surged by 42% compared to the last presidential primary, with most applications coming from first-time absentee voters.

Critics on social media claimed that mail-in voting leads to widespread voter fraud, citing an unnamed "internal memo" that they say proves thousands of ballots in one swing state were discarded on election day. Officials from both parties disputed the memo's existence, and the state's top election official said polling place procedures were audited and no ballots had been improperly discarded.

A candidate running in the primary said voter suppression tactics, including new voter ID requirements and reduced polling hours, were targeting absentee and college voters. Election board records show polling hours were extended, not reduced, in seven of the twelve counties named.`;

interface ExampleLoaderProps {
  onLoad: (text: string) => void;
  disabled?: boolean;
}

export function ExampleLoader({ onLoad, disabled }: ExampleLoaderProps) {
  return (
    <button
      type="button"
      onClick={() => onLoad(SAMPLE_ARTICLE)}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground/80 transition hover:bg-muted/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm6 1v2a1 1 0 0 0 1 1h2l-3-3Z"
          clipRule="evenodd"
        />
      </svg>
      Load sample article
    </button>
  );
}
