// Support status of a record against a date (SPEC 2). Computed at build time, never stored (D7).
import { addYears } from "./validate-data.mjs";

// The first and last day an end date names: the day itself, or the month's first and last day for a month-only end
// date (YYYY-MM, D38), which has ended only after the month's last day and is ending soon once its first day is
// within a year.
function endDays(end) {
  const [y, m, d] = end.split("-").map(Number);
  return d ? { first: end, last: end } : { first: `${end}-01`, last: `${end}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}` };
}

const addDays = (isoDate, days) => new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

// The validator guarantees end_date is set only when the source publishes a date or an anchor for it.
export function computeStatus(record, today = new Date().toISOString().slice(0, 10)) {
  const end = record.support.end_date;
  if (!end) return "unknown";
  const { first, last } = endDays(end);
  if (last < today) return "ended";
  return first <= addYears(today, 1) ? "ending_soon" : "supported";
}

// The first day computeStatus gives `status` for the record: the day after the end for "ended", and the first day
// within a year of the end for "ending_soon". The Atom feeds date their entries with it (M7), so an entry's date is
// when the event happened, not when the site was built. Null when the record has no end date or for other statuses.
export function statusSince(record, status) {
  const end = record.support.end_date;
  if (!end || (status !== "ended" && status !== "ending_soon")) return null;
  const { first, last } = endDays(end);
  if (status === "ended") return addDays(last, 1);
  let day = addYears(first, -1);
  while (addYears(day, 1) < first) day = addDays(day, 1);
  return day;
}
