#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

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

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function intBetween(rand, min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function pick(rand, list) {
  const total = list.reduce((sum, x) => sum + x.weight, 0);
  const roll = rand() * total;
  let acc = 0;
  for (const item of list) {
    acc += item.weight;
    if (roll <= acc) return item.value;
  }
  return list[list.length - 1].value;
}

const RULES = [
  { value: "D-IB-1", weight: 18, threshold: 35 },
  { value: "D-IB-2", weight: 16, threshold: 45 },
  { value: "D-IB-3", weight: 14, threshold: 55 },
  { value: "S-OFAC-1", weight: 10, threshold: 70 },
  { value: "T-VELO-2", weight: 17, threshold: 40 },
  { value: "T-VAL-3", weight: 15, threshold: 60 },
  { value: "E-ENTITY-2", weight: 10, threshold: 50 }
];

const TYPOLOGIES = [
  { value: "sanctions_exposure", weight: 12 },
  { value: "mixer_indirect", weight: 16 },
  { value: "high_risk_jurisdiction", weight: 18 },
  { value: "rapid_in_out", weight: 20 },
  { value: "structuring_pattern", weight: 18 },
  { value: "darknet_association", weight: 8 },
  { value: "gambling_flow", weight: 8 }
];

const baseScore = {
  sanctions_exposure: 78,
  mixer_indirect: 62,
  high_risk_jurisdiction: 57,
  rapid_in_out: 52,
  structuring_pattern: 49,
  darknet_association: 70,
  gambling_flow: 44
};

function filedSar(rand, score, typology) {
  const typologyBias = {
    sanctions_exposure: 0.24,
    darknet_association: 0.18,
    mixer_indirect: 0.11,
    high_risk_jurisdiction: 0.09,
    rapid_in_out: 0.07,
    structuring_pattern: 0.06,
    gambling_flow: 0.03
  }[typology];
  const scoreBias = score >= 80 ? 0.22 : score >= 65 ? 0.1 : score >= 50 ? 0.04 : -0.01;
  return rand() < Math.max(0.01, Math.min(0.8, typologyBias + scoreBias));
}

function generate(seed, count) {
  const rand = rng(seed);
  const startMs = Date.parse("2026-01-01T00:00:00.000Z");
  const alerts = [];
  for (let i = 0; i < count; i += 1) {
    const typology = pick(rand, TYPOLOGIES);
    const ruleId = pick(
      rand,
      RULES.map((r) => ({ value: r.value, weight: r.weight }))
    );
    const threshold = RULES.find((r) => r.value === ruleId).threshold;
    const score = Math.max(1, Math.min(99, baseScore[typology] + intBetween(rand, -18, 18)));
    alerts.push({
      alert_id: `AL-${seed}-${String(i + 1).padStart(6, "0")}`,
      rule_id: ruleId,
      typology,
      score,
      threshold_value: threshold,
      filed_sar: filedSar(rand, score, typology),
      value_usd: intBetween(rand, 500, 500000),
      days_to_disposition: intBetween(rand, 1, score >= 70 ? 4 : 10),
      created_at: new Date(startMs + i * 3600_000).toISOString()
    });
  }
  return alerts;
}

const args = parseArgs(process.argv);
const seed = Number(args.seed ?? 42);
const count = Number(args.count ?? 1200);
const out = path.resolve(process.cwd(), args.out ?? `./data/alerts-seed-${seed}.json`);

const payload = {
  metadata: {
    seed,
    count,
    generated_at: new Date().toISOString(),
    label: "Synthetic-benchmark"
  },
  alerts: generate(seed, count)
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(payload, null, 2));
console.log(`Generated sample dataset: ${out}`);
