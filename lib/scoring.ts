import type { Verdict } from "./types";

export const ELECTION_KEYWORDS = [
  "ballot",
  "voter id",
  "polling place",
  "election day",
  "absentee",
  "mail-in",
  "voter fraud",
  "electoral college",
  "swing state",
  "candidate",
  "primary",
  "caucus",
  "voter suppression",
] as const;

/**
 * Returns true when at least two election-related keywords appear in the text.
 * The two-hit threshold reduces false positives from passing mentions
 * (e.g. the word "candidate" in an unrelated job-market article).
 */
export function detectElectionContent(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const kw of ELECTION_KEYWORDS) {
    if (lower.includes(kw)) {
      hits += 1;
      if (hits >= 2) return true;
    }
  }
  return false;
}

export type ScoreColor = "green" | "amber" | "red";

export function scoreToColor(score: number): ScoreColor {
  if (score >= 70) return "green";
  if (score >= 40) return "amber";
  return "red";
}

/**
 * Safety fallback used only when Claude returns an invalid verdict label.
 * Bands mirror the execution-plan spec.
 */
export function scoreToVerdict(score: number): Verdict {
  if (score >= 80) return "High Confidence";
  if (score >= 60) return "Mostly Credible";
  if (score >= 40) return "Mixed Evidence";
  if (score >= 20) return "Low Credibility";
  return "Unverifiable";
}

export function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}
