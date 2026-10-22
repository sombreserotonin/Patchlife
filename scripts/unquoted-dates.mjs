// Lists the dates on cited pages that no record's quote covers (docs/COSTS.md stage 2). Every recorded row's quote is
// on its page, so a date outside every quote is a row we don't have yet, or prose such as an intro date. Revisiting a
// source starts here: no unquoted dates means nothing new to add. Reads pages with the polite fetcher; stores nothing.
// It is a report, so it exits 0 even when a page fails.
// Usage: node --use-env-proxy scripts/unquoted-dates.mjs [url ...]   (no urls: every cited page)
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { createFetcher } from "./polite-fetch.mjs";
import { listYamlFiles } from "./validate-data.mjs";
import { normalise, pageText, samePage } from "./verify-evidence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MONTH =
  "(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\\.?";
// Day month year, month day year, year-first and numeric dates, then month and year alone (D38), on normalised text.
const DATES = [
  `\\d{1,2}(?:st|nd|rd|th)? (?:of )?${MONTH},? \\d{4}`,
  `${MONTH} \\d{1,2}(?:st|nd|rd|th)?,? \\d{4}`,
  "\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}",
  "\\d{1,2}[/.]\\d{1,2}[/.]\\d{4}",
  `${MONTH},? \\d{4}`,
];
const DATE = new RegExp(`(?<![0-9a-z])(?:${DATES.join("|")})(?![0-9a-z])`, "g");

// The dates in this normalised text that fall outside every span where one of the quotes occurs, each with the text
// before it, so a reader can see the row.
export function unquotedIn(text, quotes) {
  const covered = [];
  for (const quote of quotes.map(normalise).filter(Boolean)) {
    for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) covered.push([at, at + quote.length]);
  }
  return [...text.matchAll(DATE)]
    .filter((m) => !covered.some(([from, to]) => m.index >= from && m.index + m[0].length <= to))
    .map((m) => ({ date: m[0], context: text.slice(Math.max(0, m.index - 80), m.index + m[0].length + 20).trim() }));
}

// For each url (default: every cited page), the dates no record's quote covers, or the error that stopped the read.
export async function unquotedDates(devicesDir, { urls = [], get = createFetcher() } = {}) {
  const quotes = new Map();
  for (const file of listYamlFiles(devicesDir)) {
    for (const { url, quote } of YAML.parse(readFileSync(file, "utf8")).evidence) {
      quotes.set(url, [...(quotes.get(url) ?? []), ...(quote ? [quote] : [])]);
    }
  }
  const results = [];
  for (const url of urls.length ? urls : [...quotes.keys()].sort()) {
    try {
      const page = await get(url);
      if (!samePage(url, page.url)) throw new Error(`redirected to ${page.url}`);
      results.push({ url, dates: unquotedIn(normalise(await pageText({ ...page, url })), quotes.get(url) ?? []) });
    } catch (err) {
      results.push({ url, error: err.message });
    }
  }
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const { url, dates, error } of await unquotedDates(join(ROOT, "data/devices"), { urls: process.argv.slice(2) })) {
    if (error) {
      console.log(`${url}: error (${error})`);
      continue;
    }
    console.log(`${url}: ${dates.length} unquoted date(s)`);
    for (const { context } of dates) console.log(`  ${context}`);
  }
}
