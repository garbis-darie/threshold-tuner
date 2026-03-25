function round(n) {
  return Math.round(n * 100) / 100;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx];
}

function overlapRatio(a, b) {
  if (a.length === 0 || b.length === 0) return 1;
  const aMin = Math.min(...a);
  const aMax = Math.max(...a);
  const bMin = Math.min(...b);
  const bMax = Math.max(...b);
  const overlap = Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
  const union = Math.max(aMax, bMax) - Math.min(aMin, bMin);
  if (union === 0) return 0;
  return overlap / union;
}

function confidenceScore({ sampleSize, overlap, avgDays }) {
  // Deterministic scoring model: 0-100
  const sampleScore = Math.min(40, (sampleSize / 120) * 40);
  const separationScore = Math.max(0, 40 - overlap * 40);
  const lagPenalty = Math.min(20, Math.max(0, avgDays - 2) * 2.5);
  return Math.max(0, Math.min(100, sampleScore + separationScore + (20 - lagPenalty)));
}

function confidenceBucket(score) {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function targetRate(target) {
  if (target === "critical") return 0.4;
  if (target === "broad") return 0.1;
  return 0.2;
}

export function analyseByRule(alerts) {
  const grouped = new Map();
  for (const alert of alerts) {
    const bucket = grouped.get(alert.rule_id) ?? [];
    bucket.push(alert);
    grouped.set(alert.rule_id, bucket);
  }

  const analysis = [];
  for (const [ruleId, rows] of grouped.entries()) {
    const sarRows = rows.filter((r) => r.filed_sar);
    const nonSarRows = rows.filter((r) => !r.filed_sar);
    const sarScores = sarRows.map((r) => r.score).sort((a, b) => a - b);
    const nonSarScores = nonSarRows.map((r) => r.score).sort((a, b) => a - b);
    const avgThreshold =
      rows.reduce((sum, r) => sum + Number(r.threshold_value), 0) / rows.length;
    const avgDays =
      rows.reduce((sum, r) => sum + Number(r.days_to_disposition), 0) / rows.length;

    analysis.push({
      rule_id: ruleId,
      sample_size: rows.length,
      sar_count: sarRows.length,
      conversion_rate: rows.length ? sarRows.length / rows.length : 0,
      avg_threshold: round(avgThreshold),
      avg_disposition_days: round(avgDays),
      sar_score_p50: round(percentile(sarScores, 0.5)),
      non_sar_score_p50: round(percentile(nonSarScores, 0.5)),
      score_overlap_ratio: round(overlapRatio(sarScores, nonSarScores))
    });
  }
  return analysis.sort((a, b) => a.rule_id.localeCompare(b.rule_id));
}

function recommendationFor(rule, options) {
  const minRate = targetRate(options.target);
  const maxRaisePct = options.max_raise_pct ?? 25;
  const gap = minRate - rule.conversion_rate;
  const overlap = rule.score_overlap_ratio;

  let action = "no_change";
  let suggestedThreshold = rule.avg_threshold;
  let why = "Rule performance is within target range and does not require tuning.";
  let riskNote = "Minimal change risk; continue periodic monitoring.";

  if (rule.conversion_rate < minRate) {
    if (overlap >= 0.55) {
      action = "review_rule_logic";
      why =
        "Conversion is below target and SAR/non-SAR score overlap is high; threshold-only tuning is unlikely to fix quality.";
      riskNote =
        "Raising threshold here may suppress true positives while keeping weak precision.";
    } else {
      action = "raise_threshold";
      const pct = Math.min(maxRaisePct, Math.max(3, Math.ceil(gap * 100)));
      suggestedThreshold = round(rule.avg_threshold * (1 + pct / 100));
      why =
        "Conversion is below target with acceptable score separation; a constrained threshold raise can reduce low-signal volume.";
      riskNote =
        "Aggressive raises may reduce recall; use a post-change validation window.";
    }
  } else if (rule.avg_disposition_days > 4) {
    action = "add_auto_prioritisation";
    why =
      "Conversion meets target but disposition time is elevated; prioritize high-signal cases earlier.";
    riskNote =
      "Prioritization without queue governance can shift backlog rather than reduce it.";
  }

  const score = confidenceScore({
    sampleSize: rule.sample_size,
    overlap,
    avgDays: rule.avg_disposition_days
  });

  return {
    rule_id: rule.rule_id,
    action,
    suggested_threshold: suggestedThreshold,
    confidence: confidenceBucket(score),
    confidence_score: round(score),
    why,
    risk_note: riskNote,
    signals: {
      conversion_rate_pct: round(rule.conversion_rate * 100),
      score_overlap_ratio: overlap,
      sample_size: rule.sample_size,
      avg_disposition_days: rule.avg_disposition_days
    }
  };
}

export function recommend(analysis, options = {}) {
  const resolved = {
    target: options.target ?? "standard",
    max_raise_pct: options.max_raise_pct ?? 25
  };
  return analysis.map((rule) => recommendationFor(rule, resolved));
}

export function generateReport(alerts, options = {}) {
  const analysis = analyseByRule(alerts);
  const recommendations = recommend(analysis, options);
  const totals = {
    total_alerts: alerts.length,
    total_sars: alerts.filter((a) => a.filed_sar).length,
    overall_conversion_pct: round(
      (alerts.filter((a) => a.filed_sar).length / alerts.length) * 100
    ),
    rules_analysed: analysis.length,
    rules_flagged_for_raise: recommendations.filter((r) => r.action === "raise_threshold")
      .length,
    generated_at: new Date().toISOString()
  };

  return {
    summary: totals,
    analysis,
    recommendations
  };
}
