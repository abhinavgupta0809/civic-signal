// Standalone analysis pipeline for the Chrome extension build.
//
// This is a dependency-free JavaScript port of the server pipeline
// (lib/scoring.ts, lib/mbfc.ts, lib/anthropic.ts, lib/analyze.ts) so the
// extension can run WITHOUT the hosted website: it calls the Anthropic API
// directly using the user's own key, which never leaves their machine
// (stored in chrome.storage.local, sent only to api.anthropic.com).
//
// Keep the scoring data/logic in sync with the TypeScript originals.

export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";
const MAX_INPUT_CHARS = 6000;

export const VERDICTS = [
  "High Confidence",
  "Mostly Credible",
  "Mixed Evidence",
  "Low Credibility",
  "Unverifiable",
];

const CLAIM_STATUSES = ["Supported", "Disputed", "Unverified"];

// Claim importance tiers, most important first (port of lib/types.ts).
export const CLAIM_RELEVANCE = ["Central", "Supporting", "Peripheral"];

export const ANALYSIS_FAILED_PREFIX = "Analysis could not be completed";

// ---------------------------------------------------------------------------
// Election detection (port of lib/scoring.ts)
// ---------------------------------------------------------------------------

const ELECTION_KEYWORDS = [
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
];

export function detectElectionContent(text) {
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

export function scoreToVerdict(score) {
  if (score >= 80) return "High Confidence";
  if (score >= 60) return "Mostly Credible";
  if (score >= 40) return "Mixed Evidence";
  if (score >= 20) return "Low Credibility";
  return "Unverifiable";
}

export function clampScore(score) {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function clampSignal(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(25, Math.round(n)));
}

// ---------------------------------------------------------------------------
// MBFC dataset + grounding (port of lib/mbfc.ts, snapshot 2026-06)
// ---------------------------------------------------------------------------

export const MBFC_DATA = [
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

const BY_DOMAIN = new Map(MBFC_DATA.map((entry) => [entry.domain, entry]));

// ccTLDs where the registrable name sits one label deeper (dailymail.CO.UK).
const MULTI_PART_TLDS = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk",
  "com.au", "net.au", "org.au",
  "co.nz", "co.jp", "co.in", "co.za",
  "com.br", "com.mx",
]);

// "dailymail.co.uk" -> "dailymail"; "cnn.com" -> "cnn"; null if too short.
function brandLabel(host) {
  const parts = host.split(".");
  if (parts.length < 2) return null;
  const suffixLen = MULTI_PART_TLDS.has(parts.slice(-2).join(".")) ? 2 : 1;
  if (parts.length < suffixLen + 1) return null;
  return parts[parts.length - suffixLen - 1];
}

// Brand -> rating so TLD variants (dailymail.com vs dailymail.co.uk) still
// match. Brands mapping to more than one distinct outlet are dropped.
const BY_BRAND = (() => {
  const map = new Map();
  const ambiguous = new Set();
  for (const entry of MBFC_DATA) {
    const brand = brandLabel(entry.domain);
    if (!brand) continue;
    const existing = map.get(brand);
    if (existing && existing.name !== entry.name) {
      ambiguous.add(brand);
      continue;
    }
    if (!existing) map.set(brand, entry);
  }
  for (const brand of ambiguous) map.delete(brand);
  return map;
})();

const FACTUAL_TO_SCORE = {
  "Very High": 25,
  High: 22,
  "Mostly Factual": 18,
  Mixed: 11,
  Low: 5,
  "Very Low": 1,
};

const CREDIBILITY_CAP = {
  High: 100,
  Medium: 79,
  Low: 39,
};

export function normalizeDomain(input) {
  if (!input) return "";
  let host = String(input).trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  host = host.split("/")[0];
  host = host.split("?")[0];
  host = host.split("#")[0];
  host = host.split(":")[0];
  host = host.replace(/^www\./, "");
  return host;
}

export function lookupMbfc(domain) {
  if (!domain) return null;
  const host = normalizeDomain(domain);
  if (!host) return null;

  const exact = BY_DOMAIN.get(host);
  if (exact) return exact;

  const parts = host.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const match = BY_DOMAIN.get(parts.slice(i).join("."));
    if (match) return match;
  }

  const brand = brandLabel(host);
  if (brand) {
    const match = BY_BRAND.get(brand);
    if (match) return match;
  }
  return null;
}

export function applyMbfcOverride(result, mbfc) {
  if (result.summary.startsWith(ANALYSIS_FAILED_PREFIX)) {
    return { ...result, mbfc };
  }

  const mbfcScore = FACTUAL_TO_SCORE[mbfc.factualReporting];
  const previousSource = result.signals.source_credibility;
  const signals = { ...result.signals, source_credibility: mbfcScore };

  let score = clampScore(result.score - previousSource + mbfcScore);
  const cap = CREDIBILITY_CAP[mbfc.credibility];
  const capped = score > cap;
  if (capped) score = cap;

  const sourceExplanation =
    `Media Bias/Fact Check rates ${mbfc.name} "${mbfc.factualReporting}" for factual reporting ` +
    `(${mbfc.credibility} credibility), which sets this signal deterministically.` +
    (capped
      ? ` The overall score is also capped at ${cap} because of the outlet's ${mbfc.credibility} credibility rating.`
      : "");

  return {
    ...result,
    signals,
    signal_explanations: {
      ...(result.signal_explanations || {}),
      source_credibility: sourceExplanation,
    },
    score,
    verdict: scoreToVerdict(score),
    mbfc,
  };
}

// ---------------------------------------------------------------------------
// Prompt + parsing (port of lib/anthropic.ts)
// ---------------------------------------------------------------------------

function buildMbfcBlock(mbfc) {
  if (!mbfc) {
    return [
      "SOURCE CREDIBILITY: No Media Bias/Fact Check rating was found for this domain.",
      "Estimate source_credibility cautiously from the text alone and do not assume an established reputation.",
    ].join("\n");
  }

  return [
    "SOURCE CREDIBILITY (AUTHORITATIVE — Media Bias/Fact Check):",
    `- Outlet: ${mbfc.name}`,
    `- Factual Reporting: ${mbfc.factualReporting}`,
    `- Bias: ${mbfc.bias}`,
    `- MBFC Credibility: ${mbfc.credibility}`,
    mbfc.questionable
      ? "- Note: MBFC flags this as a Questionable/Conspiracy source."
      : "",
    "Treat this MBFC rating as the definitive measure of source credibility.",
    "Set source_credibility to match it and do not let polished writing raise the overall score above what this rating supports.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildAnalysisPrompt({ text, domain, electionRelated, mbfc }) {
  const trimmed = text.slice(0, MAX_INPUT_CHARS);
  const domainLine = domain && domain.trim()
    ? `SOURCE DOMAIN: ${domain.trim()}`
    : "SOURCE DOMAIN: (not provided)";
  const mbfcBlock = buildMbfcBlock(mbfc);
  const electionLine = electionRelated
    ? "ELECTION CONTEXT: This article appears election- or voting-related. Apply extra scrutiny to voting procedures, deadlines, and eligibility claims."
    : "ELECTION CONTEXT: Not detected.";

  const today = new Date().toISOString().slice(0, 10);

  return `You are a careful credibility analyst for a news-literacy tool.

Your task: evaluate the article below and return ONE JSON object only. No prose, no markdown fences, no commentary.

TODAY'S DATE: ${today}. Your training data may end before this date. Do NOT treat article dates on or before today as anachronistic, fictional, or "in the future", and do not penalize the article for describing recent events you have no record of.

Rules:
- Focus on checkable factual claims (people, events, numbers, procedures) — not opinions or predictions.
- Extract between 3 and 5 claims. Never fewer than 3, never more than 5. Prefer the claims most central to the article's main story.
- Each claim's "status" must be exactly one of: "Supported", "Disputed", "Unverified".
  - "Supported": consistent with your knowledge or clearly evidenced within the article.
  - "Disputed": contradicts your knowledge or is contested by credible sources.
  - "Unverified": you cannot confirm or deny it (e.g. very recent events). Recency alone is NOT grounds for "Disputed".
- Each claim's "relevance" must be exactly one of: "Central", "Supporting", "Peripheral".
  - "Central": carries the article's main story (its headline topic).
  - "Supporting": adds context or detail to the main story.
  - "Peripheral": an aside — celebrity sightings, trivia, promotions, or anything that could be deleted without changing the main story.
- Each claim's "note" is ONE short sentence explaining the status and relevance call.
- Each entry in "signal_explanations" is ONE short plain-English sentence a general reader can understand, citing something concrete about THIS article (a phrase, a pattern, a gap) that justifies that signal's score.
- "verdict" must be exactly one of: "High Confidence", "Mostly Credible", "Mixed Evidence", "Low Credibility", "Unverifiable".
- "summary" must be 1–2 plain-English sentences.
- Signals are integers 0–25 each; "score" is an integer 0–100 roughly equal to the sum of the four signals.
- If the article is too short, opinion-only, or contains no checkable facts, return verdict "Unverifiable" with a low score.
- "source" on each claim should be "Model assessment" unless you can cite something that clearly appears in the article.

Return JSON matching exactly this shape:
{
  "score": 0,
  "verdict": "Mixed Evidence",
  "summary": "Short plain-English explanation",
  "election_related": ${electionRelated},
  "signals": {
    "source_credibility": 0,
    "claim_corroboration": 0,
    "fact_check_match": 0,
    "manipulation_language": 0
  },
  "signal_explanations": {
    "source_credibility": "One-sentence reason",
    "claim_corroboration": "One-sentence reason",
    "fact_check_match": "One-sentence reason",
    "manipulation_language": "One-sentence reason"
  },
  "claims": [
    { "claim": "Claim text", "status": "Supported", "relevance": "Central", "note": "One-sentence reason", "source": "Model assessment" }
  ]
}

${domainLine}
${mbfcBlock}
${electionLine}

ARTICLE TEXT:
"""
${trimmed}
"""

Respond with the JSON object only.`;
}

function extractJsonObject(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;

  const start = candidate.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}

function safeFallback(electionRelated, reason) {
  return {
    score: 0,
    verdict: "Unverifiable",
    summary: `${ANALYSIS_FAILED_PREFIX}: ${reason}`,
    election_related: electionRelated,
    signals: {
      source_credibility: 0,
      claim_corroboration: 0,
      fact_check_match: 0,
      manipulation_language: 0,
    },
    signal_explanations: {
      source_credibility: "Analysis failed, so no signal could be assessed.",
      claim_corroboration: "Analysis failed, so no signal could be assessed.",
      fact_check_match: "Analysis failed, so no signal could be assessed.",
      manipulation_language: "Analysis failed, so no signal could be assessed.",
    },
    claims: [
      {
        claim: "No claims could be extracted from the provided text.",
        status: "Unverified",
        relevance: "Central",
        note: "The analysis did not complete, so no claims were assessed.",
        source: "Model assessment",
      },
    ],
  };
}

/** Structural validation of the parsed model output (zod-free port). */
function isValidAnalysis(data) {
  if (!data || typeof data !== "object") return false;
  if (typeof data.score !== "number") return false;
  if (typeof data.summary !== "string" || data.summary.length === 0) return false;
  if (typeof data.election_related !== "boolean") return false;
  const s = data.signals;
  if (
    !s ||
    typeof s.source_credibility !== "number" ||
    typeof s.claim_corroboration !== "number" ||
    typeof s.fact_check_match !== "number" ||
    typeof s.manipulation_language !== "number"
  ) {
    return false;
  }
  if (!Array.isArray(data.claims) || data.claims.length < 1 || data.claims.length > 8) {
    return false;
  }
  return data.claims.every(
    (c) =>
      c &&
      typeof c.claim === "string" &&
      c.claim.length > 0 &&
      CLAIM_STATUSES.includes(c.status)
  );
}

export function parseModelResponse(raw, electionRelated) {
  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) {
    return safeFallback(electionRelated, "model did not return JSON");
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return safeFallback(electionRelated, "model returned malformed JSON");
  }

  if (!isValidAnalysis(parsed)) {
    return safeFallback(
      electionRelated,
      "model response did not match expected schema"
    );
  }

  const signals = {
    source_credibility: clampSignal(parsed.signals.source_credibility),
    claim_corroboration: clampSignal(parsed.signals.claim_corroboration),
    fact_check_match: clampSignal(parsed.signals.fact_check_match),
    manipulation_language: clampSignal(parsed.signals.manipulation_language),
  };

  const score = clampScore(parsed.score);

  const rawExplanations =
    parsed.signal_explanations && typeof parsed.signal_explanations === "object"
      ? parsed.signal_explanations
      : {};
  const explanationOf = (key) =>
    typeof rawExplanations[key] === "string" ? rawExplanations[key].trim() : "";

  // Most important claims first: Central -> Supporting -> Peripheral.
  const relevanceRank = (r) => {
    const i = CLAIM_RELEVANCE.indexOf(r);
    return i === -1 ? 1 : i;
  };
  const claims = parsed.claims
    .slice(0, 5)
    .map((c) => ({
      claim: c.claim.trim(),
      status: c.status,
      relevance: CLAIM_RELEVANCE.includes(c.relevance) ? c.relevance : "Supporting",
      note: typeof c.note === "string" ? c.note.trim() : "",
      source:
        (typeof c.source === "string" && c.source.trim()) || "Model assessment",
    }))
    .sort((a, b) => relevanceRank(a.relevance) - relevanceRank(b.relevance));

  return {
    score,
    verdict: VERDICTS.includes(parsed.verdict)
      ? parsed.verdict
      : scoreToVerdict(score),
    summary: parsed.summary.trim(),
    election_related: electionRelated || parsed.election_related,
    signals,
    signal_explanations: {
      source_credibility: explanationOf("source_credibility"),
      claim_corroboration: explanationOf("claim_corroboration"),
      fact_check_match: explanationOf("fact_check_match"),
      manipulation_language: explanationOf("manipulation_language"),
    },
    claims,
  };
}

// ---------------------------------------------------------------------------
// Anthropic call + full pipeline
// ---------------------------------------------------------------------------

/** Thrown for problems the user can fix (missing/invalid key, rate limit). */
export class AnalysisError extends Error {
  constructor(message, { needsKey = false } = {}) {
    super(message);
    this.needsKey = needsKey;
  }
}

async function callClaude(prompt, apiKey) {
  let res;
  try {
    res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // Required by Anthropic for requests made from browser contexts.
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        // Explanations + notes lengthen the response; 1536 leaves headroom.
        max_tokens: 1536,
        // 0 for maximum run-to-run stability of statuses and scores.
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new AnalysisError(
      "Couldn't reach the Anthropic API. Check your internet connection."
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new AnalysisError(
      "Your Anthropic API key was rejected. Open settings and check the key.",
      { needsKey: true }
    );
  }
  if (res.status === 429) {
    throw new AnalysisError(
      "The Anthropic API rate-limited this key. Wait a moment and try again."
    );
  }
  if (!res.ok) {
    throw new AnalysisError(`The Anthropic API returned HTTP ${res.status}.`);
  }

  const data = await res.json();
  const block = Array.isArray(data?.content)
    ? data.content.find((c) => c.type === "text")
    : null;
  if (!block || typeof block.text !== "string") {
    throw new AnalysisError("The model returned no text content.");
  }
  return block.text;
}

/**
 * Full pipeline: election detection -> MBFC lookup -> prompt -> Claude ->
 * parse/validate -> MBFC override + cap. Mirrors lib/analyze.ts.
 */
export async function analyzeArticle({ text, domain, apiKey }) {
  if (!apiKey) {
    throw new AnalysisError(
      "No Anthropic API key is set. Open settings to add yours.",
      { needsKey: true }
    );
  }

  const electionRelated = detectElectionContent(text);
  const mbfc = lookupMbfc(domain);
  const prompt = buildAnalysisPrompt({ text, domain, electionRelated, mbfc });
  const raw = await callClaude(prompt, apiKey);
  const parsed = parseModelResponse(raw, electionRelated);

  return mbfc ? applyMbfcOverride(parsed, mbfc) : parsed;
}
