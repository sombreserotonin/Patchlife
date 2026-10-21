// Validates every device record against the JSON Schema plus integrity rules the schema can't express.
// Usage: node scripts/validate-data.mjs [devicesDir]
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import YAML from "yaml";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ANCHORED_RULES = new Set(["years_after_eol", "years_after_launch"]);

// Adds whole years to a YYYY-MM-DD date; 29 February becomes 28 February in non-leap years.
export function addYears(isoDate, years) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const year = y + years;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const day = m === 2 && d === 29 && !leap ? 28 : d;
  return `${String(year).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function loadValidator(schemaPath = join(ROOT, "data/schema/device.schema.json")) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(JSON.parse(readFileSync(schemaPath, "utf8")));
}

function listYamlFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...listYamlFiles(path));
    else if (name.endsWith(".yaml")) files.push(path);
  }
  return files.sort();
}

export function validateDevices(devicesDir, { today = new Date().toISOString().slice(0, 10), validate = loadValidator() } = {}) {
  if (!existsSync(devicesDir)) return { files: 0, errors: [{ file: devicesDir, message: "directory not found" }] };
  const errors = [];
  const seen = new Map();
  const files = listYamlFiles(devicesDir);

  for (const file of files) {
    const rel = relative(devicesDir, file);
    const fail = (message) => errors.push({ file: rel, message });

    let record;
    try {
      record = YAML.parse(readFileSync(file, "utf8"));
    } catch (err) {
      fail(`YAML parse error: ${err.message}`);
      continue;
    }
    if (!validate(record)) {
      for (const err of validate.errors) fail(`schema: ${err.instancePath || "/"} ${err.message}`);
      continue;
    }

    const stem = basename(file, ".yaml");
    const folder = basename(dirname(file));
    if (record.id !== stem) fail(`id "${record.id}" must match filename "${stem}"`);
    if (record.brand_slug !== folder) fail(`brand_slug "${record.brand_slug}" must match folder "${folder}"`);
    if (!record.id.startsWith(`${record.brand_slug}-`)) fail(`id must start with "${record.brand_slug}-"`);
    if (seen.has(record.id)) fail(`duplicate id "${record.id}", also in ${seen.get(record.id)}`);
    else seen.set(record.id, rel);

    const support = record.support;
    if (ANCHORED_RULES.has(support.rule)) {
      if (support.anchor_date) {
        const expected = addYears(support.anchor_date, support.years);
        if (support.end_date !== expected) fail(`end_date must equal anchor_date + ${support.years} years (${expected})`);
      } else if (support.end_date) {
        fail("end_date needs a published anchor_date for this rule");
      }
    }

    for (const ev of record.evidence) {
      if (ev.retrieved > today) fail(`evidence retrieved date ${ev.retrieved} is in the future`);
    }
    const checked = record.verification.checked;
    if (checked && checked > today) fail(`verification.checked ${checked} is in the future`);
  }

  return { files: files.length, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = resolve(process.argv[2] ?? join(ROOT, "data/devices"));
  const { files, errors } = validateDevices(dir);
  for (const e of errors) console.error(`${e.file}: ${e.message}`);
  console.log(`${files} record(s) checked, ${errors.length} error(s)`);
  process.exit(errors.length ? 1 : 0);
}
