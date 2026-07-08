import { describe, it, expect } from "vitest";
import { MBFC_DATA, normalizeDomain } from "../lib/mbfc";
import { MBFC_FACTUAL, MBFC_CREDIBILITY } from "../lib/types";

/**
 * Structural integrity of the curated MBFC snapshot (lib/mbfc.ts).
 *
 * These catch data-entry drift that would silently corrupt scoring: duplicate
 * or non-canonical domains (which break lookup), invalid enum values (which
 * break the score maps), and factual/credibility combinations that contradict
 * each other. All are deterministic — no API, no cost.
 */
describe("MBFC snapshot integrity", () => {
  it("has no duplicate domains", () => {
    const seen = new Map<string, number>();
    for (const e of MBFC_DATA) {
      seen.set(e.domain, (seen.get(e.domain) ?? 0) + 1);
    }
    const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([d]) => d);
    expect(dups, `duplicate domains: ${dups.join(", ")}`).toEqual([]);
  });

  it("uses only valid enum values and non-empty names/domains", () => {
    for (const e of MBFC_DATA) {
      expect(e.name.trim().length, `empty name for ${e.domain}`).toBeGreaterThan(0);
      expect(e.domain.trim().length, "empty domain").toBeGreaterThan(0);
      expect(MBFC_FACTUAL, `bad factualReporting for ${e.domain}`).toContain(
        e.factualReporting
      );
      expect(MBFC_CREDIBILITY, `bad credibility for ${e.domain}`).toContain(
        e.credibility
      );
    }
  });

  it("stores every domain in canonical form (lookup depends on this)", () => {
    for (const e of MBFC_DATA) {
      expect(
        normalizeDomain(e.domain),
        `${e.domain} is not canonical (has protocol/www/uppercase/path?)`
      ).toBe(e.domain);
    }
  });

  it("keeps factual reporting and credibility mutually consistent", () => {
    for (const e of MBFC_DATA) {
      const high = e.factualReporting === "Very High" || e.factualReporting === "High";
      const low = e.factualReporting === "Very Low" || e.factualReporting === "Low";
      if (high) {
        expect(
          e.credibility,
          `${e.domain}: ${e.factualReporting} factual should not be Low credibility`
        ).not.toBe("Low");
      }
      if (low) {
        expect(
          e.credibility,
          `${e.domain}: ${e.factualReporting} factual should not be High credibility`
        ).not.toBe("High");
      }
    }
  });

  it("marks questionable sources as Low credibility", () => {
    for (const e of MBFC_DATA) {
      if (e.questionable) {
        expect(e.credibility, `${e.domain} is questionable but not Low`).toBe("Low");
      }
    }
  });
});
