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

export interface Claim {
  claim: string;
  status: ClaimStatus;
  source: string;
}

export interface AnalysisResult {
  score: number;
  verdict: Verdict;
  summary: string;
  election_related: boolean;
  signals: Signals;
  claims: Claim[];
  /**
   * Present when the source domain matched a curated MBFC entry. When set,
   * `signals.source_credibility` is MBFC-derived rather than model-estimated.
   */
  mbfc?: MbfcRating | null;
}

export interface AnalyzeRequest {
  text: string;
  domain?: string;
}

export interface AnalyzeErrorResponse {
  error: string;
}

export type AnalyzeResponse = AnalysisResult | AnalyzeErrorResponse;
