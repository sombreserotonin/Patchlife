// What the per-source parsers share: the id rule, the profile's category lookup and the date check. A parser turns
// one page's rows into candidate records in the exact shape of data/devices (MIGRATION B3); anything it can't read
// without guessing is skipped with a reason, never recorded.

// The id of every record on main is its brand_slug, then the model lowercased with each run of other characters as
// one hyphen: "Tapo C200 (V5)" gives tp-link-tapo-c200-v5 and "CS-X5S-4W-B/1T" gives ezviz-cs-x5s-4w-b-1t.
export function recordId(brandSlug, model) {
  const slug = model.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${brandSlug}-${slug}`;
}

// The category the profile gives a row, as validate-data.mjs rule R7 reads the profile: an exception for the id wins,
// then the first category_map entry whose pattern matches the model (model:) or the row's quote (row:). Null when
// none matches, so the row waits for a profile entry.
export function categoryFor(profile, { id, model, quote }) {
  const exception = profile.category_exceptions?.[id];
  if (exception !== undefined) return exception;
  const entry = (profile.category_map ?? []).find((e) => new RegExp(e.model ?? e.row, "i").test(e.model ? model : quote));
  return entry?.category ?? null;
}

// YYYY-MM-DD when the numbers are a real calendar date, else null.
export function isoDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

// YYYY-MM-DD from a day, a month name and a year as a page writes them ("11", "June", "2027"; the day may carry an
// ordinal, as in "31st"), else null when the month or the date is not real.
export function monthDate(day, month, year) {
  const index = MONTHS.indexOf(month.toLowerCase());
  if (index < 0) return null;
  return isoDate(Number(year), index + 1, Number(String(day).replace(/(st|nd|rd|th)$/i, "")));
}

// A support block as the records write it: the field order matters because records are written field by field.
export function fixedDate(endDate, { atLeast, conditions }) {
  return { rule: "fixed_date", end_date: endDate, years: null, anchor_date: null, at_least: atLeast, conditions };
}

export function evidenceItem(url, quote, retrieved, regime) {
  return { url, quote, retrieved, regime };
}

// Fills a profile template: "{version}" becomes values.version. Throws on a placeholder with no value, since a note
// with a bare placeholder would be recorded as written.
export function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (values[key] === undefined) throw new Error(`template "${template}" needs ${key}`);
    return values[key];
  });
}
