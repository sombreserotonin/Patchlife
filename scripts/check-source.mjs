// The RUNBOOKS A2 step 2 triage of a source page in one command: whether robots.txt lets PatchlifeBot read it, the
// HTTP status and content type, whether any date is in the raw response (even inside scripts), how many dates the
// page text holds (the text the verifier matches quotes against, with dates found as unquoted-dates.mjs finds them)
// and up to 5 rows around dates, spread over the page. Dates in the raw response but not in the page text sit inside
// scripts, so JavaScript adds them and the verifier never sees them. Exits 0 when the page can be used as evidence
// and 1 when it can't (robots.txt disallows or is unreachable, a status other than 200, a bot challenge, a redirect
// to another page, dates only inside scripts, or content the verifier can't read), with one line saying why; 2 on
// bad arguments. Reads with the polite fetcher, so it needs the Crawl network or a runner.
// Usage: node --use-env-proxy scripts/check-source.mjs <url>
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createFetcher } from "./polite-fetch.mjs";
import { unquotedIn } from "./unquoted-dates.mjs";
import { normalise, pageText, samePage } from "./verify-evidence.mjs";

const SAMPLES = 5;
const USAGE = "Usage: node --use-env-proxy scripts/check-source.mjs <url>";
// What a bot challenge page says, on normalised text: a 200 holding one of these is a wall, not the page (D18).
const CHALLENGE = /just a moment|checking your browser|verify(?:ing)? (?:that )?you are (?:a )?human|attention required|enable javascript and cookies to continue|pardon our interruption|complete the security check/;

// Up to n items spread evenly over the list, so a table shows its start, middle and end.
function spread(list, n) {
  const count = Math.min(n, list.length);
  return Array.from({ length: count }, (_, i) => list[Math.floor((i * list.length) / count)]);
}

// Reads the page with get. robots is "allows", "disallows" or "unreachable (<why>)"; status is "HTTP <code>[, <type>]",
// "not fetched" or "error (<why>)"; final is the URL the page redirected to, when it did; read says the text was read;
// rawDates is null for a PDF, which has no raw text; reason says why the page can't be used.
export async function checkSource(url, get) {
  const result = { url, robots: "allows", status: "not fetched", read: false, rawDates: null, textDates: 0, samples: [], usable: false, reason: "" };
  let page;
  try {
    page = await get(url);
  } catch (err) {
    const disallowed = err.message.match(/^robots\.txt disallows (\S+)$/);
    const unreachable = err.message.match(/^robots\.txt unreachable \((.*)\) for \S+$/);
    if (disallowed) result.robots = "disallows";
    else if (unreachable) result.robots = `unreachable (${unreachable[1]})`;
    else if (err.status) result.status = `HTTP ${err.status}`;
    else result.status = `error (${err.cause?.message || err.message})`;
    const final = disallowed ? disallowed[1] : err.url;
    if (final && final !== url) result.final = final;
    // Only a 200 is the page: a web application firewall answers a challenge with another 2xx, such as 202.
    const note = err.status === 403 ? " (bot wall)" : err.status >= 200 && err.status < 300 ? " (not the page: a bot challenge answers this way)" : "";
    result.reason = `${err.cause?.message || err.message}${note}`;
    return result;
  }
  result.status = `HTTP 200, ${page.contentType}`;
  if (page.url !== url) result.final = page.url;
  let text;
  try {
    text = normalise(await pageText({ ...page, url }));
  } catch (err) {
    result.reason = err.message;
    return result;
  }
  result.read = true;
  const dates = unquotedIn(text, []);
  result.textDates = dates.length;
  result.rawDates = page.text == null ? null : dates.length > 0 || unquotedIn(normalise(page.text), []).length > 0;
  result.samples = spread(dates, SAMPLES).map((d) => d.context);
  const challenge = text.match(CHALLENGE);
  if (challenge) result.reason = `bot challenge (the page says "${challenge[0]}")`;
  else if (!samePage(url, page.url)) result.reason = `redirected to ${page.url}, so cite that URL instead`;
  else if (result.rawDates && !dates.length) result.reason = "the dates are only inside scripts, so JavaScript adds them and the verifier can't see them";
  else result.usable = true;
  return result;
}

// The report lines, ending with the verdict.
export function report(result) {
  const lines = [`robots.txt: ${result.robots}`, `status: ${result.status}`];
  if (result.final) lines.push(`final URL: ${result.final}`);
  if (result.read) {
    lines.push(`dates in the raw response: ${result.rawDates === null ? "n/a (PDF)" : result.rawDates ? "yes" : "no"}`);
    lines.push(`dates in the page text: ${result.textDates}`);
    for (const row of result.samples) lines.push(`  ${row}`);
  }
  lines.push(result.usable ? "usable: yes" : `not usable: ${result.reason}`);
  return lines;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.argv[2];
  if (process.argv.length !== 3 || !/^https?:\/\//.test(url)) {
    console.error(`Give one http(s) URL.\n${USAGE}`);
    process.exit(2);
  }
  const result = await checkSource(url, createFetcher());
  for (const line of report(result)) console.log(line);
  process.exit(result.usable ? 0 : 1);
}
