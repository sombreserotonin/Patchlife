import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { githubApi, mergeBot, mergeDecision } from "../scripts/merge-bot.mjs";
import { USER_AGENT } from "../scripts/polite-fetch.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/merge-bot.mjs", import.meta.url));
const FAKE_FETCH = new URL("./fixtures/merge-bot/fake-fetch.mjs", import.meta.url).href;
const REPO = "sombreserotonin/Patchlife";
const BOT = "patchlife-bot[bot]";
const SHA = "a".repeat(40);

// A check run from GitHub Actions that passed on SHA; fields replace any part of it.
const run = (name, fields = {}) => ({ id: 1, name, head_sha: SHA, status: "completed", conclusion: "success", started_at: "2026-12-21T13:00:00Z", app: { slug: "github-actions" }, ...fields });
const passingRuns = (sha) => ["test", "data-gate", "build"].map((name, n) => run(name, { id: n + 1, head_sha: sha }));
const refused = (reason) => ({ merge: false, reason });

// A re-verify or measures PR that keeps every rule, as mergeDecision's input. Its lighthouse run failed, which doesn't count.
function passing(type = "reverify") {
  const measures = type === "measures";
  return {
    pr: { number: 12, draft: false, user: { login: BOT }, labels: [{ name: "claude" }], head: { ref: measures ? "claude/measures-2026-11" : "claude/reverify-2026-12-21-123", sha: SHA, repo: { full_name: REPO } } },
    files: measures ? [{ filename: "docs/MEASURES.md", status: "modified" }] : [{ filename: "data/devices/acme/acme-cam-1.yaml", status: "modified" }, { filename: "data/sources/page-hashes.json", status: "modified" }],
    checkRuns: [...passingRuns(SHA), run("lighthouse", { id: 4, conclusion: "failure" })],
    repo: REPO,
    botLogin: BOT,
  };
}

// mergeDecision on a passing PR after change(input) breaks it.
function decide(change, type) {
  const input = passing(type);
  change(input);
  return mergeDecision(input);
}

test("a re-verify PR and a measures PR that keep every rule merge", () => {
  assert.deepEqual(mergeDecision(passing()), { merge: true, reason: "reverify" });
  assert.deepEqual(mergeDecision(passing("measures")), { merge: true, reason: "measures" });
  // A measures PR may create docs/MEASURES.md, and a re-verify PR may change only records or only the hash file.
  assert.deepEqual(decide((i) => (i.files[0].status = "added"), "measures"), { merge: true, reason: "measures" });
  assert.deepEqual(decide((i) => i.files.pop()), { merge: true, reason: "reverify" });
  assert.deepEqual(decide((i) => i.files.shift()), { merge: true, reason: "reverify" });
  assert.deepEqual(decide((i) => (i.pr.head.ref = "claude/reverify-manual-42")), { merge: true, reason: "reverify" });
});

test("a PR from a fork or a deleted head repository is refused", () => {
  for (const repo of [{ full_name: "someone/Patchlife" }, { full_name: "sombreserotonin/patchlife" }, {}, null]) {
    assert.deepEqual(decide((i) => (i.pr.head.repo = repo)), refused("head branch is not in this repository"), JSON.stringify(repo));
  }
});

test("only a PR the bot opened merges", () => {
  for (const user of [{ login: "sombreserotonin" }, { login: "dependabot[bot]" }, {}, null]) {
    assert.deepEqual(decide((i) => (i.pr.user = user)), refused("not opened by patchlife-bot[bot]"), JSON.stringify(user));
  }
});

test("without a repository and a bot login nothing merges, even when the PR's own are missing too", () => {
  assert.deepEqual(decide((i) => ((i.repo = undefined), (i.pr.head.repo = null))), refused("no repository or bot login given"));
  assert.deepEqual(decide((i) => ((i.botLogin = undefined), (i.pr.user = null))), refused("no repository or bot login given"));
  assert.deepEqual(decide((i) => ((i.botLogin = ""), (i.pr.user = { login: "" }))), refused("no repository or bot login given"));
});

test("a draft is refused, as is a PR that doesn't say whether it is one", () => {
  assert.deepEqual(decide((i) => (i.pr.draft = true)), refused("draft"));
  assert.deepEqual(decide((i) => delete i.pr.draft), refused("draft"));
});

test("only claude/reverify-* and claude/measures-* branches merge", () => {
  const refs = ["claude/a1-merge-bot", "claude/reverify", "claude/reverifyx-1", "claude/measures", "claude/measuresx-1", "reverify-2026-12-21", "x/claude/reverify-1", "x/claude/measures-2026-11", "Claude/reverify-1", "dependabot/npm_and_yarn/yaml-2.9.2"];
  for (const ref of refs) {
    assert.deepEqual(decide((i) => (i.pr.head.ref = ref)), refused(`branch ${ref} is not a re-verify or measures branch`));
  }
});

test("a needs-human or needs-human-merge label holds a PR, whatever its case", () => {
  for (const name of ["needs-human", "needs-human-merge", "Needs-Human-Merge"]) {
    assert.deepEqual(decide((i) => i.pr.labels.push({ name })), refused(`label ${name}`));
  }
  assert.deepEqual(decide((i) => delete i.pr.labels), refused("no label list"));
});

test("test, data-gate and build must each have passed on the head SHA", () => {
  for (const name of ["test", "data-gate", "build"]) {
    const drop = (i) => (i.checkRuns = i.checkRuns.filter((r) => r.name !== name));
    const only = (fields) => (i) => (drop(i), i.checkRuns.push(run(name, fields)));
    assert.deepEqual(decide(drop), refused(`check ${name} missing`));
    // A run on another commit, or from another app under the same name, doesn't count.
    assert.deepEqual(decide(only({ head_sha: "b".repeat(40) })), refused(`check ${name} missing`));
    assert.deepEqual(decide(only({ app: { slug: "another-ci" } })), refused(`check ${name} missing`));
    // Still running counts as not passed, even with a conclusion already set.
    for (const fields of [{ conclusion: "failure" }, { conclusion: "cancelled" }, { conclusion: "skipped" }, { conclusion: "neutral" }, { status: "queued", conclusion: null }, { status: "in_progress", conclusion: null }, { status: "in_progress", conclusion: "success" }]) {
      assert.deepEqual(decide(only(fields)), refused(`check ${name} not passed`), `${name} ${JSON.stringify(fields)}`);
    }
  }
});

test("the newest run of a check decides: the later start, then the higher id", () => {
  const gate = (...runs) => (i) => (i.checkRuns = [...i.checkRuns.filter((r) => r.name !== "data-gate"), ...runs]);
  const older = { id: 1, started_at: "2026-12-21T13:00:00Z" };
  const newer = { id: 2, started_at: "2026-12-21T14:00:00Z" };
  // A newer failure after a success holds the PR, in whichever order GitHub lists them.
  assert.deepEqual(decide(gate(run("data-gate", older), run("data-gate", { ...newer, conclusion: "failure" }))), refused("check data-gate not passed"));
  assert.deepEqual(decide(gate(run("data-gate", { ...newer, conclusion: "failure" }), run("data-gate", older))), refused("check data-gate not passed"));
  // A re-run that passed after a failure lets it merge.
  assert.deepEqual(decide(gate(run("data-gate", { ...older, conclusion: "failure" }), run("data-gate", newer))), { merge: true, reason: "reverify" });
  assert.deepEqual(decide(gate(run("data-gate", newer), run("data-gate", { ...older, conclusion: "failure" }))), { merge: true, reason: "reverify" });
  // The start decides before the id.
  assert.deepEqual(decide(gate(run("data-gate", { id: 9, started_at: older.started_at, conclusion: "failure" }), run("data-gate", { id: 5, started_at: newer.started_at }))), { merge: true, reason: "reverify" });
  // With a start missing or the same start, the higher id decides.
  for (const [startPassed, startFailed] of [[null, null], [undefined, undefined], [newer.started_at, null], [older.started_at, older.started_at]]) {
    const passed = run("data-gate", { id: 7, started_at: startPassed });
    const failed = run("data-gate", { id: 8, started_at: startFailed, conclusion: "failure" });
    assert.deepEqual(decide(gate(passed, failed)), refused("check data-gate not passed"), `${startPassed} ${startFailed}`);
    assert.deepEqual(decide(gate(failed, passed)), refused("check data-gate not passed"), `${startPassed} ${startFailed}`);
  }
});

test("an audited label doesn't stand in for a failed data-gate", () => {
  const audited = (i) => (i.pr.labels.push({ name: "audited" }), (i.checkRuns.find((r) => r.name === "data-gate").conclusion = "failure"));
  assert.deepEqual(decide(audited), refused("check data-gate not passed"));
});

test("a re-verify PR may only change existing device records and the page hash file", () => {
  const outside = ["data/sources/seed.yaml", ".github/workflows/ci.yml", "scripts/merge-bot.mjs", "package.json", "docs/MEASURES.md", "data/devices/acme/acme-cam-1.yml", "data/devices/acme/new/acme-cam-1.yaml", "data/devices/acme-cam-1.yaml", "data/devices/acme/acme-cam-1.yaml.bak", "data/devices/acme/acme-cam-1-yaml", "data/sources/page-hashes.json.bak", "x/data/devices/acme/acme-cam-1.yaml"];
  for (const filename of outside) {
    assert.deepEqual(decide((i) => i.files.push({ filename, status: "modified" })), refused(`${filename} (modified) not allowed in a reverify PR`));
  }
  // New, removed, renamed or copied records change more than verification, and so does any change to the hash file but an edit.
  for (const status of ["added", "removed", "renamed", "copied", "changed"]) {
    assert.deepEqual(decide((i) => (i.files[0].status = status)), refused(`data/devices/acme/acme-cam-1.yaml (${status}) not allowed in a reverify PR`));
    assert.deepEqual(decide((i) => (i.files[1].status = status)), refused(`data/sources/page-hashes.json (${status}) not allowed in a reverify PR`));
  }
});

test("a measures PR may only change docs/MEASURES.md", () => {
  for (const filename of ["README.md", "docs/PLAN.md", "data/devices/acme/acme-cam-1.yaml", "data/sources/page-hashes.json"]) {
    assert.deepEqual(decide((i) => i.files.push({ filename, status: "modified" }), "measures"), refused(`${filename} (modified) not allowed in a measures PR`));
  }
  assert.deepEqual(decide((i) => (i.files = [{ filename: "docs/PLAN.md", status: "added" }]), "measures"), refused("docs/PLAN.md (added) not allowed in a measures PR"));
  for (const status of ["removed", "renamed"]) {
    assert.deepEqual(decide((i) => (i.files[0].status = status), "measures"), refused(`docs/MEASURES.md (${status}) not allowed in a measures PR`));
  }
});

test("a PR with no files, or more than GitHub lists, is refused", () => {
  const records = (count) => (i) => (i.files = Array.from({ length: count }, (_, n) => ({ filename: `data/devices/acme/acme-${n}.yaml`, status: "modified" })));
  assert.deepEqual(decide(records(0)), refused("no files"));
  assert.deepEqual(decide(records(0), "measures"), refused("no files"));
  assert.deepEqual(decide(records(2999)), { merge: true, reason: "reverify" });
  assert.deepEqual(decide(records(3000)), refused("too many files to check (3000)"));
});

test("the first rule a PR breaks is the reason given", () => {
  const rules = [
    [(i) => (i.pr.head.repo = null), "head branch is not in this repository"],
    [(i) => (i.pr.user = null), "not opened by patchlife-bot[bot]"],
    [(i) => (i.pr.draft = true), "draft"],
    [(i) => (i.pr.head.ref = "main"), "branch main is not a re-verify or measures branch"],
    [(i) => i.pr.labels.push({ name: "needs-human" }), "label needs-human"],
    [(i) => (i.checkRuns = []), "check test missing"],
    [(i) => (i.files = []), "no files"],
  ];
  // Breaking rule n and every rule after it gives rule n's reason.
  for (const [n, [, reason]] of rules.entries()) {
    assert.deepEqual(decide((i) => rules.slice(n).forEach(([breakRule]) => breakRule(i))), refused(reason));
  }
});

// A fake api for mergeBot: the open PRs, each PR's files and each SHA's check runs, paged 100 at a time as GitHub
// does. responses maps "<METHOD> <path>" to a reply, or to an Error to throw, in place of the default. Calls are recorded.
function fakeGitHub({ prs = [], files = {}, runs = {}, responses = {} }) {
  const calls = [];
  const page = (list, path) => {
    const n = Number(new URLSearchParams(path.split("?")[1]).get("page"));
    return list.slice((n - 1) * 100, n * 100);
  };
  async function api(method, path, body) {
    calls.push(body === undefined ? `${method} ${path}` : `${method} ${path} ${JSON.stringify(body)}`);
    const key = `${method} ${path}`;
    if (key in responses) {
      if (responses[key] instanceof Error) throw responses[key];
      return responses[key];
    }
    let m;
    if (method === "GET" && /^\/repos\/[^/]+\/[^/]+\/pulls\?state=open&per_page=100&page=\d+$/.test(path)) return page(prs, path);
    if (method === "GET" && (m = path.match(/^\/repos\/[^/]+\/[^/]+\/pulls\/(\d+)\/files\?per_page=100&page=\d+$/))) return page(files[m[1]] ?? [], path);
    if (method === "GET" && (m = path.match(/^\/repos\/[^/]+\/[^/]+\/commits\/(\w+)\/check-runs\?per_page=100&filter=all&page=\d+$/))) {
      return { total_count: (runs[m[1]] ?? []).length, check_runs: page(runs[m[1]] ?? [], path) };
    }
    if (method === "PUT" && /^\/repos\/[^/]+\/[^/]+\/pulls\/\d+\/merge$/.test(path)) return { sha: "c".repeat(40), merged: true, message: "Pull Request successfully merged" };
    if (method === "DELETE" && path.startsWith(`/repos/${REPO}/git/refs/heads/`)) return null;
    throw Object.assign(new Error(`${key}: HTTP 404 Not Found`), { status: 404 });
  }
  return { api, calls };
}

const SHA12 = "1".repeat(40);
const SHA13 = "2".repeat(40);
const botPr = (number, ref, sha) => ({ number, draft: false, user: { login: BOT }, labels: [], head: { ref, sha, repo: { full_name: REPO } } });
// A passing re-verify PR, #12, and the owner's own PR, #13.
const TWO_PRS = {
  prs: [botPr(12, "claude/reverify-2026-12-21-123", SHA12), { ...botPr(13, "claude/a1-merge-bot", SHA13), user: { login: "sombreserotonin" } }],
  files: { 12: [{ filename: "data/devices/acme/acme-cam-1.yaml", status: "modified" }], 13: [{ filename: "scripts/merge-bot.mjs", status: "added" }] },
  runs: { [SHA12]: passingRuns(SHA12), [SHA13]: passingRuns(SHA13) },
};
const MERGE_12 = `PUT /repos/${REPO}/pulls/12/merge {"merge_method":"squash","sha":"${SHA12}"}`;
const DELETE_12 = `DELETE /repos/${REPO}/git/refs/heads/claude/reverify-2026-12-21-123`;
const httpError = (key, status, message) => Object.assign(new Error(`${key}: HTTP ${status} ${message}`), { status });

test("mergeBot squash-merges a passing PR at its head SHA, then deletes its branch, and skips the rest", async () => {
  const { api, calls } = fakeGitHub(TWO_PRS);
  const heard = [];
  const results = await mergeBot({ api, repo: REPO, botLogin: BOT, onResult: (r) => heard.push(r) });
  assert.deepEqual(results, [
    { number: 12, action: "merged", reason: "reverify" },
    { number: 13, action: "skipped", reason: "not opened by patchlife-bot[bot]" },
  ]);
  assert.deepEqual(heard, results);
  assert.deepEqual(calls, [
    `GET /repos/${REPO}/pulls?state=open&per_page=100&page=1`,
    `GET /repos/${REPO}/pulls/12/files?per_page=100&page=1`,
    `GET /repos/${REPO}/commits/${SHA12}/check-runs?per_page=100&filter=all&page=1`,
    MERGE_12,
    DELETE_12,
    `GET /repos/${REPO}/pulls/13/files?per_page=100&page=1`,
    `GET /repos/${REPO}/commits/${SHA13}/check-runs?per_page=100&filter=all&page=1`,
  ]);
});

test("a dry run reports what would merge and changes nothing", async () => {
  const { api, calls } = fakeGitHub(TWO_PRS);
  assert.deepEqual(await mergeBot({ api, repo: REPO, botLogin: BOT, dryRun: true }), [
    { number: 12, action: "would merge", reason: "reverify" },
    { number: 13, action: "skipped", reason: "not opened by patchlife-bot[bot]" },
  ]);
  assert.deepEqual(calls.filter((call) => !call.startsWith("GET ")), []);
});

test("an API error stops the run: a head that moved after the check makes GitHub refuse the merge, and the branch stays", async () => {
  const moved = httpError(`PUT /repos/${REPO}/pulls/12/merge`, 409, "Head branch was modified. Review and try the merge again.");
  const { api, calls } = fakeGitHub({ ...TWO_PRS, responses: { [`PUT /repos/${REPO}/pulls/12/merge`]: moved } });
  const heard = [];
  await assert.rejects(mergeBot({ api, repo: REPO, botLogin: BOT, onResult: (r) => heard.push(r) }), (err) => err === moved);
  assert.deepEqual(heard, []);
  assert.equal(calls.at(-1), MERGE_12);
  // A failure reading PRs, files or check runs stops it too, before anything merges.
  for (const key of [`GET /repos/${REPO}/pulls?state=open&per_page=100&page=1`, `GET /repos/${REPO}/pulls/12/files?per_page=100&page=1`, `GET /repos/${REPO}/commits/${SHA12}/check-runs?per_page=100&filter=all&page=1`]) {
    const broken = httpError(key, 502, "Bad Gateway");
    const failing = fakeGitHub({ ...TWO_PRS, responses: { [key]: broken } });
    await assert.rejects(mergeBot({ api: failing.api, repo: REPO, botLogin: BOT }), (err) => err === broken);
    assert.equal(failing.calls.at(-1), key);
  }
});

test("a merge GitHub doesn't confirm stops the run before the branch is deleted", async () => {
  const { api, calls } = fakeGitHub({ ...TWO_PRS, responses: { [`PUT /repos/${REPO}/pulls/12/merge`]: { merged: false, message: "not merged" } } });
  await assert.rejects(mergeBot({ api, repo: REPO, botLogin: BOT }), /#12: GitHub did not confirm the merge/);
  assert.equal(calls.at(-1), MERGE_12);
});

test("a branch GitHub already deleted after the merge is fine, but any other failure to delete it stops the run", async () => {
  const gone = fakeGitHub({ ...TWO_PRS, responses: { [`DELETE /repos/${REPO}/git/refs/heads/claude/reverify-2026-12-21-123`]: httpError("DELETE", 422, "Reference does not exist") } });
  assert.deepEqual((await mergeBot({ api: gone.api, repo: REPO, botLogin: BOT })).map((r) => r.action), ["merged", "skipped"]);
  for (const error of [httpError("DELETE", 403, "Resource not accessible by integration"), httpError("DELETE", 422, "Validation Failed")]) {
    const { api } = fakeGitHub({ ...TWO_PRS, responses: { [`DELETE /repos/${REPO}/git/refs/heads/claude/reverify-2026-12-21-123`]: error } });
    const heard = [];
    await assert.rejects(mergeBot({ api, repo: REPO, botLogin: BOT, onResult: (r) => heard.push(r) }), (err) => err === error);
    // The merge was reported before the error, so the log says it happened.
    assert.deepEqual(heard, [{ number: 12, action: "merged", reason: "reverify" }]);
  }
});

test("the branch name is escaped in the delete path, so it can only name its own ref", async () => {
  const ref = "claude/reverify-x#y/%2e%2e/%2e%2e/main";
  const { api, calls } = fakeGitHub({ prs: [botPr(12, ref, SHA12)], files: TWO_PRS.files, runs: TWO_PRS.runs });
  await mergeBot({ api, repo: REPO, botLogin: BOT });
  assert.equal(calls.at(-1), `DELETE /repos/${REPO}/git/refs/heads/claude/reverify-x%23y/%252e%252e/%252e%252e/main`);
});

test("every page of open PRs, files and check runs is read", async () => {
  const owner = (number) => ({ ...botPr(number, `claude/owner-${number}`, "3".repeat(40)), user: { login: "sombreserotonin" } });
  const records = Array.from({ length: 100 }, (_, n) => ({ filename: `data/devices/acme/acme-${n}.yaml`, status: "modified" }));
  const sha = "4".repeat(40);
  // 100 PRs fill the first page, so the bot's PR is on the second, and its 101st file, outside the allowlist, too.
  const prs = fakeGitHub({
    prs: [...Array.from({ length: 100 }, (_, n) => owner(n + 1)), botPr(101, "claude/reverify-2026-12-21-9", sha)],
    files: { 101: [...records, { filename: ".github/workflows/evil.yml", status: "modified" }] },
    runs: { [sha]: passingRuns(sha) },
  });
  const results = await mergeBot({ api: prs.api, repo: REPO, botLogin: BOT });
  assert.equal(results.length, 101);
  assert.deepEqual(results.at(-1), { number: 101, action: "skipped", reason: ".github/workflows/evil.yml (modified) not allowed in a reverify PR" });
  assert.ok(prs.calls.includes(`GET /repos/${REPO}/pulls?state=open&per_page=100&page=2`));
  assert.ok(prs.calls.includes(`GET /repos/${REPO}/pulls/101/files?per_page=100&page=2`));
  assert.ok(!prs.calls.some((call) => call.includes("page=3")));
  // A newer failed data-gate on the second page of check runs holds the PR.
  const others = Array.from({ length: 97 }, (_, n) => run(`job-${n}`, { id: 10 + n, head_sha: sha }));
  const failed = run("data-gate", { id: 500, head_sha: sha, started_at: "2026-12-21T15:00:00Z", conclusion: "failure" });
  const checks = fakeGitHub({ prs: [botPr(102, "claude/reverify-2026-12-22-10", sha)], files: { 102: records.slice(0, 1) }, runs: { [sha]: [...passingRuns(sha), ...others, failed] } });
  assert.deepEqual(await mergeBot({ api: checks.api, repo: REPO, botLogin: BOT }), [{ number: 102, action: "skipped", reason: "check data-gate not passed" }]);
  assert.ok(checks.calls.includes(`GET /repos/${REPO}/commits/${sha}/check-runs?per_page=100&filter=all&page=2`));
});

test("githubApi sends the token, GitHub's media type, the API version and PatchlifeBot's user agent, and throws with the status", async () => {
  const requests = [];
  const replies = [
    new Response(JSON.stringify([{ number: 1 }]), { status: 200 }),
    new Response(null, { status: 204 }),
    new Response(JSON.stringify({ message: "Head branch was modified." }), { status: 409 }),
    new Response("<html>Bad gateway</html>", { status: 502 }),
  ];
  const api = githubApi("t0ken", async (url, init) => (requests.push({ url, init }), replies.shift()));
  assert.deepEqual(await api("GET", "/repos/o/r/pulls?state=open"), [{ number: 1 }]);
  assert.equal(await api("PUT", "/repos/o/r/pulls/1/merge", { merge_method: "squash", sha: SHA }), null);
  await assert.rejects(api("PUT", "/x", {}), (err) => err.status === 409 && err.message === "PUT /x: HTTP 409 Head branch was modified.");
  await assert.rejects(api("GET", "/y"), (err) => err.status === 502 && err.message === "GET /y: HTTP 502");
  const [get, put] = requests;
  assert.equal(get.url, "https://api.github.com/repos/o/r/pulls?state=open");
  assert.equal(get.init.method, "GET");
  assert.deepEqual(get.init.headers, { Authorization: "Bearer t0ken", Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": USER_AGENT });
  assert.equal(get.init.body, undefined);
  assert.ok(get.init.signal instanceof AbortSignal, "each request has a timeout");
  assert.equal(put.init.method, "PUT");
  assert.equal(put.init.headers["Content-Type"], "application/json");
  assert.equal(put.init.body, JSON.stringify({ merge_method: "squash", sha: SHA }));
});

// Runs the CLI with only the given environment, its fetch replaced by a fake GitHub answering from routes.
function cli(args, env, routes = {}) {
  return spawnSync(process.execPath, ["--import", FAKE_FETCH, SCRIPT, ...args], { encoding: "utf8", env: { PATH: process.env.PATH, FAKE_GITHUB: JSON.stringify(routes), ...env } });
}
const ENV = { GH_TOKEN: "t0ken", GITHUB_REPOSITORY: REPO, BOT_LOGIN: BOT };

test("the CLI exits 2 without its settings or with a mistyped flag, so it never runs half-configured", () => {
  const none = cli([], {});
  assert.equal(none.status, 2);
  assert.match(none.stderr, /^Missing environment variable\(s\): GH_TOKEN, GITHUB_REPOSITORY, BOT_LOGIN$/m);
  for (const name of Object.keys(ENV)) {
    const one = cli([], { ...ENV, [name]: "" });
    assert.equal(one.status, 2, name);
    assert.match(one.stderr, new RegExp(`^Missing environment variable\\(s\\): ${name}$`, "m"));
  }
  for (const [args, env, message] of [
    [["--dryrun"], ENV, /--dryrun/],
    [["now"], ENV, /'now'/],
    [[], { ...ENV, GITHUB_REPOSITORY: "Patchlife" }, /GITHUB_REPOSITORY must be owner\/name/],
    [[], { ...ENV, GITHUB_REPOSITORY: "o/r?x=1" }, /GITHUB_REPOSITORY must be owner\/name/],
    [[], { ...ENV, BOT_LOGIN: "sombreserotonin" }, /BOT_LOGIN must be the App's login/],
  ]) {
    const bad = cli(args, env);
    assert.equal(bad.status, 2, JSON.stringify([args, env]));
    assert.match(bad.stderr, message);
  }
});

test("the CLI prints one line per PR, and exits 1 when a GitHub call fails, after reporting what it merged", () => {
  const api = `https://api.github.com/repos/${REPO}`;
  // #12 passes; #13, a measures PR, has no build run yet.
  const routes = {
    [`GET ${api}/pulls?state=open&per_page=100&page=1`]: [200, [botPr(12, "claude/reverify-2026-12-21-123", SHA12), botPr(13, "claude/measures-2026-12", SHA13)]],
    [`GET ${api}/pulls/12/files?per_page=100&page=1`]: [200, [{ filename: "data/sources/page-hashes.json", status: "modified" }]],
    [`GET ${api}/commits/${SHA12}/check-runs?per_page=100&filter=all&page=1`]: [200, { total_count: 3, check_runs: passingRuns(SHA12) }],
    [`GET ${api}/pulls/13/files?per_page=100&page=1`]: [200, [{ filename: "docs/MEASURES.md", status: "modified" }]],
    [`GET ${api}/commits/${SHA13}/check-runs?per_page=100&filter=all&page=1`]: [200, { total_count: 2, check_runs: passingRuns(SHA13).slice(0, 2) }],
    [`PUT ${api}/pulls/12/merge`]: [200, { merged: true }],
    [`DELETE ${api}/git/refs/heads/claude/reverify-2026-12-21-123`]: [204],
  };
  const ok = cli([], ENV, routes);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.stdout, "#12: merged\n#13: skipped (check build missing)\n");
  // A dry run never calls the merge, which would fail here.
  const dry = cli(["--dry-run"], ENV, { ...routes, [`PUT ${api}/pulls/12/merge`]: [500, { message: "merge called" }] });
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(dry.stdout, "#12: would merge\n#13: skipped (check build missing)\n");
  const moved = cli([], ENV, { ...routes, [`PUT ${api}/pulls/12/merge`]: [409, { message: "Head branch was modified. Review and try the merge again." }] });
  assert.equal(moved.status, 1);
  assert.equal(moved.stdout, "");
  assert.equal(moved.stderr, `PUT /repos/${REPO}/pulls/12/merge: HTTP 409 Head branch was modified. Review and try the merge again.\n`);
  const undeleted = cli([], ENV, { ...routes, [`DELETE ${api}/git/refs/heads/claude/reverify-2026-12-21-123`]: [403, { message: "Resource not accessible by integration" }] });
  assert.equal(undeleted.status, 1);
  assert.equal(undeleted.stdout, "#12: merged\n");
  assert.match(undeleted.stderr, /^DELETE \/repos\/sombreserotonin\/Patchlife\/git\/refs\/heads\/claude\/reverify-2026-12-21-123: HTTP 403 /);
  for (const result of [ok, dry, moved, undeleted]) assert.doesNotMatch(result.stdout + result.stderr, /t0ken/);
});

test("the CLI escapes control characters, so a file name can't start a line the runner reads as a workflow command", () => {
  const api = `https://api.github.com/repos/${REPO}`;
  const result = cli([], ENV, {
    [`GET ${api}/pulls?state=open&per_page=100&page=1`]: [200, [botPr(14, "claude/reverify-2026-12-21-7", SHA12)]],
    [`GET ${api}/pulls/14/files?per_page=100&page=1`]: [200, [{ filename: "data/x\n::error::injected", status: "modified" }]],
    [`GET ${api}/commits/${SHA12}/check-runs?per_page=100&filter=all&page=1`]: [200, { total_count: 3, check_runs: passingRuns(SHA12) }],
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "#14: skipped (data/x\\x0a::error::injected (modified) not allowed in a reverify PR)\n");
});
