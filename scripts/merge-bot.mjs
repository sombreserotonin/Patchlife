// Merges the routine PRs the GitHub App opens, and nothing else (docs/MIGRATION.md decision 2): re-verifications from
// claude/reverify-* and the monthly measures from claude/measures-*. Every rule in mergeDecision must hold, or the PR
// waits for the owner; anything unexpected refuses, since the owner can always merge by hand. It merges at the head
// SHA it checked, so GitHub refuses the merge if the branch has moved since, then deletes the branch, because
// reverify.yml stops while any claude/reverify-* branch exists. Exits 2 without its settings, 1 when a GitHub call fails.
// Usage: node scripts/merge-bot.mjs [--dry-run]   (env: GH_TOKEN, GITHUB_REPOSITORY as owner/name, and BOT_LOGIN, the
// App's login such as patchlife-bot[bot])
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { USER_AGENT } from "./polite-fetch.mjs";

const API = "https://api.github.com";
// The jobs that must pass on the head SHA: test (ci.yml), data-gate (data-gate.yml) and build (pages.yml). The PR-only
// lighthouse job doesn't count, so one slow runner can't stall re-verification.
const CHECKS = ["test", "data-gate", "build"];
const HOLD_LABELS = ["needs-human", "needs-human-merge"];
const PAGE_HASHES = "data/sources/page-hashes.json";
const DEVICE = /^data\/devices\/[^/]+\/[^/]+\.yaml$/;
// GitHub lists at most 3000 files of a PR, so a PR with that many may hold files the bot never sees.
const MAX_FILES = 3000;
// Each type: the branch it comes from, and the files it may change, with the change GitHub reports for each.
const TYPES = [
  { type: "reverify", branch: /^claude\/reverify-/, fits: ({ filename, status }) => status === "modified" && (filename === PAGE_HASHES || DEVICE.test(filename)) },
  { type: "measures", branch: /^claude\/measures-/, fits: ({ filename, status }) => filename === "docs/MEASURES.md" && (status === "modified" || status === "added") },
];

// Whether check run a is more recent than b: the later start, or the higher id when a start is missing or they tie.
function newer(a, b) {
  const [startA, startB] = [Date.parse(a.started_at), Date.parse(b.started_at)];
  if (!Number.isNaN(startA) && !Number.isNaN(startB) && startA !== startB) return startA > startB;
  return a.id > b.id;
}

// Returns { merge: true, reason: <type> } when every rule holds, otherwise { merge: false, reason } with the first rule
// the PR breaks. files are the PR's files; checkRuns are the check runs on its head SHA.
export function mergeDecision({ pr, files, checkRuns, repo, botLogin }) {
  const refuse = (reason) => ({ merge: false, reason });
  // Without both, undefined === undefined would pass the first two rules.
  if (!repo || !botLogin) return refuse("no repository or bot login given");
  // A fork's head repo has another name, and a deleted one is null.
  if (pr.head?.repo?.full_name !== repo) return refuse("head branch is not in this repository");
  if (pr.user?.login !== botLogin) return refuse(`not opened by ${botLogin}`);
  if (pr.draft !== false) return refuse("draft");
  const kind = TYPES.find(({ branch }) => branch.test(pr.head.ref));
  if (!kind) return refuse(`branch ${pr.head.ref} is not a re-verify or measures branch`);
  if (!Array.isArray(pr.labels)) return refuse("no label list");
  const hold = pr.labels.find(({ name }) => HOLD_LABELS.includes(name?.toLowerCase()));
  if (hold) return refuse(`label ${hold.name}`);
  for (const name of CHECKS) {
    // Only GitHub Actions' runs on this SHA count, so another app can't pass a check by naming its run "test".
    const runs = checkRuns.filter((run) => run.name === name && run.head_sha === pr.head.sha && run.app?.slug === "github-actions");
    if (!runs.length) return refuse(`check ${name} missing`);
    const latest = runs.reduce((a, b) => (newer(b, a) ? b : a));
    if (latest.status !== "completed" || latest.conclusion !== "success") return refuse(`check ${name} not passed`);
  }
  if (!files.length) return refuse("no files");
  if (files.length >= MAX_FILES) return refuse(`too many files to check (${files.length})`);
  const misfit = files.find((file) => !kind.fits(file));
  if (misfit) return refuse(`${misfit.filename} (${misfit.status}) not allowed in a ${kind.type} PR`);
  return { merge: true, reason: kind.type };
}

// Every item of a list GitHub pages, asking for ?page=1, 2 and so on until a page has fewer than 100. pick takes the
// list out of a response that wraps it, as the check runs API does.
async function getAll(api, path, pick = (body) => body) {
  const items = [];
  for (let page = 1; ; page++) {
    const batch = pick(await api("GET", `${path}&page=${page}`));
    if (!Array.isArray(batch)) throw new Error(`GET ${path}: no list in the response`);
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

// Decides each open PR and merges the ones that pass, unless dryRun. api(method, path, body) calls GitHub's REST API,
// returns the parsed JSON and throws on an HTTP error, with its status; any error stops the run. Returns one
// { number, action, reason } per PR, action being "merged", "would merge" or "skipped", and passes each to onResult as
// it is decided, so a caller can report the PRs handled before an error.
export async function mergeBot({ api, repo, botLogin, dryRun = false, onResult = () => {} }) {
  const results = [];
  for (const pr of await getAll(api, `/repos/${repo}/pulls?state=open&per_page=100`)) {
    const files = await getAll(api, `/repos/${repo}/pulls/${pr.number}/files?per_page=100`);
    // filter=all, so a newer run GitHub would otherwise hide, such as one still in progress, decides.
    const checkRuns = await getAll(api, `/repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=100&filter=all`, (body) => body?.check_runs);
    const { merge, reason } = mergeDecision({ pr, files, checkRuns, repo, botLogin });
    if (merge && !dryRun) {
      const merged = await api("PUT", `/repos/${repo}/pulls/${pr.number}/merge`, { merge_method: "squash", sha: pr.head.sha });
      if (merged?.merged !== true) throw new Error(`#${pr.number}: GitHub did not confirm the merge, so ${pr.head.ref} stays`);
    }
    const result = { number: pr.number, action: !merge ? "skipped" : dryRun ? "would merge" : "merged", reason };
    results.push(result);
    onResult(result);
    if (merge && !dryRun) await deleteBranch(api, repo, pr.head.ref);
  }
  return results;
}

// Each part of the name is escaped, so "#" or "%2e%2e" in a branch name can't make the path name another ref. GitHub
// deletes merged branches itself when "Automatically delete head branches" is on (TASKS G1), and if it gets there
// first it answers 422 "Reference does not exist".
async function deleteBranch(api, repo, ref) {
  try {
    await api("DELETE", `/repos/${repo}/git/refs/heads/${ref.split("/").map(encodeURIComponent).join("/")}`);
  } catch (err) {
    if (err.status !== 422 || !/Reference does not exist/.test(err.message)) throw err;
  }
}

// The api for mergeBot, on fetch. Errors carry the HTTP status and GitHub's message, never the token.
export function githubApi(token, fetch = globalThis.fetch) {
  return async function api(method, path, body) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": USER_AGENT,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    if (!res.ok) {
      let message = "";
      try {
        message = JSON.parse(text).message ?? "";
      } catch {}
      throw Object.assign(new Error(`${method} ${path}: HTTP ${res.status}${message ? ` ${message}` : ""}`), { status: res.status });
    }
    return text ? JSON.parse(text) : null;
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let options;
  try {
    // Strict, so a mistyped --dry-run stops the run instead of merging.
    const { values } = parseArgs({ options: { "dry-run": { type: "boolean" } } });
    const { GH_TOKEN, GITHUB_REPOSITORY, BOT_LOGIN } = process.env;
    const missing = Object.entries({ GH_TOKEN, GITHUB_REPOSITORY, BOT_LOGIN }).filter(([, value]) => !value);
    if (missing.length) throw new Error(`Missing environment variable(s): ${missing.map(([name]) => name).join(", ")}`);
    if (!/^[\w.-]+\/[\w.-]+$/.test(GITHUB_REPOSITORY)) throw new Error(`GITHUB_REPOSITORY must be owner/name, not "${GITHUB_REPOSITORY}"`);
    // Only an App's login ends in [bot], so a person's login can't widen what merges.
    if (!BOT_LOGIN.endsWith("[bot]")) throw new Error(`BOT_LOGIN must be the App's login, such as patchlife-bot[bot], not "${BOT_LOGIN}"`);
    options = { api: githubApi(GH_TOKEN), repo: GITHUB_REPOSITORY, botLogin: BOT_LOGIN, dryRun: values["dry-run"] ?? false };
  } catch (err) {
    console.error(err.message);
    console.error("Usage: node scripts/merge-bot.mjs [--dry-run]   (env: GH_TOKEN, GITHUB_REPOSITORY, BOT_LOGIN)");
    process.exit(2);
  }
  // Control characters are escaped, so a file name in a PR can't start a line the runner reads as a workflow command.
  const printable = (text) => text.replace(/[\x00-\x1f\x7f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`);
  try {
    await mergeBot({ ...options, onResult: ({ number, action, reason }) => console.log(printable(action === "skipped" ? `#${number}: skipped (${reason})` : `#${number}: ${action}`)) });
  } catch (err) {
    console.error(printable(err.message));
    process.exit(1);
  }
}
