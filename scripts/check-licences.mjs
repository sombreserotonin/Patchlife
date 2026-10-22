// Checks that every package in package-lock.json has a licence D9 and D30 allow, so no dependency update can bring in
// one that clashes with the code's AGPL-3.0-or-later. A package with no licence is listed too: it needs a person to look.
// Lists each problem and exits 1 if there are any; exits 2 when the lockfile can't be read.
// Usage: node scripts/check-licences.mjs [lockfile]   (defaults to the repository's package-lock.json)
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// D9 (permissive, LGPL, GPL-3.0 and AGPL-3.0, with the old ids that have no -only) and D30 (MPL-2.0).
const ALLOWED = new Set([
  "MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "0BSD", "MPL-2.0",
  "LGPL-2.1-only", "LGPL-2.1-or-later", "LGPL-3.0-only", "LGPL-3.0-or-later", "LGPL-2.1", "LGPL-3.0",
  "GPL-3.0-only", "GPL-3.0-or-later", "GPL-3.0",
  "AGPL-3.0-only", "AGPL-3.0-or-later", "AGPL-3.0",
]);

// Whether an SPDX expression is allowed: OR passes if either side does, AND only if both do, and AND binds tighter
// than OR, as SPDX defines. Anything else (WITH, a + suffix, lower-case operators, a malformed expression) is refused
// rather than guessed at.
export function allowed(spdx) {
  if (typeof spdx !== "string") return false;
  const tokens = spdx.match(/[()]|[^\s()]+/g) ?? [];
  let i = 0;
  // Each step reads its whole part before combining, so the expression is checked to the end.
  const term = () => {
    const token = tokens[i++];
    if (token === "(") {
      const ok = either();
      if (tokens[i++] !== ")") throw new Error("unbalanced parentheses");
      return ok;
    }
    if (token === undefined || token === ")" || token === "AND" || token === "OR") throw new Error("expected a licence");
    return ALLOWED.has(token);
  };
  const both = () => {
    let ok = term();
    while (tokens[i] === "AND") {
      i++;
      const next = term();
      ok = ok && next;
    }
    return ok;
  };
  const either = () => {
    let ok = both();
    while (tokens[i] === "OR") {
      i++;
      const next = both();
      ok = ok || next;
    }
    return ok;
  };
  try {
    const ok = either();
    return ok && i === tokens.length;
  } catch {
    return false;
  }
}

// Returns { checked, problems }: the number of packages checked, and "<path>: <licence>" for each one not allowed.
// The root package ("") is Patchlife itself.
export function checkLicences(lock) {
  if (lock?.lockfileVersion !== 3 || typeof lock.packages !== "object" || lock.packages === null) throw new Error("not a version 3 package-lock.json");
  const packages = Object.entries(lock.packages).filter(([path]) => path !== "");
  const licence = (pkg) => (typeof pkg?.license === "string" && pkg.license.trim() ? pkg.license : "no licence");
  const problems = packages.filter(([, pkg]) => !allowed(pkg?.license)).map(([path, pkg]) => `${path}: ${licence(pkg)}`);
  return { checked: packages.length, problems };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = resolve(process.argv[2] ?? join(ROOT, "package-lock.json"));
  let result;
  try {
    result = checkLicences(JSON.parse(readFileSync(file, "utf8")));
  } catch (err) {
    console.error(`${file}: ${err.message}`);
    process.exit(2);
  }
  const { checked, problems } = result;
  for (const problem of problems) console.error(problem);
  console.log(problems.length ? `${problems.length} of ${checked} package(s) have a missing or disallowed licence (D9, D30)` : `${checked} package(s) checked, all licences allowed`);
  process.exit(problems.length ? 1 : 0);
}
