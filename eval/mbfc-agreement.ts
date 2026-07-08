/**
 * MBFC snapshot vs. independent gold labels — the "is MBFC giving good ratings?"
 * report at the dataset level. Deterministic, no API. Run via `npm run eval`.
 *
 * Reports: coverage of the gold set, credibility-bucket agreement on the
 * overlap, a confusion matrix, every disagreement, and every coverage gap
 * (gold sources missing from the snapshot — i.e. what to add next).
 *
 * Exit code is non-zero only on a DANGEROUS disagreement (gold High vs snapshot
 * Low, or vice-versa), which would be a genuine scoring bug. Coverage gaps and
 * adjacent (High<->Medium, Medium<->Low) differences are reported, not failed.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { lookupMbfc } from "../lib/mbfc";
import { MBFC_CREDIBILITY, type MbfcCredibility } from "../lib/types";

const here = dirname(fileURLToPath(import.meta.url));

interface GoldSource {
  domain: string;
  name: string;
  credibility: MbfcCredibility;
  note?: string;
}

const gold: { sources: GoldSource[] } = JSON.parse(
  readFileSync(join(here, "fixtures", "gold-sources.json"), "utf8")
);

const TIERS = MBFC_CREDIBILITY; // ["High","Medium","Low"]

function rank(t: MbfcCredibility): number {
  return TIERS.indexOf(t); // 0 High .. 2 Low
}

interface Row {
  domain: string;
  name: string;
  gold: MbfcCredibility;
  snapshot: MbfcCredibility;
  severe: boolean;
}

const covered: Row[] = [];
const gaps: GoldSource[] = [];

for (const g of gold.sources) {
  const rating = lookupMbfc(g.domain);
  if (!rating) {
    gaps.push(g);
    continue;
  }
  const severe = Math.abs(rank(g.credibility) - rank(rating.credibility)) >= 2;
  covered.push({
    domain: g.domain,
    name: g.name,
    gold: g.credibility,
    snapshot: rating.credibility,
    severe,
  });
}

const total = gold.sources.length;
const matches = covered.filter((r) => r.gold === r.snapshot);
const disagreements = covered.filter((r) => r.gold !== r.snapshot);
const severe = disagreements.filter((r) => r.severe);

const pct = (n: number, d: number) => (d === 0 ? "0.0" : ((100 * n) / d).toFixed(1));

// Confusion matrix: rows = gold tier, cols = snapshot tier.
const matrix: Record<string, Record<string, number>> = {};
for (const t of TIERS) matrix[t] = Object.fromEntries(TIERS.map((c) => [c, 0]));
for (const r of covered) matrix[r.gold][r.snapshot] += 1;

const now = new Date().toISOString().slice(0, 16).replace("T", " ");
const md: string[] = [];
const w = (s = "") => md.push(s);

w(`# MBFC snapshot vs. gold labels — dataset agreement`);
w();
w(`_Generated ${now} UTC · deterministic (no API) · run via \`npm run eval\`_`);
w();
w(
  `> Grades the curated MBFC snapshot in \`lib/mbfc.ts\` against an independent ` +
    `reliability consensus (\`eval/fixtures/gold-sources.json\`). Gold labels are a ` +
    `curated consensus, not absolute truth.`
);
w();
w(`| Metric | Value |`);
w(`| --- | --- |`);
w(`| Gold sources | ${total} |`);
w(`| Covered by snapshot | ${covered.length} (${pct(covered.length, total)}%) |`);
w(`| Agreement on overlap | ${matches.length}/${covered.length} (${pct(matches.length, covered.length)}%) |`);
w(`| Disagreements | ${disagreements.length} (dangerous High↔Low: ${severe.length}) |`);
w();
w(`## Confusion matrix (rows = gold, cols = snapshot)`);
w();
w(`| gold \\ snapshot | ${TIERS.join(" | ")} |`);
w(`| --- | ${TIERS.map(() => "---").join(" | ")} |`);
for (const g of TIERS) {
  w(`| ${g} | ${TIERS.map((s) => matrix[g][s] || "").join(" | ")} |`);
}
w();
if (disagreements.length) {
  w(`## Disagreements`);
  w();
  for (const r of disagreements) {
    w(`- ${r.severe ? "**‼ dangerous** " : ""}\`${r.domain}\` — gold=${r.gold}, snapshot=${r.snapshot}`);
  }
  w();
}
if (gaps.length) {
  w(`## Coverage gaps — in gold set, missing from the snapshot (${gaps.length})`);
  w();
  w(`These are sources to add next to extend coverage:`);
  w();
  for (const g of gaps) w(`- \`${g.domain}\` (consensus: ${g.credibility})`);
  w();
}
w(
  severe.length > 0
    ? `**FAIL:** ${severe.length} dangerous High↔Low disagreement(s) — fix \`lib/mbfc.ts\`.`
    : `**OK:** no dangerous disagreements. Coverage gaps above are opportunities to extend the dataset.`
);
w();

const reportDir = join(here, "report");
mkdirSync(reportDir, { recursive: true });
writeFileSync(join(reportDir, "agreement.md"), md.join("\n"));

console.log(md.join("\n"));
console.log(`\nReport written to eval/report/agreement.md`);

if (severe.length > 0) process.exit(1);
