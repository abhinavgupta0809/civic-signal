/**
 * Live end-to-end eval with an MBFC on/off ablation. Run via `npm run eval:live`
 * (needs ANTHROPIC_API_KEY). Runs each labeled article through the REAL pipeline
 * (lib/analyze.ts) twice — grounded and ungrounded — and writes a report to
 * eval/report/latest.md (+ .json).
 *
 * What it measures:
 *  - Cap effectiveness (headline): does MBFC grounding hold questionable-source
 *    articles at the Low-Credibility band, even when the prose reads clean?
 *  - Source separation: gap between reliable and questionable mean scores.
 *  - Verdict accuracy vs the expected band, grounded vs ungrounded.
 *  - Election-detection precision/recall.
 *
 * Cost: ~2 Haiku calls per article (on + off). The default corpus is ~12
 * articles => ~24 cheap calls.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { analyzeArticle } from "../lib/analyze";
import { lookupMbfc } from "../lib/mbfc";
import { VERDICTS, type AnalysisResult, type Verdict } from "../lib/types";

const here = dirname(fileURLToPath(import.meta.url));

// tsx doesn't load .env.local the way Next.js does — load it ourselves so
// `npm run eval:live` works without exporting the key by hand.
function loadEnvLocal(): void {
  const path = join(here, "..", ".env.local");
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key && !process.env[key]) process.env[key] = val;
  }
}
loadEnvLocal();

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "ANTHROPIC_API_KEY is not set. Add it to .env.local or export it, then re-run `npm run eval:live`."
  );
  process.exit(1);
}

type Group = "reliable" | "mixed" | "questionable" | "unknown";
interface CorpusItem {
  file: string;
  domain: string;
  group: Group;
  expectedBand: Verdict;
  electionExpected: boolean;
}

const corpus: { articles: CorpusItem[] } = JSON.parse(
  readFileSync(join(here, "fixtures", "articles", "index.json"), "utf8")
);

interface RunRow {
  domain: string;
  group: Group;
  expectedBand: Verdict;
  electionExpected: boolean;
  mbfcRating: string | null;
  on: { score: number; verdict: Verdict; election: boolean };
  off: { score: number; verdict: Verdict };
}

/** Below 40 = the Low-Credibility / Unverifiable band. */
const LOW_BAND = 40;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round = (n: number) => Math.round(n * 10) / 10;
const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(0)}%`);

async function main() {
  const rows: RunRow[] = [];

  for (const item of corpus.articles) {
    const text = readFileSync(join(here, "fixtures", "articles", item.file), "utf8").trim();
    process.stdout.write(`Analyzing ${item.domain} (${item.file}) ... `);

    let on: AnalysisResult;
    let off: AnalysisResult;
    try {
      // Sequential + grounded first, to stay gentle on rate limits.
      on = await analyzeArticle({ text, domain: item.domain, applyMbfc: true });
      off = await analyzeArticle({ text, domain: item.domain, applyMbfc: false });
    } catch (err) {
      console.log("ERROR");
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ${message}`);
      if (/credit balance is too low/i.test(message)) {
        console.error(
          "\n  Your Anthropic account is out of credits. Add credits at\n" +
            "  https://console.anthropic.com/settings/billing and re-run `npm run eval:live`.\n" +
            "  (The hosted app will fail the same way until the key has credits.)"
        );
      }
      process.exit(1);
    }

    const rating = lookupMbfc(item.domain);
    rows.push({
      domain: item.domain,
      group: item.group,
      expectedBand: item.expectedBand,
      electionExpected: item.electionExpected,
      mbfcRating: rating ? `${rating.factualReporting} / ${rating.credibility}` : null,
      on: { score: on.score, verdict: on.verdict, election: on.election_related },
      off: { score: off.score, verdict: off.verdict },
    });
    console.log(`on=${on.score} (${on.verdict})  off=${off.score} (${off.verdict})`);
  }

  // ---- Metrics ----
  const questionable = rows.filter((r) => r.group === "questionable");
  const reliable = rows.filter((r) => r.group === "reliable");

  const qPassedWithout = questionable.filter((r) => r.off.score >= LOW_BAND);
  const qHeldWith = questionable.filter((r) => r.on.score < LOW_BAND);

  const relMean = round(mean(reliable.map((r) => r.on.score)));
  const qMean = round(mean(questionable.map((r) => r.on.score)));

  const onMatches = rows.filter((r) => r.on.verdict === r.expectedBand).length;
  const offMatches = rows.filter((r) => r.off.verdict === r.expectedBand).length;

  // Election detection (MBFC-on run) precision/recall.
  const tp = rows.filter((r) => r.electionExpected && r.on.election).length;
  const fp = rows.filter((r) => !r.electionExpected && r.on.election).length;
  const fn = rows.filter((r) => r.electionExpected && !r.on.election).length;

  // Verdict confusion matrix (MBFC on): rows = expected, cols = predicted.
  const matrix: Record<string, Record<string, number>> = {};
  for (const v of VERDICTS) matrix[v] = Object.fromEntries(VERDICTS.map((c) => [c, 0]));
  for (const r of rows) matrix[r.expectedBand][r.on.verdict] += 1;

  // ---- Render markdown ----
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const md: string[] = [];
  md.push(`# CivicSignal — Live Eval Report`);
  md.push("");
  md.push(`_Generated ${now} UTC · Model: claude-haiku-4-5 · Corpus: ${rows.length} labeled articles_`);
  md.push("");
  md.push(
    `> **Honesty note.** Gold labels are a curated reliability consensus, not absolute truth, ` +
      `and this is a small illustrative corpus of original synthetic articles. Treat the numbers ` +
      `as directional evidence that MBFC grounding works — not as a benchmark score.`
  );
  md.push("");
  md.push(`## 🎯 Headline: MBFC grounding holds questionable sources to the Low-Credibility band`);
  md.push("");
  md.push(`Questionable-source articles in corpus: **${questionable.length}**`);
  md.push("");
  md.push(`| | Without MBFC (ungrounded) | With MBFC (grounded) |`);
  md.push(`| --- | --- | --- |`);
  md.push(
    `| Scored **≥40** (escaped the "Low Credibility" band) | **${qPassedWithout.length} of ${questionable.length}** | ${
      questionable.filter((r) => r.on.score >= LOW_BAND).length
    } of ${questionable.length} |`
  );
  md.push(
    `| Held at **≤39** ("Low Credibility") | ${questionable.length - qPassedWithout.length} of ${
      questionable.length
    } | **${qHeldWith.length} of ${questionable.length}** |`
  );
  md.push("");
  md.push(
    `➡️ **${qPassedWithout.length}** questionable-source article(s) read credibly enough that the ungrounded ` +
      `model let them score ≥40. MBFC grounding pulled **${qHeldWith.length}/${questionable.length}** down to the ` +
      `Low-Credibility band — the cap doing exactly its job.`
  );
  md.push("");
  md.push(`## 📊 Source separation (grounded run)`);
  md.push("");
  md.push(`- Reliable-source mean score: **${relMean}**`);
  md.push(`- Questionable-source mean score: **${qMean}**`);
  md.push(`- Separation gap: **${round(relMean - qMean)}** points`);
  md.push("");
  md.push(`## ✅ Verdict accuracy vs expected band (exact match)`);
  md.push("");
  md.push(`- With MBFC: **${onMatches}/${rows.length}** (${pct(onMatches, rows.length)})`);
  md.push(`- Without MBFC: ${offMatches}/${rows.length} (${pct(offMatches, rows.length)})`);
  md.push("");
  md.push(`## 🗳️ Election detection`);
  md.push("");
  md.push(`- Precision: ${pct(tp, tp + fp)} · Recall: ${pct(tp, tp + fn)} (tp=${tp}, fp=${fp}, fn=${fn})`);
  md.push("");
  md.push(`## Confusion matrix — grounded (rows = expected, cols = predicted)`);
  md.push("");
  md.push(`| expected \\ predicted | ${VERDICTS.join(" | ")} |`);
  md.push(`| --- | ${VERDICTS.map(() => "---").join(" | ")} |`);
  for (const e of VERDICTS) {
    md.push(`| ${e} | ${VERDICTS.map((p) => matrix[e][p] || "").join(" | ")} |`);
  }
  md.push("");
  md.push(`## Per-article detail`);
  md.push("");
  md.push(`| domain | group | MBFC (factual/cred) | expected | grounded | ungrounded | election |`);
  md.push(`| --- | --- | --- | --- | --- | --- | --- |`);
  for (const r of rows) {
    md.push(
      `| ${r.domain} | ${r.group} | ${r.mbfcRating ?? "—"} | ${r.expectedBand} | ${r.on.score} ${r.on.verdict} | ${r.off.score} ${r.off.verdict} | ${
        r.on.election ? "⚠︎" : ""
      } |`
    );
  }
  md.push("");

  const reportDir = join(here, "report");
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(join(reportDir, "latest.md"), md.join("\n"));
  writeFileSync(
    join(reportDir, "latest.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        model: "claude-haiku-4-5",
        corpusSize: rows.length,
        headline: {
          questionable: questionable.length,
          escapedLowBandWithoutMbfc: qPassedWithout.length,
          heldAtLowBandWithMbfc: qHeldWith.length,
        },
        separation: { reliableMean: relMean, questionableMean: qMean, gap: round(relMean - qMean) },
        verdictAccuracy: { withMbfc: onMatches, withoutMbfc: offMatches, total: rows.length },
        election: { tp, fp, fn },
        rows,
      },
      null,
      2
    )
  );

  console.log("\n" + md.slice(0, 22).join("\n"));
  console.log(`\nFull report written to eval/report/latest.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
