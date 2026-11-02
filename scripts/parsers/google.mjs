// Parses Google's security support pages (MIGRATION B4). The Nest table (answer/10231940) is the main page: rows like
// "Nest Cam (battery) 8/24/2021 8/24/2026 Yes" give the release date, the end date and the Yes/No cell, all read
// from the row and never computed; addYears is only a cross-check that the end date is the release date plus five
// years, as the validator requires, so a row that is not is skipped and reported. A model named in the UK PSTI statement (answer/14869041) or in an Australian
// statement (one page per model) gains that region, the statement's two quotes and the profile's combined notes
// sentence; the profile's renames table says which statement name is which table model, so a name with no entry is
// reported, never linked. The regulatory page (chromecast/answer/10367042) is read for links to Australian statements
// the profile does not list yet.
import { tableRows } from "../table-rows.mjs";
import { addYears } from "../validate-data.mjs";
import { categoryFor, evidenceItem, fill, isoDate, recordId } from "./common.mjs";

export const TABLE = "https://support.google.com/product-documentation/answer/10231940?hl=en";
export const UK = "https://support.google.com/product-documentation/answer/14869041?hl=en";
export const INDEX = "https://support.google.com/chromecast/answer/10367042";
const SENTENCES = [
  "Google Nest connected home devices will receive automatic security updates for at least 5 years from the date we start selling them on the US Google Store.",
  "Security updates will address critical issues known to Google Nest that are able to be resolved with a remote software update.",
];
const YEARS = 5;
const REGIMES = { [TABLE]: "vendor_policy", [UK]: "uk_psti" };
const AU_REGIME = "au_smart_device_rules";
const MDY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const GROUP = /Group (\d+): (.*?)(?= Group \d+:|$)/g;
const ENTRY_SPLIT = /, (?![^(]*\))/;
const CODES = /^(.*?)\s*\(([A-Z0-9][A-Z0-9/, ]*)\)$/;
const AU_DATE = /, ending no earlier than ([A-Za-z]+) (\d{1,2}), (\d{4})$/;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const STATEMENT_LINK = /<a\b[^>]*href="\/product-documentation\/answer\/(\d+)"[^>]*>\s*AU Cyber Security Rules/g;

const statementUrl = (id) => `https://support.google.com/product-documentation/answer/${id}?hl=en`;

// The table, the UK statement, the Australian statements the profile lists (every other product-documentation URL in
// regions_by_url) and the regulatory page that links the statements.
export function pages(profile) {
  const statements = Object.keys(profile.regions_by_url).filter((url) => ![TABLE, UK, INDEX].includes(url));
  return [TABLE, UK, ...statements, INDEX];
}

function mdy(text) {
  const m = text.match(MDY);
  return m ? isoDate(Number(m[3]), Number(m[1]), Number(m[2])) : null;
}

// The Nest table: a candidate per row that reads without guessing.
function parseTable({ html, profile, today, skipped, flags }) {
  const [conditions] = profile.conditions[TABLE];
  const [formatNote, regionNote, receivingNote, notReceivingNote] = profile.notes[TABLE];
  const candidates = [];
  let rows = 0;
  for (const row of tableRows(html)) {
    if (row.cells.length !== 5 || row.cells[0].text === "Device") continue;
    rows++;
    const [model, releaseCell, endCell, receiving] = row.cells.map((c) => c.text);
    const quote = [model, releaseCell, endCell, receiving].join(" ");
    const release = mdy(releaseCell);
    const endDate = mdy(endCell);
    if (!release || !endDate) {
      skipped.push({ url: TABLE, quote, reason: "the release or end cell is not a month/day/year date" });
      continue;
    }
    if (!["Yes", "No"].includes(receiving)) {
      skipped.push({ url: TABLE, quote, reason: `"${receiving}" is neither Yes nor No` });
      continue;
    }
    // The validator requires the end date to be the release date plus five years, so a row that is not cannot be a
    // record: it is skipped and flagged for a person.
    if (addYears(release, YEARS) !== endDate) {
      flags.push(`google: the end date of "${quote}" is not the release date plus ${YEARS} years`);
      skipped.push({ url: TABLE, quote, reason: `the end date is not the release date plus ${YEARS} years` });
      continue;
    }
    // The records drop a leading "Google " from the id: "Google Home Max" is google-home-max.
    const id = recordId(profile.brand_slug, model.replace(/^Google /, ""));
    const category = categoryFor(profile, { id, model, quote });
    if (!category) {
      skipped.push({ url: TABLE, quote, reason: `no category_map entry matches "${model}"` });
      continue;
    }
    // The dated note follows the Yes/No cell: a No is said as such; a Yes is said once the minimum has passed.
    const dated = receiving === "No" ? fill(notReceivingNote, { date: today }) : endDate < today ? fill(receivingNote, { date: today }) : null;
    candidates.push({
      id,
      brand: profile.brand,
      brand_slug: profile.brand_slug,
      model,
      aliases: [],
      category,
      regions: [...profile.regions_by_url[TABLE]],
      support: { rule: "years_after_launch", end_date: endDate, years: YEARS, anchor_date: release, at_least: true, conditions },
      evidence: [quote, ...SENTENCES].map((q) => evidenceItem(TABLE, q, today, REGIMES[TABLE])),
      verification: { status: "unverified" },
      notes: { formatNote, regionNote, dated, statements: [] },
    });
  }
  return { candidates, rows };
}

// The UK statement lists "Name (CODE)" entries by group in one cell and each group's period in another.
function parseUk({ html, profile }) {
  const periods = new Map();
  const entries = [];
  for (const row of tableRows(html)) {
    const [label, body] = row.cells.map((c) => c.text);
    if (row.cells.length !== 2) continue;
    if (label === "UK Defined Support Period") for (const [, n, sentence] of body.matchAll(GROUP)) periods.set(n, `Group ${n}: ${sentence}`);
    if (label === "Product (Model Number)") for (const [, n, list] of body.matchAll(GROUP)) for (const text of list.split(ENTRY_SPLIT)) entries.push({ text: text.trim(), group: n });
  }
  return entries.map((e) => ({ url: UK, text: e.text, sentence: periods.get(e.group) ?? null, regime: REGIMES[UK], regions: profile.regions_by_url[UK] }));
}

// An Australian statement names one product and its period, which ends with the date the table gives.
function parseAu({ html, url, profile }) {
  const cell = (label) => tableRows(html).find((row) => row.cells.length === 2 && row.cells[0].text === label)?.cells[1].text ?? null;
  const text = cell("Product (Model Number)");
  const sentence = cell("Australian Defined Support Period");
  if (!text || !sentence) return [];
  const m = sentence.match(AU_DATE);
  const endDate = m && MONTHS.includes(m[1]) ? isoDate(Number(m[3]), MONTHS.indexOf(m[1]) + 1, Number(m[2])) : null;
  return [{ url, text, sentence, endDate, regime: AU_REGIME, regions: profile.regions_by_url[url] }];
}

// Links the statement entries to the table's candidates through the renames table.
function link(entry, candidates, profile, today, flags) {
  const rename = (profile.renames ?? []).find((r) => r.urls.includes(entry.url) && r.from === entry.text);
  const page = entry.url === UK ? "the UK statement" : `the Australian statement ${entry.url}`;
  if (!rename) return false;
  const candidate = candidates.find((c) => c.model === rename.to);
  if (!candidate) {
    flags.push(`google: ${page} lists "${entry.text}", which the profile maps to "${rename.to}", but the Nest table has no such row`);
    return true;
  }
  if (!entry.sentence || !profile.at_least.some((s) => entry.sentence.includes(s))) {
    flags.push(`google: ${page} gives "${entry.text}" the period "${entry.sentence}", which is not the profile's at-least wording, so it is not linked`);
    return true;
  }
  if (entry.endDate !== undefined && entry.endDate !== candidate.support.end_date) {
    flags.push(`google: ${page} ends "${entry.text}" no earlier than ${entry.endDate}, but the Nest table gives ${candidate.support.end_date}, so it is not linked`);
    return true;
  }
  const codes = entry.text.match(CODES);
  for (const alias of codes ? [codes[1], ...codes[2].split(", ")] : [entry.text]) if (alias !== candidate.model && !candidate.aliases.includes(alias)) candidate.aliases.push(alias);
  candidate.regions.push(...entry.regions);
  candidate.evidence.push(evidenceItem(entry.url, entry.text, today, entry.regime), evidenceItem(entry.url, entry.sentence, today, entry.regime));
  candidate.notes.statements.push(entry.url);
  return true;
}

// The notes as the records write them: the format note, the UK sentence (alone or with Australia), the region note,
// an Australian-only sentence, then the dated Yes/No note.
function notesFor(parts, profile) {
  const [ukOnly, ukAndAu] = profile.notes[UK];
  const uk = parts.statements.includes(UK);
  const au = parts.statements.find((url) => url !== UK);
  const sentences = [parts.formatNote];
  if (uk) sentences.push(au ? ukAndAu : ukOnly);
  sentences.push(parts.regionNote);
  if (au && !uk) sentences.push(profile.notes[au][0]);
  if (parts.dated) sentences.push(parts.dated);
  return sentences.join(" ");
}

// Candidate records, the rows skipped, the flags for a person and the rows read per page (the regulatory page's rows
// are its links to Australian statements).
export function parse({ pages: read, profile, today = new Date().toISOString().slice(0, 10) }) {
  const html = Object.fromEntries(read.map((p) => [p.url, p.html]));
  const skipped = [];
  const flags = [];
  const rows = {};
  const { candidates, rows: tableRowCount } = parseTable({ html: html[TABLE], profile, today, skipped, flags });
  rows[TABLE] = tableRowCount;
  const entries = [];
  for (const { url } of read) {
    if (url === TABLE || url === INDEX) continue;
    const found = url === UK ? parseUk({ html: html[url], profile }) : parseAu({ html: html[url], url, profile });
    rows[url] = found.length;
    entries.push(...found);
  }
  // A statement entry with the five-year wording and no renames row could be a Nest table model: a lead for a person.
  const unlinked = new Map();
  for (const entry of entries) {
    const fiveYears = entry.sentence && profile.at_least.some((s) => entry.sentence.includes(s));
    if (!link(entry, candidates, profile, today, flags) && fiveYears) unlinked.set(entry.url, [...(unlinked.get(entry.url) ?? []), entry.text]);
  }
  for (const [url, names] of unlinked) flags.push(`google: ${url === UK ? "the UK statement" : url} lists ${names.length} product(s) the profile's renames table does not map to a Nest table model: ${names.join("; ")}`);
  if (INDEX in html) {
    const linked = [...html[INDEX].matchAll(STATEMENT_LINK)].map(([, id]) => statementUrl(id));
    rows[INDEX] = linked.length;
    for (const url of linked) if (!(url in profile.regions_by_url)) flags.push(`google: the regulatory page links an Australian statement the profile does not list: ${url}`);
  }
  for (const c of candidates) c.notes = notesFor(c.notes, profile);
  return { candidates, skipped, flags, rows };
}
