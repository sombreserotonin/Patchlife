// Moves every evidence item citing one page to its new URL, keeping each item's quote, then re-verifies the records
// it touched with the verifier's own verifyDevices: RUNBOOKS A4 for a whole page at once, so a moved source is one PR
// (docs/MIGRATION.md B5). A capture of the old page is not a capture of the new one, so each moved item's archive_url
// is cleared for the nightly run to capture again (D43); the verification block is left to the verifier, which marks
// a verified record stale when its quote is not on the new page. --dry-run lists the records that cite the old URL
// and changes nothing. The re-verification reads the new page with the polite fetcher, so it needs the Crawl network
// or a runner. Exits 1 when no record cites the old URL or a moved record did not verify, listing them; 2 on bad
// arguments.
// Usage: node --use-env-proxy scripts/repoint-source.mjs <old url> <new url> [--dry-run]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import YAML from "yaml";
import { listYamlFiles } from "./validate-data.mjs";
import { pageReport, verifyDevices, YAML_OUT } from "./verify-evidence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const USAGE = "Usage: node --use-env-proxy scripts/repoint-source.mjs <old url> <new url> [--dry-run]";

// Returns { moved, results, pages }: one { id, file, items } per record citing oldUrl, where items are the indexes of
// the evidence items moved, then the verifier's results and page report for those records (verifyDevices takes get,
// today and hashFile). With dryRun, nothing is written or fetched and results and pages are empty.
export async function repointSource(devicesDir, oldUrl, newUrl, { dryRun = false, get, today, hashFile } = {}) {
  const moved = [];
  for (const file of listYamlFiles(devicesDir)) {
    const doc = YAML.parseDocument(readFileSync(file, "utf8"));
    const record = doc.toJS();
    const items = record.evidence.flatMap((item, i) => (item.url === oldUrl ? [i] : []));
    if (!items.length) continue;
    moved.push({ id: record.id, file, items });
    if (dryRun) continue;
    for (const i of items) {
      doc.setIn(["evidence", i, "url"], newUrl);
      if (doc.hasIn(["evidence", i, "archive_url"])) doc.setIn(["evidence", i, "archive_url"], null);
    }
    writeFileSync(file, doc.toString(YAML_OUT));
  }
  if (dryRun || !moved.length) return { moved, results: [], pages: [] };
  return { moved, ...(await verifyDevices(devicesDir, { ids: moved.map((m) => m.id), get, today, hashFile })) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let oldUrl;
  let newUrl;
  let dryRun;
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { "dry-run": { type: "boolean" } } });
    if (positionals.length !== 2) throw new Error("Give the old URL and the new URL.");
    [oldUrl, newUrl] = positionals;
    if (!/^https:\/\//.test(newUrl)) throw new Error("The new URL must start with https://, as the schema requires.");
    if (oldUrl === newUrl) throw new Error("The old and new URLs are the same.");
    dryRun = Boolean(values["dry-run"]);
  } catch (err) {
    console.error(`${err.message}\n${USAGE}`);
    process.exit(2);
  }
  const { moved, results, pages } = await repointSource(join(ROOT, "data/devices"), oldUrl, newUrl, { dryRun, hashFile: join(ROOT, "data/sources/page-hashes.json") });
  if (!moved.length) {
    console.log(`No evidence item cites ${oldUrl}`);
    process.exit(1);
  }
  const count = moved.reduce((n, m) => n + m.items.length, 0);
  console.log(`${dryRun ? "Would move" : "Moved"} ${count} item(s) in ${moved.length} record(s) from ${oldUrl} to ${newUrl}`);
  if (dryRun) {
    for (const m of moved) console.log(`${m.id}: ${m.items.length} item(s)`);
    process.exit(0);
  }
  for (const r of results) console.log(`${r.id}: ${r.outcome}${r.reason ? ` (${r.reason})` : ""}`);
  for (const line of pageReport(pages)) console.log(line);
  const failed = results.filter((r) => ["failed", "stale", "error"].includes(r.outcome)).map((r) => r.id);
  console.log(`${results.length} record(s) checked, ${failed.length} problem(s)`);
  if (failed.length) console.log(`Did not verify: ${failed.join(" ")}`);
  process.exit(failed.length ? 1 : 0);
}
