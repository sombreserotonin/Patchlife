// Runs each brand's parser on its profiled pages and matches the candidate records to the existing ones by their row
// quotes (MIGRATION B3 and B4), never by generated id, so it can't create a duplicate. The parser gate: every record
// whose quotes are still on their pages must be reproduced field for field, or nothing is written. With --check it
// writes nothing and reports per page. Without it, a record whose row has changed (its quote gone or withdrawn (O8), the model's row
// now giving another date or wording, or only the templated notes moved on) is rewritten from the parser's row as a
// proposal, then the rows no record
// covers are written as new unverified records, one brand at a time, up to --limit (MIGRATION decision 5). Records in
// the profile's parser_exceptions are never rewritten. A page with fewer rows than the profile's min_rows stops the
// run as "parser broken". --report writes a JSON report for the weekly workflow. Reads pages with the polite fetcher.
// Usage: node --use-env-proxy scripts/candidates.mjs [--check] [--limit <n>] [--report <file>] [brand ...]
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import YAML from "yaml";
import { createFetcher } from "./polite-fetch.mjs";
import { listYamlFiles, validateDevices, validateSources } from "./validate-data.mjs";
import { YAML_OUT, normalise, pageText, samePage, stripHidden } from "./verify-evidence.mjs";
import * as asus from "./parsers/asus.mjs";
import * as ezvizEol from "./parsers/ezviz-eol.mjs";
import * as glInet from "./parsers/gl-inet.mjs";
import * as google from "./parsers/google.mjs";
import * as grandstream from "./parsers/grandstream.mjs";
import * as kyocera from "./parsers/kyocera.mjs";
import * as ring from "./parsers/ring.mjs";
import * as tpLinkAu from "./parsers/tp-link-au.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PARSERS = { "tp-link": tpLinkAu, ezviz: ezvizEol, ring, google, "gl-inet": glInet, kyocera, asus, grandstream };
// The fields the parser gate compares (MIGRATION, "The parser gate"); the support ones live under support.
const GATE_FIELDS = ["model", "end_date", "at_least", "regions", "category", "conditions", "notes"];
const field = (record, name) => (name in record.support ? record.support[name] : record[name] ?? null);
// A notes template's {date} placeholder matches any date, so the dates in both notes are blanked before comparing.
const DATE = /\d{4}-\d{2}-\d{2}/g;
const DEFAULT_LIMIT = 60;

// A record, new or rewritten, in the style of the hand-written ones: regions in flow style, dates and quotes
// double-quoted.
export function recordYaml(record) {
  const doc = new YAML.Document(record);
  doc.get("regions").flow = true;
  const quote = (path) => {
    const node = doc.getIn(path, true);
    if (node) node.type = "QUOTE_DOUBLE";
  };
  quote(["support", "end_date"]);
  quote(["support", "anchor_date"]);
  record.evidence.forEach((item, i) => {
    quote(["evidence", i, "quote"]);
    quote(["evidence", i, "retrieved"]);
  });
  return doc.toString(YAML_OUT);
}

// Compares a record with the candidate that reproduces its row: the gate fields that differ, as the record and the
// parser give them.
export function gateDifferences(record, candidate) {
  return GATE_FIELDS.flatMap((name) => {
    const [a, b] = [field(record, name), field(candidate, name)];
    const same = name === "notes" && typeof a === "string" && typeof b === "string" ? a.replace(DATE, "{date}") === b.replace(DATE, "{date}") : JSON.stringify(a) === JSON.stringify(b);
    return same ? [] : [{ field: name, record: a, parser: b }];
  });
}

// The record rewritten from the parser's row: the row-derived fields come from the candidate, the record's identity,
// aliases and category stay, and the verification starts again.
export function rewritten(record, candidate) {
  const { notes, ...rest } = record;
  const next = { ...rest, regions: candidate.regions, support: candidate.support, evidence: candidate.evidence, verification: { status: "unverified" } };
  if (candidate.notes) next.notes = candidate.notes;
  return next;
}

const key = (url, quote) => `${url}\n${normalise(quote)}`;
const names = (record) => [record.model, ...(record.aliases ?? [])].map(normalise);

// Matches one brand's candidates to its records. Returns one report per parsed page (see format), the candidates no
// record covers, the records whose row changed with the candidate that replaces them, and the flags for a person.
// texts gives each cited URL's normalised page text, for the quote checks.
export function matchBrand({ urls, brand_slug, profile, candidates, skipped, flags = [], rows, records, texts }) {
  const exceptions = new Set(profile.parser_exceptions ?? []);
  // An item with no quote (a record withdrawn by O8, or none_published) pins no row, so its record counts as changed.
  const onPage = (item) => item.quote != null && (texts.get(item.url)?.includes(normalise(item.quote)) ?? false);
  const reports = Object.fromEntries(urls.map((url) => [url, { url, brand_slug, rows: rows[url], minRows: profile.min_rows?.[url], cited: 0, reproduced: [], exceptions: [], differ: [], notReproduced: [], changed: [], idDiffers: [], ambiguous: [], unquotable: [], newRows: [], skipped: skipped.filter((s) => s.url === url) }]));
  const pagesOf = (items) => [...new Set(items.map((item) => item.url))].filter((url) => url in reports);
  const report = (items, list, entry) => pagesOf(items).forEach((url) => reports[url][list].push(entry));
  const out = [];
  // A candidate with an item that is not in its page's text can't stand as a record, so it fails the gate, whether it
  // is a new row or would replace a recorded one.
  const missingItem = (candidate) => candidate.evidence.find((item) => !onPage(item));
  const unquotable = (candidate, missing) => {
    report(candidate.evidence, "unquotable", { id: candidate.id, url: missing.url, quote: missing.quote });
    out.push(`unquotable: ${candidate.id}: ${JSON.stringify(missing.quote)} is not on ${missing.url}`);
  };
  // A parser's conflict is settled once exception records quote every side of it: each page's row contains a quote
  // an exception record cites from that page (a D33 or D39 split already recorded). What a record cites from a table
  // page is a dated row or a whole sentence, so a row that appears later with another date contains none of them, and
  // its conflict shows even for a model whose record is an exception for its notes alone. A flag without sides shows.
  const exceptionQuotes = new Map();
  for (const r of records.filter((record) => exceptions.has(record.id))) {
    for (const item of r.evidence) if (item.quote && normalise(item.quote)) exceptionQuotes.set(item.url, [...(exceptionQuotes.get(item.url) ?? []), normalise(item.quote)]);
  }
  const settled = (flag) => Array.isArray(flag.sides) && flag.sides.length > 0 && flag.sides.every((side) => (exceptionQuotes.get(side.url) ?? []).some((quote) => normalise(side.quote).includes(quote)));
  for (const flag of flags) {
    if (typeof flag === "string") out.push(flag);
    else if (!settled(flag)) out.push(flag.text);
  }

  // Identical rows (a page may list a model twice) collapse into one candidate. Two different rows for one id are
  // ambiguous: a record's quote still pins one of them, but neither is written as new.
  const byQuote = new Map();
  for (const c of candidates) byQuote.set(key(c.evidence[0].url, c.evidence[0].quote), c);
  const unique = [...byQuote.values()];
  const byId = new Map();
  for (const c of unique) byId.set(c.id, [...(byId.get(c.id) ?? []), c]);
  const ambiguous = new Set();
  for (const [id, group] of byId) {
    if (group.length === 1) continue;
    ambiguous.add(id);
    report(group.flatMap((c) => c.evidence), "ambiguous", { id, quotes: group.map((c) => c.evidence[0].quote) });
    out.push(`ambiguous: ${brand_slug} gives two rows for ${id}: ${group.map((c) => JSON.stringify(c.evidence[0].quote)).join(" and ")}`);
  }
  // Every item of every candidate: a quote held by one candidate pins it, a sentence shared by all pins none.
  const index = new Map();
  for (const c of unique) for (const item of c.evidence) index.set(key(item.url, item.quote), [...(index.get(key(item.url, item.quote)) ?? []), c]);
  const byName = new Map();
  for (const c of unique) for (const name of names(c)) byName.set(name, [...(byName.get(name) ?? []), c]);
  const naming = (record) => [...new Set([...(byId.get(record.id) ?? []), ...names(record).flatMap((n) => byName.get(n) ?? [])])].filter((c) => !ambiguous.has(c.id));

  const matched = new Set();
  const proposals = [];
  for (const record of records) {
    const items = record.evidence.filter((item) => item.url in reports);
    if (!items.length) continue;
    pagesOf(items).forEach((url) => reports[url].cited++);
    const gone = items.filter((item) => !onPage(item));
    if (gone.length) {
      // The record's row has changed: the parser's row with the record's own id and model, if there is one, replaces
      // it (B4). A row that names the record under another model or id is a rename: a rewrite would keep the old model
      // and id, which the next run's gate refuses, so that row is left to a person.
      const named = naming(record).filter((c) => !matched.has(c));
      const [candidate] = named.filter((c) => c.id === record.id && c.model === record.model);
      const row = candidate ?? named[0];
      const withdrawn = gone[0].quote == null;
      const was = withdrawn ? "it has no quote (withdrawn)" : `its quote ${JSON.stringify(gone[0].quote)} is no longer on ${gone[0].url}`;
      report(gone, "changed", { id: record.id, ...(withdrawn ? { withdrawn: true } : { quote: gone[0].quote }), ...(row ? { parser: row.evidence[0].quote } : {}) });
      const missing = candidate && missingItem(candidate);
      if (!row) out.push(`changed: ${record.id}: ${was} and no row names the model now`);
      else if (exceptions.has(record.id)) out.push(`changed: ${record.id} is a parser exception, so its changed row ${JSON.stringify(row.evidence[0].quote)} is not written`);
      else if (!candidate) out.push(`changed: ${record.id}: ${was}, and the row that names it now gives the model ${JSON.stringify(row.model)} (id ${row.id}): a rename for a person (RUNBOOKS O9)`);
      else if (missing) unquotable(candidate, missing);
      else {
        // The PR's change table shows dates and conditions, not regions, so a rewrite that loses one says so here.
        const dropped = record.regions.filter((region) => !candidate.regions.includes(region));
        if (dropped.length) out.push(`changed: ${record.id}: the rewrite drops the region(s) ${dropped.join(", ")}, where no row names ${record.model} now: check the record against the pages (RUNBOOKS O9)`);
        proposals.push({ record, candidate, quote: withdrawn ? null : gone[0].quote });
      }
      if (row) matched.add(row);
      continue;
    }
    const pinned = [...new Set(items.flatMap((item) => (index.get(key(item.url, item.quote))?.length === 1 ? index.get(key(item.url, item.quote)) : [])))];
    // An exception's row is still the record's row, so its candidate is neither compared nor a new row.
    if (exceptions.has(record.id)) {
      report(items, "exceptions", record.id);
      for (const c of pinned) matched.add(c);
      continue;
    }
    if (!pinned.length) {
      report(items, "notReproduced", { id: record.id, quote: items[0].quote });
      continue;
    }
    for (const c of pinned) matched.add(c);
    const [candidate] = pinned;
    const differences = pinned.length > 1 ? [{ field: "rows", record: items.map((item) => item.quote), parser: pinned.map((c) => c.id) }] : gateDifferences(record, candidate);
    if (differences.length && differences.every((d) => d.field === "notes")) {
      // The row is unchanged and only the templated notes have moved on (Google's dated note once a minimum passes):
      // a proposal to regenerate the record, not a parser mismatch.
      const missing = missingItem(candidate);
      if (missing) unquotable(candidate, missing);
      else {
        report(items, "changed", { id: record.id, quote: items[0].quote, parser: candidate.evidence[0].quote, notes: true });
        out.push(`changed: ${record.id}: only the notes differ (record ${JSON.stringify(record.notes ?? null)}, parser ${JSON.stringify(candidate.notes ?? null)})`);
        proposals.push({ record, candidate, quote: items[0].quote });
      }
    } else if (differences.length) report(items, "differ", { id: record.id, differences });
    else report(items, "reproduced", record.id);
    if (candidate.id !== record.id) report(items, "idDiffers", { id: record.id, parser: candidate.id });
  }

  // A row no quote matches is new only when no record already has its id or names it; otherwise it is a second row
  // for a record whose own row is still on the page, which a person looks at.
  const ids = new Set(records.map((r) => r.id));
  const known = new Set(records.flatMap(names));
  const newRows = [];
  for (const candidate of unique) {
    if (matched.has(candidate) || ambiguous.has(candidate.id)) continue;
    const quote = candidate.evidence[0].quote;
    const missing = missingItem(candidate);
    if (missing) unquotable(candidate, missing);
    else if (ids.has(candidate.id) || names(candidate).some((name) => known.has(name))) {
      report(candidate.evidence, "changed", { id: candidate.id, quote, parser: true });
      out.push(`changed: a second row names the existing record ${candidate.id}: ${JSON.stringify(quote)}`);
    } else {
      report(candidate.evidence, "newRows", candidate);
      newRows.push(candidate);
    }
  }
  return { reports: urls.map((url) => reports[url]), newRows, proposals, flags: out };
}

// The parser's output disagrees with a record, or can't stand as one: the gate fails (MIGRATION, "The parser gate").
// Changed, ambiguous and skipped rows are for a person to look at, so they are reported but fail nothing.
export const mismatches = (report) => report.differ.length + report.notReproduced.length + report.idDiffers.length + report.unquotable.length;

// Runs the parsers of the named brands (default: every brand with one) and matches their candidates to the records.
// Returns { reports, written, flags }: one report per page, the records written (none with check: each with its id,
// file and kind, "changed" ones with the before and after of the row-derived fields) and the flags. Throws when a page
// can't be read, yields fewer rows than its min_rows, or the profile lacks what the parser needs.
export async function runCandidates(devicesDir, { brands = [], sources, parsers = PARSERS, get = createFetcher(), today = new Date().toISOString().slice(0, 10), check = false, limit = DEFAULT_LIMIT } = {}) {
  const chosen = brands.length ? brands : Object.keys(parsers);
  const pages = new Map();
  const page = (url) => {
    if (!pages.has(url)) {
      pages.set(url, get(url).then(async (fetched) => {
        if (!samePage(url, fetched.url)) throw new Error(`redirected to ${fetched.url}`);
        if (fetched.contentType !== "text/html") throw new Error(`not an HTML page (${fetched.contentType})`);
        // The parsers read the page as the verifier does: a row inside a comment or a script is not on the page.
        return { html: stripHidden(fetched.text), text: normalise(await pageText({ ...fetched, url })) };
      }));
    }
    return pages.get(url);
  };

  const results = [];
  for (const brand of chosen) {
    const parser = parsers[brand];
    const profile = sources.find((s) => s.brand_slug === brand);
    if (!parser) throw new Error(`no parser for brand "${brand}" (parsers: ${Object.keys(parsers).join(", ")})`);
    if (!profile) throw new Error(`no source registry entry for brand "${brand}"`);
    const urls = parser.PAGE ? [parser.PAGE] : parser.pages(profile);
    for (const url of urls) if (profile.min_rows?.[url] === undefined) throw new Error(`the ${brand} profile has no min_rows for ${url}`);
    const read = [];
    for (const url of urls) read.push({ url, html: (await page(url)).html });
    let parsed;
    if (parser.PAGE) {
      const [{ url, html }] = read;
      const { candidates, skipped } = parser.parse({ html, url, profile, today });
      parsed = { candidates, skipped: skipped.map((s) => ({ url, ...s })), flags: [], rows: { [url]: candidates.length + skipped.length } };
    } else {
      parsed = parser.parse({ pages: read, profile, today });
    }
    for (const url of urls) {
      if (parsed.rows[url] < profile.min_rows[url]) throw new Error(`parser broken: ${url} yields ${parsed.rows[url]} row(s), under the profile's min_rows ${profile.min_rows[url]}`);
    }
    const texts = new Map();
    for (const cited of new Set(parsed.candidates.flatMap((c) => c.evidence.map((item) => item.url)))) texts.set(cited, (await page(cited)).text);
    const dir = join(devicesDir, brand);
    const records = existsSync(dir) ? listYamlFiles(dir).map((file) => ({ file, record: YAML.parse(readFileSync(file, "utf8")) })) : [];
    const matched = matchBrand({ urls, brand_slug: brand, profile, ...parsed, records: records.map((r) => r.record), texts });
    results.push({ brand, ...matched, files: new Map(records.map((r) => [r.record.id, r.file])) });
  }

  const reports = results.flatMap((r) => r.reports);
  const flags = results.flatMap((r) => r.flags);
  const written = [];
  if (check || reports.some(mismatches)) return { reports, written, flags };
  // Changed rows on any brand come first, then new rows one brand at a time (MIGRATION decision 5), within the limit.
  const restore = new Map();
  const row = (record, quote) => ({ end_date: record.support.end_date, at_least: record.support.at_least, conditions: record.support.conditions, quote, notes: record.notes ?? null });
  for (const { proposals, files } of results) {
    for (const { record, candidate, quote } of proposals) {
      if (written.length === limit) break;
      const file = files.get(record.id);
      restore.set(file, readFileSync(file, "utf8"));
      writeFileSync(file, recordYaml(rewritten(record, candidate)));
      written.push({ id: record.id, file, kind: "changed", before: row(record, quote), after: row(candidate, candidate.evidence[0].quote) });
    }
  }
  for (const { newRows } of results) {
    for (const candidate of newRows) {
      if (written.length === limit) break;
      const dir = join(devicesDir, candidate.brand_slug);
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `${candidate.id}.yaml`);
      writeFileSync(file, recordYaml(candidate));
      written.push({ id: candidate.id, file, kind: "new" });
    }
  }
  // The tree must stay valid: when the validator rejects anything afterwards, the new records are removed again, the
  // rewritten ones restored and the errors reported, rather than left for CI.
  const { errors } = validateDevices(devicesDir, { today, sources });
  if (errors.length) {
    for (const { file, kind } of written) {
      if (kind === "new") rmSync(file);
      else writeFileSync(file, restore.get(file));
    }
    throw new Error(`validation failed after writing, so the ${written.length} record(s) written were undone:\n${errors.map((e) => `${e.file}: ${e.message}`).join("\n")}`);
  }
  return { reports, written, flags };
}

const show = (value) => JSON.stringify(value);

// The lines printed for one page: the counts, then one line per record or row that needs a look.
export function format(report) {
  const lines = [
    `${report.url} (${report.brand_slug})`,
    `  rows found: ${report.rows} (min_rows ${report.minRows})`,
    `  records citing the page: ${report.cited}`,
    `  reproduced: ${report.reproduced.length}`,
    `  parser exceptions, quote on the page: ${report.exceptions.length}`,
    `  fields differ: ${report.differ.length}`,
    `  not reproduced (quote on the page, no candidate matches it): ${report.notReproduced.length}`,
    `  changed rows (quote no longer on the page or withdrawn, only the notes differ, or a second row for an existing record): ${report.changed.length}`,
    `  id differs: ${report.idDiffers.length}`,
    `  ambiguous (two rows for one id): ${report.ambiguous.length}`,
    `  candidates with a quote not on its page: ${report.unquotable.length}`,
    `  new rows no record covers: ${report.newRows.length}`,
    `  rows skipped by the parser: ${report.skipped.length}`,
  ];
  for (const { id, differences } of report.differ) for (const d of differences) lines.push(`  differs: ${id}: ${d.field}: record ${show(d.record)}, parser ${show(d.parser)}`);
  for (const { id, quote } of report.notReproduced) lines.push(`  not reproduced: ${id}: ${show(quote)}`);
  for (const { id, quote, parser, notes, withdrawn } of report.changed) {
    if (notes) lines.push(`  changed: ${id}: only the notes differ for ${show(quote)}`);
    else lines.push(`  changed: ${id}: ${parser === true ? `a second row names the record ${show(quote)}` : `${withdrawn ? "no quote (withdrawn)" : `quote gone ${show(quote)}`}${parser ? `, the page now has ${show(parser)}` : ", no row names the model now"}`}`);
  }
  for (const { id, parser } of report.idDiffers) lines.push(`  id differs: ${id}: parser gives ${parser}`);
  for (const { id, quotes } of report.ambiguous) lines.push(`  ambiguous: ${id}: ${quotes.map(show).join(" and ")}`);
  for (const { id, url, quote } of report.unquotable) lines.push(`  not on ${url}: ${id}: ${show(quote)}`);
  for (const candidate of report.newRows) lines.push(`  new: ${show(candidate.evidence[0].quote)}`);
  for (const { quote, reason } of report.skipped) lines.push(`  skipped: ${show(quote)}: ${reason}`);
  return lines;
}

// The machine-readable report the weekly workflow builds its PR body from.
export function reportJson({ today, reports, written, flags }) {
  const counts = (r) => ({ url: r.url, brand_slug: r.brand_slug, rows: r.rows, min_rows: r.minRows, cited: r.cited, reproduced: r.reproduced.length, exceptions: r.exceptions.length, differ: r.differ.length, not_reproduced: r.notReproduced.length, changed: r.changed.length, id_differs: r.idDiffers.length, ambiguous: r.ambiguous.length, unquotable: r.unquotable.length, new_rows: r.newRows.length, skipped: r.skipped.length });
  return { today, pages: reports.map(counts), written, flags };
}

if (import.meta.main) {
  let options;
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { check: { type: "boolean" }, limit: { type: "string" }, report: { type: "string" } } });
    if (values.limit !== undefined && !/^\d{1,5}$/.test(values.limit)) throw new Error(`--limit takes a whole number up to 99999, not "${values.limit}"`);
    options = { brands: positionals, check: values.check ?? false, limit: values.limit === undefined ? DEFAULT_LIMIT : Number(values.limit), report: values.report };
  } catch (err) {
    console.error(`${err.message}\nUsage: node --use-env-proxy scripts/candidates.mjs [--check] [--limit <n>] [--report <file>] [brand ...]`);
    process.exit(2);
  }
  const { entries: sources, errors } = validateSources(join(ROOT, "data/sources"));
  if (errors.length) {
    for (const e of errors) console.error(`${e.file}: ${e.message}`);
    process.exit(1);
  }
  const today = new Date().toISOString().slice(0, 10);
  let result;
  try {
    result = await runCandidates(join(ROOT, "data/devices"), { ...options, sources, today });
  } catch (err) {
    console.error(err.cause?.message ? `${err.message} (${err.cause.message})` : err.message);
    process.exit(1);
  }
  const { reports, written, flags } = result;
  for (const report of reports) console.log(format(report).join("\n"));
  for (const flag of flags) console.log(`flag: ${flag}`);
  const failed = reports.reduce((n, report) => n + mismatches(report), 0);
  const newRows = new Set(reports.flatMap((report) => report.newRows)).size;
  const changed = written.filter((w) => w.kind === "changed").length;
  console.log(`${reports.length} page(s) read, ${failed} mismatch(es), ${newRows} new row(s), ${flags.length} flag(s)${options.check ? "" : failed ? ", nothing written" : `, ${changed} record(s) rewritten, ${written.length - changed} new record(s) written`}`);
  for (const { file, kind } of written) console.log(`${kind === "new" ? "wrote" : "rewrote"} ${file}`);
  if (options.report) writeFileSync(options.report, `${JSON.stringify(reportJson({ today, reports, written, flags }), null, 2)}\n`);
  process.exit(failed ? 1 : 0);
}
