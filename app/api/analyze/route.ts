import { NextResponse } from "next/server";
import { analyzeArticle } from "@/lib/analyze";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
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

function jsonWithCors(
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, ...extraHeaders },
  });
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

  // Gate the paid Claude call behind rate limits so a public deployment can't
  // run up the API bill. Checked after cheap validation, before any model call.
  const rl = checkRateLimit(clientIp(req));
  if (!rl.ok) {
    return jsonWithCors({ error: rl.error }, rl.status, {
      "Retry-After": String(rl.retryAfter),
    });
  }

  let result;
  try {
    result = await analyzeArticle({ text, domain });
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

  return jsonWithCors(result, 200);
}
