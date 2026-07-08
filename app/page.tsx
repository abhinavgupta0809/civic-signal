"use client";

import { useRef, useState } from "react";
import { ScoreCard } from "@/components/ScoreCard";
import { SignalBars } from "@/components/SignalBars";
import { ClaimsList } from "@/components/ClaimsList";
import { ElectionBanner } from "@/components/ElectionBanner";
import { ExampleLoader } from "@/components/ExampleLoader";
import type { AnalysisResult } from "@/lib/types";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copied, setCopied] = useState(false);

  const urlInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const canAnalyzeUrl = url.trim().length > 0;
  const canAnalyzeText = text.trim().length > 0;
  const canAnalyze = canAnalyzeUrl || canAnalyzeText;

  const analyze = async (mode: "url" | "text") => {
    const payload =
      mode === "url" && url.trim()
        ? { url: url.trim() }
        : { text, domain: domain || undefined };
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    requestAnimationFrame(() =>
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setResult(data as AnalysisResult);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setUrl("");
    setText("");
    setDomain("");
    setResult(null);
    setError(null);
    setCopied(false);
  };

  const copyResults = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  return (
    <main className="mx-auto max-w-reading px-4 py-10 md:px-0 md:py-14">
      <header className="mb-10 text-center">
        <h1 className="font-serif text-[28px] font-semibold leading-9 tracking-tight text-foreground md:text-5xl md:font-bold md:leading-[56px] md:tracking-[-0.02em]">
          Credibility analysis for the news you read.
        </h1>
      </header>

      {/* URL input card */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <label
          htmlFor="article-url"
          className="block text-sm font-medium text-foreground"
        >
          Article link
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <input
              ref={urlInputRef}
              id="article-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canAnalyzeUrl && !loading)
                  analyze("url");
              }}
              placeholder="https://apnews.com/article/…"
              disabled={loading}
              className="block w-full border-b border-border bg-background py-3 pl-10 pr-3 text-[15px] text-foreground outline-none transition-all placeholder:text-muted/70 focus:border-b-2 focus:border-primary disabled:opacity-60"
            />
          </div>
          <button
            type="button"
            onClick={() => analyze("url")}
            disabled={loading || !canAnalyzeUrl}
            className="whitespace-nowrap rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-on-primary shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Analyze
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          We fetch the page and detect the source automatically
        </p>
      </section>

      {/* Divider */}
      <div className="flex items-center gap-4 py-6">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          or paste text instead
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Text input card */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <label
          htmlFor="article-text"
          className="block text-sm font-medium text-foreground"
        >
          Article text
        </label>
        <textarea
          ref={textInputRef}
          id="article-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the full text of the article here for analysis..."
          rows={8}
          disabled={loading}
          className="mt-2 block w-full resize-y rounded-lg border border-border bg-background p-4 text-[15px] leading-relaxed text-foreground outline-none transition-all placeholder:text-muted/70 focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
        />

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="md:max-w-xs">
            <label
              htmlFor="domain"
              className="block text-sm font-medium text-foreground"
            >
              Source domain{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. reuters.com"
              disabled={loading}
              className="mt-2 block w-full border-b border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-all placeholder:text-muted/70 focus:border-b-2 focus:border-primary disabled:opacity-60"
            />
          </div>
          <ExampleLoader onLoad={setText} disabled={loading} />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => analyze("text")}
            disabled={loading || !canAnalyzeText}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-on-primary shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <>
                <Spinner />
                Analyzing…
              </>
            ) : (
              "Analyze text"
            )}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={loading || (!url && !text && !result && !error)}
            className="rounded-lg border border-border bg-transparent px-6 py-3 text-sm font-medium text-foreground transition hover:bg-card-subtle disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      </section>

      <div ref={resultsRef} className="scroll-mt-20">
        {error && (
          <div
            role="alert"
            className="animate-fade-in mt-8 flex flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm md:p-12"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card-subtle">
              <svg
                className="h-8 w-8 text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M10 13a5 5 0 0 0 5.54 1.54" />
                <path d="M17.5 12.5l2.54-2.54a5 5 0 0 0-7.07-7.07L11.25 4.6" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            </div>
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              {error}
            </h2>
            <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted">
              If a link can&apos;t be read — a paywall or a script-heavy page —
              you can still analyze the article by pasting its text directly.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  textInputRef.current?.focus();
                  textInputRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                }}
                className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-on-primary shadow-sm transition hover:opacity-90"
              >
                Paste article text
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setUrl("");
                  urlInputRef.current?.focus();
                  urlInputRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                }}
                className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-primary transition hover:bg-card-subtle"
              >
                Try another link
              </button>
            </div>
          </div>
        )}

        {loading && <LoadingSkeleton />}

        {result && !loading && (
          <div className="mt-8 space-y-6">
            {result.election_related && <ElectionBanner />}
            <ScoreCard
              score={result.score}
              verdict={result.verdict}
              summary={result.summary}
            />
            <SignalBars signals={result.signals} mbfc={result.mbfc} />
            <ClaimsList claims={result.claims} />
            <div className="flex justify-center">
              <button
                type="button"
                onClick={copyResults}
                className="inline-flex items-center gap-2 border-b border-transparent pb-0.5 text-sm font-medium text-muted transition-colors hover:border-primary hover:text-primary"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                {copied ? "Copied!" : "Copy results"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mt-8 space-y-6" aria-busy="true" aria-live="polite">
      <div className="text-center md:text-left">
        <h2 className="flex items-center justify-center gap-2 font-serif text-2xl font-semibold text-foreground md:justify-start">
          <Spinner />
          Analyzing article…
        </h2>
        <p className="mt-1 text-[15px] text-muted">
          Cross-referencing claims, evaluating sources, and generating
          credibility signals.
        </p>
      </div>

      {/* Gauge skeleton */}
      <div className="flex flex-col items-center gap-8 rounded-2xl border border-border bg-card p-8 shadow-sm md:flex-row">
        <div className="skeleton h-44 w-44 shrink-0 rounded-full" />
        <div className="w-full space-y-3">
          <div className="skeleton h-6 w-36 rounded-full" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
        </div>
      </div>

      {/* Signal bars skeleton */}
      <div className="rounded-2xl border border-border bg-card-subtle p-6 shadow-sm md:p-8">
        <div className="skeleton h-5 w-44" />
        <div className="mt-6 space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="flex justify-between">
                <div className="skeleton h-3 w-1/3" />
                <div className="skeleton h-3 w-10" />
              </div>
              <div className="skeleton mt-2 h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Claims skeleton */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="skeleton h-5 w-48" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-4 rounded-xl bg-background p-4"
            >
              <div className="skeleton h-6 w-20 shrink-0 rounded" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
