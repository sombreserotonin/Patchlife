// Parses Grandstream's compliance page (the entry in data/sources/seed.yaml): one table per product section, each
// under a button that names the section. A data row has nine cells: the product name, seven compliance columns and a
// "Defined Support Period" cell that reads "2028-12-31 or Later" or "2031/11/23 or later" (a minimum), a bare date,
// or "Pending", "EOL" or "NA". A name cell lists one model per <p>, so the markup splits the names. A model's quote
// runs from its name to the end of the row, cells joined by single spaces, so two models in one cell have quotes of
// their own (candidates.mjs matches rows by quote). Tables without the period column are not read, and a section is
// read only when its name states a category this project has.
import { tableRows } from "../table-rows.mjs";
import { htmlToText } from "../verify-evidence.mjs";
import { categoryFor, evidenceItem, fixedDate, isoDate, recordId } from "./common.mjs";

export const PAGE = "https://www.grandstream.com/compliance";
const REGIME = "vendor_policy";
// The sections whose rows are recorded, with the category each name states. The profile's category_map gives the
// category by model family, as the validator's rule R7 reads it; a model the two place differently is skipped.
const SECTIONS = { "Access Points": "access-point", "Gigabit Routers": "router", "Managed Switches": "network-switch" };
const PERIOD_COLUMN = "Defined Support Period";
const TABLE = /<table\b[^>]*>[\s\S]*?<\/table\s*>/gi;
const BUTTON = /<button\b[^>]*>([\s\S]*?)<\/button\s*>/gi;
const NAME_BREAK = /<\/p>|<br\s*\/?>/i;
// Year first, with - or /, alone or followed by the profile's at-least phrase in either case.
const PERIOD = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(.+))?$/;
// A model code: letters, then digits, as in GWN7674 or GWN7802P. "Lite", "Pro", "PL" and "V2" are not codes, so
// "GWN7803 PL Pro" is one model, while two codes on one line could be two models and are never guessed at.
const CODE = /^[A-Z]{2,}[A-Z-]*\d{2,}[A-Z0-9-]*$/i;
const MAX_QUOTE = 300;

const collapse = (html) => htmlToText(html).replace(/\s+/g, " ").trim();

// Candidate records for the rows that read without guessing, and the rows skipped with the reason.
export function parse({ html, url = PAGE, profile, today = new Date().toISOString().slice(0, 10) }) {
  const candidates = [];
  const skipped = [];
  const [note] = profile.notes[url];
  const [atLeastPhrase] = profile.at_least;
  const buttons = [...html.matchAll(BUTTON)].map((m) => ({ at: m.index, label: collapse(m[1]) }));
  for (const table of html.matchAll(TABLE)) {
    const [header, ...rows] = tableRows(table[0]);
    if (!header || header.cells.at(-1)?.text !== PERIOD_COLUMN) continue;
    const section = buttons.filter((b) => b.at < table.index).at(-1)?.label ?? "";
    for (const row of rows) {
      if (row.cells.length !== header.cells.length) continue;
      const skip = (reason) => skipped.push({ quote: row.quote, reason });
      const period = row.cells.at(-1).text;
      const date = period.match(PERIOD);
      if (!date) {
        skip(`"${period}" in the support period cell is not a date`);
        continue;
      }
      const endDate = isoDate(Number(date[1]), Number(date[2]), Number(date[3]));
      if (!endDate) {
        skip(`"${period}" is not a calendar date`);
        continue;
      }
      const atLeast = date[4] !== undefined && date[4].toLowerCase() === atLeastPhrase.toLowerCase();
      if (date[4] !== undefined && !atLeast) {
        skip(`"${date[4]}" after the date is not the profile's at-least phrase`);
        continue;
      }
      if (!(section in SECTIONS)) {
        skip(`no category for the section "${section}"`);
        continue;
      }
      if (row.quote.length > MAX_QUOTE) {
        skip(`the row is ${row.quote.length} characters, over ${MAX_QUOTE}`);
        continue;
      }
      const names = row.cells[0].html.split(NAME_BREAK).map(collapse).filter(Boolean);
      const rest = row.cells.slice(1).map((cell) => cell.text).filter(Boolean);
      for (const [i, model] of names.entries()) {
        const quote = [...names.slice(i), ...rest].join(" ");
        if (model.split(" ").filter((word) => CODE.test(word)).length > 1) {
          skip(`"${model}" may name several models on one line`);
          continue;
        }
        const id = recordId(profile.brand_slug, model);
        const category = categoryFor(profile, { id, model, quote });
        if (category !== SECTIONS[section]) {
          skip(`the profile gives "${model}" ${category ? `the category ${category}` : "no category"}, but its section is "${section}"`);
          continue;
        }
        candidates.push({
          id,
          brand: profile.brand,
          brand_slug: profile.brand_slug,
          model,
          aliases: [],
          category,
          regions: profile.regions_by_url[url],
          support: fixedDate(endDate, { atLeast, conditions: null }),
          evidence: [evidenceItem(url, quote, today, REGIME)],
          verification: { status: "unverified" },
          notes: note,
        });
      }
    }
  }
  return { candidates, skipped };
}
