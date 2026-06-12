import { NextResponse } from "next/server";
import {
  buildAnalysisPrompt,
  callClaude,
  parseModelResponse,
} from "@/lib/anthropic";
import { detectElectionContent } from "@/lib/scoring";
import { applyMbfcOverride, lookupMbfc } from "@/lib/mbfc";
import type { AnalyzeRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_TEXT_LENGTH = 40;

// Permissive CORS for local MVP — lets the Chrome extension (origin
// chrome-extension://...) and any local tool hit this endpoint.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function jsonWithCors(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  let body: AnalyzeRequest;
  try {
    body = (await req.json()) as AnalyzeRequest;
  } catch {
    return jsonWithCors({ error: "Request body must be valid JSON." }, 400);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const domain =
    typeof body.domain === "string" && body.domain.trim().length > 0
      ? body.domain.trim()
      : undefined;

  if (!text) {
    return jsonWithCors({ error: "Please paste article text to analyze." }, 400);
  }
  if (text.length < MIN_TEXT_LENGTH) {
    return jsonWithCors(
      { error: `Article text is too short (minimum ${MIN_TEXT_LENGTH} characters).` },
      400
    );
  }

  const electionRelated = detectElectionContent(text);
  // MBFC is the preferred source-credibility authority: look it up first and
  // feed it into the prompt, then hard-override the signal after parsing.
  const mbfc = lookupMbfc(domain);
  const prompt = buildAnalysisPrompt({ text, domain, electionRelated, mbfc });

  let raw: string;
  try {
    raw = await callClaude(prompt);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown analysis error.";
    const isConfig = message.includes("ANTHROPIC_API_KEY");
    return jsonWithCors(
      {
        error: isConfig
          ? message
          : "Analysis service is unavailable right now. Please try again.",
      },
      isConfig ? 500 : 502
    );
  }

  const parsed = parseModelResponse(raw, electionRelated);
  const result = mbfc ? applyMbfcOverride(parsed, mbfc) : parsed;
  return jsonWithCors(result, 200);
}
