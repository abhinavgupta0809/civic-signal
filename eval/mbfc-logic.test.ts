import { describe, it, expect } from "vitest";
import {
  MBFC_DATA,
  mbfcToScore,
  lookupMbfc,
  applyMbfcOverride,
} from "../lib/mbfc";
import { scoreToVerdict } from "../lib/scoring";
import {
  MBFC_FACTUAL,
  ANALYSIS_FAILED_PREFIX,
  type AnalysisResult,
  type MbfcRating,
} from "../lib/types";

/** Build a clean, "perfectly credible" analysis to feed the override. */
function baseResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    score: 95,
    verdict: "High Confidence",
    summary: "A well-sourced report with corroborated claims.",
    election_related: false,
    signals: {
      source_credibility: 25,
      claim_corroboration: 24,
      fact_check_match: 23,
      manipulation_language: 23,
    },
    claims: [{ claim: "An example claim.", status: "Supported", source: "Model assessment" }],
    ...overrides,
  };
}

const CAP = { High: 100, Medium: 79, Low: 39 } as const;

describe("mbfcToScore", () => {
  it("maps each factual level to its fixed points", () => {
    expect(mbfcToScore("Very High")).toBe(25);
    expect(mbfcToScore("High")).toBe(22);
    expect(mbfcToScore("Mostly Factual")).toBe(18);
    expect(mbfcToScore("Mixed")).toBe(11);
    expect(mbfcToScore("Low")).toBe(5);
    expect(mbfcToScore("Very Low")).toBe(1);
  });

  it("is strictly decreasing from most to least factual", () => {
    const scores = MBFC_FACTUAL.map(mbfcToScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1]);
    }
  });

  it("always yields a value within a single 0-25 signal", () => {
    for (const f of MBFC_FACTUAL) {
      const s = mbfcToScore(f);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(25);
    }
  });
});

describe("lookupMbfc", () => {
  it("matches an exact domain", () => {
    expect(lookupMbfc("cnn.com")?.name).toBe("CNN");
  });

  it("falls back across subdomains", () => {
    expect(lookupMbfc("edition.cnn.com")?.domain).toBe("cnn.com");
  });

  it("normalizes a full URL with www and path", () => {
    expect(lookupMbfc("https://www.bbc.com/news/world-123")?.name).toBe("BBC");
  });

  it("returns null for unknown or empty input", () => {
    expect(lookupMbfc("no-such-domain.example")).toBeNull();
    expect(lookupMbfc("")).toBeNull();
    expect(lookupMbfc(null)).toBeNull();
    expect(lookupMbfc(undefined)).toBeNull();
  });
});

describe("applyMbfcOverride", () => {
  it("replaces source_credibility with the deterministic MBFC score", () => {
    const mbfc = lookupMbfc("cnn.com")!; // Mixed factual -> 11
    const out = applyMbfcOverride(baseResult(), mbfc);
    expect(out.signals.source_credibility).toBe(mbfcToScore(mbfc.factualReporting));
    expect(out.mbfc).toBe(mbfc);
  });

  it("adjusts the overall score by the source-credibility delta", () => {
    const mbfc = lookupMbfc("apnews.com")!; // High factual -> 22
    const before = baseResult({ score: 60, signals: { ...baseResult().signals, source_credibility: 10 } });
    const out = applyMbfcOverride(before, mbfc);
    // delta = 22 - 10 = +12 -> 72, under the High cap (100)
    expect(out.score).toBe(72);
  });

  it("caps the score at the credibility ceiling and re-derives the verdict", () => {
    const infowars = lookupMbfc("infowars.com")!; // Low credibility
    const out = applyMbfcOverride(baseResult({ score: 95 }), infowars);
    expect(out.score).toBeLessThanOrEqual(CAP.Low);
    expect(out.verdict).toBe(scoreToVerdict(out.score));

    const fox = lookupMbfc("foxnews.com")!; // Medium credibility
    const outMed = applyMbfcOverride(baseResult({ score: 95 }), fox);
    expect(outMed.score).toBeLessThanOrEqual(CAP.Medium);
    expect(outMed.verdict).toBe(scoreToVerdict(outMed.score));
  });

  it("keeps score, verdict, and cap consistent for every snapshot entry", () => {
    for (const e of MBFC_DATA) {
      const out = applyMbfcOverride(baseResult({ score: 100 }), e);
      expect(out.signals.source_credibility).toBe(mbfcToScore(e.factualReporting));
      expect(out.score, `${e.domain} exceeded its cap`).toBeLessThanOrEqual(CAP[e.credibility]);
      expect(out.verdict, `${e.domain} verdict mismatch`).toBe(scoreToVerdict(out.score));
    }
  });

  it("does not fabricate a score for a failed analysis", () => {
    const failed = baseResult({
      score: 0,
      summary: `${ANALYSIS_FAILED_PREFIX}: model returned malformed JSON`,
      signals: { source_credibility: 0, claim_corroboration: 0, fact_check_match: 0, manipulation_language: 0 },
    });
    const mbfc: MbfcRating = lookupMbfc("apnews.com")!;
    const out = applyMbfcOverride(failed, mbfc);
    expect(out.score).toBe(0);
    expect(out.signals.source_credibility).toBe(0); // not overridden
    expect(out.mbfc).toBe(mbfc); // attached for transparency
  });
});
