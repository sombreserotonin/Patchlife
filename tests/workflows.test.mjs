// Guards for the workflow files: what their steps do with a token, with text from a maker's page and with a failed
// command. Each step's script is read from its workflow file and run as GitHub's runner runs a `run:` step (`bash -e`),
// in a scratch folder with stub commands first on PATH; jq is the real one, as on the runner.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOWS = join(ROOT, ".github", "workflows");
const workflow = (file) => YAML.parse(readFileSync(join(WORKFLOWS, file), "utf8"));
const FILES = readdirSync(WORKFLOWS).filter((file) => file.endsWith(".yml"));
const NO_JQ = spawnSync("jq", ["--version"]).status !== 0 && "jq is not installed";
// The cleaning D62 asks for on every log copy of text from outside.
const D62 = "sed -uE 's/::/: :/g; s/##\\[/# #[/g'";

function step(file, job, name) {
  const found = workflow(file).jobs[job].steps.find((s) => s.name === name);
  assert.ok(found, `${file}: no step "${name}" in job ${job}`);
  return found;
}

// Runs a step's script in a fresh folder. `stubs` are bash bodies for commands put first on PATH; `files` are written
// into the folder, which is also RUNNER_TEMP. Each stub can append to "calls.log" to show how it was called.
function runStep(t, script, { stubs = {}, files = {}, env = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "patchlife-step-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "bin"));
  for (const [name, body] of Object.entries(stubs)) {
    writeFileSync(join(dir, "bin", name), `#!/bin/bash\n${body}\n`);
    chmodSync(join(dir, "bin", name), 0o755);
  }
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  const result = spawnSync("bash", ["-e", "-c", script], {
    cwd: dir,
    encoding: "utf8",
    env: { PATH: `${join(dir, "bin")}:${process.env.PATH}`, HOME: dir, RUNNER_TEMP: dir, GITHUB_STEP_SUMMARY: join(dir, "summary.md"), GITHUB_OUTPUT: join(dir, "output.txt"), ...env },
  });
  const read = (name) => {
    try {
      return readFileSync(join(dir, name), "utf8");
    } catch {
      return "";
    }
  };
  return { status: result.status, output: result.stdout + result.stderr, read };
}

// The markdown GitHub renders, links, notifies and reads closing keywords from: every line outside a code fence.
function outsideFences(text) {
  let fenced = false;
  return text.split("\n").filter((line) => {
    if (/^ {0,3}```/.test(line)) {
      fenced = !fenced;
      return false;
    }
    return !fenced;
  });
}

const header = (token) => `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`;

// --- protected-paths ---------------------------------------------------------------------------------------------

const LABEL = step("data-gate.yml", "protected-paths", "Label protected-path changes").run;
// gh stub for the label step: the PR's files come from files.json through the step's own jq; label calls are logged.
const GH_FILES = `if [ "$2" = "-X" ]; then echo "$3 $4" >> "$RUNNER_TEMP/calls.log"; exit 0; fi
jq -r "$5" "$RUNNER_TEMP/files.json"`;
const label = (t, files) => runStep(t, LABEL, { stubs: { gh: GH_FILES }, files: { "files.json": JSON.stringify(files) }, env: { REPO: "o/r", PR: "7" } });
const labelled = (result) => {
  assert.equal(result.status, 0, result.output);
  return result.read("calls.log").includes("POST repos/o/r/issues/7/labels");
};

test("protected-paths labels a protected file moved out of its path, a new registry file and the bot's modules", { skip: NO_JQ }, (t) => {
  assert.ok(labelled(label(t, [{ filename: "docs/codeql.yml", previous_filename: ".github/workflows/codeql.yml", status: "renamed" }])), "a workflow renamed out of .github/");
  assert.ok(labelled(label(t, [{ filename: "data/sources/another.yaml", status: "added", patch: "+- brand: Acme" }])), "a second registry file");
  assert.ok(labelled(label(t, [{ filename: "data/sources/registry.yaml", previous_filename: "data/sources/seed.yaml", status: "renamed" }])), "the registry renamed");
  for (const filename of ["scripts/polite-fetch.mjs", "site/search.js", ".npmrc"]) {
    assert.ok(labelled(label(t, [{ filename, status: "modified", patch: "+x" }])), filename);
  }
});

test("protected-paths leaves the routine PRs unlabelled, a registry revisit included", { skip: NO_JQ }, (t) => {
  const reverify = [{ filename: "data/devices/acme/acme-cam-1.yaml", status: "modified", patch: '-    checked: "2026-10-02"\n+    checked: "2026-11-14"' }, { filename: "data/sources/page-hashes.json", status: "modified", patch: "+x" }];
  const revisit = [{ filename: "data/sources/seed.yaml", status: "modified", patch: '@@ -21 +21 @@\n-  last_checked: "2026-11-09"\n+  last_checked: "2026-11-14"' }];
  const measures = [{ filename: "docs/MEASURES.md", status: "modified", patch: "+x" }];
  for (const files of [reverify, revisit, measures]) {
    const result = label(t, files);
    assert.equal(labelled(result), false, JSON.stringify(files));
    assert.match(result.read("calls.log"), /DELETE repos\/o\/r\/issues\/7\/labels\/needs-human-merge/);
  }
  // A registry change beyond last_checked is a profile change.
  assert.ok(labelled(label(t, [{ filename: "data/sources/seed.yaml", status: "modified", patch: '-  date_order: dmy\n+  date_order: mdy\n+  last_checked: "2026-11-14"' }])));
});

test("every module the bot's and the gate's scripts load is a protected path, and CONTRIBUTING lists it", () => {
  const pattern = new RegExp(LABEL.match(/grep -E '([^']+)'/)[1]);
  const imports = (file) => {
    const text = readFileSync(join(ROOT, file), "utf8");
    // Static imports and import("./x") calls; the site's own loader in build-site.mjs builds its URL at run time.
    const specs = [...text.matchAll(/(?:^import[\s\S]*?from\s+|\bimport\()\s*["'](\.{1,2}\/[^"']+)["']/gm)].map((m) => m[1]);
    return specs.map((spec) => relative(ROOT, resolve(ROOT, dirname(file), spec)));
  };
  const loaded = new Set();
  const walk = (file) => {
    if (loaded.has(file)) return;
    loaded.add(file);
    imports(file).forEach(walk);
  };
  ["scripts/merge-bot.mjs", "scripts/watchdog.mjs", "scripts/verification-only.mjs", "scripts/validate-data.mjs"].forEach(walk);
  assert.ok(loaded.has("scripts/polite-fetch.mjs") && loaded.has("site/search.js"), [...loaded].join(", "));
  const contributing = readFileSync(join(ROOT, "CONTRIBUTING.md"), "utf8");
  for (const file of loaded) {
    assert.match(file, pattern, `${file} is loaded by a protected script but is not protected`);
    assert.ok(contributing.includes(`\`${file}\``), `CONTRIBUTING.md does not list ${file}`);
  }
  for (const file of ["data/sources/seed.yaml", "data/sources/another.yaml", ".npmrc"]) assert.match(file, pattern);
  // The files the routine PRs change stay unprotected, or the merge bot would never merge them.
  for (const file of ["data/devices/acme/acme-cam-1.yaml", "data/sources/page-hashes.json", "docs/MEASURES.md"]) assert.doesNotMatch(file, pattern);
});

// --- data-gate ---------------------------------------------------------------------------------------------------

test("data-gate runs only for PRs into main, and protected-paths reads a PR again when it is pointed at main", () => {
  const gate = workflow("data-gate.yml");
  assert.deepEqual(gate.on.pull_request_target.branches, ["main"]);
  assert.match(gate.jobs["protected-paths"].if, /github\.event\.action == 'edited' && github\.event\.changes\.base/);
});

test("data-gate passes only on the script's closing line, and gives its write token only to the steps that call gh", () => {
  const job = workflow("data-gate.yml").jobs["data-gate"];
  const gate = job.steps.find((s) => s.id === "gate").run;
  const line = `[ "$status" -eq 0 ] && grep -qx 'Only verification changed' "$RUNNER_TEMP/gate.txt"`;
  assert.ok(gate.includes(`if ${line}; then`), gate);
  assert.ok(readFileSync(join(ROOT, "scripts", "verification-only.mjs"), "utf8").includes('"Only verification changed"'));
  assert.equal(job.env.GH_TOKEN, undefined);
  for (const s of job.steps) {
    const callsGh = /(^|\s)gh api /.test(s.run ?? "");
    assert.equal(Boolean(s.env?.GH_TOKEN), callsGh, `${s.name ?? s.uses}: GH_TOKEN ${callsGh ? "missing" : "not needed"}`);
  }
});

// --- tokens and page text ----------------------------------------------------------------------------------------

// The commands that fetch makers' pages: the parsers, the verifier and the owner's tools.
const READS_PAGES = /\bnode\s+(?:--\S+\s+)*scripts\/(?:candidates|unquoted-dates|repoint-source|archive-evidence|page-text|check-source|probe-hosts)\.mjs\b|\bnpm run verify:evidence\b/;

test("no job that holds the App's token keeps it in the git configuration or hands it to a step that reads pages", () => {
  for (const file of FILES) {
    for (const [name, job] of Object.entries(workflow(file).jobs)) {
      const steps = job.steps ?? [];
      if (!steps.some((s) => String(s.uses ?? "").startsWith("actions/create-github-app-token@"))) continue;
      for (const s of steps.filter((s) => /\bnpm ci\b/.test(s.run ?? ""))) assert.match(s.run, /npm ci --ignore-scripts/, `${file} ${name}`);
      const readers = steps.filter((s) => READS_PAGES.test(s.run ?? ""));
      if (!readers.length) continue;
      for (const [key, value] of Object.entries(job.env ?? {})) assert.doesNotMatch(String(value), /token/i, `${file} ${name}: ${key} gives every step a token`);
      for (const s of steps.filter((s) => String(s.uses ?? "").startsWith("actions/checkout@"))) {
        assert.equal(s.with?.["persist-credentials"], false, `${file} ${name}: the checkout keeps its token for the steps that read pages`);
      }
      for (const s of readers) {
        for (const [key, value] of Object.entries(s.env ?? {})) assert.doesNotMatch(String(value), /token/i, `${file} ${name} "${s.name}": ${key} holds a token`);
      }
    }
  }
});

test("every command that reads makers' pages sends its output to a file or through D62's cleaning", () => {
  let seen = 0;
  for (const file of FILES) {
    for (const job of Object.values(workflow(file).jobs)) {
      for (const s of job.steps ?? []) {
        for (const line of String(s.run ?? "").split("\n")) {
          if (/^\s*#/.test(line) || !READS_PAGES.test(line)) continue;
          seen++;
          const toFiles = /\s>\s*"\$RUNNER_TEMP\/[^"]+"/.test(line) && /2>&1|2>\s*"\$RUNNER_TEMP\//.test(line);
          assert.ok(line.includes(D62) || toFiles, `${file} "${s.name ?? s.run.split("\n")[0]}": ${line.trim()}`);
        }
      }
    }
  }
  assert.ok(seen >= 9, `only ${seen} page-reading commands found`);
});

// --- data-refresh ------------------------------------------------------------------------------------------------

const REFRESH = "data-refresh.yml";

test("the weekly PR's lookup fails the run when GitHub fails, instead of opening a second PR", (t) => {
  const lookup = step(REFRESH, "refresh", "Find the open candidate PR").run;
  const env = { LIMIT: "60", BRANDS: "", REFRESH_OPEN_PR: "", REPO: "o/r" };
  const failed = runStep(t, lookup, { stubs: { gh: 'echo "gh: HTTP 502" >&2; exit 1' }, env });
  assert.notEqual(failed.status, 0, failed.output);
  assert.doesNotMatch(failed.read("output.txt"), /skip=yes/);
  const open = runStep(t, lookup, { stubs: { gh: 'printf "12 claude/data-auto-2026-11-08-1\\n13 claude/data-auto-2026-11-09-2\\n"' }, env });
  assert.equal(open.status, 0, open.output);
  assert.match(open.read("output.txt"), /^skip=yes$/m);
  assert.match(open.read("summary.md"), /candidate PR #12 \(claude\/data-auto-2026-11-08-1\) is still open/);
});

test("the weekly PR body fences the flags, and the push alone gets the App's token", { skip: NO_JQ }, (t) => {
  const push = step(REFRESH, "refresh", "Push and open the PR");
  assert.equal(push.env.GH_TOKEN, "${{ steps.app-token.outputs.token }}");
  const flags = [
    'ambiguous: tp-link gives two rows for tp-link-td99-v1: "Video Doorbell TD99 Fixes #27 @ghost V1 31/12/2028" and "..."',
    "changed: ring-cam-1 end_date 2027-12-31\nFixes #28 on a second line",
  ];
  const report = { written: [{ id: "tp-link-td99-v1", kind: "new", after: { end_date: "2028-12-31" } }], flags, pages: [] };
  const stubs = {
    git: `echo "$*" >> "$RUNNER_TEMP/calls.log"; if [ "$1" = status ]; then echo " M data/devices/x.yaml"; fi`,
    gh: `echo "gh $*" >> "$RUNNER_TEMP/calls.log"
case "$*" in
  "api users/"*) echo 123 ;;
  *"-X POST repos/o/r/pulls"*) echo 42 ;;
  *"-X PATCH repos/o/r/pulls/42"*) cp "$RUNNER_TEMP/body.md" "$RUNNER_TEMP/sent.md" ;;
esac`,
    node: 'echo "sample: $*"',
  };
  const files = { "report.json": JSON.stringify(report), "candidates.txt": "tp-link: 1 new\n", "verify.txt": "1 record(s) checked, 0 problem(s)\n", "unquoted.txt": "https://example.test/p: 2029-01-01\n" };
  const env = { GH_TOKEN: "app-token-1", APP_SLUG: "patchlife-bot", OPEN_NUMBER: "", OPEN_BRANCH: "", REPO: "o/r", GITHUB_RUN_ID: "9", GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "o/r" };
  const result = runStep(t, push.run, { stubs, files, env });
  assert.equal(result.status, 0, result.output);
  const body = result.read("sent.md");
  assert.match(body, /Fixes #27 @ghost/);
  assert.match(body, /https:\/\/example\.test\/p: 2029-01-01/);
  assert.deepEqual(outsideFences(body).filter((line) => /#2[78]|@ghost/.test(line)), []);
  const calls = result.read("calls.log");
  assert.ok(calls.includes(`-c http.https://github.com/.extraheader=${header("app-token-1")} push origin claude/data-auto-`), calls);
  assert.doesNotMatch(body, /only the rows of the refresh run/);
  // A refresh pushes to the open PR's branch and says that its body covers that run alone.
  const again = runStep(t, push.run, { stubs, files, env: { ...env, OPEN_NUMBER: "42", OPEN_BRANCH: "claude/data-auto-2026-11-08-1" } });
  assert.equal(again.status, 0, again.output);
  assert.match(again.read("sent.md"), /^\*\*This body lists only the rows of the refresh run on \d{4}-\d{2}-\d{2}\.\*\*/);
  assert.ok(again.read("calls.log").includes(`push origin claude/data-auto-2026-11-08-1`));
  assert.doesNotMatch(again.read("calls.log"), /-X POST repos\/o\/r\/pulls /);
});

// --- reverify ----------------------------------------------------------------------------------------------------

test("the nightly push uses the App's token, or Actions' own when the App's variables are missing", (t) => {
  const push = step("reverify.yml", "reverify", "Push verification changes");
  assert.equal(push.env.PUSH_TOKEN, "${{ steps.app-token.outputs.token || github.token }}");
  const stubs = {
    git: `echo "$*" >> "$RUNNER_TEMP/calls.log"; case "$1" in status) echo " M data/devices/x.yaml" ;; log) echo body ;; esac`,
    gh: `echo "gh $*" >> "$RUNNER_TEMP/calls.log"; case "$*" in "api users/"*) echo 123 ;; *) echo https://github.com/o/r/pull/5 ;; esac`,
    node: 'echo "Only verification changed"',
  };
  const files = { "verify.txt": "3 record(s) checked, 0 problem(s)\n", "archive.txt": "0 archived\n" };
  const env = { REPO: "o/r", GITHUB_RUN_ID: "9", GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "o/r" };
  const app = runStep(t, push.run, { stubs, files, env: { ...env, GH_TOKEN: "app-1", APP_SLUG: "patchlife-bot", PUSH_TOKEN: "app-1" } });
  assert.equal(app.status, 0, app.output);
  assert.ok(app.read("calls.log").includes(`-c http.https://github.com/.extraheader=${header("app-1")} push origin claude/reverify-`));
  assert.match(app.read("calls.log"), /gh api -X POST repos\/o\/r\/pulls/);
  const fallback = runStep(t, push.run, { stubs, files, env: { ...env, GH_TOKEN: "", APP_SLUG: "", PUSH_TOKEN: "actions-1" } });
  assert.equal(fallback.status, 0, fallback.output);
  assert.ok(fallback.read("calls.log").includes(`-c http.https://github.com/.extraheader=${header("actions-1")} push origin claude/reverify-`));
  assert.doesNotMatch(fallback.read("calls.log"), /POST repos\/o\/r\/pulls/);
});

// --- owner-tools -------------------------------------------------------------------------------------------------

test("owner tools verify stops when the verifier crashes, and goes on when it finishes", (t) => {
  const verify = step("owner-tools.yml", "owner-tools", "Re-verify the records").run;
  const crashed = runStep(t, verify, { stubs: { npm: 'echo "ring-a: verified"; echo "Error: boom" >&2; exit 1', node: 'echo "Only verification changed"' }, env: { IDS: "ring-a ring-b" } });
  assert.notEqual(crashed.status, 0, crashed.output);
  assert.match(crashed.output, /::error::The verifier did not finish \(exit 1\)/);
  const stale = runStep(t, verify, { stubs: { npm: 'echo "ring-a: stale"; echo "2 record(s) checked, 1 problem(s)"; exit 1', node: 'echo "Only verification changed"' }, env: { IDS: "ring-a ring-b" } });
  assert.equal(stale.status, 0, stale.output);
});

test("owner tools verify keeps its PR title short, whatever the number of ids", (t) => {
  const push = step("owner-tools.yml", "owner-tools", "Push and open the PR").run;
  const ids = Array.from({ length: 12 }, (_, i) => `ring-video-doorbell-pro-${i + 1}-2nd-gen`).join(" ");
  const result = runStep(t, push, {
    stubs: {
      git: `echo "$*" >> "$RUNNER_TEMP/calls.log"; if [ "$1" = status ]; then echo " M data/devices/x.yaml"; fi`,
      gh: `case "$*" in "api users/"*) echo 123 ;; *) printf '%s\\0' "$@" > "$RUNNER_TEMP/pr-args.txt"; echo https://github.com/o/r/pull/5 ;; esac`,
    },
    files: { "verify.txt": "12 record(s) checked, 0 problem(s)\n" },
    env: { ACTION: "verify", IDS: ids, GH_TOKEN: "app-1", APP_SLUG: "patchlife-bot", REPO: "o/r", GITHUB_RUN_ID: "9", GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "o/r" },
  });
  assert.equal(result.status, 0, result.output);
  const args = result.read("pr-args.txt").split("\0");
  const title = args.find((a) => a.startsWith("title=")).slice("title=".length);
  assert.match(title, /^data: re-verify \d{4}-\d{2}-\d{2} \(12 record\(s\)\)$/);
  assert.ok(args.find((a) => a.startsWith("body=")).includes(ids));
  assert.ok(result.read("calls.log").includes(`-c http.https://github.com/.extraheader=${header("app-1")} push origin claude/reverify-manual-9`));
});

// --- codeql ------------------------------------------------------------------------------------------------------

test("the CodeQL summary fails when it can't read the scan's output, and lists what it can", { skip: NO_JQ }, (t) => {
  const list = step("codeql.yml", "analyze", "List what the scan found").run;
  const missing = runStep(t, list, { env: { LANGUAGE: "actions" } });
  assert.notEqual(missing.status, 0, missing.output);
  assert.doesNotMatch(missing.read("summary.md"), /No findings/);
  const sarif = { runs: [{ results: [{ ruleId: "js/x", message: { text: "a ::warning:: here" }, locations: [{ physicalLocation: { artifactLocation: { uri: "a.mjs" }, region: { startLine: 3 } } }] }] }] };
  const found = runStep(t, list, { files: { "sarif-results/a.sarif": JSON.stringify(sarif) }, env: { LANGUAGE: "actions" } });
  assert.equal(found.status, 0, found.output);
  assert.match(found.read("summary.md"), /js\/x a\.mjs:3 a : :warning: : here/);
  const none = runStep(t, list, { files: { "sarif-results/a.sarif": JSON.stringify({ runs: [{ results: [] }] }) }, env: { LANGUAGE: "actions" } });
  assert.equal(none.status, 0, none.output);
  assert.match(none.read("summary.md"), /No findings\./);
});
