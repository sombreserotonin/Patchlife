// Counts device records by brand, category, status and verification state, for the Measures table in docs/PLAN.md.
// Usage: node scripts/data-report.mjs [devicesDir]
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { computeStatus } from "./status.mjs";
import { listYamlFiles } from "./validate-data.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Keys listed in `keys` always appear, in that order, even with a count of zero.
function tally(values, keys = []) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

export function buildReport(records, today) {
  const verified = records.filter((r) => r.verification.status === "verified");
  return {
    records: records.length,
    brands: tally(records.map((r) => r.brand_slug).sort()),
    categories: tally(records.map((r) => r.category).sort()),
    status: tally(records.map((r) => computeStatus(r, today)), ["supported", "ending_soon", "ended", "unknown"]),
    verification: tally(records.map((r) => r.verification.status), ["verified", "unverified", "stale", "disputed"]),
    brandsVerified: new Set(verified.map((r) => r.brand_slug)).size,
    oldestChecked: records.map((r) => r.verification.checked).filter(Boolean).sort()[0] ?? null,
  };
}

function printRows(rows, indent = "") {
  const width = Math.max(...rows.map(([key]) => key.length));
  for (const [key, value] of rows) console.log(`${indent}${key.padEnd(width)}  ${value}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const today = new Date().toISOString().slice(0, 10);
  const files = listYamlFiles(resolve(process.argv[2] ?? join(ROOT, "data/devices")));
  const report = buildReport(files.map((file) => YAML.parse(readFileSync(file, "utf8"))), today);
  const computable = report.records - report.status.unknown;
  // Rounded down, so 100% means every record.
  const share = report.records ? Math.floor((100 * computable) / report.records) : 0;
  printRows([
    ["Records", report.records],
    ["Brands with verified records", report.brandsVerified],
    ["Computable status", `${computable} of ${report.records} (${share}%)`],
    ["Oldest checked", report.oldestChecked ?? "none"],
  ]);
  const sections = { Brand: report.brands, Category: report.categories, [`Status on ${today}`]: report.status, Verification: report.verification };
  for (const [title, counts] of Object.entries(sections)) {
    console.log(`\n${title}`);
    printRows(Object.entries(counts), "  ");
  }
}
