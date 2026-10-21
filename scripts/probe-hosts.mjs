// Checks robots.txt and the first cited page on each evidence host with the polite fetcher, to learn which hosts
// block GitHub's runners before the nightly re-verify moves to Actions (docs/COSTS.md stage 1). It is a report, so it
// exits 0 even when hosts fail. Prints one line per host: host, robots.txt result, HTTP status or error.
// Usage: node --use-env-proxy scripts/probe-hosts.mjs [devicesDir]
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { createFetcher } from "./polite-fetch.mjs";
import { listYamlFiles } from "./validate-data.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// host -> the first evidence URL on that host, in record order.
export function firstUrls(records) {
  const urls = new Map();
  for (const record of records) {
    for (const { url } of record.evidence) {
      const { host } = new URL(url);
      if (!urls.has(host)) urls.set(host, url);
    }
  }
  return urls;
}

// The fetcher checks this URL's robots.txt before anything else, so only an error naming this URL or its origin is
// this host's robots result; a robots.txt error after a redirect to another host is reported as an error.
export async function probe(url, get) {
  const redirected = (finalUrl) => (finalUrl !== url ? ` (redirected to ${finalUrl})` : "");
  try {
    const page = await get(url);
    return { robots: "allows", result: `HTTP 200${redirected(page.url)}` };
  } catch (err) {
    if (err.message === `robots.txt disallows ${url}`) return { robots: "disallows", result: "not fetched" };
    const unreachable = err.message.match(/^robots\.txt unreachable \((.*)\) for (\S+)$/);
    if (unreachable && unreachable[2] === new URL(url).origin) return { robots: `unreachable (${unreachable[1]})`, result: "not fetched" };
    if (err.status) return { robots: "allows", result: `HTTP ${err.status}${redirected(err.url)}` };
    return { robots: "allows", result: `error (${err.cause?.message || err.message})` };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = resolve(process.argv[2] ?? join(ROOT, "data/devices"));
  const records = listYamlFiles(dir).map((file) => YAML.parse(readFileSync(file, "utf8")));
  const get = createFetcher();
  for (const [host, url] of firstUrls(records)) {
    const { robots, result } = await probe(url, get);
    console.log(`${host}\trobots.txt ${robots}\t${result}`);
  }
}
