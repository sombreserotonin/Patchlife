// Fills evidence items' archive_url with a Wayback Machine capture of the cited page (SPEC 3, D29, D43). For each
// cited page with a quoted item that has no link, it asks Save Page Now for a capture, reads the capture's raw copy
// and links every such item whose quote the copy holds. An item whose quote isn't there keeps null and is tried again
// next run. It is best effort, so it exits 0 whatever the archive answers. It runs on GitHub's runners, which reach
// archive.org; the Crawl network doesn't. A runner's anonymous save took 48 seconds on 22 Oct 2026.
// Usage: node scripts/archive-evidence.mjs [--limit <n>] [url ...]   (no urls: every page with an unlinked item)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import YAML from "yaml";
import { createFetcher } from "./polite-fetch.mjs";
import { listYamlFiles, normalise } from "./validate-data.mjs";
import { pageText, YAML_OUT } from "./verify-evidence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WAYBACK = "https://web.archive.org";

// Returns one { url, archiveUrl, linked, missing } per page archived, or { url, error } when the save or the capture
// failed, in which case no file changes for that page.
export async function archiveEvidence(devicesDir, { urls = [], limit = Infinity, get = createFetcher({ timeoutMs: 120_000 }) } = {}) {
  const files = listYamlFiles(devicesDir).map((file) => ({ file, doc: YAML.parseDocument(readFileSync(file, "utf8")) }));
  // url -> the quoted items citing it that have no link yet.
  const unlinked = new Map();
  for (const [f, { doc }] of files.entries()) {
    for (const [i, item] of doc.toJS().evidence.entries()) {
      if (item.archive_url || !normalise(item.quote ?? "")) continue;
      unlinked.set(item.url, [...(unlinked.get(item.url) ?? []), { f, i, quote: normalise(item.quote) }]);
    }
  }
  const results = [];
  const changed = new Set();
  for (const url of (urls.length ? urls.filter((u) => unlinked.has(u)) : [...unlinked.keys()].sort()).slice(0, limit)) {
    try {
      // Save Page Now redirects to the new capture; a capture that is itself a redirect ends somewhere else.
      const saved = await get(`${WAYBACK}/save/${url}`);
      const timestamp = saved.url.match(/^https:\/\/web\.archive\.org\/web\/(\d{14})\//)?.[1];
      const archiveUrl = `${WAYBACK}/web/${timestamp}/${url}`;
      if (!timestamp || saved.url !== archiveUrl) throw new Error(`Save Page Now ended at ${saved.url}, not a capture of this page`);
      // The id_ form serves the page as captured, without the archive's banner or rewritten links.
      const raw = `${WAYBACK}/web/${timestamp}id_/${url}`;
      const capture = await get(raw);
      if (capture.url !== raw) throw new Error(`the capture redirects to ${capture.url}`);
      const text = normalise(await pageText({ ...capture, url }));
      const items = unlinked.get(url);
      const held = items.filter(({ quote }) => text.includes(quote));
      for (const { f, i } of held) {
        files[f].doc.setIn(["evidence", i, "archive_url"], archiveUrl);
        changed.add(f);
      }
      results.push({ url, archiveUrl, linked: held.length, missing: items.length - held.length });
    } catch (err) {
      results.push({ url, error: err.message });
    }
  }
  for (const f of changed) writeFileSync(files[f].file, files[f].doc.toString(YAML_OUT));
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let options;
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { limit: { type: "string" } } });
    if (values.limit !== undefined && !/^\d{1,5}$/.test(values.limit)) throw new Error(`--limit takes a whole number up to 99999, not "${values.limit}"`);
    options = { urls: positionals, limit: values.limit === undefined ? undefined : Number(values.limit) };
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
  const results = await archiveEvidence(join(ROOT, "data/devices"), options);
  for (const r of results) {
    if (r.error) console.log(`${r.url}: error (${r.error})`);
    else console.log(`${r.url}: ${r.archiveUrl}, ${r.linked} item(s) linked${r.missing ? `, ${r.missing} quote(s) not in the capture` : ""}`);
  }
  console.log(`${results.length} page(s) tried, ${results.filter((r) => r.error).length} error(s)`);
}
