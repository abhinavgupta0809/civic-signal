export const VERDICTS = [
  "High Confidence",
  "Mostly Credible",
  "Mixed Evidence",
  "Low Credibility",
  "Unverifiable",
] as const;

export type Verdict = (typeof VERDICTS)[number];

export const CLAIM_STATUSES = ["Supported", "Disputed", "Unverified"] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/**
 * How central a claim is to the article's main story, highest first.
 * "Central" claims carry the article's core narrative; "Supporting" claims add
 * context to it; "Peripheral" claims are asides (celebrity mentions, trivia,
 * cross-promotion) that don't affect the main story's credibility.
 */
export const CLAIM_RELEVANCE = ["Central", "Supporting", "Peripheral"] as const;

export type ClaimRelevance = (typeof CLAIM_RELEVANCE)[number];

/**
 * Media Bias / Fact Check "Factual Reporting" levels, highest to lowest.
 * This is MBFC's primary measure of how accurately a source reports.
 */
export const MBFC_FACTUAL = [
  "Very High",
  "High",
  "Mostly Factual",
  "Mixed",
  "Low",
  "Very Low",
] as const;

export type MbfcFactual = (typeof MBFC_FACTUAL)[number];

/** MBFC's overall credibility bucket, derived from factual reporting + traffic + history. */
export const MBFC_CREDIBILITY = ["High", "Medium", "Low"] as const;

export type MbfcCredibility = (typeof MBFC_CREDIBILITY)[number];

/**
 * A curated Media Bias / Fact Check rating for a known publisher.
 * When present, this is treated as the authoritative source-credibility
 * signal and overrides the model's own guess.
 */
export interface MbfcRating {
  /** Publisher name, e.g. "Associated Press". */
  name: string;
  /** Registrable domain the rating is keyed on, e.g. "apnews.com". */
  domain: string;
  /** Human-readable bias label using MBFC's vocabulary. */
  bias: string;
  factualReporting: MbfcFactual;
  credibility: MbfcCredibility;
  /** True for sources MBFC flags as Questionable / Conspiracy-Pseudoscience. */
  questionable?: boolean;
}

/** Prefix used on the summary of a failed analysis so downstream steps can detect it. */
export const ANALYSIS_FAILED_PREFIX = "Analysis could not be completed";

export interface Signals {
  source_credibility: number;
  claim_corroboration: number;
  fact_check_match: number;
  manipulation_language: number;
}

/**
 * One plain-English sentence per signal explaining why it got its score.
 * Written by the model, except source_credibility which is replaced with
 * MBFC-derived text when a rating matched.
 */
export interface SignalExplanations {
  source_credibility: string;
  claim_corroboration: string;
  fact_check_match: string;
  manipulation_language: string;
}

export interface Claim {
  claim: string;
  status: ClaimStatus;
  source: string;
  /** How central this claim is to the article's main story. */
  relevance: ClaimRelevance;
  /** Short reason for the status/relevance call, e.g. "Aside about a celebrity attendee, unrelated to the match report." */
  note: string;
}

export interface AnalysisResult {
  score: number;
  verdict: Verdict;
  summary: string;
  election_related: boolean;
  /**
   * 0–100 score for the article TEXT alone (claim corroboration, fact-check
   * match, manipulation language — scaled from their 0–75 sum). Deliberately
   * excludes source reputation, so an accurate article from a distrusted
   * outlet (or a shaky article from a reputable one) is legible at a glance.
   */
  article_accuracy: number;
  signals: Signals;
  /** Per-signal reasoning shown under each bar in the UI. */
  signal_explanations: SignalExplanations;
  claims: Claim[];
  /**
   * Present when the source domain matched a curated MBFC entry. When set,
   * `signals.source_credibility` is MBFC-derived rather than model-estimated.
   */
  mbfc?: MbfcRating | null;
}

export interface AnalyzeRequest {
  /** Raw article text (paste-text path). */
  text?: string;
  /** Optional source domain; enables MBFC grounding on the text path. */
  domain?: string;
  /** Article URL (URL-first path); the server fetches and extracts the text. */
  url?: string;
}

export interface AnalyzeErrorResponse {
  error: string;
}

export type AnalyzeResponse = AnalysisResult | AnalyzeErrorResponse;
