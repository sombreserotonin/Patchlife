// Parses Ring's software security update articles, the GB, AU and US pages in the profile's regions_by_url (MIGRATION
// B4). Each page is a set of two-column tables, product and "31 December 2027". A model gets one candidate whose
// regions are every page that lists it with the same date, with the row and the profile's at-least sentence quoted
// from each page. The model is the row's name without the "Ring " prefix, or the model the profile's renames table
// maps the name to on that page; the name as written stays an alias. A model with different dates on different pages
// is a D33 split: reported, never written. The 538eg name-change rows the renames table cites are quoted too, as the
// records do, so candidates.mjs fetches those pages for its quote check.
import { tableRows } from "../table-rows.mjs";
import { categoryFor, evidenceItem, fixedDate, monthDate, recordId } from "./common.mjs";

const REGIME = "vendor_policy";
const HEADER = "Ring device type";
const DATE = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/;
const PREFIX = /^Ring /;
const MAX_QUOTE = 300;

// The pages the parser reads, in the profile's order: the regions_by_url keys.
export const pages = (profile) => Object.keys(profile.regions_by_url);

// The renames entries whose urls name this page, by the name they map (with or without the prefix).
function renamesOn(profile, url) {
  const entries = (profile.renames ?? []).filter((r) => r.urls.includes(url));
  return (name) => entries.find((r) => r.from === name || r.from === name.replace(PREFIX, ""));
}

// One page: candidates for its rows, one per model and date, and the rows skipped with a reason.
function parsePage({ html, url, profile, today }) {
  const [conditions] = profile.conditions[url];
  const [atLeast] = profile.at_least;
  const rename = renamesOn(profile, url);
  const groups = new Map();
  const skipped = [];
  let rows = 0;
  for (const row of tableRows(html)) {
    if (row.cells.length !== 2 || row.cells[0].text === HEADER) continue;
    rows++;
    const [name, when] = row.cells.map((c) => c.text);
    const date = when.match(DATE);
    const endDate = date && monthDate(date[1], date[2], date[3]);
    if (!endDate) {
      skipped.push({ url, quote: row.quote, reason: `"${when}" is not a day, month and year` });
      continue;
    }
    const model = rename(name)?.to ?? name.replace(PREFIX, "");
    const key = `${model}\n${endDate}`;
    const group = groups.get(key) ?? { model, endDate, names: [], quotes: [] };
    group.names.push(name);
    group.quotes.push(row.quote);
    groups.set(key, group);
  }
  const candidates = [];
  for (const { model, endDate, names, quotes } of groups.values()) {
    // Several rows of one page mapped to one model with one date are quoted together, as the records are.
    const quote = quotes.join(" ");
    if (quote.length > MAX_QUOTE) {
      skipped.push({ url, quote, reason: `the ${quotes.length} rows for ${model} quoted together are over ${MAX_QUOTE} characters` });
      continue;
    }
    const id = recordId(profile.brand_slug, model);
    const category = categoryFor(profile, { id, model, quote });
    if (!category) {
      skipped.push({ url, quote, reason: `no category_map entry matches "${model}"` });
      continue;
    }
    const aliases = [`Ring ${model}`, ...names.filter((name) => name !== model && name !== `Ring ${model}`)];
    candidates.push({
      id,
      brand: profile.brand,
      brand_slug: profile.brand_slug,
      model,
      aliases,
      category,
      regions: profile.regions_by_url[url],
      support: fixedDate(endDate, { atLeast: true, conditions }),
      evidence: [evidenceItem(url, quote, today, REGIME), evidenceItem(url, atLeast, today, REGIME)],
      verification: { status: "unverified" },
    });
  }
  return { candidates, skipped, rows };
}

// The 538eg rows for a model: each renames entry mapping an old name to it, on each cited page that is not one of
// the parsed pages, quoted as the two cells of the rename table read ("Indoor Cam Plus Indoor Cam 2K").
function renameItems(profile, model, parsed, today) {
  const items = [];
  const names = [];
  for (const entry of profile.renames ?? []) {
    if (entry.to !== model) continue;
    const urls = entry.urls.filter((url) => !parsed.includes(url));
    if (!urls.length) continue;
    names.push(entry.from);
    for (const url of urls) items.push(evidenceItem(url, `${entry.from} ${entry.to}`, today, REGIME));
  }
  return { items, names };
}

// Candidate records merged across the pages (regions and evidence in page order), the rows skipped, the flags for a
// person (a D33 conflict carries its model, so candidates.mjs can drop one that exception records already settle) and
// the data rows read per page.
export function parse({ pages: read, profile, today = new Date().toISOString().slice(0, 10) }) {
  const parsed = read.map((p) => p.url);
  const perPage = read.map(({ url, html }) => parsePage({ html, url, profile, today }));
  const rows = Object.fromEntries(read.map(({ url }, i) => [url, perPage[i].rows]));
  const skipped = perPage.flatMap((p) => p.skipped);
  const flags = [];
  const byModel = new Map();
  for (const { candidates } of perPage) for (const c of candidates) byModel.set(c.model, [...(byModel.get(c.model) ?? []), c]);
  const candidates = [];
  for (const [model, parts] of byModel) {
    const dates = new Set(parts.map((c) => c.support.end_date));
    if (dates.size > 1) {
      const where = parts.map((c) => `${c.regions.join("/")} ${c.support.end_date}`).join(", ");
      flags.push({ model, text: `conflict: Ring's pages give different dates for ${model} (${where}), a D33 split for a person to record` });
      for (const c of parts) skipped.push({ url: c.evidence[0].url, quote: c.evidence[0].quote, reason: `different dates on different pages for ${model} (D33)` });
      continue;
    }
    const [first] = parts;
    const renamed = renameItems(profile, model, parsed, today);
    candidates.push({
      ...first,
      aliases: [...new Set([...parts.flatMap((c) => c.aliases), ...renamed.names])],
      regions: parts.flatMap((c) => c.regions),
      evidence: [...parts.flatMap((c) => c.evidence), ...renamed.items],
    });
  }
  return { candidates, skipped, flags, rows };
}
