// Checks that, under data/, the working tree differs from a git ref only in what a re-verification may change: the
// `verification` block of existing device records, an empty `archive_url` filled with a capture of its item's own page
// (D43), data/sources/page-hashes.json, and a registry entry's `last_checked` (a revisit that found nothing to add,
// RUNBOOKS A5 step 4). Files outside data/ (notes, the log) are not data and are ignored. The nightly re-verify
// workflow runs it before pushing, and the data-gate check and the daily build before merging a PR without an audit
// (D20, RUNBOOKS A9).
// Usage: node scripts/verification-only.mjs [ref]   (ref defaults to HEAD; run it from inside the repository)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import YAML from "yaml";
import { isCaptureOf } from "./validate-data.mjs";

const PAGE_HASHES = "data/sources/page-hashes.json";
const DEVICE = /^data\/devices\/[^/]+\/[^/]+\.yaml$/;
const REGISTRY = /^data\/sources\/[^/]+\.yaml$/;

// True when two registry files hold the same entries apart from their last_checked dates.
function sameButLastChecked(before, after) {
  if (!Array.isArray(before) || !Array.isArray(after) || before.length !== after.length) return false;
  const rest = ({ last_checked: _, ...entry }) => entry;
  return before.every((entry, i) => entry && after[i] && isDeepStrictEqual(rest(entry), rest(after[i])));
}

// The record without its verification block. Given `before`, the archive links filled since then where an item had
// none are left out too, so those count like verification; the links `before` already had stay on both sides.
function comparable(record, before) {
  const { verification: _, ...rest } = record ?? {};
  if (!before || !Array.isArray(rest.evidence)) return rest;
  const evidence = rest.evidence.map((item, i) => {
    const old = before?.evidence?.[i];
    if (old?.archive_url != null || typeof item?.archive_url !== "string" || !isCaptureOf(item.archive_url, item.url)) return item;
    const { archive_url: _link, ...plain } = item;
    return old?.archive_url === null ? { ...plain, archive_url: null } : plain;
  });
  return { ...rest, evidence };
}

// Returns one message per path that a re-verification may not change; an empty list means only verification changed.
export function verificationOnlyProblems(ref = "HEAD", cwd = process.cwd()) {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }).trim();
  // Run from the top, so untracked paths come back relative to it, as diff paths do.
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  const lines = (text) => text.split("\n").filter(Boolean);
  const changed = [...lines(git("diff", "--name-only", "--no-renames", ref)), ...lines(git("ls-files", "--others", "--exclude-standard"))];
  const problems = [];
  for (const path of [...new Set(changed)].sort()) {
    if (path === PAGE_HASHES || !path.startsWith("data/")) continue;
    if (!DEVICE.test(path) && !REGISTRY.test(path)) {
      problems.push(`${path}: data other than a device record, a registry file or the page hash file`);
      continue;
    }
    let before;
    try {
      before = YAML.parse(git("show", `${ref}:${path}`));
    } catch {
      problems.push(`${path}: new file`);
      continue;
    }
    let after;
    try {
      after = YAML.parse(readFileSync(join(root, path), "utf8"));
    } catch {
      problems.push(`${path}: deleted or unreadable`);
      continue;
    }
    if (REGISTRY.test(path)) {
      if (!sameButLastChecked(before, after)) problems.push(`${path}: changes more than last_checked`);
    } else if (!isDeepStrictEqual(comparable(before), comparable(after, before))) problems.push(`${path}: changes more than the verification block`);
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = verificationOnlyProblems(process.argv[2]);
  for (const problem of problems) console.error(problem);
  console.log(problems.length ? `${problems.length} change(s) outside verification` : "Only verification changed");
  process.exit(problems.length ? 1 : 0);
}
