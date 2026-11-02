// Reads the rows of the tables in an HTML page cell by cell (MIGRATION decision 4). The verifier's htmlToText turns
// every tag into a space, so run on a whole page it loses the cell boundaries, and a footnote in <sup> fuses with the
// text before it ("Tapo C200<sup>1</sup>" reads "Tapo C2001"). So <tr> and <td>/<th> are split on the raw HTML, each
// <sup> becomes a marker kept beside the cell, and htmlToText runs on what is left of each cell. A row's quote is its
// cell texts joined by single spaces, as docs/DATA-POLICY.md says table-row quotes are written, and rowQuoteProblems
// lists the rows whose quote the verifier would not find in the page text, such as rows with a <sup> marker.
import { htmlToText, pageText, quoteMatches } from "./verify-evidence.mjs";

const ROW = /<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi;
const CELL = /<t([dh])\b([^>]*)>([\s\S]*?)<\/t\1\s*>/gi;
const SUP = /<sup\b[^>]*>([\s\S]*?)<\/sup\s*>/gi;

const collapse = (text) => text.replace(/\s+/g, " ").trim();

// One cell: its text with whitespace collapsed, its <sup> contents in order, how many columns it spans, and its raw
// inner HTML for a parser that needs the markup inside the cell (ASUS lists one model per <p>).
export function readCell(attrs, inner) {
  const markers = [];
  const rest = inner.replace(SUP, (match, sup) => {
    const marker = collapse(htmlToText(sup));
    if (marker) markers.push(marker);
    return " ";
  });
  const span = Number(attrs.match(/\bcolspan\s*=\s*["']?(\d+)/i)?.[1] ?? 1);
  return { text: collapse(htmlToText(rest)), markers, span: span > 0 ? span : 1, html: inner };
}

// Every <tr> in the page, in document order: { cells, quote }, where quote joins the non-empty cell texts with single
// spaces. Nested tables are not expected on the cited pages; a cell holding one reads as a single cell.
export function tableRows(html) {
  const rows = [];
  for (const [, inner] of html.matchAll(ROW)) {
    const cells = [...inner.matchAll(CELL)].map(([, , attrs, body]) => readCell(attrs, body));
    rows.push({ cells, quote: cells.map((c) => c.text).filter(Boolean).join(" ") });
  }
  return rows;
}

// The rows whose quote the verifier would not find in the page's own text: a cell with a <sup> marker reads fused in
// the page text, so no quote made of its cells can be verified. Such a row is reported, never recorded.
export async function rowQuoteProblems(rows, html, url = "page") {
  const text = await pageText({ url, contentType: "text/html", text: html });
  return rows.filter((row) => row.quote && !quoteMatches(row.quote, text)).map((row) => ({ quote: row.quote, reason: "quote not found in the page text" }));
}
