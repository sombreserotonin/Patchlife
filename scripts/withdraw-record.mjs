// Pulls a wrong date now, without a session (RUNBOOKS O8; docs/MIGRATION.md P3's withdraw action). The record becomes
// none_published with no quotes and an unverified verification block, and its notes start with "Withdrawn pending
// review (<date>): <reason>.", so the site shows no date for it until a proper fix with new evidence (A3). Nothing is
// fetched. The record keeps its aliases, regions and the pages it cited, once each, as the pages checked (DATA-POLICY,
// "Reviewing a record" rule 7); the archive links go with the quotes, since a capture holds the withdrawn row. The
// record is validated afterwards with the source registry. Exits 1 when no record has the id, it is already
// none_published or the result does not validate; 2 on bad arguments.
// Usage: node scripts/withdraw-record.mjs <id> <reason>
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { listYamlFiles, validateDevices, validateSources } from "./validate-data.mjs";
import { YAML_OUT } from "./verify-evidence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const USAGE = "Usage: node scripts/withdraw-record.mjs <id> <reason>";
const NOTES_MAX = 500;

// The withdrawal sentence, then the old notes when both fit the schema's limit; otherwise the sentence alone. A reason
// the sentence itself can't hold is refused.
export function withdrawnNotes(oldNotes, today, reason) {
  const sentence = `Withdrawn pending review (${today}): ${reason.trim().replace(/\.$/, "")}.`;
  if (sentence.length > NOTES_MAX) throw new Error(`The reason is too long: notes hold ${NOTES_MAX} characters, and the withdrawal sentence has ${sentence.length}`);
  const both = oldNotes ? `${sentence} ${oldNotes}` : sentence;
  return both.length <= NOTES_MAX ? both : sentence;
}

// Rewrites the record file in place and returns { file, droppedNotes }, or throws with the reason.
export function withdrawRecord(devicesDir, id, reason, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const file = listYamlFiles(devicesDir).find((path) => basename(path) === `${id}.yaml`);
  if (!file) throw new Error(`No record has the id "${id}"`);
  const doc = YAML.parseDocument(readFileSync(file, "utf8"));
  const record = doc.toJS();
  if (record.support?.rule === "none_published") throw new Error(`${id} is already none_published, so there is no date to withdraw`);
  for (const [key, value] of Object.entries({ rule: "none_published", end_date: null, years: null, anchor_date: null, at_least: false, conditions: null })) {
    doc.setIn(["support", key], value);
  }
  const pages = [];
  for (const item of record.evidence) {
    if (pages.some((page) => page.url === item.url)) continue;
    pages.push({ url: item.url, retrieved: item.retrieved, regime: item.regime });
  }
  doc.set("evidence", pages);
  doc.set("verification", { status: "unverified" });
  const notes = withdrawnNotes(record.notes, today, reason);
  doc.set("notes", notes);
  writeFileSync(file, doc.toString(YAML_OUT));
  return { file, droppedNotes: Boolean(record.notes) && !notes.includes(record.notes) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [id, reason] = process.argv.slice(2);
  if (process.argv.length !== 4 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) || !reason.trim()) {
    console.error(USAGE);
    process.exit(2);
  }
  try {
    withdrawnNotes(null, "2000-01-01", reason);
  } catch (err) {
    console.error(`${err.message}\n${USAGE}`);
    process.exit(2);
  }
  const devicesDir = join(ROOT, "data/devices");
  let result;
  try {
    result = withdrawRecord(devicesDir, id, reason);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  console.log(`Withdrew ${id}: ${result.file}`);
  if (result.droppedNotes) console.log("The old notes did not fit beside the withdrawal sentence, so they were dropped.");
  const sources = validateSources(join(ROOT, "data/sources"));
  const { errors } = validateDevices(devicesDir, { sources: sources.entries });
  const problems = [...errors, ...sources.errors];
  for (const { file, message } of problems) console.error(`${file}: ${message}`);
  if (problems.length) {
    console.error(`${problems.length} error(s): the withdrawn record does not validate, so fix it before committing`);
    process.exit(1);
  }
  console.log("The data validates. Commit the record and open a PR; the site shows no date for it once that merges (O8).");
}
