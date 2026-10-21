// Checks that each evidence quote appears in the source page (SPEC 3) and records the result in the YAML.
// Stores hashes, never pages. PDF extraction and archive snapshots are not built yet.
// Usage: node --use-env-proxy scripts/verify-evidence.mjs [--due <days>] [--limit <n>] [id ...]
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import YAML from "yaml";
import { createFetcher } from "./polite-fetch.mjs";
import { listYamlFiles, normalise } from "./validate-data.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEXT_TYPES = new Set(["text/html", "application/xhtml+xml", "text/plain"]);
// Keeps untouched lines byte-identical, such as `regions: [UK]` and long notes.
const YAML_OUT = { flowCollectionPadding: false, lineWidth: 0 };

// Named entities: the basic set, all of Latin-1 (code points 160 to 255 in order) and common typography.
const LATIN1 =
  "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para " +
  "middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute " +
  "Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute " +
  "THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde " +
  "ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml";
const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", sbquo: "‚", bdquo: "„",
  lsaquo: "‹", rsaquo: "›", ndash: "–", mdash: "—", hellip: "…", bull: "•", trade: "™", euro: "€", ensp: "\u2002",
  emsp: "\u2003", thinsp: "\u2009",
  ...Object.fromEntries(LATIN1.split(" ").map((name, i) => [name, String.fromCodePoint(160 + i)])),
};

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, body) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body] ?? ENTITIES[body.toLowerCase()] ?? match;
  });
}

// Comments and inline formatting tags vanish, so "<strong>date</strong>." stays "date." and "31<sup>st</sup>" stays
// "31st". Every other tag becomes a space, so table cells are joined by single spaces after normalising.
const INLINE_TAGS = /<\/?(?:a|abbr|b|cite|code|em|font|i|mark|q|s|small|strong|sub|sup|time|u|wbr)(?=[\s/>])[^>]*>/gi;

export function htmlToText(html) {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(INLINE_TAGS, "")
    .replace(/<[^>]*>/g, " ");
  return decodeEntities(stripped);
}

export { normalise };

export function quoteMatches(quote, text) {
  const wanted = normalise(quote);
  return wanted !== "" && normalise(text).includes(wanted);
}

// texts[i] is the HTML of record.evidence[i].url, or null when it could not be fetched.
export function verifyRecord(record, texts, today = new Date().toISOString().slice(0, 10)) {
  if (record.support.rule === "none_published") return { ok: false, reason: "none_published records have no quote to verify" };
  const normalised = [];
  for (const [i, item] of record.evidence.entries()) {
    if (texts[i] == null) return { ok: false, reason: `no text for ${item.url}` };
    const text = normalise(htmlToText(texts[i]));
    if (!quoteMatches(item.quote ?? "", text)) return { ok: false, reason: `quote not found at ${item.url}` };
    normalised.push(text);
  }
  const text_sha256 = createHash("sha256").update(normalised.join("\n")).digest("hex");
  return { ok: true, verification: { status: "verified", checked: today, text_sha256 } };
}

// Returns the ids to check: those named in ids, or all. With due or limit, it keeps only verified records (others need
// repair, not a re-check), then those whose `checked` is more than `due` days before today (UTC dates), sorts them
// oldest first (a missing date counts as oldest), and keeps the first `limit`.
export function selectRecords(records, { ids = [], due, limit, today = new Date().toISOString().slice(0, 10) } = {}) {
  const named = ids.length ? records.filter((r) => ids.includes(r.id)) : records;
  if (due == null && limit == null) return named.map((r) => r.id);
  const cutoff = due == null ? null : new Date(Date.parse(today) - due * 86_400_000).toISOString().slice(0, 10);
  const checked = (r) => r.verification.checked ?? "";
  return named
    .filter((r) => r.verification.status === "verified" && r.support.rule !== "none_published")
    .filter((r) => cutoff == null || checked(r) < cutoff)
    .sort((a, b) => (checked(a) < checked(b) ? -1 : checked(a) > checked(b) ? 1 : 0))
    .slice(0, limit ?? Infinity)
    .map((r) => r.id);
}

const quoted = (doc, value) => Object.assign(doc.createNode(value), { type: "QUOTE_DOUBLE" });

// A redirect to another origin or path, such as a homepage, means the cited page has moved, so its text is not checked.
// A trailing slash, query string or fragment does not count.
function samePage(cited, final) {
  const [a, b] = [new URL(cited), new URL(final)];
  return a.origin === b.origin && a.pathname.replace(/\/$/, "") === b.pathname.replace(/\/$/, "");
}

// Updates records in place: verified when every quote matches, stale when a verified record's quote no longer
// matches or the cited page itself is gone (404 or 410). Any other fetch failure leaves the file unchanged. Returns one { id, outcome, reason } per record checked.
export async function verifyDevices(devicesDir, { ids = [], due, limit, get = createFetcher(), today = new Date().toISOString().slice(0, 10) } = {}) {
  const pages = new Map();
  const page = (url) => {
    if (!pages.has(url)) {
      pages.set(url, get(url).then(({ url: finalUrl, contentType, text }) => {
        if (!samePage(url, finalUrl)) throw new Error(`redirected to ${finalUrl}`);
        if (!TEXT_TYPES.has(contentType)) throw new Error(`unsupported content type "${contentType}" at ${url}`);
        return text;
      }, (err) => {
        // An HTTP error from the page redirected to says nothing about the cited page, so it never marks a record stale.
        throw err.url && !samePage(url, err.url) ? new Error(`redirected to ${err.url}, HTTP ${err.status}`) : err;
      }));
    }
    return pages.get(url);
  };

  const files = listYamlFiles(devicesDir).map((file) => ({ file, doc: YAML.parseDocument(readFileSync(file, "utf8")) }));
  const records = files.map(({ doc }) => doc.toJS());
  const chosen = new Set(selectRecords(records, { ids, due, limit, today }));
  const results = [];
  for (const [i, { file, doc }] of files.entries()) {
    const record = records[i];
    const { id } = record;
    if (!chosen.has(id)) continue;
    if (record.support.rule === "none_published" || record.verification.status === "disputed") {
      results.push({ id, outcome: "skipped", reason: record.support.rule === "none_published" ? "none_published" : "disputed" });
      continue;
    }
    const texts = [];
    try {
      for (const item of record.evidence) texts.push(await page(item.url));
    } catch (err) {
      // A removed page means the quote is gone too; anything else may be temporary, so the file is left alone.
      if ((err.status === 404 || err.status === 410) && record.verification.status === "verified") {
        doc.setIn(["verification", "status"], "stale");
        writeFileSync(file, doc.toString(YAML_OUT));
        results.push({ id, outcome: "stale", reason: err.message });
      } else {
        results.push({ id, outcome: "error", reason: err.message });
      }
      continue;
    }
    const result = verifyRecord(record, texts, today);
    if (result.ok) {
      doc.setIn(["verification", "status"], "verified");
      doc.setIn(["verification", "checked"], quoted(doc, today));
      doc.setIn(["verification", "text_sha256"], result.verification.text_sha256);
      writeFileSync(file, doc.toString(YAML_OUT));
      results.push({ id, outcome: "verified" });
    } else if (record.verification.status === "verified") {
      doc.setIn(["verification", "status"], "stale");
      writeFileSync(file, doc.toString(YAML_OUT));
      results.push({ id, outcome: "stale", reason: result.reason });
    } else {
      results.push({ id, outcome: "failed", reason: result.reason });
    }
  }
  for (const id of new Set(ids)) {
    if (!records.some((r) => r.id === id)) results.push({ id, outcome: "error", reason: "no record with this id" });
  }
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let options;
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { due: { type: "string" }, limit: { type: "string" } } });
    // Up to five digits, so a huge --due cannot push the cutoff outside the range of Date.
    const count = (name) => {
      const value = values[name];
      if (value !== undefined && !/^\d{1,5}$/.test(value)) throw new Error(`--${name} takes a whole number up to 99999, not "${value}"`);
      return value === undefined ? undefined : Number(value);
    };
    options = { ids: positionals, due: count("due"), limit: count("limit") };
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
  const results = await verifyDevices(join(ROOT, "data/devices"), options);
  for (const r of results) console.log(`${r.id}: ${r.outcome}${r.reason ? ` (${r.reason})` : ""}`);
  const problems = results.filter((r) => ["failed", "stale", "error"].includes(r.outcome)).length;
  console.log(`${results.length} record(s) checked, ${problems} problem(s)`);
  process.exit(problems ? 1 : 0);
}
