import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  ANALYSIS_FAILED_PREFIX,
  CLAIM_RELEVANCE,
  CLAIM_STATUSES,
  VERDICTS,
  type AnalysisResult,
  type MbfcRating,
} from "./types";
import { clampScore, scoreToVerdict } from "./scoring";

const MODEL = "claude-haiku-4-5";
const MAX_INPUT_CHARS = 6000;

/**
 * Max live web searches per analysis (Anthropic's built-in web_search tool).
 * Live search is what lets very recent, true claims resolve to "Supported"
 * with a citation instead of "Unverified" — training data alone can't verify
 * this week's news. Each search costs extra (see Anthropic pricing), so it's
 * capped; set WEB_SEARCH_MAX_USES=0 to disable entirely.
 */
function webSearchMaxUses(): number {
  const raw = Number(process.env.WEB_SEARCH_MAX_USES);
  if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  return 3;
}

const SignalsSchema = z.object({
  source_credibility: z.number(),
  claim_corroboration: z.number(),
  fact_check_match: z.number(),
  manipulation_language: z.number(),
});

// Explanations are transparency extras: tolerate a missing/malformed block
// rather than discarding an otherwise valid analysis.
const SignalExplanationsSchema = z
  .object({
    source_credibility: z.string().catch(""),
    claim_corroboration: z.string().catch(""),
    fact_check_match: z.string().catch(""),
    manipulation_language: z.string().catch(""),
  })
  .catch({
    source_credibility: "",
    claim_corroboration: "",
    fact_check_match: "",
    manipulation_language: "",
  });

const ClaimSchema = z.object({
  claim: z.string().min(1),
  status: z.enum(CLAIM_STATUSES),
  source: z.string().default("Model assessment"),
  relevance: z.enum(CLAIM_RELEVANCE).catch("Supporting"),
  note: z.string().catch(""),
});

const AnalysisSchema = z.object({
  score: z.number(),
  verdict: z.enum(VERDICTS),
  summary: z.string().min(1),
  election_related: z.boolean(),
  signals: SignalsSchema,
  signal_explanations: SignalExplanationsSchema.default({
    source_credibility: "",
    claim_corroboration: "",
    fact_check_match: "",
    manipulation_language: "",
  }),
  claims: z.array(ClaimSchema).min(1).max(8),
});

export interface BuildPromptInput {
  text: string;
  domain?: string;
  electionRelated: boolean;
  mbfc?: MbfcRating | null;
}

/**
 * Renders the MBFC rating (or its absence) as a prompt block. When a rating
 * exists it is presented as authoritative ground truth so the model aligns its
 * source_credibility and summary with it — the route still hard-overrides the
 * numeric signal afterwards, but this keeps the model's prose consistent.
 */
function buildMbfcBlock(mbfc?: MbfcRating | null): string {
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

/**
 * Builds the structured prompt passed to Claude.
 * The prompt is intentionally explicit about the JSON shape so we can
 * parse deterministically and reject malformed responses.
 */
export function buildAnalysisPrompt({
  text,
  domain,
  electionRelated,
  mbfc,
}: BuildPromptInput): string {
  const trimmed = text.slice(0, MAX_INPUT_CHARS);
  const domainLine = domain?.trim()
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

WEB SEARCH: If a web search tool is available, use it (within your search budget) to verify the article's most important claims — prioritize Central claims about recent events that your training data cannot cover. Base statuses on what the searches return.

Rules:
- Focus on checkable factual claims (people, events, numbers, procedures) — not opinions or predictions.
- Extract between 3 and 5 claims. Never fewer than 3, never more than 5. Prefer the claims most central to the article's main story.
- Each claim's "status" must be exactly one of: "Supported", "Disputed", "Unverified".
  - "Supported": consistent with your knowledge, clearly evidenced within the article, or corroborated by web search results.
  - "Disputed": contradicts your knowledge, credible sources, or web search results.
  - "Unverified": you cannot confirm or deny it after checking. Recency alone is NOT grounds for "Disputed".
- When a status comes from web search corroboration, set that claim's "source" to the corroborating outlet (e.g. "Corroborated via web search: BBC Sport"), not "Model assessment".
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

/**
 * Calls Claude with the prepared prompt and returns the raw text response.
 * Throws on SDK / network errors — callers should translate these into
 * user-friendly error responses.
 */
export async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. Add it to .env.local."
    );
  }

  const client = new Anthropic({ apiKey });

  const maxUses = webSearchMaxUses();
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: MODEL,
    // Explanations + notes lengthen the response; search results add more.
    max_tokens: 2048,
    // 0 for maximum run-to-run stability of statuses and scores.
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
    ...(maxUses > 0 && {
      tools: [
        {
          type: "web_search_20250305" as const,
          name: "web_search" as const,
          max_uses: maxUses,
        },
      ],
    }),
  };

  let response: Anthropic.Message;
  try {
    response = await client.messages.create(params);
  } catch (err) {
    // If the account/model rejects the web-search tool, degrade gracefully
    // to an ungrounded analysis rather than failing the request.
    if (maxUses > 0 && err instanceof Anthropic.APIError && err.status === 400) {
      response = await client.messages.create({ ...params, tools: undefined });
    } else {
      throw err;
    }
  }

  // With tools enabled the content interleaves text and search blocks; the
  // final JSON can also be split across text blocks, so join them all.
  const text = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("");
  if (!text) {
    throw new Error("Claude returned no text content.");
  }
  return text;
}

/**
 * Extracts the first balanced JSON object from an arbitrary model response.
 * Claude usually returns clean JSON under our prompt, but occasionally wraps
 * it in prose or code fences — this handles both.
 */
function extractJsonObject(raw: string): string | null {
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

function safeFallback(
  electionRelated: boolean,
  reason: string
): AnalysisResult {
  return {
    score: 0,
    verdict: "Unverifiable",
    summary: `${ANALYSIS_FAILED_PREFIX}: ${reason}`,
    election_related: electionRelated,
    article_accuracy: 0,
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

/**
 * Parses and validates Claude's response. Returns a well-formed
 * AnalysisResult, falling back to a safe "Unverifiable" result rather than
 * throwing when the model returns malformed JSON.
 */
export function parseModelResponse(
  raw: string,
  electionRelated: boolean
): AnalysisResult {
  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) {
    return safeFallback(electionRelated, "model did not return JSON");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return safeFallback(electionRelated, "model returned malformed JSON");
  }

  const result = AnalysisSchema.safeParse(parsed);
  if (!result.success) {
    return safeFallback(
      electionRelated,
      "model response did not match expected schema"
    );
  }

  const data = result.data;

  const signals = {
    source_credibility: clampSignal(data.signals.source_credibility),
    claim_corroboration: clampSignal(data.signals.claim_corroboration),
    fact_check_match: clampSignal(data.signals.fact_check_match),
    manipulation_language: clampSignal(data.signals.manipulation_language),
  };

  const score = clampScore(data.score);

  // Text-only accuracy: the three signals the model judges from the article
  // itself, scaled from their 0–75 sum to 0–100. Source reputation is
  // intentionally excluded (and the MBFC override never touches this).
  const article_accuracy = Math.round(
    ((signals.claim_corroboration +
      signals.fact_check_match +
      signals.manipulation_language) /
      75) *
      100
  );

  // Most important claims first: Central, then Supporting, then Peripheral.
  // Stable sort preserves the model's own ordering within each tier.
  const relevanceRank = (r: (typeof CLAIM_RELEVANCE)[number]) =>
    CLAIM_RELEVANCE.indexOf(r);
  const claims = data.claims
    .slice(0, 5)
    .map((c) => ({
      claim: c.claim.trim(),
      status: c.status,
      relevance: c.relevance,
      note: c.note.trim(),
      source: (c.source ?? "Model assessment").trim() || "Model assessment",
    }))
    .sort((a, b) => relevanceRank(a.relevance) - relevanceRank(b.relevance));

  return {
    score,
    verdict: VERDICTS.includes(data.verdict) ? data.verdict : scoreToVerdict(score),
    summary: data.summary.trim(),
    election_related: electionRelated || data.election_related,
    article_accuracy,
    signals,
    signal_explanations: {
      source_credibility: data.signal_explanations.source_credibility.trim(),
      claim_corroboration: data.signal_explanations.claim_corroboration.trim(),
      fact_check_match: data.signal_explanations.fact_check_match.trim(),
      manipulation_language: data.signal_explanations.manipulation_language.trim(),
    },
    claims,
  };
}

function clampSignal(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(25, Math.round(n)));
}
