// Validates every device record and source registry file against its JSON Schema plus integrity rules the schema can't express.
// Usage: node scripts/validate-data.mjs [devicesDir] [sourcesDir]
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import YAML from "yaml";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ANCHORED_RULES = new Set(["years_after_eol", "years_after_launch"]);

// Adds whole years to a YYYY-MM-DD date; 29 February becomes 28 February in non-leap years.
export function addYears(isoDate, years) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const year = y + years;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const day = m === 2 && d === 29 && !leap ? 28 : d;
  return `${String(year).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const NUMBER_WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

// Invisible characters (soft hyphen, zero-width spaces and joiners, word joiner, BOM) are dropped before comparing.
// The verifier finds quotes in page text with it, and the validator finds model names in quotes.
export function normalise(text) {
  return text.normalize("NFKC").replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

// True when the text writes this YYYY-MM-DD date in a common form: 31 December 2027, 31st Dec 2027,
// December 31, 2027, 2027-12-31, 2027/12/31, or numerically as 31/12/2027 or 12/31/2027 (with / or .).
// order ("dmy" or "mdy") is how the source writes numeric dates, and only that order counts. With no order, a
// numeric date counts only when its day and month can't swap. Catches a date retyped wrongly from its quote.
export function mentionsDate(text, isoDate, order) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const month = MONTHS[m - 1];
  const names = `(?:${month}|${month.slice(0, 3)}${month === "september" ? "|sept" : ""})\\.?`;
  const day = `0?${d}(?:st|nd|rd|th)?`;
  const unambiguous = !order && (d > 12 || d === m);
  const forms = [
    `${day}\\s+(?:of\\s+)?${names},?\\s+${y}`,
    `${names}\\s+${day},?\\s+${y}`,
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    `${y}/0?${m}/0?${d}`,
  ];
  if (order === "dmy" || unambiguous) forms.push(`0?${d}[/.]0?${m}[/.]${y}`);
  if (order === "mdy" || unambiguous) forms.push(`0?${m}[/.]0?${d}[/.]${y}`);
  return new RegExp(`(?:^|[^0-9a-z])(?:${forms.join("|")})(?![0-9])`, "i").test(text.normalize("NFKC"));
}

// Numeric dates in the text, such as 3/4/2027, whose day and month could swap: both 12 or under and different.
// A year-first date (2027/4/3) always reads year, month, day.
export function ambiguousDates(text) {
  return [...text.normalize("NFKC").matchAll(/(?<![0-9])(\d{1,2})[/.](\d{1,2})[/.]\d{4}(?![0-9])/g)]
    .filter(([, a, b]) => Number(a) !== Number(b) && Number(a) <= 12 && Number(b) <= 12)
    .map(([date]) => date);
}

// True when the text states this number of years: "3 years", "three years", "3-year", "a year".
export function mentionsYears(text, years) {
  const words = [String(years), NUMBER_WORDS[years], years === 1 ? "a" : ""].filter(Boolean).join("|");
  return new RegExp(`\\b(?:${words})[\\s-]+years?\\b`, "i").test(text.normalize("NFKC"));
}

export function loadValidator(schemaPath = join(ROOT, "data/schema/device.schema.json")) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(JSON.parse(readFileSync(schemaPath, "utf8")));
}

export function listYamlFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...listYamlFiles(path));
    else if (name.endsWith(".yaml")) files.push(path);
  }
  return files.sort();
}

// sources is the source registry's entries (validateSources returns them). An entry's date_order sets how numeric
// dates read in quotes from any evidence URL that starts with one of its URLs.
export function validateDevices(
  devicesDir,
  { today = new Date().toISOString().slice(0, 10), validate = loadValidator(), sources = [] } = {},
) {
  if (!existsSync(devicesDir)) return { files: 0, errors: [{ file: devicesDir, message: "directory not found" }] };
  const errors = [];
  const seen = new Map();
  const named = new Map();
  const files = listYamlFiles(devicesDir);
  const orders = sources.flatMap((entry) => (entry.date_order ? entry.urls.map((url) => [url, entry.date_order]) : []));
  const orderFor = (url) => orders.find(([prefix]) => url.startsWith(prefix))?.[1];

  for (const file of files) {
    const rel = relative(devicesDir, file);
    const fail = (message) => errors.push({ file: rel, message });

    let record;
    try {
      record = YAML.parse(readFileSync(file, "utf8"));
    } catch (err) {
      fail(`YAML parse error: ${err.message}`);
      continue;
    }
    if (!validate(record)) {
      for (const err of validate.errors) fail(`schema: ${err.instancePath || "/"} ${err.message}`);
      continue;
    }

    const stem = basename(file, ".yaml");
    const folder = basename(dirname(file));
    if (record.id !== stem) fail(`id "${record.id}" must match filename "${stem}"`);
    if (record.brand_slug !== folder) fail(`brand_slug "${record.brand_slug}" must match folder "${folder}"`);
    if (!record.id.startsWith(`${record.brand_slug}-`)) fail(`id must start with "${record.brand_slug}-"`);
    if (seen.has(record.id)) fail(`duplicate id "${record.id}", also in ${seen.get(record.id)}`);
    else seen.set(record.id, rel);

    const support = record.support;
    if (ANCHORED_RULES.has(support.rule)) {
      if (support.anchor_date) {
        const expected = addYears(support.anchor_date, support.years);
        if (support.end_date !== expected) fail(`end_date must equal anchor_date + ${support.years} years (${expected})`);
      } else if (support.end_date) {
        fail("end_date needs a published anchor_date for this rule");
      }
    }

    const quotes = record.evidence.map((ev) => ev.quote ?? "").join("\n");
    const quoted = (date) => record.evidence.some((ev) => mentionsDate(ev.quote ?? "", date, orderFor(ev.url)));
    if (support.rule === "fixed_date" && !quoted(support.end_date)) fail(`end_date ${support.end_date} is not written in any evidence quote`);
    if (support.anchor_date && !quoted(support.anchor_date)) fail(`anchor_date ${support.anchor_date} is not written in any evidence quote`);
    if (support.years && !mentionsYears(quotes, support.years)) fail(`years ${support.years} is not stated in any evidence quote`);
    for (const ev of record.evidence) {
      if (orderFor(ev.url)) continue;
      for (const date of ambiguousDates(ev.quote ?? "")) {
        fail(`quote from ${ev.url} writes "${date}", which reads as either day/month or month/day: list the URL in a source registry entry with a date_order`);
      }
    }

    // A quote must name the model, so the evidence is about this record. A none_published record has no date to quote.
    const names = [record.model, ...(record.aliases ?? [])];
    const quoteTexts = record.evidence.map((ev) => normalise(ev.quote ?? ""));
    const inQuote = (name) => normalise(name) !== "" && quoteTexts.some((text) => text.includes(normalise(name)));
    if (support.rule !== "none_published" && !names.some(inQuote)) fail(`neither model "${record.model}" nor an alias appears in any evidence quote`);

    // A model or alias names one record per brand, except region-date splits of one model (D33).
    const keys = names.map((name) => `${record.brand_slug}\n${normalise(name)}`);
    const clashes = new Map();
    for (const [i, key] of keys.entries()) {
      for (const other of named.get(key) ?? []) {
        const split = other.model === record.model && !other.regions.some((region) => record.regions.includes(region));
        if (!split && !clashes.has(other.id)) clashes.set(other.id, names[i]);
      }
    }
    for (const [id, name] of clashes) fail(`name "${name}" is also used by ${id}; only region-date splits (same model, no region in common) may share a name`);
    for (const key of new Set(keys)) named.set(key, [...(named.get(key) ?? []), record]);

    for (const ev of record.evidence) {
      if (ev.retrieved > today) fail(`evidence retrieved date ${ev.retrieved} is in the future`);
    }
    const checked = record.verification.checked;
    if (checked && checked > today) fail(`verification.checked ${checked} is in the future`);
  }

  return { files: files.length, errors };
}

// Checks each sourcesDir/*.yaml file: a list of starting URLs per brand. A brand_slug may appear once across all files.
// Returns the entries of the files that pass the schema, for validateDevices.
export function validateSources(
  sourcesDir,
  { today = new Date().toISOString().slice(0, 10), validate = loadValidator(join(ROOT, "data/schema/source.schema.json")) } = {},
) {
  if (!existsSync(sourcesDir)) return { files: 0, sources: 0, entries: [], errors: [{ file: sourcesDir, message: "directory not found" }] };
  const errors = [];
  const seen = new Map();
  const files = readdirSync(sourcesDir).filter((name) => name.endsWith(".yaml")).sort();
  const valid = [];
  let sources = 0;

  for (const name of files) {
    const fail = (message) => errors.push({ file: name, message });

    let entries;
    try {
      entries = YAML.parse(readFileSync(join(sourcesDir, name), "utf8"));
    } catch (err) {
      fail(`YAML parse error: ${err.message}`);
      continue;
    }
    if (Array.isArray(entries)) sources += entries.length;
    if (!validate(entries)) {
      for (const err of validate.errors) fail(`schema: ${err.instancePath || "/"} ${err.message}`);
      continue;
    }

    valid.push(...entries);
    for (const { brand_slug: slug, last_checked: checked } of entries) {
      if (seen.has(slug)) fail(`duplicate brand_slug "${slug}", also in ${seen.get(slug)}`);
      else seen.set(slug, name);
      if (checked && checked > today) fail(`last_checked ${checked} for "${slug}" is in the future`);
    }
  }

  return { files: files.length, sources, entries: valid, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sources = validateSources(resolve(process.argv[3] ?? join(ROOT, "data/sources")));
  const devices = validateDevices(resolve(process.argv[2] ?? join(ROOT, "data/devices")), { sources: sources.entries });
  const errors = [...devices.errors, ...sources.errors];
  for (const e of errors) console.error(`${e.file}: ${e.message}`);
  console.log(`${devices.files} record(s) and ${sources.sources} source(s) checked, ${errors.length} error(s)`);
  process.exit(errors.length ? 1 : 0);
}
