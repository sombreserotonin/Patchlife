// Prints a page as the verifier sees it (RUNBOOKS A2 step 3): the final URL and content type on the first line, then
// the page text from verify-evidence.mjs with whitespace collapsed and folded at spaces to 300 characters, as
// `fold -s -w 300` folds it, so quotes are copied from this output and never from a browser or a connector (D17).
// With --grep, only the folded lines holding the text (in any case) are printed, numbered as `grep -n` numbers the
// full output, where the URL line is line 1. Reads with the polite fetcher, so it needs the Crawl network or a runner.
// Exits 1 when the page can't be read or --grep matches nothing, 2 on bad arguments.
// Usage: node --use-env-proxy scripts/page-text.mjs [--grep <text>] <url>
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createFetcher } from "./polite-fetch.mjs";
import { pageText } from "./verify-evidence.mjs";

const WIDTH = 300;
const USAGE = "Usage: node --use-env-proxy scripts/page-text.mjs [--grep <text>] <url>";

// Folds each line at the last space within the width, keeping that space at the end of the line as `fold -s` does, so
// the lines join back into the text; a run with no space breaks at the width.
export function fold(text, width = WIDTH) {
  const lines = [];
  for (let line of text.split("\n")) {
    while (line.length > width) {
      const space = line.lastIndexOf(" ", width - 1);
      const at = space > 0 ? space + 1 : width;
      lines.push(line.slice(0, at));
      line = line.slice(at);
    }
    lines.push(line);
  }
  return lines;
}

// The output for a fetched page: its final URL and content type, then the folded text.
export async function pageLines(page, width = WIDTH) {
  const text = (await pageText(page)).replace(/\s+/g, " ").trim();
  return [`${page.url} (${page.contentType})`, ...fold(text, width)];
}

// The lines holding the text in any case, each as "<number>:<line>", numbered from `first`.
export function grepLines(lines, text, first = 1) {
  const wanted = text.toLowerCase();
  return lines.flatMap((line, i) => (line.toLowerCase().includes(wanted) ? [`${i + first}:${line}`] : []));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let url;
  let grep;
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { grep: { type: "string" } } });
    if (positionals.length !== 1 || !/^https?:\/\//.test(positionals[0])) throw new Error("Give one http(s) URL.");
    if (values.grep === "") throw new Error("--grep needs some text.");
    [url, grep] = [positionals[0], values.grep];
  } catch (err) {
    console.error(`${err.message}\n${USAGE}`);
    process.exit(2);
  }
  let lines;
  try {
    lines = await pageLines(await createFetcher()(url));
  } catch (err) {
    console.error(`${url}: error (${err.cause?.message || err.message})`);
    process.exit(1);
  }
  const out = grep === undefined ? lines : [lines[0], ...grepLines(lines.slice(1), grep, 2)];
  // A page can be hundreds of kilobytes, and process.exit could cut a write to a pipe short, so the process ends on its own.
  process.stdout.write(`${out.join("\n")}\n`);
  process.exitCode = grep !== undefined && out.length === 1 ? 1 : 0;
}
