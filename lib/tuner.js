/**
 * threshold-tuner / lib / tuner.js
 *
 * Analyses historical alert data to compute alert-to-SAR conversion rates
 * per rule, then recommends threshold adjustments to reduce false positives
 * while preserving detection of true positives.
 *
 * Designed for transaction monitoring teams who want data-driven calibration
 * instead of gut-feel threshold changes.
 */

// ─── Mock historical alert data ─────────────────────────────────────────────
// In production, replace with a database query or CSV import.

export const SAMPLE_ALERTS = [
  { rule_id: 'D-IB-1', threshold_value: 200_000, score: 82, filed_sar: true,  value_usd: 450_000, days_to_disposition: 2  },
  { rule_id: 'D-IB-1', threshold_value: 200_000, score: 78, filed_sar: true,  value_usd: 320_000, days_to_disposition: 3  },
  { rule_id: 'D-IB-1', threshold_value: 200_000, score: 55, filed_sar: false, value_usd: 210_000, days_to_disposition: 5  },
  { rule_id: 'D-2',    threshold_value: 75,      score: 88, filed_sar: true,  value_usd: 180_000, days_to_disposition: 1  },
  { rule_id: 'D-2',    threshold_value: 75,      score: 76, filed_sar: false, value_usd: 95_000,  days_to_disposition: 4  },
  { rule_id: 'D-2',    threshold_value: 75,      score: 91, filed_sar: true,  value_usd: 520_000, days_to_disposition: 1  },
  { rule_id: 'D-3',    threshold_value: 50,      score: 62, filed_sar: false, value_usd: 45_000,  days_to_disposition: 7  },
  { rule_id: 'D-3',    threshold_value: 50,      score: 58, filed_sar: false, value_usd: 38_000,  days_to_disposition: 6  },
  { rule_id: 'D-3',    threshold_value: 50,      score: 71, filed_sar: true,  value_usd: 120_000, days_to_disposition: 3  },
  { rule_id: 'D-4',    threshold_value: 25,      score: 34, filed_sar: false, value_usd: 62_000,  days_to_disposition: 8  },
  { rule_id: 'D-4',    threshold_value: 25,      score: 28, filed_sar: false, value_usd: 55_000,  days_to_disposition: 9  },
  { rule_id: 'D-4',    threshold_value: 25,      score: 42, filed_sar: false, value_usd: 70_000,  days_to_disposition: 7  },
  { rule_id: 'I-1',    threshold_value: 50,      score: 65, filed_sar: false, value_usd: 280_000, days_to_disposition: 5  },
  { rule_id: 'I-1',    threshold_value: 50,      score: 72, filed_sar: true,  value_usd: 410_000, days_to_disposition: 2  },
  { rule_id: 'I-2',    threshold_value: 50,      score: 53, filed_sar: false, value_usd: 35_000,  days_to_disposition: 10 },
  { rule_id: 'I-2',    threshold_value: 50,      score: 61, filed_sar: false, value_usd: 48_000,  days_to_disposition: 8  },
  { rule_id: 'I-3',    threshold_value: 25,      score: 30, filed_sar: false, value_usd: 12_000,  days_to_disposition: 12 },
  { rule_id: 'I-3',    threshold_value: 25,      score: 27, filed_sar: false, value_usd: 8_000,   days_to_disposition: 14 },
  { rule_id: 'I-3',    threshold_value: 25,      score: 35, filed_sar: false, value_usd: 15_000,  days_to_disposition: 11 },
];

// ─── Core analytics ─────────────────────────────────────────────────────────

/**
 * Group alerts by rule_id and compute per-rule statistics.
 */
export function analyseByRule(alerts) {
  const grouped = {};

  for (const alert of alerts) {
    if (!grouped[alert.rule_id]) {
      grouped[alert.rule_id] = [];
    }
    grouped[alert.rule_id].push(alert);
  }

  const analysis = {};

  for (const [ruleId, ruleAlerts] of Object.entries(grouped)) {
    const total      = ruleAlerts.length;
    const sarsFiled  = ruleAlerts.filter(a => a.filed_sar).length;
    const convRate   = total > 0 ? Math.round((sarsFiled / total) * 1000) / 10 : 0;
    const avgScore   = Math.round(ruleAlerts.reduce((s, a) => s + a.score, 0) / total * 10) / 10;
    const avgDays    = Math.round(ruleAlerts.reduce((s, a) => s + a.days_to_disposition, 0) / total * 10) / 10;
    const avgValue   = Math.round(ruleAlerts.reduce((s, a) => s + a.value_usd, 0) / total);
    const threshold  = ruleAlerts[0].threshold_value;

    // Score distribution of SARs vs. non-SARs
    const sarScores    = ruleAlerts.filter(a => a.filed_sar).map(a => a.score);
    const nonSarScores = ruleAlerts.filter(a => !a.filed_sar).map(a => a.score);
    const minSarScore  = sarScores.length > 0 ? Math.min(...sarScores) : null;
    const maxNonSar    = nonSarScores.length > 0 ? Math.max(...nonSarScores) : null;

    analysis[ruleId] = {
      rule_id: ruleId,
      total_alerts: total,
      sars_filed: sarsFiled,
      conversion_rate_pct: convRate,
      current_threshold: threshold,
      avg_score: avgScore,
      avg_disposition_days: avgDays,
      avg_value_usd: avgValue,
      min_sar_score: minSarScore,
      max_non_sar_score: maxNonSar,
    };
  }

  return analysis;
}

// ─── Recommendation engine ──────────────────────────────────────────────────

const CONVERSION_TARGETS = {
  critical: { min_rate: 40, label: 'Critical — high SAR yield expected' },
  standard: { min_rate: 20, label: 'Standard — moderate SAR yield acceptable' },
  broad:    { min_rate: 10, label: 'Broad net — low yield tolerated for coverage' },
};

/**
 * Generate threshold adjustment recommendations.
 *
 * @param {Object} analysis - Output of analyseByRule()
 * @param {Object} options  - { target: 'critical'|'standard'|'broad', max_raise_pct: number }
 * @returns {Array} Array of recommendation objects
 */
export function recommend(analysis, options = {}) {
  const { target = 'standard', max_raise_pct = 25 } = options;
  const targetConfig = CONVERSION_TARGETS[target] || CONVERSION_TARGETS.standard;
  const recommendations = [];

  for (const [ruleId, stats] of Object.entries(analysis)) {
    const rec = {
      rule_id: ruleId,
      current_threshold: stats.current_threshold,
      conversion_rate_pct: stats.conversion_rate_pct,
      target_min_rate_pct: targetConfig.min_rate,
      target_label: targetConfig.label,
      action: 'no_change',
      suggested_threshold: stats.current_threshold,
      rationale: '',
      confidence: 'low',
      alert_volume_impact: 0,
    };

    // Rule has zero SARs — strong candidate for threshold raise
    if (stats.sars_filed === 0) {
      const raise = Math.round(stats.current_threshold * (max_raise_pct / 100));
      rec.action = 'raise_threshold';
      rec.suggested_threshold = stats.current_threshold + raise;
      rec.rationale = `0% conversion across ${stats.total_alerts} alerts. Raise threshold by ${max_raise_pct}% to reduce noise.`;
      rec.confidence = stats.total_alerts >= 5 ? 'high' : 'medium';
      rec.alert_volume_impact = -stats.total_alerts;
      recommendations.push(rec);
      continue;
    }

    // Conversion rate below target
    if (stats.conversion_rate_pct < targetConfig.min_rate) {
      // If we have score separation, recommend raising to just below min SAR score
      if (stats.min_sar_score !== null && stats.max_non_sar_score !== null) {
        const gap = stats.min_sar_score - stats.max_non_sar_score;
        if (gap > 5) {
          rec.action = 'raise_threshold';
          rec.suggested_threshold = stats.max_non_sar_score + Math.floor(gap / 2);
          rec.rationale = `Conversion ${stats.conversion_rate_pct}% < target ${targetConfig.min_rate}%. Score gap of ${gap} between worst SAR (${stats.min_sar_score}) and best non-SAR (${stats.max_non_sar_score}) allows safe raise.`;
          rec.confidence = 'high';
          const eliminated = stats.total_alerts - stats.sars_filed;
          rec.alert_volume_impact = -Math.round(eliminated * 0.6);
        } else {
          rec.action = 'review_rule_logic';
          rec.rationale = `Conversion ${stats.conversion_rate_pct}% < target ${targetConfig.min_rate}%, but SAR/non-SAR scores overlap (gap: ${gap}). Threshold alone won't fix this — consider adding contextual factors.`;
          rec.confidence = 'medium';
        }
      } else {
        const raise = Math.round(stats.current_threshold * 0.10);
        rec.action = 'raise_threshold';
        rec.suggested_threshold = stats.current_threshold + raise;
        rec.rationale = `Conversion ${stats.conversion_rate_pct}% < target ${targetConfig.min_rate}%. Conservative 10% raise suggested due to limited data.`;
        rec.confidence = 'low';
      }
      recommendations.push(rec);
      continue;
    }

    // Conversion rate is healthy — check if we can tighten for efficiency
    if (stats.conversion_rate_pct >= targetConfig.min_rate && stats.avg_disposition_days > 5) {
      rec.action = 'add_auto_prioritisation';
      rec.rationale = `Conversion ${stats.conversion_rate_pct}% meets target, but avg disposition is ${stats.avg_disposition_days} days. Consider auto-prioritising high-score alerts to reduce backlog.`;
      rec.confidence = 'medium';
      recommendations.push(rec);
      continue;
    }

    // Everything looks good
    rec.action = 'no_change';
    rec.rationale = `Conversion ${stats.conversion_rate_pct}% meets ${targetConfig.min_rate}% target. Rule is performing well.`;
    rec.confidence = 'high';
    recommendations.push(rec);
  }

  recommendations.sort((a, b) => {
    const priority = { raise_threshold: 0, review_rule_logic: 1, add_auto_prioritisation: 2, no_change: 3 };
    return (priority[a.action] ?? 9) - (priority[b.action] ?? 9);
  });

  return recommendations;
}

// ─── Summary report ─────────────────────────────────────────────────────────

/**
 * Generate a human-readable calibration report.
 */
export function generateReport(alerts, options = {}) {
  const analysis       = analyseByRule(alerts);
  const recs           = recommend(analysis, options);
  const totalAlerts    = alerts.length;
  const totalSars      = alerts.filter(a => a.filed_sar).length;
  const overallConv    = Math.round((totalSars / totalAlerts) * 1000) / 10;
  const raiseCount     = recs.filter(r => r.action === 'raise_threshold').length;
  const volumeReduction = recs.reduce((s, r) => s + r.alert_volume_impact, 0);

  return {
    summary: {
      total_alerts: totalAlerts,
      total_sars: totalSars,
      overall_conversion_pct: overallConv,
      rules_analysed: Object.keys(analysis).length,
      rules_flagged_for_raise: raiseCount,
      estimated_volume_reduction: volumeReduction,
      generated_at: new Date().toISOString(),
    },
    per_rule_analysis: analysis,
    recommendations: recs,
  };
}

export { CONVERSION_TARGETS };
