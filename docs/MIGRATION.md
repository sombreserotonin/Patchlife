# Migration: running Patchlife without AI or subscriptions

This is the plan as at 22 Oct 2026, for the owner to follow. A step counts as done only when its exit check passes.

## Summary

- **End state.** No model runs anywhere in Patchlife, and nothing depends on a subscription.
  - Every recurring job is deterministic code on GitHub Actions or a short owner task. Actions is free on standard runners for public repositories [8].
  - The judgement a model makes today (reading a maker's row, the A8 audit, repairs) moves into per-source rules that code enforces, plus your weekly review.
  - The Claude scheduled tasks, the Claude GitHub App and `claude.yml` are removed, and Max is cancelled.
- **Cost.** Subscriptions fall from Max to A$0.
  - Max today is US$100 a month, or US$200 for the 20x tier (the 20x price comes from COSTS), before tax [21]. At US$1 = A$1.43 [26] that is about A$143 or A$286 a month, or A$1,700 to A$3,400 a year.
  - The only payment still required is the `patchlife.tech` renewal: US$32.62 to US$97.15 a year depending on the registrar [27]. That is about A$47 to A$139 a year, or A$4 to A$12 a month.
  - The Pangolin VPS is also a subscription if it is paid monthly (decision 2).
- **Your time.** About 30 to 45 minutes in a typical week, and up to an hour in a busy one (*estimate*). PLAN budgets 10 minutes a week today. On top of that:
  - 1 to 3 hours per new source, if you choose to grow (*estimate*);
  - 1 to 3 hours for each of perhaps 2 to 4 breakages a year that nothing will now repair (*estimate*);
  - about 6 to 8 hours of one-off work spread over five weeks (*estimate*).
- **What you give up.**
  - Nightly growth: no new source arrives each night.
  - The independent second reader (D20). Rules, a regression test and your sample check replace it.
  - Self-repair (A7).
  - Most feature building. The recommended cuts are:
    - a bookmarklet instead of a store extension (M5);
    - a free fleet checker and hand-made reports instead of an API (M6);
    - Atom feeds instead of email alerts (M7).
- **Timeline.**
  - From 23 Oct to 8 Nov, build the replacements with the Max time already paid for, in parallel lanes.
  - From 9 to 22 Nov, shadow-run with no AI.
  - Cancel by 30 Nov.
  - Watch the first large re-verification wave from 21 Dec.
- **Most of this depends on one human gate:** a private GitHub App for the bot (decision 1).

## State on 22 Oct 2026

I checked these with `git` and `gh api` at 02:40 UTC:
- **#98 merged at 02:07 UTC.** `reverify.yml` now archives up to 5 cited pages a night (D43), and CLAUDE.md's merge rule covers it.
- **The repository has had 0 scheduled workflow runs.**
  - `reverify.yml` (`41 12 * * *`) first fires at 12:41 UTC today.
  - `pages.yml`'s `17 0 * * *` has not fired since it merged on 21 Oct.
  - Schedules are best effort [7], so watch the first runs before relying on them.
- **Heartbeat issue #27 has 0 comments.** The daily build has never posted to it.
- **Repository settings:**
  - there are 0 open PRs;
  - all five workflows are `active`;
  - ruleset 25530330 requires a PR and the `test` check;
  - ROADMAP is at `.agent/progress/ROADMAP.md`, not `docs/`.
- **Node version.** The four working workflows use `node-version: lts/*`. That resolves to Node 24 today and jumps to Node 26 when 26 becomes LTS on 28 Oct [14].
- **M3 exit check part 1** runs on the nights of 22 to 24 Oct UTC with today's AI jobs.

## End-state architecture

| Job | After cut-over | Trigger |
|---|---|---|
| Re-verify due records (40 a night, due after 60 days) and archive 5 pages | `reverify.yml`, same logic. It now opens its own PR with the bot token | `41 12 * * *`, plus dispatch with new `due` and `limit` inputs |
| Merge re-verify and measures PRs | `scripts/merge-bot.mjs` in a new `housekeeping.yml` | `23 21 * * *` (08:23 Sydney daylight time) |
| Merge every other PR (data, code, docs, protected, Dependabot) | You | By hand |
| Alarms and weekly summary | `scripts/watchdog.mjs` in the same run. Any problem turns the run red and updates one `watchdog` issue. A summary goes on #27 each Monday | Same run |
| Dead-man's switch (optional) | Uptime Kuma on Unraid: a push monitor the watchdog pings, plus a keyword check on the site [18] | Alerts after 26 hours of silence |
| Build and deploy the site | `pages.yml`, with Lighthouse moved to pull requests only | Push, `17 0 * * *`, dispatch |
| CI | `ci.yml`: `test`, `protected-paths`, and a new required `data-gate` | Pull requests, including label changes |
| New and changed rows on the five sources | `scripts/candidates.mjs` and per-source parsers in a new `data-refresh.yml`, which opens one candidate PR | Weekly at `17 14 * * 0` (Monday 01:17 Sydney), plus dispatch |
| Audit (A8, D20) | Rules R1 to R7 and the parser regression test run in CI. You check a sample and add `audited` | Each candidate PR |
| Records Actions couldn't check | Retried the next night. Listed in the watchdog issue after 3 nights, and then you follow A5 | Watchdog |
| Stale records (A4) | The parser proposes the changed row if the model is still on the page. Otherwise you fix it, or the record becomes `none_published` | Weekly run, then you |
| Correction and add-model issues | You, using a new `owner-tools.yml` | The weekly summary counts them |
| New sources | You, or they wait | Your choice |
| Dependencies and runtime | Monthly grouped Dependabot PRs, CodeQL default setup, a pinned Node version | GitHub |
| Measures, and keeping schedules alive | A monthly `claude/measures-<yyyy-mm>` PR regenerates `docs/MEASURES.md` from `node scripts/data-report.mjs`, and the bot merges it | 1st of each month |
| Backups | Unraid: nightly mirror, weekly issues export, quarterly Cloudflare zone export [19] | Unraid and you |
| Features | Frozen once the cut scope ships | You |
| Any model | None. Break-glass by hand only (decision 6) | Never scheduled |

## Where the research disagreed, and the call made

1. **Bot identity.**
   - Events made with `GITHUB_TOKEN` start no new runs except dispatches, and PR runs they cause wait for approval [1][2]. The required `test` check would therefore never run unattended.
   - **Decision: use a private GitHub App.** Mint a token for each run with `actions/create-github-app-token`; the tokens last one hour [3].
   - A fine-grained PAT acts as you and has a maximum lifetime of 366 days, or no expiry [4].
   - **Zero-secret fallback:** turn on "Allow GitHub Actions to create and approve pull requests" (known only from a third-party source [30]), and click "Approve workflows to run" on each bot PR.
2. **What the bot may merge.** One proposal let it merge any `audited` PR. **Decision: a narrow rule.** The bot merges a PR only when all of these hold:
   - the App opened it, on a `claude/reverify-*` or `claude/measures-*` head in this repository;
   - it has no `needs-human` or `needs-human-merge` label;
   - every check passed;
   - its changes pass `verification-only.mjs`, or it touches only `docs/MEASURES.md`.

   The bot merges at the head SHA it checked. You merge the data PRs you audit.
3. **Where the A9 rule is enforced.**
   - **Decision: a `data-gate` job in `ci.yml`, required by the ruleset.** It passes when the PR carries `audited`, or when `node scripts/verification-only.mjs <merge-base>` prints `Only verification changed`. That second case is also true for PRs that change no data.
   - GitHub then enforces the rule even if the bot has a bug.
4. **How rows become records.**
   - The options were per-source modules, one generic regex parser, or parsers plus a separate cross-check reader.
   - **Decision:**
     - one cell-based reader, `scripts/table-rows.mjs`, which reuses the verifier's `htmlToText` and asserts `quoteMatches`;
     - thin per-source parsers;
     - a per-source profile in `data/sources/seed.yaml` that the parsers and the validator both read.
   - **Decision: defer the cross-check readers.**
     - The AI audits never caught a wrong date, only judgement fields (`.agent/progress/LOG.md` lines 14, 30, 45, 46), and the profile rules check those fields.
     - A second parser would double the repair work after every site redesign.
5. **How often data refreshes.** **Decision: weekly**, capped at 60 new rows per source per run (*estimate*; today's audited batches are about 60). You then review at most one batch a week.
6. **An issue triage bot.** **Decision: not now.**
   - No correction or add-model issue has ever been opened.
   - A bot would add an `issues` trigger and public comments, which are a human gate.
   - Revisit if issues pass 2 a week.
7. **Heartbeat.** **Decision: report problems only** (a red run and the `watchdog` issue), plus a Monday summary, with Kuma proving the watchdog is alive. There is no daily line.
8. **Orphaned re-verify branches.** **Decision: report them, don't delete them.** Closing and deleting takes you two clicks, and it keeps the bot's rights small.
9. **Node version.** **Decision: pin 24 now** (what `lts/*` gives today), so nothing jumps on 28 Oct.
   - Test Node 26 before cut-over. If CI is green, move to it: its end of life is 30 Apr 2029.
   - Otherwise stay on 24, whose end of life is 30 Apr 2028 [14].
10. **Exchange rate.** **Decision: US$1 = A$1.43** (RBA, March 2026 [26]), instead of an unsourced 0.65.
11. **Local model.** **Decision: don't build anything for it.**
    - Use one by hand only, if ever (decision 6).
    - Don't run it unattended with a write token on a home PC.
12. **`.agent/` and CLAUDE.md.** **Decision: freeze them at cut-over, and move them after the rollback window** (Stage 4).

## Staged plan

### Stage 0: decide and record (22 to 23 Oct, Max)

- Let M3 exit check part 1 run as scheduled.
- Answer decisions 1 to 5 below.
- Open one docs PR containing:
  - this file as `docs/MIGRATION.md`;
  - D44 in `.agent/memory/decisions.md`: "Patchlife runs with no model and no subscription; judgement goes to the owner", superseding D37;
  - a "superseded" note on these COSTS sections: "Summary", stages 3 and 4 of "The pivot, in stages", and "Getting to Pro";
  - TASKS updated for #98.
- **Exit check:**
  - D44 is on `main`;
  - a scheduled `Re-verify evidence` run has happened, and its archive branch has been merged per A9.

### Stage 1: build (23 Oct to 8 Nov, Max)

Run parallel sessions in separate files (D19, D26), each with one reviewer and no multi-agent reviews. There are five lanes:
- A1, then P2;
- P1 (first, before 28 Oct);
- B1, then B2;
- B3, then B4, then P3;
- B5.

Tier C starts only after Tiers A and B have merged. If the Max time runs short, cut Tier C.

**Tier A: housekeeping (required before cancelling)**
- **A1 (unprotected):**
  - `scripts/merge-bot.mjs` and `scripts/watchdog.mjs`;
  - tests using an injected fetch, covering forks, each label, red checks and a SHA that moved;
  - `ops/renewals.yml`;
  - `docs/OPERATIONS.md`, covering settings, alerts, backups, cut-over and rollback.
- **P1 (protected):**
  - `.github/dependabot.yml`: npm and github-actions, monthly, grouped, with a 7-day cooldown [10];
  - `node-version: 24` in `ci.yml`, `pages.yml`, `reverify.yml` and `probe-hosts.yml`;
  - `if: github.event_name == 'pull_request'` on the Lighthouse step in `pages.yml`. A score dip then can't block the daily rebuild that moves statuses (D7).
- **P2 (protected):**
  - a new `housekeeping.yml`: mints the App token, has the `if: vars.BOT_MERGE == 'on'` kill switch, runs `merge-bot.mjs` then `watchdog.mjs`, and finishes with an optional `KUMA_PUSH_URL` ping;
  - `reverify.yml`: uses the App token, opens its own PR through `gh api`, and gains `due` and `limit` inputs;
  - `ci.yml`: adds `data-gate` and the `labeled` and `unlabeled` event types;
  - `concurrency: crawl` on `reverify.yml` and `probe-hosts.yml` [15];
  - the new commands in CLAUDE.md.

  While `BOT_MERGE=off`, the daily build keeps merging, so P2 can merge at any time.

**What the watchdog checks:**
- any workflow that is not `active`. It only alerts: whoever re-enables a scheduled workflow becomes the person who gets its failure emails [6], so you re-enable it yourself;
- the last successful re-verify is over 48 hours old, or the last Pages deploy is over 36 hours old. For Pages it also dispatches `pages.yml`;
- a re-verify branch is over 36 hours old, or has a closed, unmerged PR;
- the same ids appear in `Records not checked` on 3 nights running;
- stale records are 2% or more, or the oldest `needs-human` item is over 7 days old (PLAN Measures);
- `https://patchlife.tech/` doesn't answer 200, or its "Status as at" is over 2 days old;
- a renewal falls within 60 or 14 days.

**Monday's summary also includes:**
- open `needs-human-merge` PRs;
- open issues, by label;
- the first four lines of `data-report.mjs`;
- 5 random records with text-fragment links for your spot check [29].

**Tier B: data without AI**
- **B1 (unprotected; data, audited by A8 while AI is still available).** These are the fixes that B2's rules find when run locally:
  - add Ring's "at least" sentence as a second evidence item on 98 records;
  - fix the 2 failing aliases (`gl-inet-gl-mt6000` and `google-nest-cam-iq-indoor-and-outdoor`);
  - fix the 15 non-US Ring records that carry the US purchase condition, if Ring's GB and AU pages don't state it (unverified).

  B1 merges before B2, so CI stays green.
- **B2 (unprotected): source profiles and rules.**
  - Profiles in `data/schema/source.schema.json` and `seed.yaml` gain these fields: `regions_by_url`; `at_least` with its sentence; the allowed `conditions` sentences for each URL; `category_map`; `category_exceptions`; `versioned`; `min_rows`.
  - `scripts/validate-data.mjs` gains rules R1 to R7:
    - R1: each alias is quoted, or is the model with the brand in front;
    - R2: regions stay within the profile;
    - R3: `at_least` is stated in a quote;
    - R4: `conditions` is one of the profile's sentences, from a cited URL;
    - R5: a footnote marker needs its footnote item;
    - R6: versioned models carry their version;
    - R7: the category comes from the map or is a listed exception.
  - Each rule gets a fixture. Each past audit catch (#21, #22, #24, #51) also gets a fixture, and those must fail.
- **B3 (unprotected):**
  - `scripts/table-rows.mjs`;
  - `scripts/parsers/tp-link-au.mjs` and `ezviz-eol.mjs`, which cover 533 of the 695 records;
  - `scripts/candidates.mjs [--check] [--limit n] [brand ...]`;
  - trimmed fixtures in `tests/fixtures/parsers/`.
- **B4 (unprotected):**
  - the Ring parser: merges locales, adds rename aliases and handles D33 splits;
  - the Google parser: launch date plus 5 years;
  - the GL.iNet parser: conflicts are flagged per D39, never written;
  - changed-row proposals, which are the deterministic version of A4;
  - a sanity gate: a run that finds under 90% of the known rows fails as "parser broken".
- **B5 (unprotected):**
  - `scripts/page-text.mjs`: the A2 step 3 snippet;
  - `scripts/check-source.mjs`: robots.txt, HTTP status, date count and sample rows;
  - `scripts/audit-sample.mjs`: 3 records or 5%, at most 10, seeded by the PR number.
- **P3 (protected):**
  - **A new `data-refresh.yml`:**
    - runs weekly with the App token;
    - restores `page-hashes.json` before committing, so it never conflicts with re-verify;
    - pushes to a rolling `claude/data-auto-<brand>` branch;
    - writes a PR body with a change table, flags, highlight links and the `unquoted-dates.mjs` output.
  - **A new `owner-tools.yml`:**
    - runs only on `workflow_dispatch`;
    - passes its inputs through `env:` [16];
    - offers three actions: `read-page`, `check-source` and `verify`.
  - Both workflows join `concurrency: crawl`.
  - The new commands in CLAUDE.md.

**The parser gate.** For every record whose quote is still on its page, the parser must reproduce `model`, `end_date`, `at_least`, regions and category exactly, or the run stops. A record whose quote has gone becomes a changed-row proposal or a report line. It is never set to `none_published` automatically.

**Tier C: features (only after Tiers A and B merge)**
- **C1:**
  - an M4 `/business` page in `scripts/build-site.mjs`, linking your Tally form (after H9b);
  - a "report a wrong date" link on each device page, prefilled through `template=wrong-date.yml`.
- **C2:**
  - M7 Atom feeds: `/feeds/ending-soon.xml`, `/feeds/ended.xml` and one per brand, dated using `scripts/status.mjs` rules;
  - a `/stats/` page built from `data-report.mjs`.
- **C3:**
  - an M6 free `/fleet/` checker in `site/fleet.js`: a CSV goes in and a table comes out, all in the browser, against `/api/v1/devices.json`;
  - a test that hostile CSV text is escaped;
  - optionally, `scripts/fleet-report.mjs` for hand-made paid reports.
- **C4:** M5 `?q=` search in `site/search.js`, and a `/tools/` bookmarklet.
- **C5: docs.**
  - RUNBOOKS:
    - O4 becomes "Recover failing housekeeping";
    - O5 becomes the weekly routine below;
    - new runbooks: O9 "Review a candidate data PR", O10 "Handle a correction or add-model issue", O11 "Check and add a source", O12 "Monthly, quarterly and yearly upkeep";
    - O1, O3, O6 and A1 to A9 are retired or folded in.
  - A review section in DATA-POLICY.
  - SPEC 5 to 7, PLAN and ROADMAP cut to the new scope.

**Your actions in Stage 1** (about 4 to 5 hours, *estimate*):
1. **Create the App** (15 minutes; human gate):
   - go to Settings > Developer settings > GitHub Apps > New, and turn the webhook off;
   - repository permissions: Contents, Pull requests, Issues and Actions set to read and write; Checks set to read; no Workflows permission;
   - install it on `sombreserotonin/Patchlife` only;
   - generate a private key;
   - add the variable `BOT_APP_ID`, the secret `BOT_APP_PRIVATE_KEY` and the variable `BOT_MERGE=off`.
2. **Merge P1, P2 and P3** following O2, about 20 minutes each.
   - They add only `schedule` and `workflow_dispatch` triggers.
   - On the first Dependabot PR, confirm the `needs-human-merge` label still gets added: Dependabot runs get a read-only token by default [11].
3. **Approve the five profiles in B2,** 20 to 30 minutes each.
4. **Settings** (15 minutes):
   - CodeQL default setup (Code security > CodeQL > Default) [12];
   - Dependabot security updates on;
   - Notifications > Actions: email, failed workflows only;
   - watch the repository;
   - add `data-gate` to the required checks in ruleset 25530330 [9].
5. **Unraid** (20 to 65 minutes):
   - `git clone --mirror`, then `remote update --prune` nightly;
   - a weekly `curl` export of issues and comments, which stays within the 60 unauthenticated requests an hour [17];
   - Kuma if you choose it, with the secret `KUMA_PUSH_URL`.
6. **Fill in `ops/renewals.yml`** (10 minutes): the registrar and expiry date for `patchlife.tech`, the App key's date, and the Node end-of-life date.

**Exit check:**
- `npm run validate` and `npm test` are green on `main` with R1 to R7 switched on.
- `node scripts/candidates.mjs --check` reproduces 100% of the audited records on each parsed page. Any misses are listed and stay manual.
- Each new workflow has been run once by hand.
- `reverify.yml`, dispatched with `due=0 limit=5`, produces a PR that the bot merges, followed by a Pages deploy.
- The M3 part 2 drill (a broken fixture source) passes again through the new workflows with no session.

### Stage 2: shadow fortnight (9 to 22 Nov, or earlier if Stage 1's exit check passes)

- Set `BOT_MERGE=on`.
- At claude.ai/code/routines, **pause, don't delete,** `Patchlife daily build` and `Patchlife nightly data`. Pausing keeps their settings [25].
- Nothing is due for re-verification until 21 Dec, so dispatch `reverify.yml` with `due=0 limit=40` on at least 5 days. This also spreads out the December wave.
- Review each candidate PR using O9, and time yourself.
- If Max renews during this window, switch to Pro billed monthly (US$20 [21]). Never take annual billing.
- **Exit check, over 14 consecutive days:**
  - the watchdog is clean, or its alerts are explained, every day;
  - at least 5 re-verify PRs are opened and merged with no session;
  - no re-verify branch is older than 36 hours;
  - stale records are under 2%, and the oldest `needs-human` item is under 7 days old;
  - no AI session runs, beyond at most one interactive fix;
  - your time is 60 minutes a week or less.

### Stage 3: retire and cancel (23 to 30 Nov)

- **P4 (protected):**
  - delete `.github/workflows/claude.yml`, `.agent/prompts/daily-build.md` and `.agent/prompts/data-refresh.md`;
  - rewrite CLAUDE.md's merge rule (`data-gate` and your audit) and its end-of-task steps;
  - add a "Frozen <date>" banner to `TASKS.md`, `ROADMAP.md`, `LOG.md`, `context.md` and `.agent/sessions/`, and move the open items to GitHub issues and milestones.
- **A docs PR with new decisions:**
  - D45: the bot's merge scope (amends D42);
  - D46: the rules, the regression test and your sample replace D20's second session (narrows D17);
  - D47: source profiles are binding;
  - D15, D27 and D35 are retired.
- **Your actions** (15 minutes):
  - delete both scheduled tasks;
  - uninstall the Claude GitHub App at github.com/settings/installations;
  - confirm there is no `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` secret;
  - disconnect GitHub in claude.ai;
  - cancel the plan.

  From then on, any scripted model call would need either an API key under Anthropic's commercial terms or a local model [22].
- **Exit check:** the plan is cancelled, and the next statement has no Anthropic charge.

### Stage 4: watch (1 Dec 2026 to mid-January 2027)

- The re-verification wave starts on 21 Dec. It covers about 695 records, less those already checked in Stage 2, at 40 a night: about 12 to 18 nights, over Christmas.
- **After 4 clean weeks, one last protected PR:**
  - move `decisions.md` to `docs/DECISIONS.md`;
  - move the hard rules to `CONTRIBUTING.md`;
  - cut CLAUDE.md down to a pointer to `CONTRIBUTING.md`, so any future tool or contractor still meets the rules;
  - delete `.claude/` once DATA-POLICY and RUNBOOKS hold the skill's rules.
- **Exit check:**
  - every record has been checked within the last 60 days;
  - the Measures rows are green;
  - a Monday summary has posted every week;
  - Kuma has raised no alerts.

## Finish with AI before cut-over

- Tiers A and B with their tests, and `--check` green against the live pages.
- B1's data fixes, audited by A8 while a second reader still exists.
- The coverage backlog, if you say yes to decision 5. Run these through the new parsers in 60-row batches, each audited by A8:
  - TP-Link AU (797 dates that no record quotes yet);
  - EZVIZ (119);
  - Google (about 40).
- A final security read of the code that renders user input: `site/search.js`, `scripts/build-site.mjs`, and `site/fleet.js` if C3 ships. After cut-over, only you and CodeQL review code.
- The Node 26 test, so the next forced Node upgrade isn't until 2029.
- `docs/OPERATIONS.md` and the O runbooks, written for someone who doesn't code every day.

## Scope cuts recommended

| Area | Cut to | Why |
|---|---|---|
| M5 store extension | `?q=` search and a bookmarklet | No store accounts (H10) and no store-review churn. Some retailers' content security policy may block the bookmarklet (unverified) |
| M6 API keys, webhook, Unraid service, supplier SKU check | A free fleet checker. If gate A says go, paid reports by hand: a Stripe invoice plus `fleet-report.mjs`. Stripe charges per transaction [31] | A billing server with secrets and uptime is the riskiest thing to run alone. Pages bars commercial services [13] (D40) |
| M7 email alerts | Atom feeds and `/stats/` | No email provider, no Spam Act duties, no personal data |
| Nightly source onboarding | A weekly refresh of the five sources, plus at most one new source a month, added by you | Nothing will read new pages for you |
| Issue triage bot, cross-check parser, local model tooling | Not built | No issue volume yet; double maintenance; the goal is no AI |
| `LOG.md`, sessions, `TASKS.md` | Frozen, with GitHub issues and milestones taking over | Nobody will write them |

## Weekly routine (new O5)

Do this on Monday morning, after the Sunday UTC runs:

| Step | Minutes (*estimate*) |
|---|---|
| Read the #27 summary, and the `watchdog` issue if it is open. Confirm the summary is under 8 days old: this is the only check on the watchdog itself | 5 |
| Candidate data PR (O9). Open the flagged rows and the sample through their highlight links. Check the date order, the model, "or later" against `at_least`, and the region. Fix any `category: other` in the web editor, add `audited` (until then `data-gate` stays red), then squash-merge | 0 to 20 |
| Spot-check the summary's 5 random records | 8 to 10 |
| Merge `needs-human-merge` PRs and clear `needs-human` items | 0 to 10 |
| Correction and add-model issues (O10) | 0 to 15 |
| Monthly work, averaged per week: Dependabot grouped PRs, Search Console indexing | 4 |
| Quarterly and yearly work, averaged per week: zone export, restore test, renewals, Node upgrade | 2 |
| **Typical week** | **30 to 45** |

A single red `Re-verify evidence` email is usually a transient error, and the next night retries it. Act only when the watchdog issue lists the record, which happens after 3 nights.

Incidents add 5 to 15 minutes a week on average (*estimate*). During M4, add 10 minutes a week for the weekly numbers.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| In a public repo, schedules switch off after 60 days without repository activity [5] | The monthly measures PR and Dependabot PRs create activity (which events count is unverified). The watchdog flags any workflow that isn't `active`, and Kuma flags a silent watchdog |
| Schedules run late or are dropped [7]; none has run in this repo yet | Schedules avoid the top of the hour. Re-verify takes the oldest records first, so missed nights catch up. The watchdog checks how old each last run is |
| A bug in the merge bot | Narrow allowlist, SHA pin, required `data-gate`, the protected-path label, the `BOT_MERGE` kill switch, and a test for each rule |
| The App's private key leaks | Use it only in scheduled and dispatched jobs, never in `pull_request` jobs. Least permissions. Rotate it yearly (whether keys expire is unverified). Revoke it in the App's settings |
| A site redesign breaks a parser | The sanity gate fails loudly. Re-verification keeps working because the verifier uses no parser. The affected records go `stale` until you fix the parser or pull them (O8) |
| One parser error repeats across many rows | The regression test on 695 audited records, `quoteMatches`, `date_order`, R1 to R7, your sample, and a full check of any new source's first PR |
| A maker adds a qualifier in prose, with no date | It shows only as a changed row or a footnote marker, plus the `unquoted-dates.mjs` output in each PR. Accept this as residual risk |
| A host blocks GitHub's runners | All six hosts passed the 21 Oct probe. If one blocks, run `npm run verify:evidence -- <ids>` from Unraid or your PC |
| You are away | The site keeps serving and re-verification continues; alerts wait for you. Stage 2 spreads out the December wave |
| A Node, npm or action change breaks CI | A pinned Node version, and monthly grouped Dependabot PRs with a cooldown. If a major version breaks, add an `ignore` entry rather than fixing code |
| A free tier changes | The mirror and issue backups, and the zone export. A static site can move to another host |
| Gain | No model reads untrusted pages or issues, so prompt injection leaves the system. The bot no longer acts as you |

## Rollback

- **Before cancelling (Stages 2 and 3), about 5 minutes:**
  - set `BOT_MERGE=off`;
  - resume both routines and use Run now. The prompts still handle `claude/reverify-*` branches;
  - you can resume just the nightly data task on its own;
  - if you are on Pro by then, check that the routines still run (unverified).
- **After cancelling, 1 to 2 hours:** resubscribe, `git revert` P4, reinstall the Claude GitHub App and recreate the routines (O6). Whether claude.ai keeps routines and environments after cancelling is unverified, so assume it doesn't.
- **Without a subscription:** see decision 6.

## Open decisions

1. **Create the GitHub App `patchlife-bot`?** Recommended: yes. Without it, every bot PR waits for your click.
2. **The Pangolin VPS.** If it is paid monthly, it is a subscription, and only M6 needs it (D40). Recommended: cancel it unless M6 goes ahead. If it does, try Cloudflare Tunnel from Unraid first; it is reportedly on all plans, but that is unverified [20].
3. **Max renewal.** Recommended: don't renew. If the renewal date falls before Stage 3, take Pro billed monthly for one month.
4. **Scope cuts.** Recommended: accept the table above.
5. **Clear the backlog before cancelling?** Recommended: yes for TP-Link AU and EZVIZ, in 60-row batches with A8 audits, once Tiers A and B are on `main`. Otherwise the weekly cap feeds the backlog in slowly.
6. **Break-glass.** Recommended: none by default. If a breakage beats you, the options are:
   - paste the log into a local model on the RX 9070 XT (llama.cpp Vulkan build on 127.0.0.1 [28]), which needs no account or secret;
   - a one-off Anthropic API key on prepaid credits with auto-reload off [24]. This involves account and spending gates, and costs about US$1 to 5 a fix at Sonnet 5.5 rates [23] (*estimate*);
   - a contractor.
7. **Uptime Kuma.** Recommended: run it on Unraid, not the VPS.
8. **Growth.** Recommended: stay with the five sources until the M4 gate result, then add at most one new source a month.
9. **Node version.** Recommended: pin 24 now, and move to 26 before cut-over if CI is green on it.
10. **Public bot posts.** The Monday summary on #27 and the `watchdog` issue are public posts. Recommended: approve their fixed templates once, when you review P2.
11. **Contractors.** Recommended: only once there is revenue. Use fixed-price quotes, a contract that assigns copyright to you (this keeps D10's relicensing option), work from a fork, and you merge. A$2,000 to 8,000 for SPEC 6's API is an unverified *estimate*; get 2 or 3 quotes.

## Sources

Items 1 to 4, 6 to 9, 15 to 20, 25 to 27 and 29 to 31 come from search summaries or third-party pages: docs.github.com and several other sites could not be opened from the research container. Re-check them before quoting them elsewhere. Repository facts come from the files named above and from `gh api` on 22 Oct 2026.

1. https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow
2. https://docs.github.com/en/actions/concepts/security/github_token
3. https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app
4. https://github.blog/changelog/2024-10-18-new-pat-rotation-policies-preview-and-optional-expiration-for-fine-grained-pats/
5. https://raw.githubusercontent.com/github/docs/main/data/reusables/actions/scheduled-workflows-disabled.md
6. https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs
7. https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
8. https://docs.github.com/en/billing/concepts/product-billing/github-actions
9. https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets
10. https://raw.githubusercontent.com/github/docs/main/content/code-security/reference/supply-chain-security/dependabot-options-reference.md
11. https://raw.githubusercontent.com/github/docs/main/content/code-security/reference/supply-chain-security/dependabot-on-actions.md
12. https://raw.githubusercontent.com/github/docs/main/content/code-security/concepts/code-scanning/setup-types.md
13. https://raw.githubusercontent.com/github/docs/main/content/pages/getting-started-with-github-pages/github-pages-limits.md
14. https://raw.githubusercontent.com/nodejs/Release/main/schedule.json
15. https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
16. https://docs.github.com/en/actions/concepts/security/script-injections
17. https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
18. https://github.com/louislam/uptime-kuma
19. https://developers.cloudflare.com/dns/manage-dns-records/how-to/import-and-export/
20. https://developers.cloudflare.com/tunnel/
21. https://claude.com/pricing
22. https://www.anthropic.com/legal/consumer-terms
23. https://platform.claude.com/docs/en/about-claude/pricing
24. https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-claude-api-usage
25. https://code.claude.com/docs/en/web-scheduled-tasks
26. https://www.rba.gov.au/statistics/frequency/exchange-rates.html
27. https://domainoffer.net/tld/tech?page=2
28. https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
29. https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment/Text_fragments
30. https://www.guideflow.com/tutorial/how-to-allow-github-actions-to-create-and-approve-pull-requests-in-a-repository
31. https://stripe.com/au/pricing