// Checks that each evidence quote appears in the saved source text (SPEC 3). Pure functions only: fetching,
// PDF extraction, archive snapshots and the CLI come with the networked verifier. Stores hashes, never pages.
import { createHash } from "node:crypto";

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
