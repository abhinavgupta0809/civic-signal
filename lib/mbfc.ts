import {
  ANALYSIS_FAILED_PREFIX,
  type AnalysisResult,
  type MbfcCredibility,
  type MbfcFactual,
  type MbfcRating,
} from "./types";
import { clampScore, scoreToVerdict } from "./scoring";

/**
 * Curated Media Bias / Fact Check (MBFC) snapshot.
 *
 * Source: https://mediabiasfactcheck.com — human-reviewed ratings of
 * news publishers. This is a hand-maintained subset of widely-known outlets,
 * not the full MBFC database. Ratings on MBFC change over time, so treat this
 * as a snapshot (last reviewed 2026-06). For production you would replace this
 * array with the official downloadable MBFC dataset and refresh it on a
 * schedule — the lookup/scoring code below does not change.
 *
 * `factualReporting` is MBFC's accuracy measure and is what we map to a
 * deterministic source-credibility score; `credibility` is used to cap the
 * overall trust score so a known low-credibility outlet can never present as
 * trustworthy on the strength of clean-sounding copy alone.
 */
const MBFC_DATA: MbfcRating[] = [
  // ---- Wire services & major US outlets ----
  { name: "Associated Press", domain: "apnews.com", bias: "Least Biased", factualReporting: "High", credibility: "High" },
  { name: "Reuters", domain: "reuters.com", bias: "Least Biased", factualReporting: "High", credibility: "High" },
  { name: "BBC", domain: "bbc.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "BBC", domain: "bbc.co.uk", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "NPR", domain: "npr.org", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "PBS", domain: "pbs.org", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "The New York Times", domain: "nytimes.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "The Washington Post", domain: "washingtonpost.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "The Wall Street Journal", domain: "wsj.com", bias: "Right-Center", factualReporting: "Mostly Factual", credibility: "High" },
  { name: "The Guardian", domain: "theguardian.com", bias: "Left-Center", factualReporting: "Mostly Factual", credibility: "High" },
  { name: "The Economist", domain: "economist.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "Bloomberg", domain: "bloomberg.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "Financial Times", domain: "ft.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "ABC News", domain: "abcnews.go.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "CBS News", domain: "cbsnews.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "NBC News", domain: "nbcnews.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "USA Today", domain: "usatoday.com", bias: "Left-Center", factualReporting: "Mostly Factual", credibility: "High" },
  { name: "Politico", domain: "politico.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "The Hill", domain: "thehill.com", bias: "Least Biased", factualReporting: "High", credibility: "High" },
  { name: "Axios", domain: "axios.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "ProPublica", domain: "propublica.org", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "The Christian Science Monitor", domain: "csmonitor.com", bias: "Least Biased", factualReporting: "High", credibility: "High" },
  { name: "TIME", domain: "time.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "The Atlantic", domain: "theatlantic.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "The New Yorker", domain: "newyorker.com", bias: "Left", factualReporting: "High", credibility: "High" },
  { name: "Los Angeles Times", domain: "latimes.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "Chicago Tribune", domain: "chicagotribune.com", bias: "Right-Center", factualReporting: "High", credibility: "High" },

  // ---- Business / general interest ----
  { name: "Forbes", domain: "forbes.com", bias: "Right-Center", factualReporting: "Mostly Factual", credibility: "Medium" },
  { name: "Business Insider", domain: "businessinsider.com", bias: "Left-Center", factualReporting: "Mostly Factual", credibility: "Medium" },
  { name: "Vox", domain: "vox.com", bias: "Left", factualReporting: "Mostly Factual", credibility: "High" },
  { name: "Slate", domain: "slate.com", bias: "Left", factualReporting: "Mostly Factual", credibility: "Medium" },
  { name: "HuffPost", domain: "huffpost.com", bias: "Left", factualReporting: "Mostly Factual", credibility: "Medium" },

  // ---- Cable / partisan, mixed reliability ----
  { name: "CNN", domain: "cnn.com", bias: "Left", factualReporting: "Mixed", credibility: "Medium" },
  { name: "Fox News", domain: "foxnews.com", bias: "Right", factualReporting: "Mixed", credibility: "Medium" },
  { name: "MSNBC", domain: "msnbc.com", bias: "Left", factualReporting: "Mixed", credibility: "Medium" },
  { name: "New York Post", domain: "nypost.com", bias: "Right", factualReporting: "Mixed", credibility: "Medium" },
  { name: "Al Jazeera", domain: "aljazeera.com", bias: "Left-Center", factualReporting: "Mostly Factual", credibility: "Medium" },
  { name: "The Daily Wire", domain: "dailywire.com", bias: "Right", factualReporting: "Mixed", credibility: "Medium" },
  { name: "Daily Kos", domain: "dailykos.com", bias: "Left", factualReporting: "Mixed", credibility: "Medium" },

  // ---- Low credibility / questionable ----
  { name: "Breitbart", domain: "breitbart.com", bias: "Right (Questionable Source)", factualReporting: "Low", credibility: "Low", questionable: true },
  { name: "Newsmax", domain: "newsmax.com", bias: "Right (Questionable Source)", factualReporting: "Low", credibility: "Low", questionable: true },
  { name: "One America News (OANN)", domain: "oann.com", bias: "Right (Questionable Source)", factualReporting: "Very Low", credibility: "Low", questionable: true },
  { name: "InfoWars", domain: "infowars.com", bias: "Conspiracy-Pseudoscience", factualReporting: "Very Low", credibility: "Low", questionable: true },
  { name: "The Gateway Pundit", domain: "thegatewaypundit.com", bias: "Right (Questionable Source)", factualReporting: "Very Low", credibility: "Low", questionable: true },

  // ---- UK press ----
  { name: "The Telegraph", domain: "telegraph.co.uk", bias: "Right-Center", factualReporting: "Mostly Factual", credibility: "High" },
  { name: "The Independent", domain: "independent.co.uk", bias: "Left-Center", factualReporting: "Mostly Factual", credibility: "High" },
  { name: "Daily Mail", domain: "dailymail.co.uk", bias: "Right", factualReporting: "Low", credibility: "Low" },
  { name: "The Sun", domain: "thesun.co.uk", bias: "Right", factualReporting: "Low", credibility: "Low" },
  { name: "Daily Mirror", domain: "mirror.co.uk", bias: "Left", factualReporting: "Mixed", credibility: "Medium" },

  // ---- Science & fact-checkers ----
  { name: "Nature", domain: "nature.com", bias: "Pro-Science", factualReporting: "Very High", credibility: "High" },
  { name: "Science (AAAS)", domain: "science.org", bias: "Pro-Science", factualReporting: "Very High", credibility: "High" },
  { name: "Scientific American", domain: "scientificamerican.com", bias: "Pro-Science", factualReporting: "High", credibility: "High" },
  { name: "National Geographic", domain: "nationalgeographic.com", bias: "Pro-Science", factualReporting: "High", credibility: "High" },
  { name: "Snopes", domain: "snopes.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "PolitiFact", domain: "politifact.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "FactCheck.org", domain: "factcheck.org", bias: "Least Biased", factualReporting: "High", credibility: "High" },

  // ---- Canadian outlets ----
  { name: "CBC News", domain: "cbc.ca", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "CTV News", domain: "ctvnews.ca", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "Global News", domain: "globalnews.ca", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "The Globe and Mail", domain: "theglobeandmail.com", bias: "Right-Center", factualReporting: "High", credibility: "High" },
  { name: "National Post", domain: "nationalpost.com", bias: "Right-Center", factualReporting: "Mostly Factual", credibility: "High" },
  { name: "Toronto Star", domain: "thestar.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
  { name: "CP24", domain: "cp24.com", bias: "Left-Center", factualReporting: "High", credibility: "High" },
];

const BY_DOMAIN = new Map<string, MbfcRating>(
  MBFC_DATA.map((entry) => [entry.domain, entry])
);

/**
 * MBFC factual-reporting level → deterministic source-credibility points (0–25).
 * These are fixed, not model-generated, so this signal is fully auditable.
 */
const FACTUAL_TO_SCORE: Record<MbfcFactual, number> = {
  "Very High": 25,
  High: 22,
  "Mostly Factual": 18,
  Mixed: 11,
  Low: 5,
  "Very Low": 1,
};

/**
 * Ceiling the overall trust score may reach given MBFC's credibility bucket.
 * A "Low" credibility source can't exceed the Low-Credibility band, and a
 * "Medium" source can't reach the top "High Confidence" band — regardless of
 * how clean the article text reads.
 */
const CREDIBILITY_CAP: Record<MbfcCredibility, number> = {
  High: 100,
  Medium: 79,
  Low: 39,
};

export function mbfcToScore(factual: MbfcFactual): number {
  return FACTUAL_TO_SCORE[factual];
}

/**
 * Normalizes a raw domain or URL to a bare host:
 * lowercased, no protocol/path/query/port, no leading "www.".
 */
export function normalizeDomain(input: string): string {
  if (!input) return "";
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // strip protocol
  host = host.split("/")[0];
  host = host.split("?")[0];
  host = host.split("#")[0];
  host = host.split(":")[0]; // strip port
  host = host.replace(/^www\./, "");
  return host;
}

/**
 * Looks up a domain in the MBFC dataset. Tries an exact host match first,
 * then progressively drops leftmost subdomain labels so that, e.g.,
 * "edition.cnn.com" still resolves to the "cnn.com" entry.
 */
export function lookupMbfc(domain?: string | null): MbfcRating | null {
  if (!domain) return null;
  const host = normalizeDomain(domain);
  if (!host) return null;

  const exact = BY_DOMAIN.get(host);
  if (exact) return exact;

  const parts = host.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join(".");
    const match = BY_DOMAIN.get(candidate);
    if (match) return match;
  }
  return null;
}

/** A short MBFC search URL for the matched domain, for "verify this" links. */
export function mbfcSearchUrl(rating: MbfcRating): string {
  return `https://mediabiasfactcheck.com/?s=${encodeURIComponent(rating.domain)}`;
}

/**
 * Applies an MBFC rating as the authoritative source-credibility signal.
 *
 * - Overrides `signals.source_credibility` with the deterministic MBFC score.
 * - Adjusts the overall score by the delta between the model's source guess
 *   and the MBFC value, so MBFC fully governs the source-credibility portion
 *   while the model's read on the other three signals is preserved.
 * - Caps the overall score by MBFC's credibility bucket and re-derives the
 *   verdict from the resulting band, keeping score, verdict, and bars consistent.
 *
 * Failed analyses (malformed model output) are left untouched apart from
 * attaching the rating for transparency — we don't manufacture a score for
 * an article we couldn't actually analyze.
 */
export function applyMbfcOverride(
  result: AnalysisResult,
  mbfc: MbfcRating
): AnalysisResult {
  if (result.summary.startsWith(ANALYSIS_FAILED_PREFIX)) {
    return { ...result, mbfc };
  }

  const mbfcScore = mbfcToScore(mbfc.factualReporting);
  const previousSource = result.signals.source_credibility;
  const signals = { ...result.signals, source_credibility: mbfcScore };

  let score = clampScore(result.score - previousSource + mbfcScore);
  const cap = CREDIBILITY_CAP[mbfc.credibility];
  if (score > cap) score = cap;

  return {
    ...result,
    signals,
    score,
    verdict: scoreToVerdict(score),
    mbfc,
  };
}
