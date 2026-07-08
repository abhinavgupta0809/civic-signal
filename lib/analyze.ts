import {
  buildAnalysisPrompt,
  callClaude,
  parseModelResponse,
} from "./anthropic";
import { detectElectionContent } from "./scoring";
import { applyMbfcOverride, lookupMbfc } from "./mbfc";
import type { AnalysisResult } from "./types";

export interface AnalyzeArticleInput {
  /** The article body to analyze. */
  text: string;
  /** Source domain or URL; enables MBFC grounding when it matches a rating. */
  domain?: string;
  /**
   * When true (default), MBFC grounding is active: the matched rating is
   * injected into the prompt AND applied as a deterministic override/cap.
   * When false, MBFC is fully disabled — no injection, no override — so the
   * result reflects the model's ungrounded judgement. This flag is what powers
   * the eval ablation (MBFC on vs off).
   */
  applyMbfc?: boolean;
}

/**
 * Runs the full credibility pipeline: election detection -> MBFC lookup ->
 * prompt -> Claude -> parse/validate -> MBFC override + cap. This is the single
 * source of truth for "analyze an article", shared by the API route and the
 * eval harness so both exercise identical logic.
 *
 * Throws on Claude SDK/network/config errors — callers translate those into
 * user-facing responses. Malformed model output does NOT throw; it returns a
 * safe "Unverifiable" result (see parseModelResponse).
 */
export async function analyzeArticle({
  text,
  domain,
  applyMbfc = true,
}: AnalyzeArticleInput): Promise<AnalysisResult> {
  const electionRelated = detectElectionContent(text);

  // MBFC is the preferred source-credibility authority: look it up first and
  // feed it into the prompt, then hard-override the signal after parsing.
  // With applyMbfc=false we skip both, for the ungrounded ablation baseline.
  const mbfc = applyMbfc ? lookupMbfc(domain) : null;

  const prompt = buildAnalysisPrompt({ text, domain, electionRelated, mbfc });
  const raw = await callClaude(prompt);
  const parsed = parseModelResponse(raw, electionRelated);

  return mbfc ? applyMbfcOverride(parsed, mbfc) : parsed;
}
