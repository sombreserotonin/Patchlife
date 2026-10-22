import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite, loadRecords } from "../scripts/build-site.mjs";
import { USER_AGENT } from "../scripts/polite-fetch.mjs";
import { checkState, gatherState, gitStaleSince, highlightLink, issueBody, pickSample, publish, siteDate, summaryText } from "../scripts/watchdog.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/watchdog.mjs", import.meta.url));
const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));
// Sunday 15 Nov 2026 at the housekeeping run's time. Every function takes `now`, so nothing reads the clock.
const NOW = Date.parse("2026-11-15T21:23:00Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ago = (hours, minutes = 0) => new Date(NOW - hours * HOUR - minutes * MINUTE).toISOString();
const R = "/repos/o/r";
const RUNS = "https://github.com/o/r/actions/runs";

// A fake GitHub API. routes: "METHOD /path?query" -> a reply, or an Error to throw; anything else is a 404, as on GitHub.
function fakeApi(routes) {
  const calls = [];
  const api = async (method, path, body) => {
    calls.push({ method, path, body });
    const reply = routes[`${method} ${path}`];
    if (reply instanceof Error) throw reply;
    if (reply === undefined) throw Object.assign(new Error(`${method} ${path}: HTTP 404`), { status: 404 });
    return structuredClone(reply);
  };
  return { api, calls, paths: () => calls.map((call) => `${call.method} ${call.path}`) };
}
const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { status });

// ---------- checkState ----------

const step = (name, conclusion, completed_at) => ({ name, conclusion, completed_at });
const pushed = (completed_at, conclusion = "success") => step("Push verification changes", conclusion, completed_at);
const run = (id, steps, annotations) => ({ url: `${RUNS}/${id}`, steps, ...(annotations && { annotations }) });
const notChecked = (ids) => [{ title: "Records not checked", message: ids }];

// A repository with nothing wrong: last night's re-verify pushed, Pages deployed this morning, the site is current.
function healthy() {
  return {
    at: new Date(NOW).toISOString(),
    repo: "o/r",
    errors: [],
    workflows: [{ name: "Pages", path: ".github/workflows/pages.yml", state: "active" }],
    reverifyRuns: [run(3, [pushed(ago(8, 30))], []), run(2, [pushed(ago(32, 30))], []), run(1, [pushed(ago(56, 30))], []), run(0, [pushed(ago(80, 30))])],
    pagesRuns: [{ event: "schedule", updated_at: ago(21), url: `${RUNS}/9` }],
    cancelled: [],
    branches: [],
    records: { total: 100, stale: [] },
    issues: [{ number: 27, pull: false, created_at: "2026-10-21T11:28:37Z", labels: [] }],
    pulls: [],
    site: { url: "https://patchlife.tech/", status: 200, date: "2026-11-15" },
    renewals: [
      { name: "patchlife.tech", due: "2027-10-01", note: "" },
      { name: "Cloudflare plan", due: null, note: "Free" },
    ],
  };
}
const messages = (changes) => checkState({ ...healthy(), ...changes }, NOW).map(({ check, message }) => `${check}: ${message}`);

test("a healthy repository has no problems, and a check whose read failed is skipped", () => {
  assert.deepEqual(checkState(healthy(), NOW), []);
  assert.deepEqual(checkState({ at: new Date(NOW).toISOString(), errors: [] }, NOW), []);
});

test("workflows: any that isn't active is reported, but never a deleted one", () => {
  const workflow = (name, file, state) => ({ name, path: `.github/workflows/${file}`, state });
  assert.deepEqual(
    messages({
      workflows: [
        workflow("Pages", "pages.yml", "active"),
        workflow("Re-verify evidence", "reverify.yml", "disabled_inactivity"),
        workflow("CI", "ci.yml", "disabled_manually"),
        workflow("Claude", "claude.yml", "deleted"),
      ],
    }),
    [
      "Workflows: Re-verify evidence (.github/workflows/reverify.yml) is switched off (disabled_inactivity). Re-enable it in the Actions tab.",
      "Workflows: CI (.github/workflows/ci.yml) is switched off (disabled_manually). Re-enable it in the Actions tab.",
    ],
  );
});

test("re-verify: the last run through the push step must be under 48 hours old", () => {
  // The newest run stopped before the push; other steps that passed don't count.
  const lastPushed = (hours, minutes) =>
    messages({
      reverifyRuns: [run(3, [step("Run npm test", "success", ago(1)), pushed(ago(1), "skipped")]), run(2, [pushed(ago(hours, minutes))]), run(1, [pushed(ago(100))])],
    });
  assert.deepEqual(lastPushed(47, 59), []);
  assert.deepEqual(lastPushed(48), [
    `Re-verify: The last re-verify run to get through "Push verification changes" finished 48 hours ago (2026-11-13 21:23 UTC). Latest run: ${RUNS}/3`,
  ]);
  assert.deepEqual(messages({ reverifyRuns: [run(2, [pushed(ago(5), "failure")]), run(1, [step("Push verification change", "success", ago(5))])] }), [
    `Re-verify: No re-verify run got through "Push verification changes" in the last 2 completed runs. Latest run: ${RUNS}/2`,
  ]);
  assert.deepEqual(messages({ reverifyRuns: [] }), ["Re-verify: No re-verify run has completed."]);
});

test("pages: the last deploy by push, schedule or dispatch must be under 36 hours old", () => {
  const deploy = (event, updated_at) => ({ event, updated_at, url: `${RUNS}/9` });
  // A pull request run only builds, so it never counts as a deploy.
  const lastDeploy = (hours, minutes) =>
    messages({ pagesRuns: [deploy("push", ago(60)), deploy("workflow_dispatch", ago(hours, minutes)), deploy("schedule", ago(70)), deploy("pull_request", ago(1))] });
  assert.deepEqual(lastDeploy(35, 59), []);
  assert.deepEqual(lastDeploy(36), ["Pages: The last Pages deploy finished 36 hours ago (2026-11-14 09:23 UTC)."]);
  assert.deepEqual(messages({ pagesRuns: [deploy("pull_request", ago(1))] }), ["Pages: No successful Pages deploy found."]);
});

test("cancelled runs: any crawl-group run cancelled in the last 48 hours", () => {
  assert.deepEqual(
    messages({
      cancelled: [
        { workflow: "reverify.yml", updated_at: ago(48), url: `${RUNS}/5` },
        { workflow: "probe-hosts.yml", updated_at: ago(48, 1), url: `${RUNS}/4` },
      ],
    }),
    [`Cancelled runs: A reverify.yml run was cancelled (2026-11-13 21:23 UTC): ${RUNS}/5`],
  );
});

test("re-verify branches: one over 36 hours old, or one whose PRs were all closed without merging", () => {
  const branch = (name, [hours, minutes], prs = []) => ({ name, committed_at: ago(hours, minutes), prs });
  const pr = (number, state, merged_at = null) => ({ number, state, merged_at });
  assert.deepEqual(
    messages({
      branches: [
        branch("claude/reverify-2026-11-14-1", [36, 0], [pr(7, "open")]),
        branch("claude/reverify-2026-11-13-2", [36, 1]),
        branch("claude/reverify-2026-11-15-3", [2, 0], [pr(8, "closed")]),
        branch("claude/reverify-2026-11-15-4", [2, 0], [pr(9, "closed", ago(1))]),
        branch("claude/reverify-2026-11-15-5", [2, 0], [pr(10, "closed"), pr(11, "closed")]),
        branch("claude/reverify-2026-11-15-6", [2, 0], [pr(12, "closed"), pr(13, "open")]),
      ],
    }),
    [
      "Re-verify branches: claude/reverify-2026-11-13-2 is 36 hours old and unmerged, so re-verification stops at its guard.",
      "Re-verify branches: claude/reverify-2026-11-15-3: its PR #8 was closed without merging. Delete the branch, or reopen the PR.",
      "Re-verify branches: claude/reverify-2026-11-15-5: its PRs #10, #11 were closed without merging. Delete the branch, or reopen the PR.",
    ],
  );
});

test("unchecked records: the ids listed under Records not checked on each of the last 3 runs", () => {
  const nights = (a, b, c) => [
    run(4, [pushed(ago(8))], [{ title: "", message: "a notice" }, ...notChecked(a)]),
    run(3, [pushed(ago(32))], [{ title: "Other", message: "acme-2" }, ...notChecked(b)]),
    run(2, [pushed(ago(56))], notChecked(c)),
    run(1, [pushed(ago(80))]),
  ];
  // Each pair of nights shares more than all three do, and the "Other" annotation would add acme-2 to the second.
  assert.deepEqual(messages({ reverifyRuns: nights("acme-5 acme-3 acme-1 acme-2 ", "acme-1 acme-3 acme-4 acme-5", "acme-2 acme-1 acme-4 acme-5") }), [
    "Unchecked records: Not checked on each of the last 3 re-verify runs: acme-1 acme-5",
  ]);
  assert.deepEqual(messages({ reverifyRuns: nights("acme-1", "", "acme-1") }), []);
  assert.deepEqual(messages({ reverifyRuns: nights("acme-2", "acme-1", "acme-2") }), []);
  assert.deepEqual(messages({ reverifyRuns: nights("acme-1", "acme-1", "acme-1").slice(0, 2) }), []);
});

test("data health: records stale for over 14 days, grouped by the day they went stale", () => {
  const stale = [
    { id: "acme-1", since: "2026-11-01" },
    { id: "acme-3", since: "2026-10-31" },
    { id: "acme-2", since: "2026-10-31" },
    { id: "acme-4", since: "2026-09-30" },
    { id: "acme-5", since: null },
  ];
  assert.deepEqual(messages({ records: { total: 1000, stale } }), [
    "Data health: 1 stale record with no date in git history (is the checkout shallow?): acme-5",
    "Data health: 1 record stale since 2026-09-30, 46 days ago: acme-4",
    "Data health: 2 records stale since 2026-10-31, 15 days ago: acme-3 acme-2",
  ]);
});

test("data health: stale records at 2% or more of all records", () => {
  const stale = (n) => Array.from({ length: n }, (_, i) => ({ id: `acme-${i}`, since: "2026-11-14" }));
  assert.deepEqual(messages({ records: { total: 51, stale: stale(1) } }), []);
  assert.deepEqual(messages({ records: { total: 50, stale: stale(1) } }), ["Data health: 2.0% of records are stale (1 of 50). The limit is under 2%."]);
  assert.deepEqual(messages({ records: { total: 101, stale: stale(2) } }), []);
  assert.deepEqual(messages({ records: { total: 100, stale: stale(2) } }), ["Data health: 2.0% of records are stale (2 of 100). The limit is under 2%."]);
  assert.deepEqual(messages({ records: { total: 0, stale: [] } }), []);
});

test("stale dates come from the commit that marked the record stale, and a shallow clone gives none", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "patchlife-watchdog-git-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (args, env = {}) => execFileSync("git", args, { cwd: dir, encoding: "utf8", env: { ...process.env, ...env } });
  const file = "data/devices/acme/acme-1.yaml";
  // Author dates differ from commit dates, as after a rebase or a squash merge; the commit date counts.
  const commit = (status, notes, day) => {
    writeFileSync(join(dir, file), `id: acme-1\nverification:\n  status: ${status}\nnotes: ${notes}\n`);
    git(["add", "."]);
    git(["-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-qm", status], {
      GIT_AUTHOR_DATE: "2026-09-01T12:00:00Z",
      GIT_COMMITTER_DATE: `${day}T12:00:00Z`,
    });
  };
  git(["init", "-q"]);
  mkdirSync(join(dir, "data/devices/acme"), { recursive: true });
  // Stale, fixed, then stale again: the age counts from the second time.
  commit("verified", "null", "2026-10-01");
  commit("stale", "null", "2026-10-05");
  commit("verified", "null", "2026-10-10");
  commit("stale", "null", "2026-10-20");
  commit("stale", "a note", "2026-11-02");
  const staleSince = gitStaleSince(dir);
  assert.equal(staleSince(file), "2026-10-20");
  assert.equal(staleSince("data/devices/acme/acme-9.yaml"), null);
  const shallow = join(dir, "shallow");
  git(["clone", "-q", "--depth", "1", `file://${dir}`, shallow]);
  assert.equal(gitStaleSince(shallow)(file), null);
});

test("data health: an open needs-human issue or PR created over 7 days ago", () => {
  const item = (number, [days, minutes], labels, pull = false) => ({ number, pull, created_at: ago(24 * days, minutes), labels });
  assert.deepEqual(
    messages({
      issues: [
        item(41, [7, 0], ["needs-human"]),
        item(40, [7, 1], ["bug", "needs-human"]),
        item(39, [30, 0], ["planned", "needs-human-merge"]),
        item(38, [9, 0], ["needs-human"], true),
      ],
    }),
    ["Data health: #40 (needs-human) has waited 7 days, since 2026-11-08.", "Data health: #38 (needs-human) has waited 9 days, since 2026-11-06."],
  );
});

test("candidate PR: a claude/data-auto- PR open for over 14 days", () => {
  const pr = (number, head, [days, minutes]) => ({ number, head, created_at: ago(24 * days, minutes), labels: [] });
  assert.deepEqual(
    messages({ pulls: [pr(50, "claude/data-auto-2026-11-01", [14, 0]), pr(51, "claude/data-auto-2026-10-31", [14, 1]), pr(52, "claude/data-other", [30, 0])] }),
    ["Candidate PR: #51 (claude/data-auto-2026-10-31) has been open 14 days, so the weekly data refresh keeps skipping."],
  );
});

test("the site must answer 200 with a Status as at date under 2 days old", () => {
  const site = (fields) => messages({ site: { url: "https://patchlife.tech/", status: 200, date: "2026-11-15", ...fields } });
  assert.deepEqual(site({ date: "2026-11-14" }), []);
  assert.deepEqual(site({ date: "2026-11-13" }), ['Site: https://patchlife.tech/ says "Status as at 2026-11-13", 2 days ago.']);
  assert.deepEqual(site({ status: 503, date: null }), ["Site: https://patchlife.tech/ answered HTTP 503."]);
  assert.deepEqual(site({ status: 404, date: "2026-11-15" }), ["Site: https://patchlife.tech/ answered HTTP 404."]);
  assert.deepEqual(site({ date: null }), ['Site: https://patchlife.tech/ has no "Status as at" date in its footer.']);
  assert.deepEqual(site({ status: undefined, date: undefined, error: "getaddrinfo ENOTFOUND patchlife.tech" }), [
    "Site: https://patchlife.tech/ could not be reached: getaddrinfo ENOTFOUND patchlife.tech",
  ]);
});

test("renewals: due within 60 days, within 14 days, or past due", () => {
  const renewal = (days) => messages({ renewals: [{ name: "patchlife.tech", due: new Date(NOW + days * DAY).toISOString().slice(0, 10), note: "" }] });
  assert.deepEqual(renewal(61), []);
  assert.deepEqual(renewal(60), ["Renewals: patchlife.tech is due on 2027-01-14, in 60 days (within 60 days)."]);
  assert.deepEqual(renewal(15), ["Renewals: patchlife.tech is due on 2026-11-30, in 15 days (within 60 days)."]);
  assert.deepEqual(renewal(14), ["Renewals: patchlife.tech is due on 2026-11-29, in 14 days (within 14 days)."]);
  assert.deepEqual(renewal(1), ["Renewals: patchlife.tech is due on 2026-11-16, in 1 day (within 14 days)."]);
  assert.deepEqual(renewal(0), ["Renewals: patchlife.tech is due on 2026-11-15, today (within 14 days)."]);
  assert.deepEqual(renewal(-1), ["Renewals: patchlife.tech was due on 2026-11-14, 1 day ago."]);
  assert.deepEqual(messages({ renewals: [{ name: "Unraid licence", due: null, note: "" }, { name: "Node 24", due: "2028-02-30", note: "" }] }), [
    'Renewals: Node 24: the due date "2028-02-30" is not a YYYY-MM-DD date.',
  ]);
});

// ---------- gatherState ----------

const job = (id, steps) => ({ id, check_run_url: `https://api.github.com/repos/o/r/check-runs/${id}`, steps });
const ghRun = (id, fields = {}) => ({ id, html_url: `${RUNS}/${id}`, ...fields });
const record = (id, status) => ({ id, brand_slug: "acme", verification: { status } });
const FOOTER = (date) => `<footer>\n<p>Status as at <time datetime="${date}">${date}</time>.</p>\n<p>Support information</p>\n</footer>`;

test("gatherState reads every check's data from the API, the site, git and the records", async () => {
  const issues = Array.from({ length: 100 }, (_, i) => ({ number: i + 1, created_at: ago(1), labels: [] }));
  const { api, paths } = fakeApi({
    [`GET ${R}/actions/workflows?per_page=100`]: {
      total_count: 2,
      workflows: [
        { id: 1, name: "Pages", path: ".github/workflows/pages.yml", state: "active" },
        { id: 2, name: "Re-verify evidence", path: ".github/workflows/reverify.yml", state: "disabled_inactivity" },
      ],
    },
    [`GET ${R}/actions/workflows/reverify.yml/runs?status=completed&per_page=10`]: { total_count: 4, workflow_runs: [41, 31, 21, 11].map((id) => ghRun(id)) },
    [`GET ${R}/actions/runs/41/jobs`]: { total_count: 1, jobs: [job(410, [step("Run npm test", "success", ago(8)), pushed(ago(8), "skipped")])] },
    [`GET ${R}/actions/runs/31/jobs`]: { total_count: 1, jobs: [job(310, [pushed(ago(32))])] },
    [`GET ${R}/actions/runs/21/jobs`]: { total_count: 1, jobs: [job(210, [pushed(ago(56))])] },
    [`GET ${R}/actions/runs/11/jobs`]: { total_count: 1, jobs: [job(110, [pushed(ago(80))])] },
    [`GET ${R}/check-runs/410/annotations`]: [{ title: "Records not checked", message: "acme-1 acme-3 ", annotation_level: "warning" }, { title: "", message: "a notice" }],
    [`GET ${R}/check-runs/310/annotations`]: notChecked("acme-3 acme-1"),
    [`GET ${R}/check-runs/210/annotations`]: notChecked("acme-1"),
    [`GET ${R}/actions/workflows/pages.yml/runs?event=push&status=success&per_page=1`]: { workflow_runs: [ghRun(90, { event: "push", updated_at: ago(40) })] },
    [`GET ${R}/actions/workflows/pages.yml/runs?event=schedule&status=success&per_page=1`]: { workflow_runs: [] },
    [`GET ${R}/actions/workflows/pages.yml/runs?event=workflow_dispatch&status=success&per_page=1`]: { workflow_runs: [ghRun(91, { event: "workflow_dispatch", updated_at: ago(37) })] },
    [`GET ${R}/actions/workflows/reverify.yml/runs?status=cancelled&per_page=20`]: { workflow_runs: [ghRun(40, { updated_at: ago(5) })] },
    [`GET ${R}/actions/workflows/probe-hosts.yml/runs?status=cancelled&per_page=20`]: { workflow_runs: [] },
    [`GET ${R}/git/matching-refs/heads/claude/reverify-`]: [{ ref: "refs/heads/claude/reverify-2026-11-13-77", object: { sha: "abc123", type: "commit" } }],
    [`GET ${R}/commits/abc123`]: { sha: "abc123", commit: { committer: { date: ago(50) } } },
    [`GET ${R}/pulls?state=all&head=o%3Aclaude%2Freverify-2026-11-13-77&per_page=100`]: [],
    [`GET ${R}/issues?state=open&per_page=100&page=1`]: issues,
    [`GET ${R}/issues?state=open&per_page=100&page=2`]: [
      { number: 102, created_at: ago(24 * 8), labels: [{ name: "needs-human" }] },
      { number: 103, pull_request: { url: "x" }, created_at: ago(1), labels: [{ name: "needs-human-merge" }] },
    ],
    [`GET ${R}/pulls?state=open&per_page=100&page=1`]: [
      { number: 103, head: { ref: "claude/p2" }, created_at: ago(1), labels: [{ name: "needs-human-merge" }] },
      { number: 104, head: { ref: "claude/data-auto-2026-10-25" }, created_at: ago(24 * 20), labels: [] },
    ],
  });
  const fetched = [];
  const fetchSite = async (url) => {
    fetched.push(url);
    // The body's own "Status as at" comes first; only the footer's counts.
    return { status: 200, text: `<main><p>Status as at <time datetime="2026-11-15">15 Nov</time>.</p></main>\n${FOOTER("2026-11-12")}` };
  };
  const asked = [];
  const staleSince = (file) => {
    asked.push(file);
    return file.endsWith("acme-2.yaml") ? "2026-10-01" : "";
  };
  const renewals = [{ name: "patchlife.tech", due: "2026-12-01", note: "Registrar" }];
  const devices = [record("acme-1", "verified"), record("acme-2", "stale"), record("acme-3", "stale")];
  const state = await gatherState({ api, fetchSite, now: NOW, repo: "o/r", siteUrl: "https://patchlife.tech", devices, renewals, staleSince });

  assert.deepEqual(paths(), [
    `GET ${R}/actions/workflows?per_page=100`,
    `GET ${R}/actions/workflows/reverify.yml/runs?status=completed&per_page=10`,
    `GET ${R}/actions/runs/41/jobs`,
    `GET ${R}/check-runs/410/annotations`,
    `GET ${R}/actions/runs/31/jobs`,
    `GET ${R}/check-runs/310/annotations`,
    `GET ${R}/actions/runs/21/jobs`,
    `GET ${R}/check-runs/210/annotations`,
    `GET ${R}/actions/runs/11/jobs`,
    `GET ${R}/actions/workflows/pages.yml/runs?event=push&status=success&per_page=1`,
    `GET ${R}/actions/workflows/pages.yml/runs?event=schedule&status=success&per_page=1`,
    `GET ${R}/actions/workflows/pages.yml/runs?event=workflow_dispatch&status=success&per_page=1`,
    `GET ${R}/actions/workflows/reverify.yml/runs?status=cancelled&per_page=20`,
    `GET ${R}/actions/workflows/data-refresh.yml/runs?status=cancelled&per_page=20`,
    `GET ${R}/actions/workflows/probe-hosts.yml/runs?status=cancelled&per_page=20`,
    `GET ${R}/actions/workflows/owner-tools.yml/runs?status=cancelled&per_page=20`,
    `GET ${R}/git/matching-refs/heads/claude/reverify-`,
    `GET ${R}/commits/abc123`,
    `GET ${R}/pulls?state=all&head=o%3Aclaude%2Freverify-2026-11-13-77&per_page=100`,
    `GET ${R}/issues?state=open&per_page=100&page=1`,
    `GET ${R}/issues?state=open&per_page=100&page=2`,
    `GET ${R}/pulls?state=open&per_page=100&page=1`,
  ]);
  assert.deepEqual(fetched, ["https://patchlife.tech/"]);
  assert.deepEqual(asked, ["data/devices/acme/acme-2.yaml", "data/devices/acme/acme-3.yaml"]);
  // data-refresh.yml and owner-tools.yml don't exist yet: their 404s are not errors.
  assert.deepEqual(state.errors, []);
  assert.equal(state.at, "2026-11-15T21:23:00.000Z");
  assert.deepEqual(state.reverifyRuns[0], {
    url: `${RUNS}/41`,
    steps: [step("Run npm test", "success", ago(8)), pushed(ago(8), "skipped")],
    annotations: [{ title: "Records not checked", message: "acme-1 acme-3 " }, { title: "", message: "a notice" }],
  });
  assert.deepEqual(state.reverifyRuns[3], { url: `${RUNS}/11`, steps: [pushed(ago(80))] });
  assert.deepEqual(state.records, { total: 3, stale: [{ id: "acme-2", since: "2026-10-01" }, { id: "acme-3", since: null }] });
  assert.equal(state.issues.length, 102);
  assert.deepEqual(state.issues.slice(-2), [
    { number: 102, pull: false, created_at: ago(24 * 8), labels: ["needs-human"] },
    { number: 103, pull: true, created_at: ago(1), labels: ["needs-human-merge"] },
  ]);
  assert.deepEqual(state.site, { url: "https://patchlife.tech/", status: 200, date: "2026-11-12" });
  assert.equal(state.renewals, renewals);

  assert.deepEqual(
    checkState(state, NOW).map(({ check, message }) => `${check}: ${message}`),
    [
      "Workflows: Re-verify evidence (.github/workflows/reverify.yml) is switched off (disabled_inactivity). Re-enable it in the Actions tab.",
      "Pages: The last Pages deploy finished 37 hours ago (2026-11-14 08:23 UTC).",
      `Cancelled runs: A reverify.yml run was cancelled (2026-11-15 16:23 UTC): ${RUNS}/40`,
      "Re-verify branches: claude/reverify-2026-11-13-77 is 50 hours old and unmerged, so re-verification stops at its guard.",
      "Unchecked records: Not checked on each of the last 3 re-verify runs: acme-1",
      "Data health: 1 stale record with no date in git history (is the checkout shallow?): acme-3",
      "Data health: 1 record stale since 2026-10-01, 45 days ago: acme-2",
      "Data health: 66.7% of records are stale (2 of 3). The limit is under 2%.",
      "Data health: #102 (needs-human) has waited 8 days, since 2026-11-07.",
      "Candidate PR: #104 (claude/data-auto-2026-10-25) has been open 20 days, so the weekly data refresh keeps skipping.",
      'Site: https://patchlife.tech/ says "Status as at 2026-11-12", 3 days ago.',
      "Renewals: patchlife.tech is due on 2026-12-01, in 16 days (within 60 days).",
    ],
  );
});

test("a failed read is reported under its check, leaves nothing half-read, and the other reads still run", async () => {
  const { api } = fakeApi({
    [`GET ${R}/actions/workflows?per_page=100`]: httpError(500),
    [`GET ${R}/actions/workflows/reverify.yml/runs?status=completed&per_page=10`]: { workflow_runs: [ghRun(41), ghRun(31)] },
    [`GET ${R}/actions/runs/41/jobs`]: { jobs: [job(410, [pushed(ago(8))])] },
    [`GET ${R}/check-runs/410/annotations`]: [],
    [`GET ${R}/actions/runs/31/jobs`]: httpError(502),
    [`GET ${R}/git/matching-refs/heads/claude/reverify-`]: [],
    [`GET ${R}/issues?state=open&per_page=100&page=1`]: [],
    [`GET ${R}/pulls?state=open&per_page=100&page=1`]: [],
  });
  const fetchSite = async () => {
    throw new TypeError("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND patchlife.tech") });
  };
  const staleSince = () => {
    throw new Error("not a git repository");
  };
  const state = await gatherState({ api, fetchSite, now: NOW, repo: "o/r", devices: [record("acme-2", "stale")], renewals: [], staleSince });
  assert.deepEqual(state.errors, [
    { check: "Workflows", message: "Could not read the workflow list: HTTP 500" },
    { check: "Re-verify", message: "Could not read the re-verify runs: HTTP 502" },
    { check: "Pages", message: `Could not read the Pages runs: GET ${R}/actions/workflows/pages.yml/runs?event=push&status=success&per_page=1: HTTP 404` },
    { check: "Data health", message: "Could not read when the stale records went stale: not a git repository" },
  ]);
  assert.equal(state.workflows, undefined);
  assert.equal(state.reverifyRuns, undefined);
  assert.equal(state.records, undefined);
  // Every cancelled-runs lookup was a 404, so no crawl workflow exists yet: nothing to report.
  assert.deepEqual(state.cancelled, []);
  assert.deepEqual(state.site, { url: "https://patchlife.tech/", error: "getaddrinfo ENOTFOUND patchlife.tech" });
  assert.deepEqual(
    checkState(state, NOW).map(({ check }) => check),
    ["Workflows", "Re-verify", "Pages", "Data health", "Site"],
  );
});

test("cancelled runs: a workflow that doesn't exist yet (404) is skipped quietly, but another error is reported", async () => {
  const cancelled = (file) => `GET ${R}/actions/workflows/${file}/runs?status=cancelled&per_page=20`;
  const gather = async (routes) =>
    gatherState({ api: fakeApi(routes).api, fetchSite: async () => ({ status: 200, text: "" }), now: NOW, repo: "o/r", devices: [], renewals: [], staleSince: () => null });
  const found = await gather({ [cancelled("reverify.yml")]: { workflow_runs: [ghRun(5, { updated_at: ago(1) })] }, [cancelled("probe-hosts.yml")]: { workflow_runs: [] } });
  assert.deepEqual(found.cancelled, [{ workflow: "reverify.yml", updated_at: ago(1), url: `${RUNS}/5` }]);
  assert.ok(!found.errors.some((error) => error.check === "Cancelled runs"));
  const failed = await gather({ [cancelled("probe-hosts.yml")]: httpError(500) });
  assert.equal(failed.cancelled, undefined);
  assert.deepEqual(
    failed.errors.filter((error) => error.check === "Cancelled runs"),
    [{ check: "Cancelled runs", message: "Could not read the cancelled runs: HTTP 500" }],
  );
});

test("siteDate reads the footer of a page build-site.mjs made, and nothing else", (t) => {
  const outDir = mkdtempSync(join(tmpdir(), "patchlife-watchdog-"));
  t.after(() => rmSync(outDir, { recursive: true, force: true }));
  buildSite({ records: loadRecords(`${FIXTURES}valid`), outDir, today: "2026-11-14" });
  assert.equal(siteDate(readFileSync(join(outDir, "index.html"), "utf8")), "2026-11-14");
  assert.equal(siteDate(FOOTER("2026-11-12")), "2026-11-12");
  assert.equal(siteDate("<footer><p>Status as at 14 Nov 2026.</p></footer>"), null);
  assert.equal(siteDate('<main>Status as at <time datetime="2026-11-14">14 Nov</time></main>'), null);
});

// ---------- The summary and the issue ----------

test("the spot-check sample is the same for the same date, whatever the record order", () => {
  const records = Array.from({ length: 40 }, (_, i) => ({ id: `acme-${i}`, evidence: [{ url: "https://a.test/p", quote: `Acme ${i} 2029` }] }));
  const ids = (list, seed) => pickSample(list, seed).map((r) => r.id);
  const picked = ids(records, "2026-11-15");
  // The five lowest sha256("2026-11-15\n<id>"), as `sha256sum` ranks them.
  assert.deepEqual(picked, ["acme-33", "acme-12", "acme-37", "acme-25", "acme-14"]);
  assert.deepEqual(ids([...records].reverse(), "2026-11-15"), picked);
  assert.deepEqual(ids(records, "2026-11-15"), picked);
  assert.notDeepEqual(ids(records, "2026-11-22"), picked);
  // Only a record whose first evidence item has a quote can get a highlight link.
  const unquoted = { id: "acme-x", evidence: [{ url: "https://a.test/p" }, { url: "https://a.test/q", quote: "Acme X" }] };
  assert.deepEqual(ids([unquoted, records[0]], "2026-11-15"), ["acme-0"]);
  assert.equal(pickSample(records, "2026-11-15", 3).length, 3);
});

test("a highlight link escapes the text directive's separators and Markdown's brackets", () => {
  assert.equal(
    highlightLink("https://support.ezviz.com/eol", "Camera CS-BC1-B3(4MP,W1) & more 2029/12/31"),
    "https://support.ezviz.com/eol#:~:text=Camera%20CS%2DBC1%2DB3%284MP%2CW1%29%20%26%20more%202029%2F12%2F31",
  );
  assert.equal(highlightLink("https://a.test/p#top", "Cam 1"), "https://a.test/p#top:~:text=Cam%201");
});

const MEASURES = [
  "Verified records                695",
  "Brands with verified records    5",
  "Share with a computable status  100% (695 of 695 verified)",
  "Stale records                   0",
];

test("the weekly summary is a fixed template", () => {
  const state = {
    at: new Date(NOW).toISOString(),
    site: { url: "https://patchlife.tech/", status: 200, date: "2026-11-15" },
    pulls: [
      { number: 31, head: "claude/p3", created_at: ago(30), labels: ["needs-human-merge"] },
      { number: 30, head: "claude/p2", created_at: ago(40), labels: ["planned", "needs-human-merge"] },
      { number: 32, head: "dependabot/npm_and_yarn/x", created_at: ago(2), labels: [] },
    ],
    issues: [
      { number: 102, pull: false, created_at: ago(24), labels: ["needs-human"] },
      { number: 99, pull: false, created_at: ago(24), labels: ["planned"] },
      { number: 110, pull: false, created_at: ago(24), labels: ["needs-human", "data-correction"] },
      { number: 27, pull: false, created_at: ago(24), labels: [] },
      { number: 31, pull: true, created_at: ago(30), labels: ["needs-human-merge"] },
    ],
  };
  const sample = [
    { id: "ezviz-cs-bc1", brand: "EZVIZ", model: "CS-BC1-B3(4MP,W1)", evidence: [{ url: "https://support.ezviz.com/eol", quote: "CS-BC1-B3(4MP,W1) Europe 2029/12/31" }] },
    { id: "acme-cam-1", brand: "Acme", model: "Cam_1 [Pro]", evidence: [{ url: "https://example.com/acme", quote: "Acme Cam 1 30 June 2029" }, { url: "https://example.com/b", quote: "other" }] },
  ];
  assert.equal(
    summaryText(state, MEASURES, sample),
    [
      "Weekly summary for 2026-11-15.",
      "",
      "PRs for you to merge (`needs-human-merge`): #30, #31.",
      "",
      "Open issues: 4.",
      "- data-correction: 1",
      "- needs-human: 2",
      "- planned: 1",
      "- no label: 1",
      "",
      "Measures, from `node scripts/data-report.mjs`:",
      "```",
      "Verified records                695",
      "Brands with verified records    5",
      "Share with a computable status  100% (695 of 695 verified)",
      "Stale records                   0",
      "```",
      "",
      "Spot check: compare each record with the highlighted words on the maker's page.",
      "- [EZVIZ CS-BC1-B3(4MP,W1)](https://patchlife.tech/devices/ezviz-cs-bc1/): [maker's page](https://support.ezviz.com/eol#:~:text=CS%2DBC1%2DB3%284MP%2CW1%29%20Europe%202029%2F12%2F31)",
      "- [Acme Cam\\_1 \\[Pro\\]](https://patchlife.tech/devices/acme-cam-1/): [maker's page](https://example.com/acme#:~:text=Acme%20Cam%201%2030%20June%202029)",
    ].join("\n"),
  );
  assert.match(summaryText({ ...state, pulls: [] }, MEASURES, sample), /^PRs for you to merge \(`needs-human-merge`\): none\.$/m);
  const unread = summaryText({ at: state.at }, MEASURES, []);
  assert.match(unread, /^PRs for you to merge: the watchdog could not read them\.$/m);
  assert.match(unread, /^Open issues: the watchdog could not read them\.$/m);
});

const PAGES = { check: "Pages", message: "The last Pages deploy finished 40 hours ago (2026-11-14 05:23 UTC)." };
const SITE = { check: "Site", message: "https://patchlife.tech/ answered HTTP 503." };

test("the issue body is a fixed template around the problems", () => {
  assert.equal(
    issueBody([PAGES, SITE], NOW),
    [
      "The watchdog found 2 problem(s) on its run at 2026-11-15 21:23 UTC.",
      "",
      "- **Pages:** The last Pages deploy finished 40 hours ago (2026-11-14 05:23 UTC).",
      "- **Site:** https://patchlife.tech/ answered HTTP 503.",
      "",
      "Each nightly run rewrites this list, and the first run that finds nothing closes this issue. The checks are in `scripts/watchdog.mjs`.",
    ].join("\n"),
  );
});

// ---------- publish ----------

const OPEN = `GET ${R}/issues?state=open&labels=watchdog&per_page=100`;
const DISPATCH = `POST ${R}/actions/workflows/pages.yml/dispatches`;
const LABEL = `GET ${R}/labels/watchdog`;

test("problems open the watchdog issue, and a Pages problem dispatches pages.yml and says so", async () => {
  const { api, calls, paths } = fakeApi({ [OPEN]: [], [DISPATCH]: null, [LABEL]: { name: "watchdog" }, [`POST ${R}/issues`]: { number: 120 } });
  const problems = [PAGES, SITE];
  assert.deepEqual(await publish({ api, repo: "o/r", problems, now: NOW }), ["Dispatched pages.yml on main.", "Opened #120."]);
  assert.deepEqual(paths(), [DISPATCH, OPEN, LABEL, `POST ${R}/issues`]);
  assert.deepEqual(calls[0].body, { ref: "main" });
  const dispatched = { ...PAGES, message: `${PAGES.message} Dispatched pages.yml on main.` };
  assert.deepEqual(calls[3].body, { title: "Watchdog: 2 problem(s)", body: issueBody([dispatched, SITE], NOW), labels: ["watchdog"] });
  assert.deepEqual(problems, [PAGES, SITE], "the caller's problems are left as they were");
});

test("a missing watchdog label is made before the issue, so the next run finds it", async () => {
  const { api, calls, paths } = fakeApi({ [OPEN]: [], [`POST ${R}/labels`]: { name: "watchdog" }, [`POST ${R}/issues`]: { number: 122 } });
  assert.deepEqual(await publish({ api, repo: "o/r", problems: [SITE], now: NOW }), ["Opened #122."]);
  assert.deepEqual(paths(), [OPEN, LABEL, `POST ${R}/labels`, `POST ${R}/issues`]);
  assert.deepEqual(calls[2].body, { name: "watchdog", color: "b60205", description: "Opened and closed by scripts/watchdog.mjs" });
  // Any other failure to read the label stops the run rather than risk an issue the next run can't find.
  const broken = fakeApi({ [OPEN]: [], [LABEL]: httpError(502) });
  await assert.rejects(publish({ api: broken.api, repo: "o/r", problems: [SITE], now: NOW }), /HTTP 502/);
  assert.deepEqual(broken.paths(), [OPEN, LABEL]);
});

test("a dispatch that fails is reported in the issue instead", async () => {
  const refused = Object.assign(new Error(`POST ${R}/actions/workflows/pages.yml/dispatches: HTTP 403 (Resource not accessible by integration)`), { status: 403 });
  const { api, calls } = fakeApi({ [OPEN]: [], [DISPATCH]: refused, [LABEL]: { name: "watchdog" }, [`POST ${R}/issues`]: { number: 121 } });
  const outcome = `Could not dispatch pages.yml: ${refused.message}`;
  assert.deepEqual(await publish({ api, repo: "o/r", problems: [PAGES], now: NOW }), [outcome, "Opened #121."]);
  assert.equal(calls[3].body.body, issueBody([{ ...PAGES, message: `${PAGES.message} ${outcome}` }], NOW));
});

test("an open watchdog issue is rewritten, not duplicated", async () => {
  // A pull request with the label is not the issue, even with the lowest number.
  const { api, calls, paths } = fakeApi({ [OPEN]: [{ number: 15 }, { number: 11, pull_request: {} }, { number: 12 }], [`PATCH ${R}/issues/12`]: {} });
  assert.deepEqual(await publish({ api, repo: "o/r", problems: [SITE], now: NOW }), ["Updated #12."]);
  assert.deepEqual(paths(), [OPEN, `PATCH ${R}/issues/12`]);
  assert.deepEqual(calls[1].body, { title: "Watchdog: 1 problem(s)", body: issueBody([SITE], NOW) });
});

test("a run with no problems closes each open watchdog issue with a comment", async () => {
  const { api, calls, paths } = fakeApi({
    [OPEN]: [{ number: 15 }, { number: 12 }],
    [`POST ${R}/issues/12/comments`]: {},
    [`PATCH ${R}/issues/12`]: {},
    [`POST ${R}/issues/15/comments`]: {},
    [`PATCH ${R}/issues/15`]: {},
  });
  assert.deepEqual(await publish({ api, repo: "o/r", problems: [], now: NOW }), ["Closed #12.", "Closed #15."]);
  assert.deepEqual(paths(), [OPEN, `POST ${R}/issues/12/comments`, `PATCH ${R}/issues/12`, `POST ${R}/issues/15/comments`, `PATCH ${R}/issues/15`]);
  assert.deepEqual(calls[1].body, { body: "All clear on 2026-11-15." });
  assert.deepEqual(calls[2].body, { state: "closed", state_reason: "completed" });

  const quiet = fakeApi({ [OPEN]: [] });
  assert.deepEqual(await publish({ api: quiet.api, repo: "o/r", problems: [], now: NOW }), []);
  assert.deepEqual(quiet.paths(), [OPEN]);
});

test("the summary is posted on #27 after the issue is up to date", async () => {
  const { api, calls, paths } = fakeApi({ [OPEN]: [], [`POST ${R}/issues/27/comments`]: {} });
  assert.deepEqual(await publish({ api, repo: "o/r", problems: [], now: NOW, summary: "Weekly summary for 2026-11-15." }), ["Posted the summary on #27."]);
  assert.deepEqual(paths(), [OPEN, `POST ${R}/issues/27/comments`]);
  assert.deepEqual(calls[1].body, { body: "Weekly summary for 2026-11-15." });
});

test("a dry run reads but writes nothing: no dispatch, no issue, no comment", async () => {
  const withIssue = fakeApi({ [OPEN]: [{ number: 12 }] });
  assert.deepEqual(await publish({ api: withIssue.api, repo: "o/r", problems: [PAGES], now: NOW, summary: "Weekly", dryRun: true }), [
    "Dry run: would dispatch pages.yml on main.",
    "Dry run: would update #12.",
    "Dry run: would post the summary on #27.",
  ]);
  assert.deepEqual(await publish({ api: withIssue.api, repo: "o/r", problems: [], now: NOW, dryRun: true }), ["Dry run: would close #12."]);
  const without = fakeApi({ [OPEN]: [] });
  assert.deepEqual(await publish({ api: without.api, repo: "o/r", problems: [SITE], now: NOW, dryRun: true }), ["Dry run: would open a watchdog issue."]);
  assert.deepEqual([...withIssue.calls, ...without.calls].map((call) => call.method), ["GET", "GET", "GET"]);
});

// ---------- CLI ----------

// Runs the CLI against a local fake of the GitHub API and the site, so its headers, writes and exit code are checked
// with no network. It reads this checkout's real records and renewals, so it asserts only on what the fake controls:
// a switched-off workflow and a Pages deploy 40 hours old guarantee two problems, and the dispatch answers 204.
async function runCli(t, args) {
  const requests = [];
  const hourAgo = new Date(Date.now() - HOUR).toISOString();
  const deployed = new Date(Date.now() - 40 * HOUR).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const runs = (list) => [200, { total_count: list.length, workflow_runs: list }];
  let base;
  const route = (key) =>
    ({
      [`GET ${R}/actions/workflows?per_page=100`]: [200, { workflows: [{ name: "Re-verify evidence", path: ".github/workflows/reverify.yml", state: "disabled_manually" }] }],
      [`GET ${R}/actions/workflows/reverify.yml/runs?status=completed&per_page=10`]: runs([ghRun(1)]),
      [`GET ${R}/actions/runs/1/jobs`]: [200, { jobs: [{ id: 10, check_run_url: `${base}${R}/check-runs/10`, steps: [pushed(hourAgo)] }] }],
      [`GET ${R}/check-runs/10/annotations`]: [200, []],
      [`GET ${R}/actions/workflows/pages.yml/runs?event=push&status=success&per_page=1`]: runs([ghRun(2, { event: "push", updated_at: deployed })]),
      [`GET ${R}/actions/workflows/pages.yml/runs?event=schedule&status=success&per_page=1`]: runs([]),
      [`GET ${R}/actions/workflows/pages.yml/runs?event=workflow_dispatch&status=success&per_page=1`]: runs([]),
      [`POST ${R}/actions/workflows/pages.yml/dispatches`]: [204, ""],
      [`GET ${R}/git/matching-refs/heads/claude/reverify-`]: [200, []],
      [`GET ${R}/issues?state=open&per_page=100&page=1`]: [200, []],
      [`GET ${R}/pulls?state=open&per_page=100&page=1`]: [200, []],
      [`GET ${R}/issues?state=open&labels=watchdog&per_page=100`]: [200, []],
      [`POST ${R}/labels`]: [201, { name: "watchdog" }],
      [`POST ${R}/issues`]: [201, { number: 5 }],
      [`POST ${R}/issues/27/comments`]: [201, { id: 1 }],
      ["GET /site/"]: [200, `<!doctype html><body>${FOOTER(today)}</body>`],
    })[key] ?? [404, { message: "Not Found" }];
  const server = createServer((req, res) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      requests.push({ method: req.method, path: req.url, headers: req.headers, body: data ? JSON.parse(data) : undefined });
      const [status, body] = route(`${req.method} ${req.url}`);
      res.writeHead(status, { "content-type": typeof body === "string" ? "text/html" : "application/json" });
      res.end(typeof body === "string" ? body : JSON.stringify(body));
    });
  });
  await new Promise((listening) => server.listen(0, "127.0.0.1", listening));
  t.after(() => server.close());
  base = `http://127.0.0.1:${server.address().port}`;
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, GH_TOKEN: "test-token", GITHUB_REPOSITORY: "o/r", GITHUB_API_URL: base, SITE_URL: `${base}/site/` };
  const result = await new Promise((done) => {
    execFile(process.execPath, [SCRIPT, ...args], { env, encoding: "utf8" }, (error, stdout, stderr) => done({ status: error ? error.code : 0, stdout, stderr }));
  });
  return { ...result, requests, lines: result.stdout.trim().split("\n") };
}

test("the CLI reads with the token and API version, opens the issue, posts the summary and exits 1", async (t) => {
  const cli = await runCli(t, ["--summary"]);
  assert.equal(cli.status, 1, cli.stderr);
  assert.ok(cli.lines.includes("Workflows: Re-verify evidence (.github/workflows/reverify.yml) is switched off (disabled_manually). Re-enable it in the Actions tab."));
  assert.ok(cli.lines.includes("Dispatched pages.yml on main."), "an empty 204 reply is a success");
  assert.ok(cli.lines.includes("Opened #5."));
  assert.ok(cli.lines.includes("Posted the summary on #27."));
  assert.match(cli.lines.at(-1), /^\d+ problem\(s\)$/);
  const github = cli.requests.filter((request) => request.path.startsWith("/repos/"));
  for (const { headers } of github) {
    assert.equal(headers.authorization, "Bearer test-token");
    assert.equal(headers["x-github-api-version"], "2022-11-28");
    assert.equal(headers.accept, "application/vnd.github+json");
    assert.equal(headers["user-agent"], USER_AGENT);
  }
  const site = cli.requests.find((request) => request.path === "/site/");
  assert.equal(site.headers.authorization, undefined, "the token goes only to the API");
  const writes = cli.requests.filter((request) => request.method !== "GET").map((request) => `${request.method} ${request.path}`);
  assert.deepEqual(writes, [`POST ${R}/actions/workflows/pages.yml/dispatches`, `POST ${R}/labels`, `POST ${R}/issues`, `POST ${R}/issues/27/comments`]);
  const opened = cli.requests.find((request) => request.method === "POST" && request.path === `${R}/issues`);
  assert.equal(opened.headers["content-type"], "application/json");
  assert.match(opened.body.title, /^Watchdog: \d+ problem\(s\)$/);
  assert.deepEqual(opened.body.labels, ["watchdog"]);
  assert.match(opened.body.body, /^- \*\*Workflows:\*\* Re-verify evidence/m);
  const summary = cli.requests.find((request) => request.path === `${R}/issues/27/comments`).body.body;
  assert.match(summary, /^Weekly summary for \d{4}-\d{2}-\d{2}\.$/m);
  assert.match(summary, /^Verified records +\d+$/m);
  assert.equal(summary.match(/^- \[.+\]\(.+\/site\/devices\/[a-z0-9-]+\/\): \[maker's page\]\(https:\/\/.+#:~:text=.+\)$/gm).length, 5);
});

test("the CLI's dry run reads the same but writes nothing, and prints the summary", async (t) => {
  const cli = await runCli(t, ["--dry-run", "--summary"]);
  assert.equal(cli.status, 1, cli.stderr);
  assert.deepEqual(cli.requests.filter((request) => request.method !== "GET"), []);
  assert.ok(cli.lines.includes("Dry run: would dispatch pages.yml on main."));
  assert.ok(cli.lines.includes("Dry run: would open a watchdog issue."));
  assert.ok(cli.lines.includes("Dry run: would post the summary on #27."));
  assert.ok(cli.lines.some((line) => line.startsWith("Weekly summary for ")));
});

test("the CLI exits 2 without GH_TOKEN and GITHUB_REPOSITORY, or with an unknown argument", () => {
  // A bare environment, so a token in the caller's (on Actions, say) never reaches the script.
  const run = (args, env) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", env: { PATH: process.env.PATH, ...env } });
  const bare = run([], {});
  assert.equal(bare.status, 2);
  assert.equal(bare.stderr, "Set GH_TOKEN and GITHUB_REPOSITORY first.\n");
  const half = run(["--dry-run"], { GITHUB_REPOSITORY: "o/r" });
  assert.equal(half.status, 2);
  assert.equal(half.stderr, "Set GH_TOKEN first.\n");
  const odd = run(["--dryrun"], { GH_TOKEN: "x", GITHUB_REPOSITORY: "o/r" });
  assert.equal(odd.status, 2);
  assert.equal(odd.stderr, "Unknown argument --dryrun. Usage: node scripts/watchdog.mjs [--dry-run] [--summary]\n");
  assert.equal(odd.stdout, "");
});
