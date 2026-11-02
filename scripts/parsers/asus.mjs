// Parses ASUS's UK PSTI security update list for networking products (MIGRATION B4): a two-column table whose model
// cell lists one model per <p> (or <br>) and whose period cell reads "4 years (until 31th December 2028)". The markup
// splits the names, so no guessing is needed. A model's quote runs from its name to the date, as the records were
// written, so a model far up a long list is skipped when that quote would be over 300 characters.
import { tableRows } from "../table-rows.mjs";
import { htmlToText } from "../verify-evidence.mjs";
import { categoryFor, evidenceItem, fill, fixedDate, monthDate, recordId } from "./common.mjs";

export const PAGE = "https://www.asus.com/support/faq/1051929/";
const REGIME = "uk_psti";
const SENTENCE = "ASUS will offer security update support to the networking products complied with UK PSTI(Product Security and Telecommunications Infrastructure Act) until the date specified below. And extended support may be provided after the stated date.";
const PERIOD = /^\d+ years \(until (\d{1,2})(?:st|nd|rd|th) ([A-Za-z]+) (\d{4})\)$/;
const NAME_BREAK = /<\/p>|<br\s*\/?>/i;
const MAX_QUOTE = 300;

const collapse = (html) => htmlToText(html).replace(/\s+/g, " ").trim();

// Candidate records for the models whose quote fits, and the models and rows skipped with the reason.
export function parse({ html, url = PAGE, profile, today = new Date().toISOString().slice(0, 10) }) {
  const candidates = [];
  const skipped = [];
  const [conditions] = profile.conditions[url];
  const [pageNote, minimumNote, dateNote] = profile.notes[url];
  for (const row of tableRows(html)) {
    if (row.cells.length !== 2 || row.cells[0].text === "Product") continue;
    const names = row.cells[0].html.split(NAME_BREAK).map(collapse).filter(Boolean);
    const period = row.cells[1].text;
    const date = period.match(PERIOD);
    const endDate = date && monthDate(date[1], date[2], date[3]);
    if (!endDate) {
      skipped.push({ quote: row.quote, reason: `"${period}" gives no day, month and year` });
      continue;
    }
    names.forEach((model, i) => {
      const quote = [...names.slice(i), period].join(" ");
      const id = recordId(profile.brand_slug, model);
      const category = categoryFor(profile, { id, model, quote });
      if (!category) {
        skipped.push({ quote: `${model} ${period}`, reason: `no category_map entry matches "${model}"` });
        return;
      }
      if (quote.length > MAX_QUOTE) {
        skipped.push({ quote: `${model} ${period}`, reason: `the quote from ${model} to the date is ${quote.length} characters, over ${MAX_QUOTE}` });
        return;
      }
      candidates.push({
        id,
        brand: profile.brand,
        brand_slug: profile.brand_slug,
        model,
        aliases: [],
        category,
        regions: profile.regions_by_url[url],
        support: fixedDate(endDate, { atLeast: true, conditions }),
        evidence: [evidenceItem(url, quote, today, REGIME), evidenceItem(url, SENTENCE, today, REGIME)],
        verification: { status: "unverified" },
        notes: `${pageNote} ${minimumNote} ${fill(dateNote, { year: date[3] })}`,
      });
    });
  }
  return { candidates, skipped };
}
