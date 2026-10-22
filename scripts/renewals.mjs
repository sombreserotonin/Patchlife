// Loads ops/renewals.yml, the things Patchlife must renew or replace by a date, for the watchdog to warn about 60 and
// 14 days ahead (docs/MIGRATION.md). The owner edits the file by hand, so its shape is checked strictly: a typo should
// stop the watchdog with a clear message, not silently drop a warning.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIELDS = ["name", "due", "note"];

// A real calendar date written YYYY-MM-DD. Date alone would take 2027-02-30 as 2 March, and "+010000-01" as the year 10000.
function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Returns the list of { name, due, note } items, due being "YYYY-MM-DD" or null and note optional, or throws naming
// the file and the first item that's wrong.
export function loadRenewals(path = join(ROOT, "ops/renewals.yml")) {
  let list;
  try {
    list = YAML.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`${path}: ${err.message}`);
  }
  if (!Array.isArray(list)) throw new Error(`${path}: must be a list of items with name, due and an optional note`);
  for (const [i, item] of list.entries()) {
    const where = `${path}: item ${i + 1}`;
    if (item === null || typeof item !== "object" || Array.isArray(item)) throw new Error(`${where} must have name, due and an optional note`);
    const unknown = Object.keys(item).find((key) => !FIELDS.includes(key));
    if (unknown) throw new Error(`${where} has an unknown field "${unknown}" (use name, due and note)`);
    if (typeof item.name !== "string" || !item.name.trim()) throw new Error(`${where} needs a name`);
    if (item.due !== null && !isDate(item.due)) throw new Error(`${where} (${item.name}): due must be null or a real date written "YYYY-MM-DD", not ${JSON.stringify(item.due) ?? "missing"}`);
    if ("note" in item && typeof item.note !== "string") throw new Error(`${where} (${item.name}): note must be text, or left out`);
  }
  return list;
}
