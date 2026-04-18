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
}

export interface AnalyzeRequest {
  text: string;
  domain?: string;
}

export interface AnalyzeErrorResponse {
  error: string;
}

export type AnalyzeResponse = AnalysisResult | AnalyzeErrorResponse;
