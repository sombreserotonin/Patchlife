// Validates every device record and source registry file against its JSON Schema plus integrity rules the schema can't express.
// Usage: node scripts/validate-data.mjs [devicesDir] [sourcesDir]
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import YAML, { CST, LineCounter, Parser } from "yaml";

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
// numeric date counts only when its day and month can't swap. A YYYY-MM month (D38) counts as December 2027,
// Dec. 2027 or 2027-12. Catches a date retyped wrongly from its quote.
export function mentionsDate(text, isoDate, order) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const month = MONTHS[m - 1];
  const names = `(?:${month}|${month.slice(0, 3)}${month === "september" ? "|sept" : ""})\\.?`;
  if (d === undefined) {
    return new RegExp(`(?:^|[^0-9a-z])(?:${names},?\\s+${y}|${y}-${String(m).padStart(2, "0")})(?![0-9])`, "i").test(text.normalize("NFKC"));
  }
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

// An archive link must be a Wayback Machine capture of the cited page itself (D43).
export function isCaptureOf(archiveUrl, url) {
  return archiveUrl.match(/^https:\/\/web\.archive\.org\/web\/\d{14}\/(.*)$/s)?.[1] === url;
}

// The hardware versions a text writes (V5, v1, V2.20), lowercased: a "v" and digits standing alone, so "VR2100" and
// "5G" don't count.
export function versionsIn(text) {
  return [...(text ?? "").normalize("NFKC").matchAll(/(?<![a-z0-9])v\d+(?:\.\d+)*(?![a-z0-9])/gi)].map(([v]) => v.toLowerCase());
}

// True when the text writes this token as a whole word, with its own casing. R4 takes a hardware version exactly as
// the row writes it, since TP-Link's page writes "v1" on two rows and "V1" on the rest (#108).
export function writesToken(text, token) {
  return text.normalize("NFKC").replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, "").split(/\s+/).includes(token);
}

// A footnote marker: asterisks, daggers or superscript digits, as a page attaches them to a row ("or later*").
const MARKER = "[*†‡]+|[⁰¹²³⁴⁵⁶⁷⁸⁹]+";
const MARKERS = new RegExp(MARKER, "g");
const LEADING_MARKER = new RegExp(`^(?:${MARKER})`);

// Plain (unquoted) scalars in YAML source that a comment cuts short (R8, D25). YAML ends a plain scalar at " #" with
// no error, so the value loses its tail; the CST keeps that comment right after the scalar's token, so the check reads
// the source, not the parsed value. A plain scalar holding ": " is a parse error already (a nested mapping).
export function plainScalarProblems(source) {
  const problems = [];
  const lines = new LineCounter();
  const check = (token) => {
    if (token?.type !== "scalar") return;
    const next = token.end?.find((t) => t.type === "comment" || t.type === "newline");
    if (next?.type === "comment") {
      problems.push(`line ${lines.linePos(token.offset).line}: plain value "${token.source}" ends at the comment "${next.source}": quote the value or reword it (D25)`);
    }
  };
  for (const token of new Parser(lines.addNewLine).parse(source)) {
    CST.visit(token, (item) => {
      check(item.key);
      check(item.value);
    });
  }
  return problems;
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
// dates read in quotes from any evidence URL that starts with one of its URLs. An entry's profile fields (the source
// schema describes them) set what rules R2, R3, R4, R6 and R7 check on its brand's records; R1, R5 and R8 need none.
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
  const profiles = new Map(sources.map((entry) => [entry.brand_slug, entry]));
  // A category_map pattern that doesn't compile matches nothing here; validateSources reports it.
  const regexes = new Map();
  const regexFor = (pattern) => {
    if (!regexes.has(pattern)) {
      try {
        regexes.set(pattern, new RegExp(pattern, "i"));
      } catch {
        regexes.set(pattern, null);
      }
    }
    return regexes.get(pattern);
  };

  for (const file of files) {
    const rel = relative(devicesDir, file);
    const fail = (message) => errors.push({ file: rel, message });

    const text = readFileSync(file, "utf8");
    let record;
    try {
      record = YAML.parse(text);
    } catch (err) {
      fail(`YAML parse error: ${err.message}`);
      continue;
    }
    // R8: no plain scalar loses its tail to a comment (D25).
    for (const problem of plainScalarProblems(text)) fail(`R8: ${problem}`);
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
    // A month-only end date is for a source that gives no day (D38): when a quote gives a day in that month, use it.
    if (/^\d{4}-\d{2}$/.test(support.end_date ?? "")) {
      const [y, m] = support.end_date.split("-").map(Number);
      const days = Array.from({ length: new Date(Date.UTC(y, m, 0)).getUTCDate() }, (_, i) => `${support.end_date}-${String(i + 1).padStart(2, "0")}`);
      const day = days.find(quoted);
      if (day) fail(`end_date ${support.end_date} gives only the month, but a quote states ${day}: use the full date`);
    }
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
      if (ev.archive_url && !isCaptureOf(ev.archive_url, ev.url)) fail(`archive_url ${ev.archive_url} is not a Wayback capture of ${ev.url}`);
    }
    const checked = record.verification.checked;
    if (checked && checked > today) fail(`verification.checked ${checked} is in the future`);

    // Profile rules (MIGRATION B2): the brand's source registry entry says how its pages state support, so the
    // judgement fields the audits used to catch (aliases, regions, at_least, conditions, category) are checked here.
    const profile = profiles.get(record.brand_slug) ?? {};
    const urls = [...new Set(record.evidence.map((ev) => ev.url))];

    // R1: an alias is quoted, is the model with the brand in front, or is an old name the rename table maps to the model.
    const renamed = (alias) => (profile.renames ?? []).some((r) => normalise(r.from) === normalise(alias) && normalise(r.to) === normalise(record.model));
    for (const alias of record.aliases ?? []) {
      if (!inQuote(alias) && normalise(alias) !== normalise(`${record.brand} ${record.model}`) && !renamed(alias)) {
        fail(`R1: alias "${alias}" is not quoted in any evidence item, is not the model with the brand in front, and is not a rename of the model in the profile`);
      }
    }

    // R2: the regions stay within what the cited pages cover together.
    if (profile.regions_by_url) {
      const covered = new Set(urls.flatMap((url) => profile.regions_by_url[url] ?? []));
      for (const region of record.regions) {
        if (!covered.has(region)) fail(`R2: region ${region} is not covered by any cited page (the profile says they cover ${[...covered].join(", ") || "no region"})`);
      }
    }

    // R3: an at_least record quotes the wording that makes the date a minimum.
    if (profile.at_least && support.at_least) {
      const stated = profile.at_least.some((sentence) => quoteTexts.some((text) => text.includes(normalise(sentence))));
      if (!stated) fail("R3: at_least is true, but no evidence quote states one of the profile's at-least sentences");
    }

    // R4: conditions is one of the profile's sentences for a cited page, with any {version} written as the row writes it.
    // A none_published record has no row, so R4 and R6 leave it alone.
    if (profile.conditions && support.rule !== "none_published") {
      const allowed = urls.flatMap((url) => (profile.conditions[url] ?? []).map((sentence) => ({ url, sentence })));
      const conditions = support.conditions ?? null;
      if (conditions === null) {
        if (allowed.length) fail("R4: conditions is missing, but the profile lists the sentences a record citing these pages carries");
      } else if (!allowed.length) {
        fail(`R4: conditions "${conditions}" is set, but the profile lists no conditions sentence for the cited pages`);
      } else {
        const matches = allowed.flatMap(({ url, sentence }) => {
          if (!sentence.includes("{version}")) return conditions === sentence ? [{ url }] : [];
          const version = conditions.match(new RegExp(`^${sentence.split("{version}").map(escapeRegExp).join("(\\S+)")}$`))?.[1];
          return version === undefined ? [] : [{ url, version }];
        });
        const written = matches.some(({ url, version }) => version === undefined || record.evidence.some((ev) => ev.url === url && writesToken(ev.quote ?? "", version)));
        if (!matches.length) fail(`R4: conditions "${conditions}" is not one of the profile's sentences for the cited pages`);
        else if (!written) fail(`R4: conditions names hardware version "${matches[0].version}", which no quoted row from the page writes that way`);
      }
    }

    // R5: a footnote marker in a quote needs the footnote itself, quoted from the same page as its own item.
    for (const ev of record.evidence) {
      const quote = ev.quote ?? "";
      const markers = new Set([...quote.matchAll(MARKERS)].filter((m) => m.index > 0).map(([marker]) => marker));
      for (const marker of markers) {
        const footnote = record.evidence.some((other) => other !== ev && other.url === ev.url && (other.quote ?? "").match(LEADING_MARKER)?.[0] === marker);
        if (!footnote) fail(`R5: quote "${quote}" carries the footnote marker "${marker}", but no other evidence item from the same page quotes a footnote starting with it`);
      }
    }

    // R6: on a versioned source the model or the conditions carries the row's hardware version, and so does every alias.
    if (profile.versioned && support.rule !== "none_published") {
      const written = new Set(record.evidence.flatMap((ev) => versionsIn(ev.quote)));
      const carries = (value) => versionsIn(value).some((v) => written.has(v));
      const list = [...written].join(", ");
      if (!written.size) fail("R6: the profile says this source lists models by hardware version, but no evidence quote writes one");
      else {
        if (!carries(record.model) && !carries(support.conditions)) fail(`R6: neither model "${record.model}" nor conditions carries a hardware version the quotes write (${list})`);
        for (const alias of record.aliases ?? []) {
          if (!carries(alias)) fail(`R6: alias "${alias}" carries no hardware version the quotes write (${list}), so it would match other versions of the model`);
        }
      }
    }

    // R7: the category follows the profile's map, or is a listed exception.
    const exception = profile.category_exceptions?.[record.id];
    if (exception !== undefined) {
      if (record.category !== exception) fail(`R7: category "${record.category}" is not the profile's exception for this record (${exception})`);
    } else if (profile.category_map) {
      const entry = profile.category_map.find((e) => (e.model ? regexFor(e.model)?.test(record.model) : record.evidence.some((ev) => regexFor(e.row)?.test(ev.quote ?? ""))));
      if (!entry) fail(`R7: no category_map entry of the profile matches model "${record.model}" or its quotes, and category_exceptions does not list this record`);
      else if (entry.category !== record.category) fail(`R7: category "${record.category}" differs from the profile's ${entry.category} for ${entry.model ? "model" : "row"} pattern "${entry.model ?? entry.row}"`);
    }
  }

  return { files: files.length, errors };
}

// Checks each sourcesDir/*.yaml file: a list of starting URLs per brand. A brand_slug may appear once across all files.
// Also checks sourcesDir/page-hashes.json, which the verifier rewrites, so a broken merge of it fails here rather than
// at the next night's run. Returns the entries of the files that pass the schema, for validateDevices.
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

    const text = readFileSync(join(sourcesDir, name), "utf8");
    let entries;
    try {
      entries = YAML.parse(text);
    } catch (err) {
      fail(`YAML parse error: ${err.message}`);
      continue;
    }
    for (const problem of plainScalarProblems(text)) fail(`R8: ${problem}`);
    if (Array.isArray(entries)) sources += entries.length;
    if (!validate(entries)) {
      for (const err of validate.errors) fail(`schema: ${err.instancePath || "/"} ${err.message}`);
      continue;
    }

    valid.push(...entries);
    for (const { brand_slug: slug, last_checked: checked, category_map: map } of entries) {
      if (seen.has(slug)) fail(`duplicate brand_slug "${slug}", also in ${seen.get(slug)}`);
      else seen.set(slug, name);
      if (checked && checked > today) fail(`last_checked ${checked} for "${slug}" is in the future`);
      for (const pattern of (map ?? []).map((entry) => entry.model ?? entry.row)) {
        try {
          new RegExp(pattern, "i");
        } catch (err) {
          fail(`category_map pattern "${pattern}" for "${slug}" is not a regular expression: ${err.message}`);
        }
      }
    }
  }

  const hashFile = join(sourcesDir, "page-hashes.json");
  if (existsSync(hashFile)) {
    const fail = (message) => errors.push({ file: "page-hashes.json", message });
    let hashes;
    try {
      hashes = JSON.parse(readFileSync(hashFile, "utf8"));
    } catch (err) {
      hashes = null;
      fail(`JSON parse error: ${err.message}`);
    }
    if (hashes !== null && (typeof hashes !== "object" || Array.isArray(hashes))) fail("must be a JSON object of evidence URL to hash");
    else if (hashes) {
      const urls = Object.keys(hashes);
      for (const url of urls) {
        if (!url.startsWith("https://")) fail(`key "${url}" is not an https URL`);
        if (!/^[a-f0-9]{64}$/.test(hashes[url])) fail(`hash for ${url} is not a SHA-256 hex string`);
      }
      if (urls.join("\n") !== [...urls].sort().join("\n")) fail("keys must be sorted, as the verifier writes them");
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
