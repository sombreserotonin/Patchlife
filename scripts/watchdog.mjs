// The alarm for running Patchlife with no AI (docs/MIGRATION.md: "What the watchdog checks", decisions 7 and 8). It
// reads GitHub's REST API, the live site, the device records and the renewals list, and keeps one open issue labelled
// `watchdog` up to date: opened or rewritten while there are problems, closed with a comment once a run finds none. It
// exits 1 on any problem, so the run goes red. It only reports: it never re-enables a workflow or deletes a branch. The
// one thing it starts is a Pages run, when the last deploy is too old.
// --summary also posts the weekly summary on the heartbeat issue (#27). --dry-run writes nothing and only prints.
// Usage: node scripts/watchdog.mjs [--dry-run] [--summary]   (add --use-env-proxy in a cloud session, D16)
// Env: GH_TOKEN and GITHUB_REPOSITORY (owner/name) are required; SITE_URL defaults to https://patchlife.tech/, and
// GITHUB_API_URL (which Actions sets) to https://api.github.com.
// It dates stale records from git history, so Actions must check out with fetch-depth: 0.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { isRealDate } from "./build-site.mjs";
import { USER_AGENT } from "./polite-fetch.mjs";
import { listYamlFiles } from "./validate-data.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SITE_URL = "https://patchlife.tech/";
const LABEL = "watchdog";
const SUMMARY_ISSUE = 27;
// Names that reverify.yml prints; renaming either there silences a check here.
const PUSH_STEP = "Push verification changes";
const UNCHECKED_TITLE = "Records not checked";
// The `crawl` concurrency group (decision 14), where a queued run can cancel another.
const CRAWL_WORKFLOWS = ["reverify.yml", "data-refresh.yml", "probe-hosts.yml", "owner-tools.yml"];
// pages.yml deploys on these; a pull request run only builds.
const DEPLOY_EVENTS = ["push", "schedule", "workflow_dispatch"];

const dateOf = (time) => new Date(time).toISOString().slice(0, 10);
const stamp = (time) => `${new Date(time).toISOString().slice(0, 16).replace("T", " ")} UTC`;
const hoursSince = (iso, now) => (now - Date.parse(iso)) / HOUR;
// Whole days from one YYYY-MM-DD date to another.
const daysFrom = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const labelNames = (item) => item.labels.map((label) => label.name ?? label);

// Every item of a paged list; GitHub returns at most 100 a page.
async function all(api, path) {
  const items = [];
  for (let page = 1; ; page++) {
    const batch = await api("GET", `${path}&per_page=100&page=${page}`);
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

// The date in the footer's "Status as at <time datetime="YYYY-MM-DD">" (scripts/build-site.mjs), or null.
export function siteDate(html) {
  return html.match(/<footer[^>]*>[\s\S]*?Status as at <time datetime="(\d{4}-\d{2}-\d{2})">/)?.[1] ?? null;
}

// staleSince for the checkout at root: the day of the newest commit that added or removed a "status: stale" line in
// the file, which for a stale record is the day it went stale. Actions must check out with fetch-depth: 0. A shallow
// clone would date every stale record to its oldest commit, so there each one counts as undated, which is reported.
export function gitStaleSince(root = ROOT) {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const shallow = git("rev-parse", "--is-shallow-repository") === "true";
  return (file) => (shallow ? null : git("log", "-1", "--format=%cs", "-G", "status: stale", "--", file) || null);
}

// Reads what the checks need. api(method, path, body) is a GitHub REST helper that returns parsed JSON and throws
// (with `status`) on an HTTP error; fetchSite(url) returns { status, text }; devices are the parsed records;
// staleSince(file) returns the YYYY-MM-DD a record's file went stale, or null; renewals is ops/renewals.yml's list.
// Each read fills its part of the state only if it succeeds, so no check judges half-read data, and a failed read is
// reported under its check instead of hiding the others.
export async function gatherState({ api, fetchSite, now, repo, siteUrl = SITE_URL, devices, renewals, staleSince }) {
  const state = { at: new Date(now).toISOString(), repo, errors: [], renewals };
  const read = async (check, what, fn) => {
    try {
      await fn();
    } catch (err) {
      state.errors.push({ check, message: `Could not read ${what}: ${err.message}` });
    }
  };
  const runs = async (file, query) => (await api("GET", `/repos/${repo}/actions/workflows/${file}/runs?${query}`)).workflow_runs;

  await read("Workflows", "the workflow list", async () => {
    const { workflows } = await api("GET", `/repos/${repo}/actions/workflows?per_page=100`);
    state.workflows = workflows.map((w) => ({ name: w.name, path: w.path, state: w.state }));
  });

  // The steps of the last 10 completed runs, and the annotations of the last 3 (job ids are their check run ids).
  await read("Re-verify", "the re-verify runs", async () => {
    const list = [];
    for (const run of await runs("reverify.yml", "status=completed&per_page=10")) {
      const { jobs } = await api("GET", `/repos/${repo}/actions/runs/${run.id}/jobs`);
      const steps = jobs.flatMap((job) => job.steps ?? []).map((s) => ({ name: s.name, conclusion: s.conclusion, completed_at: s.completed_at }));
      const entry = { url: run.html_url, steps };
      if (list.length < 3) {
        entry.annotations = [];
        for (const job of jobs) {
          const annotations = await api("GET", `${new URL(job.check_run_url).pathname}/annotations`);
          entry.annotations.push(...annotations.map((a) => ({ title: a.title, message: a.message })));
        }
      }
      list.push(entry);
    }
    state.reverifyRuns = list;
  });

  await read("Pages", "the Pages runs", async () => {
    const list = [];
    for (const event of DEPLOY_EVENTS) list.push(...(await runs("pages.yml", `event=${event}&status=success&per_page=1`)));
    state.pagesRuns = list.map((run) => ({ event: run.event, updated_at: run.updated_at, url: run.html_url }));
  });

  await read("Cancelled runs", "the cancelled runs", async () => {
    const list = [];
    for (const file of CRAWL_WORKFLOWS) {
      let cancelled;
      try {
        cancelled = await runs(file, "status=cancelled&per_page=20");
      } catch (err) {
        if (err.status === 404) continue; // not added yet: data-refresh.yml and owner-tools.yml come with P3
        throw err;
      }
      list.push(...cancelled.map((run) => ({ workflow: file, updated_at: run.updated_at, url: run.html_url })));
    }
    state.cancelled = list;
  });

  await read("Re-verify branches", "the re-verify branches", async () => {
    const owner = repo.split("/")[0];
    const list = [];
    for (const { ref, object } of await api("GET", `/repos/${repo}/git/matching-refs/heads/claude/reverify-`)) {
      const name = ref.slice("refs/heads/".length);
      const { commit } = await api("GET", `/repos/${repo}/commits/${object.sha}`);
      const prs = await api("GET", `/repos/${repo}/pulls?state=all&head=${encodeURIComponent(`${owner}:${name}`)}&per_page=100`);
      list.push({ name, committed_at: commit.committer.date, prs: prs.map((pr) => ({ number: pr.number, state: pr.state, merged_at: pr.merged_at })) });
    }
    state.branches = list;
  });

  await read("Data health", "when the stale records went stale", async () => {
    const stale = [];
    // validate-data.mjs keeps each record at data/devices/<brand_slug>/<id>.yaml.
    for (const record of devices.filter((r) => r.verification?.status === "stale")) {
      stale.push({ id: record.id, since: (await staleSince(`data/devices/${record.brand_slug}/${record.id}.yaml`)) || null });
    }
    state.records = { total: devices.length, stale };
  });

  // The issues list holds pull requests too, marked by `pull_request`.
  await read("Data health", "the open issues", async () => {
    const issues = await all(api, `/repos/${repo}/issues?state=open`);
    state.issues = issues.map((i) => ({ number: i.number, pull: Boolean(i.pull_request), created_at: i.created_at, labels: labelNames(i) }));
  });

  await read("Candidate PR", "the open PRs", async () => {
    const pulls = await all(api, `/repos/${repo}/pulls?state=open`);
    state.pulls = pulls.map((pr) => ({ number: pr.number, head: pr.head.ref, created_at: pr.created_at, labels: labelNames(pr) }));
  });

  const url = siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`;
  try {
    const { status, text } = await fetchSite(url);
    state.site = { url, status, date: status === 200 ? siteDate(text) : null };
  } catch (err) {
    state.site = { url, error: err.cause?.message || err.message };
  }
  return state;
}

// Every problem in the state, as { check, message }. A part of the state that is missing (its read failed) is skipped.
export function checkState(state, now) {
  const time = new Date(now).getTime();
  const today = dateOf(time);
  const problems = [...(state.errors ?? [])];
  const add = (check, message) => problems.push({ check, message });

  // Alert only: whoever re-enables a scheduled workflow gets its failure emails, so the owner does it. A deleted
  // workflow can't be re-enabled, and the run-age checks notice one that matters.
  for (const w of state.workflows ?? []) {
    if (w.state !== "active" && w.state !== "deleted") add("Workflows", `${w.name} (${w.path}) is switched off (${w.state}). Re-enable it in the Actions tab.`);
  }

  // The push step passes when it pushes and when there is nothing to push.
  if (state.reverifyRuns) {
    const runs = state.reverifyRuns;
    const pushed = runs.flatMap((run) => run.steps).find((step) => step.name === PUSH_STEP && step.conclusion === "success");
    const latest = runs.length ? ` Latest run: ${runs[0].url}` : "";
    if (!runs.length) add("Re-verify", "No re-verify run has completed.");
    else if (!pushed) add("Re-verify", `No re-verify run got through "${PUSH_STEP}" in the last ${plural(runs.length, "completed run")}.${latest}`);
    else if (hoursSince(pushed.completed_at, time) >= 48) {
      add("Re-verify", `The last re-verify run to get through "${PUSH_STEP}" finished ${Math.floor(hoursSince(pushed.completed_at, time))} hours ago (${stamp(pushed.completed_at)}).${latest}`);
    }
  }

  if (state.pagesRuns) {
    const deploys = state.pagesRuns.filter((run) => DEPLOY_EVENTS.includes(run.event)).map((run) => Date.parse(run.updated_at));
    const last = deploys.length ? Math.max(...deploys) : null;
    if (last === null) add("Pages", "No successful Pages deploy found.");
    else if ((time - last) / HOUR >= 36) add("Pages", `The last Pages deploy finished ${Math.floor((time - last) / HOUR)} hours ago (${stamp(last)}).`);
  }

  for (const run of state.cancelled ?? []) {
    if (hoursSince(run.updated_at, time) <= 48) add("Cancelled runs", `A ${run.workflow} run was cancelled (${stamp(run.updated_at)}): ${run.url}`);
  }

  // Report, never delete (decision 8). While any of these exists, reverify.yml stops at its guard.
  for (const branch of state.branches ?? []) {
    const closed = branch.prs.length > 0 && branch.prs.every((pr) => pr.state === "closed" && !pr.merged_at);
    const age = hoursSince(branch.committed_at, time);
    if (closed) {
      const prs = branch.prs.map((pr) => `#${pr.number}`).join(", ");
      add("Re-verify branches", `${branch.name}: its ${branch.prs.length === 1 ? `PR ${prs} was` : `PRs ${prs} were`} closed without merging. Delete the branch, or reopen the PR.`);
    } else if (age > 36) {
      add("Re-verify branches", `${branch.name} is ${Math.floor(age)} hours old and unmerged, so re-verification stops at its guard.`);
    }
  }

  // The verifier couldn't fetch these (a redirect, robots.txt, HTTP 403 or 5xx, a timeout) three nights running.
  const nights = (state.reverifyRuns ?? []).slice(0, 3).map((run) => {
    const listed = (run.annotations ?? []).filter((a) => a.title === UNCHECKED_TITLE);
    return new Set(listed.flatMap((a) => a.message.split(/\s+/)).filter(Boolean));
  });
  if (nights.length === 3) {
    const ids = [...nights[0]].filter((id) => nights[1].has(id) && nights[2].has(id)).sort();
    if (ids.length) add("Unchecked records", `Not checked on each of the last 3 re-verify runs: ${ids.join(" ")}`);
  }

  // PLAN Measures: stale records under 2%, and the oldest needs-human item under 7 days.
  if (state.records) {
    const { total, stale } = state.records;
    const undated = stale.filter((r) => !r.since).map((r) => r.id);
    if (undated.length) add("Data health", `${plural(undated.length, "stale record")} with no date in git history (is the checkout shallow?): ${undated.join(" ")}`);
    const old = new Map();
    for (const { id, since } of stale) if (since && daysFrom(since, today) > 14) old.set(since, [...(old.get(since) ?? []), id]);
    for (const since of [...old.keys()].sort()) {
      add("Data health", `${plural(old.get(since).length, "record")} stale since ${since}, ${daysFrom(since, today)} days ago: ${old.get(since).join(" ")}`);
    }
    // stale / total >= 2%, in whole numbers.
    if (stale.length && stale.length * 50 >= total) {
      add("Data health", `${((100 * stale.length) / total).toFixed(1)}% of records are stale (${stale.length} of ${total}). The limit is under 2%.`);
    }
  }
  for (const issue of state.issues ?? []) {
    const days = (time - Date.parse(issue.created_at)) / DAY;
    if (issue.labels.includes("needs-human") && days > 7) add("Data health", `#${issue.number} (needs-human) has waited ${Math.floor(days)} days, since ${issue.created_at.slice(0, 10)}.`);
  }

  // The weekly refresh skips while its last PR is open (decision 5).
  for (const pr of state.pulls ?? []) {
    const days = (time - Date.parse(pr.created_at)) / DAY;
    if (pr.head.startsWith("claude/data-auto-") && days > 14) add("Candidate PR", `#${pr.number} (${pr.head}) has been open ${Math.floor(days)} days, so the weekly data refresh keeps skipping.`);
  }

  if (state.site) {
    const { url, status, date, error } = state.site;
    if (error) add("Site", `${url} could not be reached: ${error}`);
    else if (status !== 200) add("Site", `${url} answered HTTP ${status}.`);
    else if (!date) add("Site", `${url} has no "Status as at" date in its footer.`);
    else if (daysFrom(date, today) >= 2) add("Site", `${url} says "Status as at ${date}", ${daysFrom(date, today)} days ago.`);
  }

  // A null due date is one nobody has filled in yet.
  for (const { name, due } of state.renewals ?? []) {
    if (due == null) continue;
    if (!isRealDate(due)) {
      add("Renewals", `${name}: the due date ${JSON.stringify(due)} is not a YYYY-MM-DD date.`);
      continue;
    }
    const days = daysFrom(today, due);
    if (days < 0) add("Renewals", `${name} was due on ${due}, ${plural(-days, "day")} ago.`);
    else if (days <= 60) add("Renewals", `${name} is due on ${due}, ${days ? `in ${plural(days, "day")}` : "today"} (within ${days <= 14 ? 14 : 60} days).`);
  }
  return problems;
}

// The `watchdog` issue's text. It is posted publicly, so it is a fixed template around the problem lines.
export function issueBody(problems, now) {
  return [
    `The watchdog found ${problems.length} problem(s) on its run at ${stamp(now)}.`,
    "",
    ...problems.map(({ check, message }) => `- **${check}:** ${message}`),
    "",
    "Each nightly run rewrites this list, and the first run that finds nothing closes this issue. The checks are in `scripts/watchdog.mjs`.",
  ].join("\n");
}

// n records for the weekly spot check, ranked by a hash of the seed (the summary's date) and each id, so the same
// seed picks the same records whatever the file order. Only records whose first evidence item has a quote qualify.
export function pickSample(records, seed, n = 5) {
  const rank = (record) => createHash("sha256").update(`${seed}\n${record.id}`).digest("hex");
  return records
    .filter((record) => record.evidence?.[0]?.quote)
    .map((record) => ({ record, key: rank(record) }))
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .slice(0, n)
    .map(({ record }) => record);
}

// The page with the quote highlighted (a text fragment). "-", "," and "&" split a text directive into its parts, so
// they are escaped; so are brackets, which would end a Markdown link.
export function highlightLink(url, quote) {
  const text = encodeURIComponent(quote).replace(/[-()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${url}${url.includes("#") ? "" : "#"}:~:text=${text}`;
}

const markdown = (text) => text.replace(/[\\`*_[\]<>|]/g, "\\$&");

// The Sunday summary on #27. It is posted publicly, so it is a fixed template: PRs waiting for the owner, open issues
// by label, the data report's Measures rows, and links for the spot check.
export function summaryText(state, dataReportLines, sample) {
  const site = state.site?.url ?? SITE_URL;
  const lines = [`Weekly summary for ${state.at.slice(0, 10)}.`, ""];
  if (state.pulls) {
    const merge = state.pulls.filter((pr) => pr.labels.includes("needs-human-merge")).map((pr) => pr.number).sort((a, b) => a - b);
    lines.push(`PRs for you to merge (\`needs-human-merge\`): ${merge.length ? merge.map((n) => `#${n}`).join(", ") : "none"}.`);
  } else lines.push("PRs for you to merge: the watchdog could not read them.");
  lines.push("");
  if (state.issues) {
    const issues = state.issues.filter((issue) => !issue.pull);
    const counts = new Map();
    for (const issue of issues) for (const label of issue.labels.length ? issue.labels : ["no label"]) counts.set(label, (counts.get(label) ?? 0) + 1);
    const labels = [...counts.keys()].sort((a, b) => (a === "no label") - (b === "no label") || a.localeCompare(b));
    lines.push(`Open issues: ${issues.length}.`, ...labels.map((label) => `- ${label}: ${counts.get(label)}`));
  } else lines.push("Open issues: the watchdog could not read them.");
  lines.push("", "Measures, from `node scripts/data-report.mjs`:", "```", ...dataReportLines, "```", "");
  lines.push("Spot check: compare each record with the highlighted words on the maker's page.");
  for (const record of sample) {
    const { url, quote } = record.evidence[0];
    lines.push(`- [${markdown(`${record.brand} ${record.model}`)}](${site}devices/${record.id}/): [maker's page](${highlightLink(url, quote)})`);
  }
  return lines.join("\n");
}

// Acts on the problems: dispatches pages.yml when Pages is behind, keeps the one open `watchdog` issue up to date
// (opened or rewritten while there are problems, closed with a comment when there are none), and posts the summary
// on #27 when one is given. With dryRun it only reads. Returns a line for each thing it did or would do.
export async function publish({ api, repo, problems, now, summary = null, dryRun = false }) {
  const done = [];
  const listed = problems.map((problem) => ({ ...problem }));
  const pages = listed.find((problem) => problem.check === "Pages");
  if (pages && dryRun) done.push("Dry run: would dispatch pages.yml on main.");
  else if (pages) {
    let outcome = "Dispatched pages.yml on main.";
    try {
      await api("POST", `/repos/${repo}/actions/workflows/pages.yml/dispatches`, { ref: "main" });
    } catch (err) {
      outcome = `Could not dispatch pages.yml: ${err.message}`;
    }
    pages.message += ` ${outcome}`;
    done.push(outcome);
  }

  const open = (await api("GET", `/repos/${repo}/issues?state=open&labels=${LABEL}&per_page=100`))
    .filter((issue) => !issue.pull_request)
    .sort((a, b) => a.number - b.number);
  if (listed.length) {
    const fields = { title: `Watchdog: ${listed.length} problem(s)`, body: issueBody(listed, now) };
    if (dryRun) done.push(open.length ? `Dry run: would update #${open[0].number}.` : "Dry run: would open a watchdog issue.");
    else if (open.length) {
      await api("PATCH", `/repos/${repo}/issues/${open[0].number}`, fields);
      done.push(`Updated #${open[0].number}.`);
    } else {
      // GitHub's docs don't say whether a new issue's unknown label is created or dropped, and without the label the
      // next run wouldn't find this issue and would open another. So the label is made first if it's missing.
      try {
        await api("GET", `/repos/${repo}/labels/${LABEL}`);
      } catch (err) {
        if (err.status !== 404) throw err;
        await api("POST", `/repos/${repo}/labels`, { name: LABEL, color: "b60205", description: "Opened and closed by scripts/watchdog.mjs" });
      }
      const issue = await api("POST", `/repos/${repo}/issues`, { ...fields, labels: [LABEL] });
      done.push(`Opened #${issue.number}.`);
    }
  } else {
    for (const { number } of open) {
      if (dryRun) {
        done.push(`Dry run: would close #${number}.`);
        continue;
      }
      await api("POST", `/repos/${repo}/issues/${number}/comments`, { body: `All clear on ${dateOf(now)}.` });
      await api("PATCH", `/repos/${repo}/issues/${number}`, { state: "closed", state_reason: "completed" });
      done.push(`Closed #${number}.`);
    }
  }

  if (summary !== null && dryRun) done.push(`Dry run: would post the summary on #${SUMMARY_ISSUE}.`);
  else if (summary !== null) {
    await api("POST", `/repos/${repo}/issues/${SUMMARY_ISSUE}/comments`, { body: summary });
    done.push(`Posted the summary on #${SUMMARY_ISSUE}.`);
  }
  return done;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const unknown = args.find((arg) => arg !== "--dry-run" && arg !== "--summary");
  const missing = ["GH_TOKEN", "GITHUB_REPOSITORY"].filter((name) => !process.env[name]);
  if (unknown || missing.length) {
    console.error(unknown ? `Unknown argument ${unknown}. Usage: node scripts/watchdog.mjs [--dry-run] [--summary]` : `Set ${missing.join(" and ")} first.`);
    process.exit(2);
  }
  const dryRun = args.includes("--dry-run");
  const repo = process.env.GITHUB_REPOSITORY;
  const apiUrl = process.env.GITHUB_API_URL || "https://api.github.com";

  const api = async (method, path, body) => {
    const res = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${process.env.GH_TOKEN}`,
        "user-agent": USER_AGENT,
        "x-github-api-version": "2022-11-28",
        ...(body && { "content-type": "application/json" }),
      },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    if (!res.ok) {
      let detail = "";
      try {
        detail = JSON.parse(text).message ?? "";
      } catch {
        // not JSON: the status says enough
      }
      throw Object.assign(new Error(`${method} ${path}: HTTP ${res.status}${detail ? ` (${detail})` : ""}`), { status: res.status });
    }
    return text ? JSON.parse(text) : null;
  };
  const fetchSite = async (url) => {
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(30_000) });
    return { status: res.status, text: await res.text() };
  };

  const devices = listYamlFiles(join(ROOT, "data/devices")).map((file) => YAML.parse(readFileSync(file, "utf8")));

  let renewals = [];
  let renewalsError = null;
  try {
    // Imported here, not at the top, so the tests load this file without scripts/renewals.mjs.
    const { loadRenewals } = await import("./renewals.mjs");
    renewals = await loadRenewals(join(ROOT, "ops/renewals.yml"));
  } catch (err) {
    renewalsError = err.message;
  }

  const now = new Date();
  const state = await gatherState({ api, fetchSite, now, repo, siteUrl: process.env.SITE_URL || SITE_URL, devices, renewals, staleSince: gitStaleSince() });
  if (renewalsError) state.errors.push({ check: "Renewals", message: `Could not read ops/renewals.yml: ${renewalsError}` });
  const problems = checkState(state, now);
  for (const { check, message } of problems) console.log(`${check}: ${message}`);

  let summary = null;
  if (args.includes("--summary")) {
    const measures = execFileSync(process.execPath, [join(ROOT, "scripts/data-report.mjs")], { encoding: "utf8" }).split("\n").slice(0, 4);
    summary = summaryText(state, measures, pickSample(devices, dateOf(now)));
    if (dryRun) console.log(`\n${summary}\n`);
  }
  for (const line of await publish({ api, repo, problems, now, summary, dryRun })) console.log(line);
  console.log(problems.length ? `${problems.length} problem(s)` : "No problems found");
  process.exit(problems.length ? 1 : 0);
}
