# threshold-tuner

Analyses alert-to-SAR conversion rates and recommends explainable threshold actions for transaction monitoring rule engines.

## Evidence Labels

- `Synthetic-benchmark`: benchmark outputs generated from synthetic datasets.
- `Measured` (optional future use): qualified deployment context metrics with evidence.

## Decision Model Encoded Here

This project codifies practical calibration judgment used in real TM operations:

- detect low-signal rules by conversion and score behavior
- separate threshold issues from rule-logic issues
- score confidence before suggesting action
- highlight operational risk of each recommendation
- simulate scenario tradeoffs before rollout

## Proof Chain

- Claim: calibration decisions can be made more consistent, auditable, and explainable.
- Method: rule-level conversion analysis, score-overlap checks, confidence scoring, scenario backtesting.
- Dataset: synthetic benchmark datasets with fixed seeds.
- Result: recommendation report + CSV + markdown summary + optional drift diagnostics.
- Limitations: benchmark proxies are directional and not legal or regulatory determinations.
- Reproducibility: run CLI with provided seed datasets and sample scenarios.

## Quick Start

```bash
npm run data:seed42
npm run data:seed7
npm run backtest:drift
npm run backtest:fun
```

Outputs are written to `outputs/`:
- `report-standard.json`
- `report-standard.csv`
- `report-standard.md`
- `report-fun.json` + CSV + MD (stress scenarios)

## CLI

```bash
node cli.js \
  --input ./data/alerts-seed-42.json \
  --target standard \
  --scenario ./scenarios/sample-scenarios.json \
  --prior ./data/alerts-seed-7.json \
  --out ./outputs/report-standard.json
```

### Options

- `--input` required: JSON array or `{ alerts: [...] }`
- `--target`: `critical` | `standard` | `broad`
- `--scenario`: optional scenario config for backtesting
- `--prior`: optional prior-period dataset for drift diagnostics
- `--maxRaisePct`: optional max constrained threshold raise (default `25`)
- `--out`: output report path (`.json`), plus CSV/MD siblings

## Recommendation Actions

- `raise_threshold`: low conversion + acceptable score separation
- `review_rule_logic`: low conversion + high score overlap
- `add_auto_prioritisation`: conversion acceptable but queue speed weak
- `no_change`: healthy within profile

## Scenario Playground

Try `scenarios/fun-what-if.json` to compare risk appetite modes:

- **Risk-Off Hard Raise**: maximizes workload reduction, expects lower recall.
- **Risk Balanced Raise**: moderate reduction and moderate recall tradeoff.
- **Growth/Coverage Lower**: maximizes detection coverage with analyst workload increase.

## Guardrails

- Not legal advice.
- Recommendations are decision support, not automatic approvals.
- Always validate with post-change monitoring windows in production.

## Version

`v0.2.0 - Explainable Calibration Release`
