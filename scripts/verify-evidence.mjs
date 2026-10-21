// Checks that each evidence quote appears in the source page (SPEC 3) and records the result in the YAML.
// Stores hashes, never pages. PDF extraction and archive snapshots are not built yet.
// Usage: node --use-env-proxy scripts/verify-evidence.mjs [id ...]
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { createFetcher } from "./polite-fetch.mjs";
import { listYamlFiles } from "./validate-data.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEXT_TYPES = new Set(["text/html", "application/xhtml+xml", "text/plain"]);
// Keeps untouched lines byte-identical, such as `regions: [UK]` and long notes.
const YAML_OUT = { flowCollectionPadding: false, lineWidth: 0 };

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—" };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

// Block and cell boundaries become spaces so table cells are joined by single spaces after normalising.
export function htmlToText(html) {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ");
  return decodeEntities(stripped);
}

export function normalise(text) {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

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

const quoted = (doc, value) => Object.assign(doc.createNode(value), { type: "QUOTE_DOUBLE" });

// Updates records in place: verified when every quote matches, stale when a verified record's quote no longer
// matches. A fetch failure leaves the file unchanged. Returns one { id, outcome, reason } per record checked.
export async function verifyDevices(devicesDir, { ids = [], get = createFetcher(), today = new Date().toISOString().slice(0, 10) } = {}) {
  const pages = new Map();
  const page = (url) => {
    if (!pages.has(url)) {
      pages.set(url, get(url).then(({ contentType, text }) => {
        if (!TEXT_TYPES.has(contentType)) throw new Error(`unsupported content type "${contentType}" at ${url}`);
        return text;
      }));
    }
    return pages.get(url);
  };

  const results = [];
  for (const file of listYamlFiles(devicesDir)) {
    const doc = YAML.parseDocument(readFileSync(file, "utf8"));
    const record = doc.toJS();
    const { id } = record;
    if (ids.length && !ids.includes(id)) continue;
    if (record.support.rule === "none_published" || record.verification.status === "disputed") {
      results.push({ id, outcome: "skipped", reason: record.support.rule === "none_published" ? "none_published" : "disputed" });
      continue;
    }
    const texts = [];
    try {
      for (const item of record.evidence) texts.push(await page(item.url));
    } catch (err) {
      results.push({ id, outcome: "error", reason: err.message });
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
  for (const id of ids) {
    if (!results.some((r) => r.id === id)) results.push({ id, outcome: "error", reason: "no record with this id" });
  }
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results = await verifyDevices(join(ROOT, "data/devices"), { ids: process.argv.slice(2) });
  for (const r of results) console.log(`${r.id}: ${r.outcome}${r.reason ? ` (${r.reason})` : ""}`);
  const problems = results.filter((r) => ["failed", "stale", "error"].includes(r.outcome)).length;
  console.log(`${results.length} record(s) checked, ${problems} problem(s)`);
  process.exit(problems ? 1 : 0);
}
