// Reads the rows of the tables in an HTML page cell by cell (MIGRATION decision 4). The verifier's htmlToText turns
// every tag into a space, so run on a whole page it loses the cell boundaries, and a footnote in <sup> fuses with the
// text before it ("Tapo C200<sup>1</sup>" reads "Tapo C2001"). So <tr> and <td>/<th> are split on the raw HTML, each
// <sup> becomes a marker kept beside the cell, and htmlToText runs on what is left of each cell. A row's quote is its
// cell texts joined by single spaces, as docs/DATA-POLICY.md says table-row quotes are written, and rowQuoteProblems
// lists the rows whose quote the verifier would not find in the page text, such as rows with a <sup> marker.
import { htmlToText, pageText, quoteMatches } from "./verify-evidence.mjs";

const collapse = (text) => text.replace(/\s+/g, " ").trim();

// The elements named in `names`, as /<(names)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi finds them: left to right, never
// overlapping, the opening tag running to the first ">" and the element to the first closing tag of its own name. The
// expression rescans the rest of the page from every opening tag that is never closed, so a hostile page of them took
// minutes (audit 2026-11-14, record-writers L4); here a name whose closing tag is missing is searched for once, and
// every later opening tag of that name is skipped at once, so the time is linear in the length of the page.
// Yields { start, end, attrs, inner }: the element's span, its opening tag's attributes and the text between.
function* elements(html, names) {
  const open = new RegExp(`<(${names.join("|")})\\b`, "gi");
  // Built from the names given, never from the page: a closing tag is looked up by the name the opening tag matched.
  const closing = new Map(names.map((name) => [name, new RegExp(`</${name}\\s*>`, "gi")]));
  const unclosedFrom = new Map();
  let gt = -1;
  for (let match; (match = open.exec(html)); ) {
    const name = match[1].toLowerCase();
    const attrsAt = match.index + match[0].length;
    if (gt < attrsAt) gt = html.indexOf(">", attrsAt);
    if (gt === -1) return;
    const innerAt = gt + 1;
    const close = closing.get(name);
    close.lastIndex = innerAt;
    const end = innerAt >= (unclosedFrom.get(name) ?? Infinity) ? null : close.exec(html);
    if (!end) {
      unclosedFrom.set(name, Math.min(innerAt, unclosedFrom.get(name) ?? Infinity));
      open.lastIndex = match.index + 1;
      continue;
    }
    yield { start: match.index, end: end.index + end[0].length, attrs: html.slice(attrsAt, gt), inner: html.slice(innerAt, end.index) };
    open.lastIndex = end.index + end[0].length;
  }
}

// One cell: its text with whitespace collapsed, its <sup> contents in order, how many columns it spans, and its raw
// inner HTML for a parser that needs the markup inside the cell (ASUS lists one model per <p>).
export function readCell(attrs, inner) {
  const markers = [];
  let rest = "";
  let at = 0;
  for (const sup of elements(inner, ["sup"])) {
    const marker = collapse(htmlToText(sup.inner));
    if (marker) markers.push(marker);
    rest += `${inner.slice(at, sup.start)} `;
    at = sup.end;
  }
  rest += inner.slice(at);
  const span = Number(attrs.match(/\bcolspan\s*=\s*["']?(\d+)/i)?.[1] ?? 1);
  return { text: collapse(htmlToText(rest)), markers, span: span > 0 ? span : 1, html: inner };
}

// Every <tr> in the page, in document order: { cells, quote }, where quote joins the non-empty cell texts with single
// spaces. Nested tables are not expected on the cited pages; a cell holding one reads as a single cell.
export function tableRows(html) {
  const rows = [];
  for (const row of elements(html, ["tr"])) {
    const cells = [...elements(row.inner, ["td", "th"])].map((cell) => readCell(cell.attrs, cell.inner));
    rows.push({ cells, quote: cells.map((c) => c.text).filter(Boolean).join(" ") });
  }
  return rows;
}

// The rows whose quote the verifier would not find in the page's own text: a cell with a <sup> marker reads fused in
// the page text, so no quote made of its cells can be verified. candidates.mjs refuses a candidate made from such a
// row as unquotable, whether it is a new row or would replace a record.
export async function rowQuoteProblems(rows, html, url = "page") {
  const text = await pageText({ url, contentType: "text/html", text: html });
  return rows.filter((row) => row.quote && !quoteMatches(row.quote, text)).map((row) => ({ quote: row.quote, reason: "quote not found in the page text" }));
}
