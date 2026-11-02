// Parses GL.iNet's PSTI support period table (rows like "Beryl (GL-MT1300) June 11, 2027 or later*", a minimum, with
// the page's footnote as a second item) and its firmware versions table filtered to ended models (columns Status, EOL
// Date, Supported Until), where a Maintenance row gives a hard Supported Until date (MIGRATION B4). A record's id and
// alias come from the model code in brackets. A code on both pages is a D39 case: reported, never written.
import { tableRows } from "../table-rows.mjs";
import { categoryFor, evidenceItem, fill, fixedDate, monthDate, recordId } from "./common.mjs";

export const PSTI = "https://www.gl-inet.com/en-us/pages/psti-support-period";
export const ENDED = "https://www.gl-inet.com/en-us/pages/firmware-versions/?status=ended";
const FOOTNOTE = "*Actual Support Periods is 2 years after announcement of EOL";
const REGIMES = { [PSTI]: "uk_psti", [ENDED]: "vendor_policy" };
// "June 11, 2027", "Oct 10th, 2026" and "June 8, 2028" all appear; the month may be abbreviated.
const MONTH_DATE = /^([A-Za-z]+)\.? (\d{1,2})(?:st|nd|rd|th)?, (\d{4})$/;
const CODE = /\(([^()]+)\)$/;
const LONG = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Sept: "September", Oct: "October", Nov: "November", Dec: "December" };

export const pages = () => [PSTI, ENDED];

function dateOf(text) {
  const m = text.match(MONTH_DATE);
  return m ? monthDate(m[2], LONG[m[1]] ?? m[1], m[3]) : null;
}

// The code the id and alias come from: the bracketed part of "Beryl (GL-MT1300)", else the whole name (GL-S10).
const codeOf = (name) => name.match(CODE)?.[1] ?? name;

function parsePsti({ html, profile, today, skipped }) {
  const [conditions] = profile.conditions[PSTI];
  const notes = profile.notes[PSTI].join(" ");
  const [atLeast] = profile.at_least;
  const candidates = [];
  let rows = 0;
  for (const row of tableRows(html)) {
    if (row.cells.length !== 2 || row.cells[0].text === "Product models") continue;
    rows++;
    const [model, period] = row.cells.map((c) => c.text);
    if (!period.endsWith(` ${atLeast}`)) {
      skipped.push({ url: PSTI, quote: row.quote, reason: `"${period}" does not end with the profile's at-least phrase` });
      continue;
    }
    const endDate = dateOf(period.slice(0, -atLeast.length - 1));
    if (!endDate) {
      skipped.push({ url: PSTI, quote: row.quote, reason: `"${period}" does not start with a month, day and year` });
      continue;
    }
    const code = codeOf(model);
    const id = recordId(profile.brand_slug, code);
    const category = categoryFor(profile, { id, model, quote: row.quote });
    if (!category) {
      skipped.push({ url: PSTI, quote: row.quote, reason: `no category_map entry matches "${model}"` });
      continue;
    }
    candidates.push({
      id,
      brand: profile.brand,
      brand_slug: profile.brand_slug,
      model,
      aliases: code === model ? [] : [code],
      category,
      regions: profile.regions_by_url[PSTI],
      support: fixedDate(endDate, { atLeast: true, conditions }),
      evidence: [evidenceItem(PSTI, row.quote, today, REGIMES[PSTI]), evidenceItem(PSTI, FOOTNOTE, today, REGIMES[PSTI])],
      verification: { status: "unverified" },
      notes,
    });
  }
  return { candidates, rows };
}

// The firmware versions table: a seven-cell row is a model with its latest firmware, status and dates; a six-cell row
// is a second firmware line for the model above it. Only a Maintenance row with both dates gives a record.
function parseEnded({ html, profile, today, skipped, names }) {
  const [conditions] = profile.conditions[ENDED];
  const [template] = profile.notes[ENDED];
  const candidates = [];
  let rows = 0;
  for (const row of tableRows(html)) {
    if (row.cells.length !== 7) continue;
    rows++;
    const [code, , , , status, eol, until] = row.cells.map((c) => c.text);
    if (status !== "Maintenance") {
      skipped.push({ url: ENDED, quote: row.quote, reason: `status ${status} with no Supported Until date` });
      continue;
    }
    const endDate = dateOf(until);
    if (!endDate || !dateOf(eol)) {
      skipped.push({ url: ENDED, quote: row.quote, reason: `the EOL Date or Supported Until cell is not a month, day and year` });
      continue;
    }
    const model = names.get(code) ?? code;
    const id = recordId(profile.brand_slug, code);
    const category = categoryFor(profile, { id, model, quote: row.quote });
    if (!category) {
      skipped.push({ url: ENDED, quote: row.quote, reason: `no category_map entry matches "${model}"` });
      continue;
    }
    candidates.push({
      id,
      brand: profile.brand,
      brand_slug: profile.brand_slug,
      model,
      aliases: code === model ? [] : [code],
      category,
      regions: profile.regions_by_url[ENDED],
      support: fixedDate(endDate, { atLeast: false, conditions }),
      evidence: [evidenceItem(ENDED, row.quote, today, REGIMES[ENDED])],
      verification: { status: "unverified" },
      notes: fill(template, { eol_date: eol, end_date: until }),
    });
  }
  return { candidates, rows };
}

// Candidate records from both pages, the rows skipped, the D39 conflicts flagged and the rows read per page.
export function parse({ pages: read, profile, today = new Date().toISOString().slice(0, 10) }) {
  const html = Object.fromEntries(read.map((p) => [p.url, p.html]));
  const skipped = [];
  const flags = [];
  const psti = parsePsti({ html: html[PSTI], profile, today, skipped });
  const names = new Map(psti.candidates.map((c) => [codeOf(c.model), c.model]));
  const ended = parseEnded({ html: html[ENDED], profile, today, skipped, names });
  const rows = { [PSTI]: psti.rows, [ENDED]: ended.rows };
  const candidates = [];
  const onBoth = new Set(ended.candidates.map((c) => c.id).filter((id) => psti.candidates.some((c) => c.id === id)));
  for (const c of [...psti.candidates, ...ended.candidates]) {
    if (!onBoth.has(c.id)) {
      candidates.push(c);
      continue;
    }
    skipped.push({ url: c.evidence[0].url, quote: c.evidence[0].quote, reason: `both pages list ${c.model} (D39)` });
  }
  for (const id of onBoth) {
    const a = psti.candidates.find((c) => c.id === id);
    const b = ended.candidates.find((c) => c.id === id);
    flags.push({ model: a.model, text: `conflict: GL.iNet's pages both list ${a.model}: the PSTI table gives ${a.support.end_date} or later, the firmware table Supported Until ${b.support.end_date}, a D39 case for a person to record` });
  }
  return { candidates, skipped, flags, rows };
}
