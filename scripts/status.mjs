// Support status of a record against a date (SPEC 2). Computed at build time, never stored (D7).
import { addYears } from "./validate-data.mjs";

// The validator guarantees end_date is set only when the source publishes a date or an anchor for it.
export function computeStatus(record, today = new Date().toISOString().slice(0, 10)) {
  const end = record.support.end_date;
  if (!end) return "unknown";
  if (end < today) return "ended";
  return end <= addYears(today, 1) ? "ending_soon" : "supported";
}
