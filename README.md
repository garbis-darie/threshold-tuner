# threshold-tuner

> Analyses alert-to-SAR conversion rates per rule and recommends data-driven threshold adjustments for transaction monitoring engines.

[![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

---

## What It Does

`threshold-tuner` takes historical alert data as input and outputs calibration recommendations per monitoring rule. It answers the question compliance teams face every quarter: *"Which thresholds are generating noise, and how much can we safely raise them without missing true positives?"*

It does this by:
- Grouping alerts by `rule_id` and computing per-rule SAR conversion rates
- Identifying score separation between SAR-filed and non-SAR alerts
- Recommending a specific threshold raise (or flagging overlapping score distributions for rule-logic review) based on a configurable conversion target
- Estimating the alert volume reduction from each recommended change

---

## Why It Exists

Threshold calibration in most VASPs is done manually -- an analyst pulls a sample of alerts, calculates conversion rates in a spreadsheet, and makes a judgment call. This is slow, inconsistent, and hard to audit.

This module formalises that process into a repeatable, documented pipeline. It was extracted from the broader [RuleForge](https://github.com/garbis-darie/ruleforge) compliance methodology as a standalone reference implementation.

---

## Core API (`lib/tuner.js`)

| Function | Purpose |
|---|---|
| `analyseByRule(alerts)` | Groups alerts by `rule_id`, computes conversion rate, avg score, score distribution |
| `recommend(analysis, options)` | Generates threshold adjustment recommendations with rationale and confidence |
| `generateReport(alerts, options)` | End-to-end: runs analysis + recommendations + summary in one call |

---

## Quick Start

```js
import { generateReport, SAMPLE_ALERTS } from './lib/tuner.js';

// Run against mock data
const report = generateReport(SAMPLE_ALERTS, { target: 'standard' });

console.log(report.summary);
// {
//   total_alerts: 19,
//   total_sars: 8,
//   overall_conversion_pct: 42.1,
//   rules_analysed: 7,
//   rules_flagged_for_raise: 4,
//   estimated_volume_reduction: -8,
//   generated_at: '...'
// }

console.log(report.recommendations);
// [
//   { rule_id: 'D-3', action: 'raise_threshold', suggested_threshold: 64, confidence: 'high', ... },
//   { rule_id: 'D-4', action: 'raise_threshold', suggested_threshold: 31, confidence: 'high', ... },
//   ...
// ]
```

Replace `SAMPLE_ALERTS` with a real dataset from your database or a CSV export from your blockchain analytics platform.

---

## Configuration

`recommend(analysis, options)` accepts:

| Option | Default | Description |
|---|---|---|
| `target` | `'standard'` | Conversion rate target: `'critical'` (40%), `'standard'` (20%), `'broad'` (10%) |
| `max_raise_pct` | `25` | Maximum percentage to raise a zero-conversion rule's threshold |

### Conversion Targets

| Target | Min SAR Rate | Use Case |
|---|---|---|
| `critical` | 40% | High-volume, resource-constrained teams needing high precision |
| `standard` | 20% | Typical VASP compliance programmes |
| `broad` | 10% | Early-stage programmes prioritising coverage over precision |

---

## Input Data Shape

Each alert object requires:

```js
{
  rule_id: 'D-IB-1',          // Rule identifier
  threshold_value: 200_000,   // Current rule threshold
  score: 82,                  // Risk score assigned to this alert
  filed_sar: true,            // Whether a SAR was ultimately filed
  value_usd: 450_000,         // Transaction value in USD
  days_to_disposition: 2      // Days from alert creation to disposition
}
```

---

## Recommendation Actions

| Action | Meaning |
|---|---|
| `raise_threshold` | Safe to raise -- score separation or zero conversion supports it |
| `review_rule_logic` | Conversion is low but SAR/non-SAR scores overlap -- threshold alone won't fix this |
| `add_auto_prioritisation` | Conversion meets target but disposition time is high -- prioritisation logic would help |
| `no_change` | Rule is performing well within target parameters |

---

## Related

- [ruleforge](https://github.com/garbis-darie/ruleforge) -- Full KYT compliance template platform this methodology feeds into
- [sanctions-screen](https://github.com/garbis-darie/sanctions-screen) -- Companion sanctions screening engine

---

## About the Builder

**Garbis Darie** -- Transaction Monitoring Strategy Analyst specialising in Virtual Assets Compliance. Built this as part of an independent KYT risk framework for VASPs, having spent 4+ years calibrating alert thresholds at Celsius Network, ToTheMoon, and DelSaldado Services.

[LinkedIn](https://linkedin.com/in/garbis-darie) . [GitHub](https://github.com/garbis-darie) . hello@garbisdarie.com

---

## License

MIT
