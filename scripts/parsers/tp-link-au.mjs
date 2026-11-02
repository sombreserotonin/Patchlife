// Parses TP-Link's Australian cyber security compliance statement (the AU page in data/sources/seed.yaml), a single
// table whose data rows are product line, model with hardware version, and defined support period. Rows reading
// "31/12/2028 or later*" are minimums with the page's footnote as a second evidence item; an end-of-life row gives a
// bare date and no footnote. One-cell rows are section headings and the first row is the header.
import { tableRows } from "../table-rows.mjs";
import { categoryFor, evidenceItem, fill, fixedDate, isoDate, recordId } from "./common.mjs";

export const PAGE = "https://www.tp-link.com/au/landing/au-cyber-compliance/";
const REGIME = "au_smart_device_rules";
// The page's footnote, quoted by every "or later*" record: quoted as the page writes it, with a curly apostrophe.
const FOOTNOTE = "*The non-EOL product’s defined support period may be refreshed to extend specified date.";
// A hardware version stands last in the model cell, as validate-data.mjs's versionsIn reads one: V5, v1, V1.20.
const MODEL = /^(.+?)\s+(v\d+(?:\.\d+)*)$/i;
// The page writes dates day/month/year (date_order dmy), alone or followed by the profile's at-least phrase.
const PERIOD = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(.+))?$/;

function readRow(row, profile) {
  const [line, modelCell, period] = row.cells.map((c) => c.text);
  const model = modelCell.match(MODEL);
  if (!model) return { reason: "no hardware version in the model cell" };
  const date = period.match(PERIOD);
  if (!date) return { reason: "no day/month/year date in the support period cell" };
  const endDate = isoDate(Number(date[3]), Number(date[2]), Number(date[1]));
  if (!endDate) return { reason: `"${date[0]}" is not a calendar date` };
  const atLeast = date[4] === profile.at_least[0];
  if (date[4] !== undefined && !atLeast) return { reason: `"${date[4]}" after the date is not the profile's at-least phrase` };
  return { line, name: model[1], version: model[2], modelCell, endDate, atLeast };
}

// Candidate records for the rows that read without guessing, and the data rows skipped with the reason.
export function parse({ html, url = PAGE, profile, today = new Date().toISOString().slice(0, 10) }) {
  const candidates = [];
  const skipped = [];
  const [conditions] = profile.conditions[url];
  const [footnoteNote] = profile.notes[url];
  for (const row of tableRows(html).slice(1)) {
    if (row.cells.length !== 3) continue;
    const read = readRow(row, profile);
    if (read.reason) {
      skipped.push({ quote: row.quote, reason: read.reason });
      continue;
    }
    const model = `${read.name} (${read.version})`;
    const id = recordId(profile.brand_slug, model);
    const category = categoryFor(profile, { id, model, quote: row.quote });
    if (!category) {
      skipped.push({ quote: row.quote, reason: `no category_map entry for product line "${read.line}"` });
      continue;
    }
    const evidence = [evidenceItem(url, row.quote, today, REGIME)];
    if (read.atLeast) evidence.push(evidenceItem(url, FOOTNOTE, today, REGIME));
    candidates.push({
      id,
      brand: profile.brand,
      brand_slug: profile.brand_slug,
      model,
      aliases: [read.modelCell],
      category,
      regions: profile.regions_by_url[url],
      support: fixedDate(read.endDate, { atLeast: read.atLeast, conditions: fill(conditions, { version: read.version }) }),
      evidence,
      verification: { status: "unverified" },
      ...(read.atLeast ? { notes: footnoteNote } : {}),
    });
  }
  return { candidates, skipped };
}
