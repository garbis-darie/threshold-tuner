#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { generateReport } from "./lib/tuner.js";
import { computeDrift, runBacktest } from "./lib/backtest.js";
import { parseAlertFile, validateAlerts } from "./lib/validate.js";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith("--")) continue;
    args[key.slice(2)] = value;
    i += 1;
  }
  return args;
}

function toCsv(rows) {
  const header =
    "rule_id,action,suggested_threshold,confidence,confidence_score,conversion_rate_pct,score_overlap_ratio,sample_size,avg_disposition_days,why,risk_note";
  const body = rows.map((row) =>
    [
      row.rule_id,
      row.action,
      row.suggested_threshold,
      row.confidence,
      row.confidence_score,
      row.signals.conversion_rate_pct,
      row.signals.score_overlap_ratio,
      row.signals.sample_size,
      row.signals.avg_disposition_days,
      `"${row.why.replace(/"/g, '""')}"`,
      `"${row.risk_note.replace(/"/g, '""')}"`
    ].join(",")
  );
  return [header, ...body].join("\n");
}

function backtestTable(rows) {
  if (!rows.length) return "No backtest scenarios provided.";
  const head =
    "| Scenario | Reviewed | Workload Reduction | Precision Proxy | Recall Proxy | Avg Days |\n|---|---:|---:|---:|---:|---:|";
  const lines = rows.map(
    (r) =>
      `| ${r.label} | ${r.reviewed_alerts} | ${r.workload_reduction_pct}% | ${r.precision_proxy_pct}% | ${r.recall_proxy_pct}% | ${r.avg_days_to_disposition} |`
  );
  return [head, ...lines].join("\n");
}

function summaryMarkdown(report, backtest, drift, args) {
  const lines = [
    "# threshold-tuner Summary",
    "",
    `Target profile: \`${args.target ?? "standard"}\``,
    `Input alerts: ${report.summary.total_alerts}`,
    `Rules analysed: ${report.summary.rules_analysed}`,
    `Rules flagged for raise: ${report.summary.rules_flagged_for_raise}`,
    `Overall conversion: ${report.summary.overall_conversion_pct}%`,
    "",
    "## Backtest",
    "",
    backtestTable(backtest)
  ];

  if (drift) {
    lines.push(
      "",
      "## Drift Check",
      "",
      `- Conversion delta: ${drift.conversion_delta_pct_points} pct points`,
      `- Reviewed volume delta: ${drift.reviewed_volume_delta_pct}%`,
      `- Average score shift: ${drift.average_score_shift}`
    );
  }
  return lines.join("\n");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeOutputs(baseOutPath, report, recommendationsCsv, summaryMd) {
  const outJson = path.resolve(process.cwd(), baseOutPath);
  const outCsv = outJson.replace(/\.json$/i, ".csv");
  const outMd = outJson.replace(/\.json$/i, ".md");
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2));
  fs.writeFileSync(outCsv, recommendationsCsv);
  fs.writeFileSync(outMd, summaryMd);
  return { outJson, outCsv, outMd };
}

try {
  const args = parseArgs(process.argv);
  if (!args.input) {
    throw new Error('Usage error: --input is required. Example: node cli.js --input ./data/alerts.json --target standard --out ./outputs/report.json');
  }

  const inputPath = path.resolve(process.cwd(), args.input);
  const outPath = args.out ?? "./outputs/report.json";
  const target = args.target ?? "standard";
  const maxRaisePct = args.maxRaisePct ? Number(args.maxRaisePct) : 25;

  const inputPayload = readJson(inputPath);
  const alerts = parseAlertFile(inputPayload);
  validateAlerts(alerts, "input_alerts");

  let backtest = [];
  if (args.scenario) {
    const scenarioPath = path.resolve(process.cwd(), args.scenario);
    const scenarioPayload = readJson(scenarioPath);
    backtest = runBacktest(alerts, scenarioPayload.scenarios ?? []);
  }

  let drift = null;
  if (args.prior) {
    const priorPath = path.resolve(process.cwd(), args.prior);
    const priorPayload = readJson(priorPath);
    const priorAlerts = parseAlertFile(priorPayload);
    validateAlerts(priorAlerts, "prior_alerts");
    drift = computeDrift(alerts, priorAlerts);
  }

  const calibration = generateReport(alerts, { target, max_raise_pct: maxRaisePct });
  const report = {
    metadata: {
      label: "Synthetic-benchmark",
      target,
      generated_at: new Date().toISOString()
    },
    ...calibration,
    backtest,
    ...(drift ? { drift } : {})
  };

  const recommendationsCsv = toCsv(calibration.recommendations);
  const summaryMd = summaryMarkdown(calibration, backtest, drift, args);
  const written = writeOutputs(outPath, report, recommendationsCsv, summaryMd);

  console.log(`Report written: ${written.outJson}`);
  console.log(`Recommendations CSV: ${written.outCsv}`);
  console.log(`Summary markdown: ${written.outMd}`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
