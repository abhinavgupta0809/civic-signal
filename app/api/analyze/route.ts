import { NextResponse } from "next/server";
import {
  buildAnalysisPrompt,
  callClaude,
  parseModelResponse,
} from "@/lib/anthropic";
import { detectElectionContent } from "@/lib/scoring";
import type { AnalyzeRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_TEXT_LENGTH = 40;

export async function POST(req: Request) {
  let body: AnalyzeRequest;
  try {
    body = (await req.json()) as AnalyzeRequest;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const domain =
    typeof body.domain === "string" && body.domain.trim().length > 0
      ? body.domain.trim()
      : undefined;

  if (!text) {
    return NextResponse.json(
      { error: "Please paste article text to analyze." },
      { status: 400 }
    );
  }
  if (text.length < MIN_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `Article text is too short (minimum ${MIN_TEXT_LENGTH} characters).` },
      { status: 400 }
    );
  }

  const electionRelated = detectElectionContent(text);
  const prompt = buildAnalysisPrompt({ text, domain, electionRelated });

  let raw: string;
  try {
    raw = await callClaude(prompt);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown analysis error.";
    const isConfig = message.includes("ANTHROPIC_API_KEY");
    return NextResponse.json(
      {
        error: isConfig
          ? message
          : "Analysis service is unavailable right now. Please try again.",
      },
      { status: isConfig ? 500 : 502 }
    );
  }

  const result = parseModelResponse(raw, electionRelated);
  return NextResponse.json(result, { status: 200 });
}
