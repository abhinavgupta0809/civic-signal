import { NextResponse } from "next/server";
import { analyzeArticle } from "@/lib/analyze";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { ExtractError, fetchArticle } from "@/lib/extract";
import type { AnalyzeRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_TEXT_LENGTH = 40;

// No CORS headers on purpose: the endpoint is same-origin only. The Chrome
// extension is a standalone build that talks to Anthropic directly, so no
// cross-origin caller is expected — a wildcard here would let arbitrary
// websites spend this deployment's API budget from visitors' browsers.
function json(
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(body, { status, headers: extraHeaders });
}

export async function POST(req: Request) {
  let body: AnalyzeRequest;
  try {
    body = (await req.json()) as AnalyzeRequest;
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const url = typeof body.url === "string" && body.url.trim() ? body.url.trim() : "";

  // Gate the paid work (URL fetch + Claude call) behind rate limits so a public
  // deployment can't run up the API bill or be used to fetch arbitrary URLs.
  const rl = checkRateLimit(clientIp(req));
  if (!rl.ok) {
    return json({ error: rl.error }, rl.status, {
      "Retry-After": String(rl.retryAfter),
    });
  }

  let text: string;
  let domain: string | undefined;

  if (url) {
    // URL-first path: fetch + extract server-side, then derive the domain from
    // the URL (which auto-enables MBFC grounding).
    try {
      const article = await fetchArticle(url);
      text = article.text;
      domain = article.domain;
    } catch (err) {
      if (err instanceof ExtractError) {
        return json({ error: err.message }, 400);
      }
      return json(
        { error: "Couldn't read that link. Please paste the article text instead." },
        502
      );
    }
  } else {
    // Paste-text path.
    text = typeof body.text === "string" ? body.text.trim() : "";
    domain =
      typeof body.domain === "string" && body.domain.trim().length > 0
        ? body.domain.trim()
        : undefined;

    if (!text) {
      return json({ error: "Please paste article text or a link to analyze." }, 400);
    }
    if (text.length < MIN_TEXT_LENGTH) {
      return json(
        { error: `Article text is too short (minimum ${MIN_TEXT_LENGTH} characters).` },
        400
      );
    }
  }

  let result;
  try {
    result = await analyzeArticle({ text, domain });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown analysis error.";
    const isConfig = message.includes("ANTHROPIC_API_KEY");
    return json(
      {
        error: isConfig
          ? message
          : "Analysis service is unavailable right now. Please try again.",
      },
      isConfig ? 500 : 502
    );
  }

  return json(result, 200);
}
