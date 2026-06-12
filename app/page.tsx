"use client";

import { useState } from "react";
import { ScoreCard } from "@/components/ScoreCard";
import { SignalBars } from "@/components/SignalBars";
import { ClaimsList } from "@/components/ClaimsList";
import { ElectionBanner } from "@/components/ElectionBanner";
import { ExampleLoader } from "@/components/ExampleLoader";
import type { AnalysisResult } from "@/lib/types";

export default function HomePage() {
  const [text, setText] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copied, setCopied] = useState(false);

  const analyze = async () => {
    if (!text.trim()) {
      setError("Please paste article text to analyze.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, domain: domain || undefined }),
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
    <main className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <header className="mb-10">
        <div className="flex items-center gap-2 text-sm font-medium text-muted">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          CivicSignal
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Credibility analysis for news you read.
        </h1>
        <p className="mt-3 text-lg text-muted">
          Analyze article credibility and surface checkable claims.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <label
          htmlFor="article-text"
          className="block text-sm font-medium text-foreground"
        >
          Article text
        </label>
        <textarea
          id="article-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the full article or claim-heavy passage here. CivicSignal will extract 3–5 checkable claims and score each signal."
          rows={10}
          disabled={loading}
          className="mt-2 block w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-[15px] leading-relaxed text-foreground outline-none transition placeholder:text-muted/80 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10 disabled:opacity-60"
        />

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label
              htmlFor="domain"
              className="block text-sm font-medium text-foreground"
            >
              Source domain <span className="text-muted">(optional)</span>
            </label>
            <input
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. apnews.com"
              disabled={loading}
              className="mt-2 block w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted/80 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10 disabled:opacity-60"
            />
          </div>
          <ExampleLoader onLoad={setText} disabled={loading} />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={analyze}
            disabled={loading || !text.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <>
                <Spinner />
                Analyzing claims and credibility...
              </>
            ) : (
              "Analyze"
            )}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={loading || (!text && !result)}
            className="inline-flex items-center rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground/80 transition hover:bg-muted/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>
          {result && (
            <button
              type="button"
              onClick={copyResults}
              className="inline-flex items-center rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground/80 transition hover:bg-muted/10 hover:text-foreground"
            >
              {copied ? "Copied!" : "Copy results"}
            </button>
          )}
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="animate-fade-in mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          {error}
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
        </div>
      )}

      <footer className="mt-16 border-t border-border pt-6 text-center text-xs text-muted">
        This is an assistive credibility signal, not a final source of truth.
      </footer>
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
    <div className="mt-8 space-y-6">
      <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="skeleton h-32 w-32 rounded-full" />
          <div className="flex-1 space-y-3">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-6 w-40" />
          </div>
        </div>
        <div className="mt-6 space-y-2">
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-5/6" />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="skeleton h-3 w-32" />
        <div className="mt-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton h-3 w-1/3" />
              <div className="skeleton mt-2 h-2 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
