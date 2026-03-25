function round(n) {
  return Math.round(n * 100) / 100;
}

function adjustedThreshold(baseThreshold, mode, delta) {
  if (mode === "raise") return Math.min(99, baseThreshold + delta);
  if (mode === "lower") return Math.max(1, baseThreshold - delta);
  return baseThreshold;
}

export function runBacktest(alerts, scenarios = []) {
  if (!scenarios.length) return [];
  const totalSars = alerts.filter((a) => a.filed_sar).length;

  const baselineScenario = scenarios.find((s) => s.id === "baseline") ?? scenarios[0];
  const baselineReviewed = alerts.filter(
    (a) =>
      a.score >= adjustedThreshold(a.threshold_value, baselineScenario.mode, baselineScenario.delta)
  ).length;

  return scenarios.map((scenario) => {
    const reviewed = alerts.filter(
      (a) => a.score >= adjustedThreshold(a.threshold_value, scenario.mode, scenario.delta)
    );
    const sarInReviewed = reviewed.filter((a) => a.filed_sar).length;
    const avgDays =
      reviewed.length === 0
        ? 0
        : reviewed.reduce((sum, a) => sum + a.days_to_disposition, 0) / reviewed.length;

    return {
      id: scenario.id,
      label: scenario.label,
      mode: scenario.mode,
      delta: scenario.delta,
      reviewed_alerts: reviewed.length,
      workload_reduction_pct: baselineReviewed
        ? round(((baselineReviewed - reviewed.length) / baselineReviewed) * 100)
        : 0,
      precision_proxy_pct: reviewed.length ? round((sarInReviewed / reviewed.length) * 100) : 0,
      recall_proxy_pct: totalSars ? round((sarInReviewed / totalSars) * 100) : 0,
      avg_days_to_disposition: round(avgDays)
    };
  });
}

export function computeDrift(currentAlerts, priorAlerts) {
  const currSar = currentAlerts.filter((a) => a.filed_sar).length;
  const priorSar = priorAlerts.filter((a) => a.filed_sar).length;
  const currConv = currentAlerts.length ? currSar / currentAlerts.length : 0;
  const priorConv = priorAlerts.length ? priorSar / priorAlerts.length : 0;
  const currScore =
    currentAlerts.reduce((sum, a) => sum + Number(a.score), 0) / (currentAlerts.length || 1);
  const priorScore =
    priorAlerts.reduce((sum, a) => sum + Number(a.score), 0) / (priorAlerts.length || 1);

  return {
    conversion_delta_pct_points: round((currConv - priorConv) * 100),
    reviewed_volume_delta_pct: priorAlerts.length
      ? round(((currentAlerts.length - priorAlerts.length) / priorAlerts.length) * 100)
      : 0,
    average_score_shift: round(currScore - priorScore)
  };
}
