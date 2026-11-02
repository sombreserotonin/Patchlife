// Runs each brand's parser on its profiled page and matches the candidate records to the existing ones by their row
// quote (MIGRATION B3), never by generated id, so it can't create a duplicate. The parser gate: every record whose
// quote is still on the page must be reproduced field for field, or the run stops. With --check it writes nothing and
// reports per page; without it, it writes the rows no record covers as new unverified records, up to --limit. A page
// with fewer rows than the profile's min_rows stops the run as "parser broken". Reads pages with the polite fetcher.
// Usage: node --use-env-proxy scripts/candidates.mjs [--check] [--limit <n>] [brand ...]
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import YAML from "yaml";
import { createFetcher } from "./polite-fetch.mjs";
import { listYamlFiles, validateDevices, validateSources } from "./validate-data.mjs";
import { YAML_OUT, normalise, pageText, samePage } from "./verify-evidence.mjs";
import * as ezvizEol from "./parsers/ezviz-eol.mjs";
import * as tpLinkAu from "./parsers/tp-link-au.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PARSERS = { "tp-link": tpLinkAu, ezviz: ezvizEol };
// The fields the parser gate compares (MIGRATION, "The parser gate"); the support ones live under support.
const GATE_FIELDS = ["model", "end_date", "at_least", "regions", "category", "conditions", "notes"];
const field = (record, name) => (name in record.support ? record.support[name] : record[name] ?? null);
const DEFAULT_LIMIT = 60;

// A new record in the style of the hand-written ones: regions in flow style, dates and quotes double-quoted.
export function recordYaml(record) {
  const doc = new YAML.Document(record);
  doc.get("regions").flow = true;
  const quote = (path) => {
    const node = doc.getIn(path, true);
    if (node) node.type = "QUOTE_DOUBLE";
  };
  quote(["support", "end_date"]);
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
    return JSON.stringify(a) === JSON.stringify(b) ? [] : [{ field: name, record: a, parser: b }];
  });
}

// Matches one page's candidates to the brand's records. Returns the report for that page (see format) and the
// candidates no record covers. texts gives each cited URL's normalised page text, for the quote checks.
export function matchPage({ url, brand_slug, profile, candidates, skipped, records, texts }) {
  const exceptions = new Set(profile.parser_exceptions ?? []);
  const onPage = (item) => texts.get(item.url)?.includes(normalise(item.quote)) ?? false;
  const report = { url, brand_slug, rows: candidates.length + skipped.length, minRows: profile.min_rows?.[url], cited: 0, reproduced: [], exceptions: [], differ: [], notReproduced: [], changed: [], idDiffers: [], ambiguous: [], unquotable: [], newRows: [], skipped };

  // Identical rows (the page lists some models twice) collapse into one candidate. Two different rows for one id are
  // ambiguous: a record's quote still pins one of them, but neither is written as new.
  const byQuote = new Map();
  for (const c of candidates) byQuote.set(normalise(c.evidence[0].quote), c);
  const byId = new Map();
  for (const c of byQuote.values()) byId.set(c.id, [...(byId.get(c.id) ?? []), c]);
  const ambiguous = new Set();
  for (const [id, rows] of byId) {
    if (rows.length === 1) continue;
    report.ambiguous.push({ id, quotes: rows.map((c) => c.evidence[0].quote) });
    ambiguous.add(id);
  }

  const matched = new Set();
  for (const record of records) {
    const items = record.evidence.filter((item) => item.url === url);
    if (!items.length) continue;
    report.cited++;
    if (!items.every(onPage)) {
      report.changed.push({ id: record.id, quote: items.find((item) => !onPage(item)).quote });
      continue;
    }
    const candidate = items.map((item) => byQuote.get(normalise(item.quote))).find(Boolean);
    // An exception's row is still the record's row, so its candidate is neither compared nor a new row.
    if (exceptions.has(record.id)) {
      report.exceptions.push(record.id);
      if (candidate) matched.add(candidate);
      continue;
    }
    if (!candidate) {
      report.notReproduced.push({ id: record.id, quote: items[0].quote });
      continue;
    }
    matched.add(candidate);
    const differences = gateDifferences(record, candidate);
    if (differences.length) report.differ.push({ id: record.id, differences });
    else report.reproduced.push(record.id);
    if (candidate.id !== record.id) report.idDiffers.push({ id: record.id, parser: candidate.id });
  }

  // A row no quote matches is new only when no record already has its id or names it; otherwise the record's row has
  // changed, which is a proposal for a person (B4), never a write.
  const ids = new Set(records.map((r) => r.id));
  const names = new Set(records.flatMap((r) => [r.model, ...(r.aliases ?? [])].map(normalise)));
  for (const candidate of byQuote.values()) {
    if (matched.has(candidate) || ambiguous.has(candidate.id)) continue;
    const quote = candidate.evidence[0].quote;
    const missing = candidate.evidence.find((item) => !onPage(item));
    if (missing) report.unquotable.push({ id: candidate.id, url: missing.url, quote: missing.quote });
    else if (ids.has(candidate.id) || [candidate.model, ...(candidate.aliases ?? [])].some((name) => names.has(normalise(name)))) report.changed.push({ id: candidate.id, quote, parser: true });
    else report.newRows.push(candidate);
  }
  return report;
}

// The parser's output disagrees with a record, or can't stand as one: the gate fails (MIGRATION, "The parser gate").
// Changed, ambiguous and skipped rows are for a person to look at, so they are reported but fail nothing.
export const mismatches = (report) => report.differ.length + report.notReproduced.length + report.idDiffers.length + report.unquotable.length;

// Runs the parsers of the named brands (default: every brand with one) and matches their candidates to the records.
// Returns { reports, written }: one report per page, and the files written (none with check). Throws when a page
// can't be read, yields fewer rows than its min_rows, or the profile lacks what the parser needs.
export async function runCandidates(devicesDir, { brands = [], sources, parsers = PARSERS, get = createFetcher(), today = new Date().toISOString().slice(0, 10), check = false, limit = DEFAULT_LIMIT } = {}) {
  const chosen = brands.length ? brands : Object.keys(parsers);
  const pages = new Map();
  const page = (url) => {
    if (!pages.has(url)) {
      pages.set(url, get(url).then(async (fetched) => {
        if (!samePage(url, fetched.url)) throw new Error(`redirected to ${fetched.url}`);
        if (fetched.contentType !== "text/html") throw new Error(`not an HTML page (${fetched.contentType})`);
        return { html: fetched.text, text: normalise(await pageText({ ...fetched, url })) };
      }));
    }
    return pages.get(url);
  };

  const reports = [];
  for (const brand of chosen) {
    const parser = parsers[brand];
    const profile = sources.find((s) => s.brand_slug === brand);
    if (!parser) throw new Error(`no parser for brand "${brand}" (parsers: ${Object.keys(parsers).join(", ")})`);
    if (!profile) throw new Error(`no source registry entry for brand "${brand}"`);
    const url = parser.PAGE;
    const minRows = profile.min_rows?.[url];
    if (minRows === undefined) throw new Error(`the ${brand} profile has no min_rows for ${url}`);
    const { html } = await page(url);
    const { candidates, skipped } = parser.parse({ html, url, profile, today });
    const rows = candidates.length + skipped.length;
    if (rows < minRows) throw new Error(`parser broken: ${url} yields ${rows} row(s), under the profile's min_rows ${minRows}`);
    const texts = new Map();
    for (const cited of new Set(candidates.flatMap((c) => c.evidence.map((item) => item.url)))) texts.set(cited, (await page(cited)).text);
    const dir = join(devicesDir, brand);
    const records = existsSync(dir) ? listYamlFiles(dir).map((file) => YAML.parse(readFileSync(file, "utf8"))) : [];
    reports.push(matchPage({ url, brand_slug: brand, profile, candidates, skipped, records, texts }));
  }

  const written = [];
  if (check || reports.some(mismatches)) return { reports, written };
  for (const report of reports) {
    for (const candidate of report.newRows) {
      if (written.length === limit) break;
      const dir = join(devicesDir, candidate.brand_slug);
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `${candidate.id}.yaml`);
      writeFileSync(file, recordYaml(candidate));
      written.push(file);
    }
  }
  // The tree must stay valid: when the validator rejects anything afterwards, the new records are removed again and
  // the errors reported, rather than left for CI.
  const { errors } = validateDevices(devicesDir, { today, sources });
  if (errors.length) {
    for (const file of written) rmSync(file);
    throw new Error(`validation failed after writing, so the ${written.length} new record(s) were removed:\n${errors.map((e) => `${e.file}: ${e.message}`).join("\n")}`);
  }
  return { reports, written };
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
    `  changed rows (quote no longer on the page, or a row for an existing record): ${report.changed.length}`,
    `  id differs: ${report.idDiffers.length}`,
    `  ambiguous (two rows for one id): ${report.ambiguous.length}`,
    `  candidates with a quote not on its page: ${report.unquotable.length}`,
    `  new rows no record covers: ${report.newRows.length}`,
    `  rows skipped by the parser: ${report.skipped.length}`,
  ];
  for (const { id, differences } of report.differ) for (const d of differences) lines.push(`  differs: ${id}: ${d.field}: record ${show(d.record)}, parser ${show(d.parser)}`);
  for (const { id, quote } of report.notReproduced) lines.push(`  not reproduced: ${id}: ${show(quote)}`);
  for (const { id, quote, parser } of report.changed) lines.push(`  changed: ${id}: ${parser ? "the page now has the row" : "quote gone"} ${show(quote)}`);
  for (const { id, parser } of report.idDiffers) lines.push(`  id differs: ${id}: parser gives ${parser}`);
  for (const { id, quotes } of report.ambiguous) lines.push(`  ambiguous: ${id}: ${quotes.map(show).join(" and ")}`);
  for (const { id, url, quote } of report.unquotable) lines.push(`  not on ${url}: ${id}: ${show(quote)}`);
  for (const candidate of report.newRows) lines.push(`  new: ${show(candidate.evidence[0].quote)}`);
  for (const { quote, reason } of report.skipped) lines.push(`  skipped: ${show(quote)}: ${reason}`);
  return lines;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let options;
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { check: { type: "boolean" }, limit: { type: "string" } } });
    if (values.limit !== undefined && !/^\d{1,5}$/.test(values.limit)) throw new Error(`--limit takes a whole number up to 99999, not "${values.limit}"`);
    options = { brands: positionals, check: values.check ?? false, limit: values.limit === undefined ? DEFAULT_LIMIT : Number(values.limit) };
  } catch (err) {
    console.error(`${err.message}\nUsage: node --use-env-proxy scripts/candidates.mjs [--check] [--limit <n>] [brand ...]`);
    process.exit(2);
  }
  const { entries: sources, errors } = validateSources(join(ROOT, "data/sources"));
  if (errors.length) {
    for (const e of errors) console.error(`${e.file}: ${e.message}`);
    process.exit(1);
  }
  let result;
  try {
    result = await runCandidates(join(ROOT, "data/devices"), { ...options, sources });
  } catch (err) {
    console.error(err.cause?.message ? `${err.message} (${err.cause.message})` : err.message);
    process.exit(1);
  }
  const { reports, written } = result;
  for (const report of reports) console.log(format(report).join("\n"));
  const failed = reports.reduce((n, report) => n + mismatches(report), 0);
  const newRows = reports.reduce((n, report) => n + report.newRows.length, 0);
  console.log(`${reports.length} page(s) read, ${failed} mismatch(es), ${newRows} new row(s)${options.check ? "" : failed ? ", nothing written" : `, ${written.length} record(s) written`}`);
  for (const file of written) console.log(`wrote ${file}`);
  process.exit(failed ? 1 : 0);
}
