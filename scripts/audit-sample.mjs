// Picks the records a human spot-checks before merging a data PR (RUNBOOKS A8, once no second session reads the
// source): 3 records or 5% of the PR's records, whichever is larger, at most 10, ranked by a hash of the PR number and
// each id as scripts/watchdog.mjs ranks the weekly spot check, so the same PR always gives the same sample and nobody
// chooses which records get checked. Prints one line per record: id, brand and model, end date (or the rule when
// there is none) and the cited page with the quote highlighted (a text fragment link). With no ids it takes the
// records changed under data/devices/ against origin/main, so run it on the PR's branch with origin fetched. Reads
// only local files. Exits 2 on bad arguments.
// Usage: node scripts/audit-sample.mjs <pr number> [id ...]
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { listYamlFiles } from "./validate-data.mjs";
import { highlightLink } from "./watchdog.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEVICE = /^data\/devices\/[^/]+\/([^/]+)\.yaml$/;
const USAGE = "Usage: node scripts/audit-sample.mjs <pr number> [id ...]";

// 3 or 5% of count, whichever is larger, at most 10 and never more than count.
export function sampleSize(count) {
  return Math.min(count, 10, Math.max(3, Math.ceil(count / 20)));
}

// The sample: the distinct ids ranked by sha256("<seed>\n<id>"), the first sampleSize of them.
export function pickIds(ids, seed) {
  const rank = (id) => createHash("sha256").update(`${seed}\n${id}`).digest("hex");
  const distinct = [...new Set(ids)];
  return distinct
    .map((id) => ({ id, key: rank(id) }))
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .slice(0, sampleSize(distinct.length))
    .map(({ id }) => id);
}

// The record ids among changed paths of the form data/devices/<brand>/<id>.yaml.
export function changedIds(paths) {
  return paths.flatMap((path) => path.match(DEVICE)?.[1] ?? []);
}

// One tab-separated line per id: id, brand and model, end date or rule, and the first quoted item's page with its
// quote highlighted (the first item's plain URL when no item has a quote). An id with no file, such as a record the
// PR removes, says so.
export function sampleLines(devicesDir, ids) {
  const files = new Map(listYamlFiles(devicesDir).map((file) => [basename(file, ".yaml"), file]));
  return ids.map((id) => {
    if (!files.has(id)) return `${id}\tno record with this id`;
    const record = YAML.parse(readFileSync(files.get(id), "utf8"));
    const quoted = record.evidence.find((item) => item.quote);
    const link = quoted ? highlightLink(quoted.url, quoted.quote) : record.evidence[0].url;
    return `${id}\t${record.brand} ${record.model}\t${record.support.end_date ?? record.support.rule}\t${link}`;
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [pr, ...named] = process.argv.slice(2);
  if (!/^\d+$/.test(pr ?? "")) {
    console.error(`Give the PR number first.\n${USAGE}`);
    process.exit(2);
  }
  let ids = named;
  if (!ids.length) {
    try {
      ids = changedIds(execFileSync("git", ["diff", "--name-only", "origin/main", "--", "data/devices"], { cwd: ROOT, encoding: "utf8" }).split("\n"));
    } catch (err) {
      console.error(`Could not list the records changed against origin/main: ${err.message}`);
      process.exit(1);
    }
    if (!ids.length) {
      console.log("No device records changed against origin/main.");
      process.exit(0);
    }
  }
  const sample = pickIds(ids, pr);
  console.log(`Sample for PR #${pr}: ${sample.length} of ${new Set(ids).size} record(s)`);
  for (const line of sampleLines(join(ROOT, "data/devices"), sample)) console.log(line);
}
