// Support status of a record against a date (SPEC 2). Computed at build time, never stored (D7).
import { addYears } from "./validate-data.mjs";

// The validator guarantees end_date is set only when the source publishes a date or an anchor for it.
// A month-only end date (YYYY-MM, D38) has ended only after the month's last day, and is ending soon once its first
// day is within a year.
export function computeStatus(record, today = new Date().toISOString().slice(0, 10)) {
  const end = record.support.end_date;
  if (!end) return "unknown";
  const [y, m, d] = end.split("-").map(Number);
  const first = d ? end : `${end}-01`;
  const last = d ? end : `${end}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
  if (last < today) return "ended";
  return first <= addYears(today, 1) ? "ending_soon" : "supported";
}
