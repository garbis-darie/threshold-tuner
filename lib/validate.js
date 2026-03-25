const REQUIRED_FIELDS = [
  "rule_id",
  "threshold_value",
  "score",
  "filed_sar",
  "value_usd",
  "days_to_disposition"
];

export function validateAlerts(alerts, label = "alerts") {
  if (!Array.isArray(alerts)) {
    throw new Error(`Invalid input: ${label} must be an array.`);
  }
  if (alerts.length === 0) {
    throw new Error(`Invalid input: ${label} is empty.`);
  }

  for (let i = 0; i < alerts.length; i += 1) {
    const row = alerts[i];
    for (const field of REQUIRED_FIELDS) {
      if (!(field in row)) {
        throw new Error(
          `Invalid input: ${label}[${i}] is missing required field "${field}".`
        );
      }
    }
    if (typeof row.rule_id !== "string" || row.rule_id.trim() === "") {
      throw new Error(`Invalid input: ${label}[${i}].rule_id must be a non-empty string.`);
    }
    if (typeof row.filed_sar !== "boolean") {
      throw new Error(`Invalid input: ${label}[${i}].filed_sar must be a boolean.`);
    }
  }
}

export function parseAlertFile(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.alerts)) return payload.alerts;
  throw new Error(
    "Invalid input file format: expected an array of alerts or an object with an alerts array."
  );
}
