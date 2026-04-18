import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  CLAIM_STATUSES,
  VERDICTS,
  type AnalysisResult,
} from "./types";
import { clampScore, scoreToVerdict } from "./scoring";

const MODEL = "claude-haiku-4-5";
const MAX_INPUT_CHARS = 6000;

const SignalsSchema = z.object({
  source_credibility: z.number(),
  claim_corroboration: z.number(),
  fact_check_match: z.number(),
  manipulation_language: z.number(),
});

const ClaimSchema = z.object({
  claim: z.string().min(1),
  status: z.enum(CLAIM_STATUSES),
  source: z.string().default("Model assessment"),
});

const AnalysisSchema = z.object({
  score: z.number(),
  verdict: z.enum(VERDICTS),
  summary: z.string().min(1),
  election_related: z.boolean(),
  signals: SignalsSchema,
  claims: z.array(ClaimSchema).min(1).max(8),
});

export interface BuildPromptInput {
  text: string;
  domain?: string;
  electionRelated: boolean;
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
}: BuildPromptInput): string {
  const trimmed = text.slice(0, MAX_INPUT_CHARS);
  const domainLine = domain?.trim()
    ? `SOURCE DOMAIN: ${domain.trim()}`
    : "SOURCE DOMAIN: (not provided)";
  const electionLine = electionRelated
    ? "ELECTION CONTEXT: This article appears election- or voting-related. Apply extra scrutiny to voting procedures, deadlines, and eligibility claims."
    : "ELECTION CONTEXT: Not detected.";

  return `You are a careful credibility analyst for a news-literacy tool.

Your task: evaluate the article below and return ONE JSON object only. No prose, no markdown fences, no commentary.

Rules:
- Focus on checkable factual claims (people, events, numbers, procedures) — not opinions or predictions.
- Extract between 3 and 5 claims. Never fewer than 3, never more than 5.
- Each claim's "status" must be exactly one of: "Supported", "Disputed", "Unverified".
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
  "claims": [
    { "claim": "Claim text", "status": "Supported", "source": "Model assessment" }
  ]
}

${domainLine}
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

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content.find((c) => c.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text content.");
  }
  return block.text;
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
    summary: `Analysis could not be completed: ${reason}`,
    election_related: electionRelated,
    signals: {
      source_credibility: 0,
      claim_corroboration: 0,
      fact_check_match: 0,
      manipulation_language: 0,
    },
    claims: [
      {
        claim: "No claims could be extracted from the provided text.",
        status: "Unverified",
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

  return {
    score,
    verdict: VERDICTS.includes(data.verdict) ? data.verdict : scoreToVerdict(score),
    summary: data.summary.trim(),
    election_related: electionRelated || data.election_related,
    signals,
    claims: data.claims.slice(0, 5).map((c) => ({
      claim: c.claim.trim(),
      status: c.status,
      source: (c.source ?? "Model assessment").trim() || "Model assessment",
    })),
  };
}

function clampSignal(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(25, Math.round(n)));
}
