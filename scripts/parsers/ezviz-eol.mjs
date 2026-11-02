// Parses EZVIZ's EOL product list (data/sources/seed.yaml), a single table of product line, model, targeted area and
// day of firmware update cessation, written year/month/day. Every record also quotes the page's two policy sentences
// and the upgrade policy's "subject to change" sentence, which the parser carries as fixed items; candidates.mjs
// checks each against its page before writing.
import { tableRows } from "../table-rows.mjs";
import { categoryFor, evidenceItem, fill, fixedDate, isoDate, recordId } from "./common.mjs";

export const PAGE = "https://support.ezviz.com/faq/article/EZVIZ-EOL-Product-List";
const POLICY = "https://www.ezviz.com/inter/trust-center/security/upgrade-policy";
const REGIME = "vendor_policy";
const SENTENCES = [
  [PAGE, "About EZVIZ’s EOL (End-Of-Life) products: It means that EZVIZ no longer maintain any firmware updates (including security updates) for them, and may no longer respond to security vulnerability reports for such products either."],
  [PAGE, "Please note that the list includes both EOL products and currently active products with an expected EOL date."],
  [POLICY, "The updates policies and the EOL product list are subject to change and will be reviewed on a regular basis."],
];
// The profile records every row's targeted area, Europe, as EU; a row for another area has no region to record.
const AREA = "Europe";
const DATE = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;

function readRow(row) {
  const [line, model, area, day] = row.cells.map((c) => c.text);
  if (!model) return { reason: "empty model cell" };
  if (area !== AREA) return { reason: `targeted area "${area}" is not ${AREA}` };
  const date = day.match(DATE);
  if (!date) return { reason: "no year/month/day date in the cessation cell" };
  const endDate = isoDate(Number(date[1]), Number(date[2]), Number(date[3]));
  if (!endDate) return { reason: `"${day}" is not a calendar date` };
  return { line, model, endDate };
}

// Candidate records for the rows that read without guessing, and the data rows skipped with the reason.
export function parse({ html, url = PAGE, profile, today = new Date().toISOString().slice(0, 10) }) {
  const candidates = [];
  const skipped = [];
  const [conditions] = profile.conditions[url];
  const [cessationNote, lineNote] = profile.notes[url];
  for (const row of tableRows(html).slice(1)) {
    if (row.cells.length !== 4) continue;
    const read = readRow(row);
    if (read.reason) {
      skipped.push({ quote: row.quote, reason: read.reason });
      continue;
    }
    const id = recordId(profile.brand_slug, read.model);
    const category = categoryFor(profile, { id, model: read.model, quote: row.quote });
    if (!category) {
      skipped.push({ quote: row.quote, reason: `no category_map entry for product line "${read.line}"` });
      continue;
    }
    candidates.push({
      id,
      brand: profile.brand,
      brand_slug: profile.brand_slug,
      model: read.model,
      category,
      regions: profile.regions_by_url[url],
      support: fixedDate(read.endDate, { atLeast: false, conditions }),
      evidence: [evidenceItem(url, row.quote, today, REGIME), ...SENTENCES.map(([u, quote]) => evidenceItem(u, quote, today, REGIME))],
      verification: { status: "unverified" },
      notes: `${cessationNote} ${fill(lineNote, { product_line: read.line })}`,
    });
  }
  return { candidates, skipped };
}
