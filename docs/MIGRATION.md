# Migration: running Patchlife without AI or subscriptions

This is the plan as at 22 Oct 2026. It was revised the same day after a feasibility, fact and completeness review, and it is for the owner to follow. A step counts as done only when its exit check passes. *Estimate* marks a number nobody has measured. "Unverified" marks a fact nobody could confirm.

## Summary

- **End state.** No model runs anywhere in Patchlife, and nothing depends on a subscription.
  - Every recurring job is either deterministic code on GitHub Actions or a short task for you. Actions is free on standard GitHub-hosted runners in public repositories [8].
  - Today a model makes the judgement calls: reading a maker's row, the A8 audit, and repairs. That moves into per-source rules that code enforces, plus your weekly review.
  - The Claude scheduled tasks, the Claude GitHub App, Claude's GitHub authorisation and `claude.yml` are removed, and Max ends on 19 Nov 2026 without renewal.
- **Cost.** Subscriptions fall from Max to A$0.
  - Max is US$100 a month (5x) or US$200 (20x), before tax [21]. At US$1 = A$1.43 [26], that is about A$143 or A$286 a month, or A$1,700 to A$3,400 a year. Whether GST is added to Australian bills is unverified.
  - The only payment still required is the `patchlife.tech` renewal. The cheapest registrar listed renews `.tech` at US$32.62 a year [27], which is about A$47 a year or A$4 a month. Yours may charge more, so record the real price in `ops/renewals.yml`.
  - Check for other subscriptions (decision 13): `sombrexo.com` and the `admin@sombrexo.com` mailbox, Cloudflare's plan, Firecrawl, and Unraid's update licence. The Pangolin VPS is paid for your other projects, so Patchlife adds nothing to it (decision 2).
- **Your time.** About 30 to 45 minutes in a typical week, and up to about 70 in a busy one (*estimate*). PLAN budgets 10 minutes a week today. On top of that:
  - 1 to 3 hours for each new source, if you choose to grow (*estimate*).
  - When a redesign breaks a parser, 30 to 60 minutes to freeze that source and pull its records or wait. It takes 4 to 8 hours if the EZVIZ or TP-Link AU page moves, because those two pages carry 77% of the records. Expect perhaps 2 to 4 breakages a year (*estimates*).
  - About 7 to 9 hours of one-off work, spread over five weeks (*estimate*).
  - Not in the weekly figure: 30 to 60 minutes once, to set up Node and git on Windows if you want break-glass runs (*estimate*).
- **What you give up.**
  - Nightly growth: no new source arrives each night. The 10 queued sources in `seed.yaml` become issues, including the PDF-only ones (Aqara, Reolink, TP-Link UK and GoPro).
  - The independent second reader (D20). Rules, a regression test and your sample check replace it.
  - Self-repair (A7).
  - Most feature building: maintenance mode is the default. The recommended cuts are:
    - `?q=` search instead of a store extension (M5);
    - Atom feeds instead of email alerts (M7);
    - the business side (M4's demand test, and M6's paid feed, API and reports) waits in Planned until this setup is up and working (D45; see "Planned: the business side").
- **Timeline.**
  - 27 Oct: you answered decisions 1, 3, 4 and 5 on #102 (D46); 2 was settled on 22 Oct (the VPS stays). #101 is already merged, so nothing moves to Node 26 when it becomes LTS on 28 Oct.
  - 23 Oct to 4 Nov: build the replacements in parallel lanes, using the Max time you have already paid for. It ends on 19 Nov (D46), which sets every date below.
  - 5 to 18 Nov: run in shadow, with no AI doing operations. AI-audited backlog batches run in the same window, from when B4 merges.
  - By 18 Nov: Stage 3's PRs are open. On 19 Nov you remove the Claude pieces, and the plan ends.
  - 21 and 22 Dec: watch the first large re-verification.
- **Most of this depends on one human gate:** a private GitHub App for the bot (decision 1). Its steps are in #126.

## State on 22 Oct 2026

Checked with `git` and the GitHub API at 03:25 UTC:
- **#100 merged at 03:01 UTC.** It added the first version of this file, D44 (no AI model and no subscription, with this file as the plan) and the "superseded" note in COSTS. #98 merged at 02:07 UTC, so `reverify.yml` now archives up to 5 cited pages a night (D43).
- **#101 (P1) merged at 03:23 UTC.** The four working workflows are pinned to Node 24, and `.github/dependabot.yml` sends monthly grouped PRs. The Lighthouse change is in P2.
- **The business side is in Planned (D45).** You shelved M4 (the `/business` page, the waitlist and its privacy additions) and M6 (the paid feed, API keys, reports and supplier checks) until this setup is up and working. #99 keeps the drafts, labelled `planned`.
- **#102 (`needs-human`) asks for decisions 1 to 5.** This revision changes two of them and adds 12 to 15:
  - 2 is settled: the VPS stays, since you pay for it for other projects;
  - 4 now means maintenance mode by default and no bookmarklet; D45 settles its business part;
  - 5 now says when the batches run.
- **The repository has had 0 scheduled workflow runs.**
  - `reverify.yml` (`41 12 * * *`) first fires at 12:41 UTC today.
  - `pages.yml`'s `17 0 * * *` was due at 00:17 UTC today and had not run by 03:25.
  - Schedules are best effort and can be dropped [7], so watch the first runs before relying on them.
- **Heartbeat issue #27 has 0 comments.** The daily build's only scheduled run so far (19:09 UTC on 21 Oct) came before #29 added the step that posts there.
- **Ruleset 25530330:**
  - It requires a PR and the `test` check, with 0 approvals, non-strict checks and no bypass actors.
  - It also has `require_extra_approval_for_unattributed_changes: true`. No documentation I found explains this setting. It could hold PRs that the App opens; Stage 1 tests this.
- **Node.** The four working workflows are pinned to Node 24 (#101), whose end of life is 30 Apr 2028 [14].
- **Data.** There are 695 records:
  - EZVIZ 311, TP-Link 222, Ring 98, and 64 from Google and GL.iNet;
  - 340 were checked on 21 Oct and 355 on 22 Oct, so none is due before 21 Dec.
- **M3 exit check part 1** runs on the nights of 22 to 24 Oct UTC, on today's AI jobs. Decision 12 redefines it on the new jobs.
- ROADMAP is at `.agent/progress/ROADMAP.md`, not in `docs/`.

## End-state architecture

| Job | After cut-over | Trigger |
|---|---|---|
| Re-verify due records and archive 5 pages | `reverify.yml` checks every record due after 60 days. Its default `--limit` rises to 1000, which amends D42. It opens its own PR with the App token. Records it couldn't check are a warning, not a failure | `41 12 * * *`, plus dispatch with `due` and `limit` inputs |
| Merge re-verify and measures PRs | `scripts/merge-bot.mjs` in a new `housekeeping.yml` | `23 21 * * *` (08:23 Sydney daylight time the next day), plus dispatch |
| Merge every other PR (data, code, docs, protected, Dependabot) | You | By hand |
| Alarms and weekly summary | `scripts/watchdog.mjs`, in the same run. Any problem turns the run red and updates one `watchdog` issue. The Sunday UTC run posts a summary on #27, which you read on Monday morning | Same run |
| Measures, and keeping schedules alive | On the 1st (UTC), the same run opens a `claude/measures-<yyyy-mm>` PR. It regenerates `docs/MEASURES.md` from `node scripts/data-report.mjs`, and the bot merges it the next night | Same run |
| Dead-man's switch (optional) | An hourly Unraid script reads the public Actions API and the site. It notifies you after 26 hours of silence. It only makes outbound requests | Unraid |
| Build and deploy the site | `pages.yml`, with Lighthouse in its own job that runs only on pull requests | Push, `17 0 * * *`, dispatch |
| CI | `ci.yml`: `test`, `protected-paths` (with a longer list) and a licence check. A new `data-gate.yml`, required by the ruleset | Pull requests; `data-gate` also runs on label changes |
| New and changed rows on the five sources | `scripts/candidates.mjs` and per-source parsers, in a new `data-refresh.yml`. It opens one candidate PR of at most 60 rows | Weekly at `17 16 * * 0` (Monday 03:17 Sydney daylight time), plus dispatch |
| Audit (was A8, D20) | Rules R1 to R8 and the parser fixtures run in CI. The parser gate runs in each weekly refresh. You check a sample and add `audited` (O9) | Each candidate PR |
| Records Actions couldn't check | Retried the next night. Listed in the watchdog issue after 3 nights, and then you follow O11 (was A5) | Watchdog |
| Stale records (was A4) | If the model is still on the page, the weekly PR proposes the changed row. Otherwise the watchdog lists any record stale for 14 days, and you repoint or pull it (O8) | Weekly run, watchdog, then you |
| Correction and add-model issues | You, using a new `owner-tools.yml` (O10) | The weekly summary counts them |
| New sources | You (O11), or they wait as issues | Your choice |
| Dependencies and runtime | Monthly grouped Dependabot PRs (#101), CodeQL default setup, a pinned Node version | GitHub |
| Backups | Unraid: a nightly mirror and a weekly issues export. You: a quarterly Cloudflare zone export [19] | Unraid and you |
| Features | Maintenance mode: frozen once the cut scope ships | You |
| Any model | None. Break-glass by hand only (decision 6) | Never scheduled |

## Where the research disagreed, and the call made

1. **Bot identity.**
   - Events made with `GITHUB_TOKEN` start no new runs, except `workflow_dispatch` and `repository_dispatch` [1].
   - A PR it opens gets `pull_request` runs only after someone with write access clicks "Approve workflows to run" [2]. So the required `test` check would never run unattended.
   - **Decision: use a private GitHub App.** Each run mints a token with `actions/create-github-app-token@v3`. The token expires after an hour and is revoked when the job ends [3].
   - A fine-grained PAT would act as you, for up to 366 days or with no expiry [4].
   - **Zero-secret fallback:** turn on "Allow GitHub Actions to create and approve pull requests", which is off by default for repositories in a personal account [30]. Then click "Approve workflows to run" on each bot PR [2].
2. **What the bot may merge.** **Decision: a narrow rule.** The bot merges a PR only when all of these hold:
   - the App opened it, from a `claude/reverify-*` or `claude/measures-*` branch in this repository, never a fork;
   - it has no `needs-human` or `needs-human-merge` label;
   - `test`, `data-gate` and the Pages `build` check passed on the head SHA. The PR-only `lighthouse` job doesn't count, so one slow runner can't stall re-verification;
   - its files fit its type:
     - a re-verify PR touches only `data/devices/**` and `data/sources/page-hashes.json`, and passes `verification-only.mjs`. That script ignores everything outside `data/`, so it can't be the only check;
     - a measures PR touches only `docs/MEASURES.md`.

   The bot merges at the head SHA it checked, then deletes the branch, because `reverify.yml` stops while any `claude/reverify-*` branch exists. You merge every other PR.
3. **Where the A9 rule is enforced.** **Decision: a required `data-gate` check in its own `data-gate.yml`**, so that a label change doesn't re-run `test` and Lighthouse.
   - **When it runs:** on `opened`, `synchronize`, `reopened`, `labeled` and `unlabeled`, with no `paths:` filter.
   - **What it compares:** it checks out with `fetch-depth: 2` and runs the base branch's copy of `scripts/verification-only.mjs` against `HEAD^1`. A PR therefore can't weaken the check it is judged by.
   - **When it passes:**
     - when that script prints `Only verification changed`, which is also true for PRs that change no data; or
     - when the PR carries `audited` and the issue events API shows the repository owner added it.
   - **On every push** (`synchronize`), it removes `audited`, so each new push needs a fresh review. The App can never audit its own PR. Until cut-over, A8 sessions act as you, so their `audited` label counts.
   - **Ruleset:** add it to ruleset 25530330 only after it has reported once. Until then, every PR would wait on "Expected".
4. **How rows become records.** The options were per-source modules, one generic regex parser, or parsers plus a separate cross-check reader. **Decision:**
   - **One cell-based reader, `scripts/table-rows.mjs`.**
     - It splits `<tr>` and `<td>`/`<th>` on the raw HTML, then runs the verifier's `htmlToText` on each cell.
     - It keeps `<sup>` content as a separate footnote marker, and asserts `quoteMatches` against the page text.
     - Run on the whole page instead, `htmlToText` loses the cell boundaries, and NFKC turns "Tapo C200¹ 31/12/2027²" into "Tapo C2001 31/12/20272".
   - **Thin per-source parsers.**
   - **A per-source profile** in `data/sources/seed.yaml`, which both the parsers and the validator read.
   - **Defer the cross-check readers.**
     - The AI audits never caught a wrong date, only judgement fields (`.agent/progress/LOG.md` lines 14, 30, 45 and 46), and the profile rules check those fields.
     - A second parser would double the repair work after every site redesign.
   - **If a page isn't a plain `<table>`** (the markup of the five pages is unverified), an HTML parser dependency means a `package.json` change. That goes in its own protected PR, with a D9 licence check.
5. **How often data refreshes.** **Decision: weekly, one candidate PR of at most 60 rows** (*estimate*; today's audited batches are about 60).
   - Changed rows on any brand come first. New rows follow, one brand at a time until that brand's backlog is empty.
   - While that PR is open, the next run skips and says so in the summary, rather than pushing over your review.
6. **An issue triage bot.** **Decision: not now.**
   - No correction or add-model issue has ever been opened.
   - A bot would add an `issues` trigger and public comments, and public comments are a human gate.
   - Revisit if issues pass 2 a week.
7. **Heartbeat.** **Decision: report problems only** (a red run and the `watchdog` issue), plus the Monday summary.
   - There is no daily line.
   - The dead-man's switch only makes outbound checks from Unraid. A push monitor would need a public URL on Unraid, through the Pangolin VPS; the outbound check needs none, so nothing new is exposed.
8. **Orphaned re-verify branches.** **Decision: report them, don't delete them.**
   - Deleting a branch whose PR was closed unmerged takes you two clicks, and leaving it to you keeps the bot's rights small.
   - The bot does delete the branches it has just merged.
9. **Node version.** **Decision: pin 24 now (#101)**, so nothing jumps on 28 Oct.
   - Test Node 26 before cut-over. If CI is green, move to it: its end of life is 30 Apr 2029.
   - Otherwise stay on 24, whose end of life is 30 Apr 2028 [14].
10. **Exchange rate.** **Decision: US$1 = A$1.43.** The March 2026 average was US$0.7018 per A$1, which is about A$1.425 per US$1 [26]. The RBA's own table could not be reached.
11. **Local model.** **Decision: build nothing for it.**
    - Use one by hand only, if ever (decision 6).
    - Never run one unattended with a write token on a home PC.
12. **`.agent/` and CLAUDE.md.** **Decision: freeze them at cut-over, and move them after the rollback window** (Stage 4). The PR that moves them is prepared before cancelling.
13. **Re-verification batch size.**
    - `verifyDevices` fetches each cited page once per run. So `--limit 40` doesn't lower the load on any host: it is at most 19 pages either way.
    - **Decision: raise the default limit to 1000 once the bot merges** (amends D42).
    - The December wave then takes 2 nights instead of 12 to 18, and nobody needs to spread it by hand.
14. **Runs that fetch pages.**
    - With the default `queue: single`, a newly queued run cancels the run already waiting in the same concurrency group [15].
    - **Decision: one `crawl` group with `queue: max`** for `reverify.yml`, `data-refresh.yml`, `probe-hosts.yml` and `owner-tools.yml`. It allows up to 100 waiting runs, and GitHub's docs source shows it is live on github.com [15].
    - Schedules also stay hours apart, and the watchdog treats a `cancelled` run as a failure.

## Staged plan

### Stage 0: decide and record (22 to 27 Oct, Max)

- **Done:** #100 put this plan, D44 and the COSTS note on `main`.
- This revision lands as a docs PR, as #102 promised.
- **Done 27 Oct:** you answered decisions 1, 3, 4 and 5 on #102 (D46): create the App (steps in #126), don't renew Max, accept the scope cuts, and decision 5 as recommended. Decision 2 was settled on 22 Oct, and #101 merged then.
- **Let M3 exit check part 1 run as scheduled.** If it fails, note it on #102. Don't spend Max time repairing the daily build, because decision 12 redefines part 1 on the new jobs.
- **Tonight's re-verify run pushes its first branch.** If the daily build hasn't merged it by 12:00 UTC on 23 Oct, merge it yourself (A9):
  - open a PR from the branch on GitHub;
  - merge it once `test` passes.

  Otherwise the next run stops at its guard.
- **Exit check:**
  - a scheduled `Re-verify evidence` run has happened, and its branch has been merged per A9;
  - #101 is merged;
  - decisions 1 to 5 are answered.

  All three held on 27 Oct.

### Stage 1: build (23 Oct to 4 Nov, Max)

Run parallel sessions in separate files (D19, D26), each with one reviewer and no multi-agent reviews. P1 (#101), A1, B1, P2 (#128), B5 (#133), C4 (#132), C1 (#134), C2 (#136) and A2's first part (#137) have merged, all by 27 Oct. B2 is open as #135 for your profile approval, and B3 is being built on its branch in a `Crawl` session. That leaves:
- B3, then B4, each reviewed here; B2 merges when you add `audited`;
- A2's second part (O9, O10 and O8's bulk actions) and P3, once B4 has merged; then C5.

All of it lands by 4 Nov, because Max ends on 19 Nov (D46) and the shadow fortnight needs the days before it. Tier C starts only after Tiers A and B have merged, and only if it fits before 4 Nov; otherwise cut it.

**Tier A: housekeeping and runbooks (required before cancelling)**
- **A1 (unprotected; done 22 Oct: the merge bot, licence check and renewals in #109, then `scripts/watchdog.mjs`):**
  - `scripts/merge-bot.mjs` and `scripts/watchdog.mjs`;
  - `scripts/check-licences.mjs`: checks each `package-lock.json` entry's `license` against the lists in D9 and D30. All 116 entries carry one (22 Oct), so a missing licence is reported for a person to look at, with no fallback;
  - tests using an injected fetch. They cover forks, each label, red checks, files outside the allowlist, a SHA that moved, and an `audited` label added by the App;
  - `ops/renewals.yml`.
- **P2 (protected; merged 27 Oct as #128, after the App was created in #126. Your steps 1 to 4 from its description are done: the dry run minted a token, a manual re-verify opened #130 as the bot with every check green, `data-gate` is required in the ruleset, and the bot merged #130 with `BOT_MERGE=on`):**
  - **A new `housekeeping.yml`:**
    - runs on `23 21 * * *` and on `workflow_dispatch`, and mints the App token;
    - checks out with `fetch-depth: 0`, because the watchdog dates stale records from git history, and passes `GH_TOKEN` and `GITHUB_REPOSITORY`;
    - runs `merge-bot.mjs` behind the `if: vars.BOT_MERGE == 'on'` kill switch, then `watchdog.mjs`;
    - opens the measures PR when `date -u +%d` is `01`;
    - posts the summary when `date -u +%u` is `7`.
  - **`reverify.yml`:**
    - mints the App token and passes it to `actions/checkout` as `token:`, because a push made with `GITHUB_TOKEN` triggers no CI;
    - opens its own PR through `gh api`;
    - gains `due` and `limit` inputs, with a default of `--limit 1000`;
    - turns "Flag records that could not be checked" into a `::warning::`, keeping the step name "Push verification changes" and the annotation title "Records not checked", which the watchdog reads;
    - falls back to today's push-only path when `vars.BOT_CLIENT_ID` is empty.
  - A new `data-gate.yml` (decision 3). Its job must be named exactly `data-gate`: `merge-bot.mjs` (A1) requires a check run of that name from GitHub Actions on the head commit, so any other name means nothing ever merges.
  - **`pages.yml`:** Lighthouse moves to its own `lighthouse` job, with `if: github.event_name == 'pull_request'`. A score dip then can't block the daily rebuild that moves statuses (D7), or a bot merge.
  - **`ci.yml`:** the licence check.
  - **`concurrency: { group: crawl, queue: max }`** on `reverify.yml` and `probe-hosts.yml` [15].
  - **`.agent/prompts/daily-build.md`:** merge an existing re-verify PR instead of opening one, so the daily build and the workflow don't race.
  - The new commands in CLAUDE.md.

  While `BOT_MERGE=off`, the daily build keeps merging.
- **A2 (unprotected; docs for someone who doesn't code every day). First part merged 27 Oct (#137): OPERATIONS, O4, O5, O11, O12, DATA-POLICY's review section and PLAN's decision 12 lines; O9, O10 and O8's bulk actions follow B4 and P3:**
  - **`docs/OPERATIONS.md`:** settings, alerts, backups, cut-over and rollback.
  - **RUNBOOKS, rewritten:**
    - O4 becomes "Recover failing housekeeping";
    - O5 becomes the weekly routine below;
    - O8 gains the bulk `withdraw` and `repoint` actions.
  - **RUNBOOKS, new:**
    - O9 "Review a candidate data PR", which replaces A8 for you;
    - O10 "Handle a correction or add-model issue", which replaces A3;
    - O11 "Check and add a source", which replaces A2 and A5;
    - O12 "Monthly, quarterly and yearly upkeep".
  - **RUNBOOKS, folded or retired:**
    - A4 folds into O9 and O8;
    - A9 becomes the merge bot and `data-gate`;
    - O1, O3, O6, A1, A6 and A7 are retired at cut-over.
  - **DATA-POLICY:** a review section that holds the rules of the `add-device-record` skill.
  - **PLAN:** decision 12's changes, and the Measures rows pointed at `docs/MEASURES.md`.

**What the watchdog checks:**
- **Workflows:** any workflow that is not `active`. It only alerts: whoever re-enables a scheduled workflow gets its failure emails [6], so you re-enable it yourself.
- **Run ages:**
  - the last re-verify run whose "Push verification changes" step succeeded is over 48 hours old;
  - the last Pages deploy is over 36 hours old. The watchdog then also dispatches `pages.yml`;
  - any run in the `crawl` group was `cancelled`.
- **Branches:** a `claude/reverify-*` branch is over 36 hours old, or its PR was closed unmerged.
- **Unchecked records:** the same ids appear under "Records not checked" on 3 nights running.
- **Data health (PLAN Measures):**
  - a record has been `stale` for over 14 days;
  - stale records are 2% or more;
  - the oldest `needs-human` item is over 7 days old.
- **Candidate PR:** it has been open for over 14 days, so the weekly refresh keeps skipping.
- **The site:** `https://patchlife.tech/` doesn't answer 200, or its "Status as at" is over 2 days old.
- **Renewals:** an item in `ops/renewals.yml` falls due within 60 or 14 days.

**The Sunday summary also includes:**
- open `needs-human-merge` PRs;
- open issues, by label;
- the first four lines of `data-report.mjs`;
- 5 random records with text-fragment links, for your spot check [29].

**Tier B: data without AI**
- **B1 (unprotected; data, audited by A8 while AI is still available). Done 22 Oct, #105 to #108, each audited:** Ring's "at least" sentence is now quoted on all 98 records (#105). The 15 UK and AU records were right: all three regional pages name amazon.com and ring.com word for word. Both aliases went (#106, #107; Fortify is a separate GL.iNet product). TP-Link's page itself writes "v1" on those two rows, so they were right too (#108). The original list:
  - add Ring's "at least" sentence as a second evidence item on the 98 Ring records. They have `at_least: true`, but no "at least" in the quote;
  - fix the 2 failing aliases: `Fortify (GL-MT6000)` on `gl-inet-gl-mt6000`, and `Nest Cam IQ Outdoor` on `google-nest-cam-iq-indoor-and-outdoor`;
  - fix the 15 non-US Ring records that carry the US purchase condition, if Ring's GB and AU pages don't state it (unverified);
  - match the 2 TP-Link records with a lowercase "v1" in `conditions` to the page's casing.

  B1 merges before B2, so CI stays green.
- **B2 (unprotected): source profiles and rules. Open as #135 since 27 Oct, reviewed, waiting on your `audited` label (action 3 below).**
  - **New profile fields,** in `data/schema/source.schema.json` and `seed.yaml`:
    - `regions_by_url`;
    - `at_least`, with its sentence;
    - the allowed `conditions` sentences for each URL, with a `{version}` placeholder;
    - `notes` templates;
    - `category_map` and `category_exceptions`;
    - `versioned` and `min_rows`;
    - Ring's hand-kept rename table;
    - parser exceptions.
  - **The Ring profile gains the AU page** (`ring.com/au/en/support/articles/ri2p1/...`). 49 records cite it, but `seed.yaml` doesn't list it.
  - **`scripts/validate-data.mjs` gains rules R1 to R8:**
    - R1: each alias is quoted, is the model with the brand in front, or comes from the rename table;
    - R2: regions stay within the profile;
    - R3: `at_least` is stated in a quote. The profile names the sentence, because makers word it differently: Ring says "until at least four years" (#105), Kyocera "At no point shall the support periods advertised on this webpage be reduced" (#111);
    - R4: `conditions` is one of the profile's sentences for a cited URL. All 222 TP-Link records carry "Hardware version <version> only." (126 of them V1), so the placeholder is needed. It takes the version exactly as the cited row writes it, since two rows write "v1" (#108);
    - R5: a footnote marker needs its footnote item;
    - R6: versioned models carry their version;
    - R7: the category comes from the map or is a listed exception;
    - R8: no unquoted value under `data/` contains ` #` or `: `. Today D25 relies on the model remembering this.
  - **Fixtures:** each rule gets one. Each past audit catch (#21, #22, #24 and #51) also gets one, and those must fail.
- **B3 (unprotected, after B2):**
  - `scripts/table-rows.mjs` (decision 4), with a fixture for fused footnote markers;
  - `scripts/parsers/tp-link-au.mjs` and `ezviz-eol.mjs`, which cover 533 of the 695 records;
  - `scripts/candidates.mjs [--check] [--limit n] [brand ...]`:
    - it matches existing records by normalised quote, never by generated id, so it can't create duplicates;
    - `--check` reports any id mismatch;
  - synthetic fixtures with made-up models in `tests/fixtures/parsers/`:
    - copies of makers' pages would break the "never whole pages" promise in CRAWLER.md and on the methodology page;
    - `--check` runs against the live pages instead.
- **B4 (unprotected):**
  - **The Ring parser:** merges the US, GB and AU pages, takes renames from the profile's table (Ring's renames come from a prose article, not a table), and handles D33 splits.
  - **The Google parser:**
    - reads the release date, the end date and the Yes/No cell from the row, for example "Nest Learning Thermostat (4th gen) 8/20/2024 8/20/2029 Yes";
    - never computes a date. `addYears` from `validate-data.mjs` is only a cross-check.
  - **The GL.iNet parser:** conflicts are flagged per D39, never written.
  - **Notes** are regenerated from the profile's templates. Google's dated "currently receiving critical security updates" note then follows the Yes/No cell, which the quotes include.
  - **Changed-row proposals,** which are the deterministic version of A4.
  - **A sanity gate:** a run that finds under 90% of the known rows fails as "parser broken".
- **B5 (unprotected; merged 27 Oct, #133):**
  - `scripts/page-text.mjs`: the A2 step 3 snippet;
  - `scripts/check-source.mjs`: robots.txt, HTTP status, date count and sample rows;
  - `scripts/audit-sample.mjs`: 3 records or 5%, at most 10, seeded by the PR number;
  - `scripts/repoint-source.mjs <old> <new>`: moves every record that cites a page to its new URL, and re-verifies them in one go;
  - the M3 part 2 drill as an `npm test` case: a broken fixture source on a local server. It then runs on every PR.

  The fetching scripts need `node --use-env-proxy` in `Crawl` (D16). CLAUDE.md documents them like the existing commands.
- **P3 (protected, after B4 and B5). First part merged 27 Oct (#140: `owner-tools.yml` and the CLAUDE.md lines for the owner's scripts); the second part, below, follows B4:**
  - **A new `data-refresh.yml`:**
    - its weekly schedule (`17 16 * * 0`) acts only when the variable `DATA_REFRESH` is `on`, which you switch on in Stage 2. So it never doubles up with the nightly `Crawl` task, which hits the same hosts at 14:17 UTC;
    - mints the App token for checkout, push and PR;
    - restores `page-hashes.json` before committing, so it never conflicts with re-verify;
    - skips while the last candidate PR is open. The exception is a dispatch with `refresh_open_pr: true`, which re-runs the parsers on that PR's branch and pushes a new commit, never a force-push;
    - writes a PR body with a change table, flags, highlight links and the `unquoted-dates.mjs` output.
  - **A new `owner-tools.yml`:**
    - runs only on `workflow_dispatch`, and passes its inputs through `env:` [16];
    - offers five actions:
      - `read-page` and `check-source`;
      - `verify`, which pushes `claude/reverify-manual-<run id>` and opens a PR that the bot merges;
      - `repoint` and `withdraw`, which open PRs for you to merge.
  - Both workflows join the `crawl` group.
  - **The `protected-paths` regex gains:**
    - `scripts/merge-bot.mjs`, `scripts/watchdog.mjs`, `scripts/verification-only.mjs` and `scripts/validate-data.mjs`;
    - `data/sources/seed.yaml`, because profiles become binding (D49);
    - `data/schema/`.
  - The new commands in CLAUDE.md.

**The parser gate.**
- For every record whose quote is still on its page, the parser must reproduce `model`, `end_date`, `at_least`, regions, category, `conditions` and `notes` exactly, or the run stops.
- A record whose quote has gone becomes a changed-row proposal or a report line. It is never set to `none_published` automatically.
- A fix the parser doesn't reproduce stops the next run. So fixes go into the profile, or its exceptions list, never only into a record.

**Tier C: features (only after Tiers A and B merge)**
- **C1:** a "report a wrong date" link on each device page, prefilled through `template=wrong-date.yml`. Done 27 Oct (#134). (The `/business` page is in Planned, D45.)
- **C2 (done 27 Oct, #136):**
  - M7 Atom feeds: `/feeds/ending-soon.xml`, `/feeds/ended.xml` and one per brand, dated using the rules in `scripts/status.mjs`;
  - a `/stats/` page built from `data-report.mjs`.
- **C3:** moved to Planned with the business side (D45): the free `/fleet/` checker and hand-made paid reports.
- **C4:** M5: `?q=` handling in the existing `site/search.js`. No bookmarklet. Done 27 Oct (#132).
- **C5: docs.**
  - SPEC sections 5 to 7, PLAN and ROADMAP cut to the new scope.
  - ARCHITECTURE lines 15 to 33 (the daily build, the `Crawl` allowlist and the agent threat model), rewritten for runners and you.

**Your actions in Stage 1** (about 4 to 5 hours, *estimate*):
1. **Create the App.** Done on 27 Oct (#126: `patchlife-bot`, installed on this repository only, with `BOT_APP_ID`, `BOT_CLIENT_ID`, `BOT_MERGE=off`, `DATA_REFRESH=off` and the secret `BOT_APP_PRIVATE_KEY`).
   - Go to Settings > Developer settings > GitHub Apps > New, and turn the webhook off.
   - Repository permissions:
     - Contents, Pull requests, Issues and Actions: read and write;
     - Checks: read;
     - Workflows: none.
   - Install it on `sombreserotonin/Patchlife` only, and generate a private key.
   - Add these to the repository:
     - the variables `BOT_APP_ID` and `BOT_CLIENT_ID`. GitHub's current `actions/create-github-app-token` example takes the Client ID, and older ones the App ID;
     - the secret `BOT_APP_PRIVATE_KEY`;
     - the variables `BOT_MERGE=off` and `DATA_REFRESH=off`.
2. **Merge P3** following O2, about 20 minutes, then run the steps in its description. (P2 is merged and its steps are done, 27 Oct; #101 is merged.)
   - Between them, they add only `schedule`, `workflow_dispatch` and `pull_request` triggers. None uses `pull_request_target`.
   - Expect `protected-paths` to fail on Dependabot's PRs, because their runs get a read-only token [11]. Merge those yourself once `test` is green.
3. **Approve the seven profiles in B2 (#135),** 20 to 30 minutes each, including the `conditions` sentences and the category maps; the PR's review comment lists what to read. Add the `audited` label yourself when you are satisfied (only your own label event counts), then merge it or leave it for a session.
4. **Settings** (15 minutes):
   - CodeQL default setup (Code security > CodeQL > Default) [12];
   - Dependabot security updates on;
   - Notifications > Actions: email, failed workflows only [33];
   - watch the repository;
   - once `data-gate` has reported on a PR, add it to the required checks in ruleset 25530330 [9];
   - a branch ruleset for `claude/reverify-*` and `claude/measures-*` that lets only the App push and blocks force pushes. Without it, anyone with write access (including AI sessions acting as you before cut-over) could push to a bot branch, and any workflow with `checks: write` could post a check run named `test` under GitHub Actions' name. Whether a personal account's rulesets can list an App as the only bypass actor is unverified.
5. **Unraid** (20 to 65 minutes):
   - `git clone --mirror`, then `git remote update --prune` nightly;
   - a weekly `curl` export of issues and comments, which stays within the 60 unauthenticated requests allowed an hour [17];
   - the dead-man's switch, if you choose it (decision 7).
6. **Fill in `ops/renewals.yml`** (10 minutes):
   - `patchlife.tech`: registrar, expiry date and price;
   - `sombrexo.com` and its mailbox;
   - Cloudflare's plan and Unraid's licence;
   - the App key's creation date. Keys don't expire [32], so rotate it yearly;
   - Node 24's end of life.

**Exit check:**
- `npm run validate` and `npm test` are green on `main` with R1 to R8 switched on, including the M3 part 2 drill and the licence check.
- `candidates.mjs --check` reproduces 100% of the audited records on each parsed page. Any misses are listed and stay manual.
- Each new workflow has been run once by hand.
- The bot merges a test PR:
  - set `BOT_MERGE=on` for the test;
  - dispatch `reverify.yml` with `due=0 limit=5`, then `housekeeping.yml`;
  - the bot merges the PR, and a Pages deploy follows;
  - if the ruleset holds the PR, turn off `require_extra_approval_for_unattributed_changes`;
  - set `BOT_MERGE` back to `off`.

### Stage 2: shadow fortnight (5 to 18 Nov, or earlier if Stage 1's exit check passes)

- Set `BOT_MERGE=on` and `DATA_REFRESH=on`.
- At claude.ai/code/routines, **pause, don't delete,** `Patchlife daily build` and `Patchlife nightly data`. Paused tasks keep their settings [25].
- **Exercise the re-verify path.** Nothing is due until 21 Dec, so dispatch `reverify.yml` with `due=0 limit=40` on at least 5 days:
  - dispatch between 21:30 and 12:30 UTC (08:30 to 23:30 Sydney);
  - once CI is green, dispatch `housekeeping.yml` before 12:41 UTC. Otherwise the scheduled run stops at its guard.
- Review each candidate PR using O9, and time yourself.
- **The backlog batches (decision 5)** run in interactive sessions with A8 audits from when B4 merges until 18 Nov, and you merge them. They don't count against the no-AI criterion below, which covers operations only. Whatever is left on 18 Nov goes to the weekly PR.
- Max ends on 19 Nov, the day after this window, and isn't renewed (D46). A session fixes what the shadow finds before then; after that, anything found becomes an issue for you.
- **Exit check, over 14 consecutive days:**
  - the watchdog is clean every day, or its alerts are explained;
  - at least 5 re-verify PRs are opened and merged with no session;
  - M3 part 1, redefined: 3 consecutive nights of `reverify.yml` and `housekeeping.yml`, plus one `data-refresh.yml` run, all end correctly with no session;
  - no re-verify branch is older than 36 hours;
  - stale records are under 2%, and the oldest `needs-human` item is under 7 days old;
  - no session runs any operation, beyond at most one interactive fix;
  - your time is 60 minutes a week or less, not counting one-off setup.

### Stage 3: retire (PRs by 18 Nov; your actions on 19 Nov)

Sessions open the PRs below by 18 Nov, while Max is still active. On 19 Nov you remove the Claude pieces and let the plan end, then merge P4 last, so a rollback before that needs no revert.
- **P4 (protected):**
  - delete `.github/workflows/claude.yml`, `.agent/prompts/daily-build.md` and `.agent/prompts/data-refresh.md`;
  - rewrite CLAUDE.md's merge rule (`data-gate` plus your audit) and its end-of-task steps;
  - add a "Frozen <date>" banner to `TASKS.md`, `ROADMAP.md`, `LOG.md`, `context.md` and `.agent/sessions/`;
  - move the open items to GitHub issues and milestones. That includes:
    - the source queue: the 10 `seed.yaml` sources never checked, among them the PDF-only Aqara, Reolink, TP-Link UK and GoPro;
    - any leads not finished in "Finish with AI".
- **A copy PR.** This is public text, so you approve the wording.
  - **The About page:** `scripts/build-site.mjs` line 564 says "Claude Code, an AI coding tool, builds and runs Patchlife", and `tests/build-site.test.mjs` line 408 pins it. A possible wording: "One person runs Patchlife. Scripts on GitHub re-check every quote against the maker's page, and the owner reviews each batch of new records before it is published."
  - **The review lines:** "This record is being reviewed" and "Under review until new evidence is found" (lines 231, 232 and 519). For example: "waiting for a manual check".
  - **Other docs:**
    - README lines 15 and 140 to 154;
    - BRIEF line 40;
    - CRAWLER.md: requests now come from GitHub's runners and your own machines;
    - DATA-POLICY line 39, which names Claude Code's fetch tool.
- **A docs PR with new decisions:**
  - D47: the bot's merge scope and the raised nightly limit (amends D42).
  - D48: the rules, the regression test and your sample replace D20's second session (narrows D17).
    - Data you write yourself has no second reader.
    - On a parsed source, the parser must reproduce your edit.
    - On any other source, you re-read it through its highlight link the next day.
  - D49: source profiles are binding.
  - D50: manufacturer pages are read only through the polite fetcher, on GitHub's runners (`owner-tools.yml`) or your own machine. The `Crawl` environment is retired.
  - Retired: D12, D15, D22, D26, D27 and D35, the environment clause of D17, and the parallel-session clause of D19.
- **The Stage 4 PR, opened as a draft** (see Stage 4), because no session will exist later to write it.
- **Your actions** (about 20 minutes):
  - delete both scheduled tasks;
  - uninstall the Claude GitHub App at github.com/settings/installations;
  - revoke Claude at github.com/settings/apps/authorizations, because sessions act as you. Whether uninstalling the App also revokes this is unverified;
  - confirm there is no `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` secret;
  - remove the claude.ai connectors (Firecrawl, D35), and disconnect GitHub in claude.ai;
  - cancel Firecrawl, if it is a paid account (unverified);
  - let the plan end on 19 Nov (it is set not to renew) and check that no renewal is pending;
  - merge P4, then delete the `claude` label.

  From then on, any scripted model call would need either an API key under Anthropic's commercial terms, or a local model [22].
- **Exit check:**
  - the plan has ended on 19 Nov with no renewal;
  - P4 is merged;
  - the next statement has no Anthropic charge.

### Stage 4: watch (20 Nov 2026 to mid-January 2027)

- The re-verification wave arrives on 21 and 22 Dec: about 340 and then 355 records, less those already checked in Stage 2. Each night's due records go through in one run.
- **After 4 clean weeks and the December wave,** mark the draft Stage 4 PR ready and merge it (protected). It:
  - moves `decisions.md` to `docs/DECISIONS.md`;
  - moves the hard rules to `CONTRIBUTING.md`, and adds both files to `protected-paths`;
  - cuts CLAUDE.md down to a pointer to `CONTRIBUTING.md`, so any future tool or contractor still meets the rules;
  - deletes `.claude/`, since DATA-POLICY and RUNBOOKS now hold the skill's rules (A2).

  If it no longer merges cleanly, close it: frozen files do no harm.
- **Exit check:**
  - no record was last checked more than 62 days ago;
  - the Measures rows are green;
  - a summary has posted every week;
  - the dead-man's switch has raised no alerts.

## Finish with AI before cut-over

- Tiers A and B with their tests, and `--check` green against the live pages.
- B1's data fixes, audited by A8 while a second reader still exists.
- The first PR from each new parser, audited in full by A8, so you never do a first-PR check yourself. Otherwise budget about 45 to 60 minutes per brand (*estimate*).
- The coverage backlog, if you say yes to decision 5. Run it through the new parsers in about 16 batches of 60 rows, each audited by A8, from when B4 merges (about 3 Nov) to 18 Nov (*estimate*); the nightly data task's revisit PRs (RUNBOOKS A5 step 4) count toward it until the shadow starts, and whatever is left goes to the weekly PR:
  - TP-Link AU: 797 dates that no record quotes yet. Each new product family needs a `category_map` line, which takes 5 to 10 minutes of your approval each (*estimate*);
  - EZVIZ: 119;
  - Google: about 40.
- **Leads that aren't table rows.** Finish them, or file them as issues:
  - Google's AU regulatory statements: TV Streamer 4K, Nest Mini, Nest Wifi Pro, Nest x Yale Lock;
  - TP-Link's TC and TD rows;
  - the unsettled Ring renames (#44, #45).
- A sixth brand from the PDF-only queue, only if decision 12 asks for one and time allows.
- **Two security reads, each by a fresh reviewer:**
  - the code that renders user input: `site/search.js` and `scripts/build-site.mjs`;
  - the code that holds the App key or the right to merge: `merge-bot.mjs`, `watchdog.mjs`, `data-gate.yml`, and every workflow that mints the App token.

  Reviewing P2 to P4 for 20 minutes each is not a security review for someone who doesn't code every day. After cut-over, only you and CodeQL review code.
- The Node 26 test, so the next forced Node upgrade isn't until 2029.
- `docs/OPERATIONS.md` and the O runbooks (A2), written for someone who doesn't code every day.

## Scope cuts recommended

| Area | Cut to | Why |
|---|---|---|
| Feature work in general | Maintenance mode by default | Once no model builds anything, your time is the limit |
| M4 business page and waitlist | Planned (D45): after Stage 4, from the drafts in #99 | You shelved the business side until this setup is up and working |
| M5 store extension | `?q=` search in the existing `site/search.js` | No store accounts (H10), no store-review churn, nothing extra to maintain |
| M6 API keys, webhook, Unraid service, supplier SKU check | Planned (D45), with the free fleet checker that would have stood in for them | As above. When it resumes, a billing server with secrets and uptime is still the riskiest thing to run alone, and Pages bars commercial services [13] (D40). Stripe charges per transaction: from 1 Oct 2026, domestic online cards cost 1.65% + A$0.30 [31] |
| M7 email alerts | Atom feeds and `/stats/` | No email provider, no subscriber list, no personal data |
| Nightly source onboarding | A weekly refresh of the five sources, plus at most one new source a month, added by you | Nothing will read new pages for you |
| Issue triage bot, cross-check parser, local model tooling, bookmarklet | Not built | No issue volume yet; double maintenance; the goal is no AI; search covers what the bookmarklet would do |
| `LOG.md`, sessions, `TASKS.md` | Frozen, with GitHub issues and milestones taking over | Nobody will write them |

## Weekly routine (new O5)

Do this on Monday morning (Sydney time), after the Sunday UTC runs: the data refresh at 16:17 UTC and the summary at 21:23 UTC.

| Step | Minutes (*estimate*) |
|---|---|
| Read the #27 summary, and the `watchdog` issue if it is open. Confirm the summary is under 8 days old: apart from the dead-man's switch, this is the only check on the watchdog itself | 5 |
| The candidate data PR (O9): open the flagged rows and the sample through their highlight links. Check the date order, the model, "or later" against `at_least`, and the region. To fix a category, edit `category_map` or `category_exceptions` in `seed.yaml` on the PR branch, then dispatch `data-refresh.yml` with `refresh_open_pr: true`. Add `audited` last (any later push removes it), then squash-merge | 0 to 20 |
| Spot-check the summary's 5 random records | 8 to 10 |
| Merge `needs-human-merge` PRs and clear `needs-human` items | 0 to 10 |
| Correction and add-model issues (O10) | 0 to 15 |
| Monthly work, averaged per week: Dependabot grouped PRs, CodeQL and Dependabot alerts, Search Console indexing, PLAN's Measures review | 5 |
| Quarterly and yearly work, averaged per week: zone export, restore test, renewals, App key rotation, Node upgrade | 2 |
| **Typical week** | **30 to 45** |

A red `Re-verify evidence` run now means the verifier, validation or the push broke, so read the watchdog issue that morning. Records that couldn't be checked show only as a warning. They reach the watchdog issue after 3 nights, and then you follow O11 for a blocked source, or O8.

Incidents add 5 to 15 minutes a week on average (*estimate*).

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| In a public repo, schedules switch off after 60 days without repository activity [5] | The monthly measures PR and Dependabot's PRs create activity (which events count is unverified). The watchdog flags any workflow that isn't `active`, and the dead-man's switch flags a silent watchdog |
| Schedules run late or are dropped [7]. The first ones here ran 4.5 to 5 hours late (22 Oct) | Schedules avoid the top of the hour. Re-verify takes every due record, so a missed night catches up the next. The watchdog checks how old each last run is, and dispatches `pages.yml` |
| A bug in the merge bot | Allowlists of branches and files; the SHA pin; the required `data-gate`, which runs the base branch's script; the protected-path label; the `BOT_MERGE` kill switch; a test for each rule; and the bot's own scripts under `protected-paths` |
| The App's private key leaks | It is used only in scheduled and dispatched jobs, never in `pull_request` jobs, with the fewest permissions. Keys don't expire [32], so rotate it yearly; revoke it in the App's settings. `data-gate` ignores an `audited` label the App adds |
| A queued run cancels another in the `crawl` group | `queue: max` [15], and the watchdog treats `cancelled` as a failure |
| A site redesign breaks a parser | The sanity gate fails loudly. Re-verification keeps working, because the verifier uses no parser. Freeze the source, so it drops out of the weekly PR. Its records go `stale` until you fix the profile or pull them in bulk (O8). A moved page takes one `repoint` run |
| The EZVIZ or TP-Link AU page (77% of records) moves or is redesigned | Hundreds of records go stale at once. `repoint-source.mjs` and the bulk `withdraw` action keep the fix to one PR each. Budget 4 to 8 hours (*estimate*) |
| One parser error repeats across many rows | The parser gate on the 695 audited records, `quoteMatches`, `date_order`, R1 to R8, your sample, and an A8 audit of each parser's first PR before cut-over |
| A footnote marker fuses into a model or date | `table-rows.mjs` keeps `<sup>` content apart, and a fixture tests it |
| A maker adds a qualifier in prose, with no date | It shows up only as a changed row or a footnote marker, plus the `unquoted-dates.mjs` output in each PR. Accept this as residual risk |
| Data you write yourself has no second reader | D48: the parser must reproduce your edit, or you re-read it the next day through its highlight link |
| A host blocks GitHub's runners | Every evidence host answered a runner on 21 Oct (Probe hosts run 39695382968). If one blocks, run `npm run verify:evidence -- <ids>` from Unraid or your PC |
| You are away | The site keeps serving and re-verification continues; alerts wait for you. The December wave takes two nights, and stale records stay marked until you are back |
| A Node, npm or action change breaks CI | A pinned Node version, monthly grouped Dependabot PRs with a 7-day cooldown [10], and the licence check. If a major version breaks, add an `ignore` entry rather than fixing code |
| A free tier changes | The mirror, the issue backups and the zone export (whether the Free plan allows the export is unverified). A static site can move to another host |
| Gain | No model reads untrusted pages or issues, so prompt injection leaves the system. The bot no longer acts as you |

## Rollback

- **Before P4 merges (Stages 2 and 3), about 5 minutes:**
  - set `BOT_MERGE=off` and `DATA_REFRESH=off`;
  - resume both routines and use Run now. The daily build prompt, updated in P2, merges open re-verify PRs;
  - you can resume just the nightly data task on its own;
  - routines are available on Pro as well as Max [25].
- **After cancelling, 1 to 2 hours:**
  - resubscribe;
  - `git revert` P4;
  - reinstall the Claude GitHub App;
  - recreate the routines (O6). Whether claude.ai keeps routines and environments after you cancel is unverified, so assume it doesn't.
- **Without a subscription:** see decision 6.

## Planned: the business side (D45)

You shelved the business side on 22 Oct 2026, to come back to once this setup is up and working. It is planned, not cancelled.
- **What it covers:** M4's demand test (the `/business` page, the Tally waitlist and the privacy page additions) and M6 (the paid feed, API keys, reports, supplier checks, and the free fleet checker that would have stood in for them).
- **When:** after Stage 4's exit check, so the business work starts on a setup that already runs without AI.
- **Where it starts:** #99 and the drafts on `claude/m4-drafts` (`docs/drafts/m4-business-waitlist.md`). Keep that branch. The legal steps come first: H9b before the waitlist collects emails, H9c before charging.
- **Hosting:** M6 runs on Unraid, published through your Pangolin VPS (D40). You already pay for the VPS for other projects, so this adds no cost (decision 2).
- **Who builds it:** decision 15.
- **Until then:** the site collects no personal data and sells nothing, so the privacy page stays as it is.

## Open decisions

1. **Create the GitHub App `patchlife-bot`?** Settled on 27 Oct: yes (D46), with the steps in #126. Without it, every bot PR waits for your click.
2. **The Pangolin VPS.** Settled on 22 Oct: it stays. You pay for it for other projects, so Patchlife adds no cost to it. When the business side resumes, M6 runs on Unraid published through it (D40). Cloudflare Tunnel from Unraid remains the fallback; it is available on all plans [20].
3. **Max renewal.** Settled on 27 Oct: you won't renew, and the subscription ends on 19 Nov 2026 (D46). The stages are cut to fit: build to 4 Nov, shadow 5 to 18 Nov, Stage 3's PRs by 18 Nov, your removals on 19 Nov. Whatever isn't built by then waits for a later plan month or a contractor (decision 15).
4. **Scope cuts and maintenance mode.** Settled on 27 Oct: accepted (D46). The business side is in Planned (D45), and the rest of the table above applies, with maintenance mode as the default.
5. **Clear the backlog before cancelling?** Settled on 27 Oct: you left it to me, and I took the recommendation (D46). Yes, for TP-Link AU, EZVIZ and Google, in 60-row batches with A8 audits, from when B4 merges (about 3 Nov) until 18 Nov, the day before Max ends; the nightly data task's revisit PRs count toward it until the shadow starts. Whatever is left then goes to the weekly 60-row PR: TP-Link AU alone would take about 14 weeks that way (*estimate*).
6. **Break-glass.** Recommended: none by default. If a breakage beats you, the options are:
   - paste the log into a local model on the RX 9070 XT. This needs no account or secret. llama.cpp's server binds to 127.0.0.1 by default [28]; whether the card works with its Vulkan build is unverified;
   - a one-off Anthropic API key on prepaid credits, with auto-reload off [24]. This involves account and spending gates. Sonnet 5.5 costs US$2 per million input tokens and US$10 per million output [23], so a fix costs about US$1 to 5 (*estimate*);
   - a contractor.
7. **Dead-man's switch.** Recommended: an hourly Unraid User Scripts job (`curl` and `jq`, outbound only).
   - It reads the last `housekeeping.yml` run from `api.github.com`, and the site's "Status as at" date.
   - It raises an Unraid notification when either is over 26 hours old. The notification command is unverified; OPERATIONS.md will give it once tested.
   - Uptime Kuma can watch the site with a keyword monitor [18]. Whether its JSON query can compare times is unverified.
8. **Growth.** Recommended: stay with the five sources until Stage 4's exit check. After that, add at most one new source a month.
9. **Node version.** Recommended: merge #101 now, and move to 26 before cut-over if CI is green on it.
10. **Public bot posts.** The Sunday summary on #27, the `watchdog` issue and the bot's PR bodies are all public posts. Recommended: approve their fixed templates once, when you review P2 and P3.
11. **Contractors.** Recommended: only once there is revenue.
    - Use fixed-price quotes.
    - Use a contract that assigns copyright to you, which keeps D10's relicensing option.
    - They work from a fork, and you merge.
    - A$2,000 to 8,000 for SPEC section 6's API is an unverified *estimate*; get 2 or 3 quotes.
12. **M3 and the Measures.** PLAN wants 6 or more brands at M3 (and at M4's start, now in Planned), and 5 or more daily-build heartbeats a week. Kyocera became the sixth brand on 22 Oct (#111), so the brand target holds; the heartbeat still goes away. Recommended:
    - redefine M3 part 1 on the new jobs (Stage 2's exit check);
    - replace the heartbeat row with "clean watchdog days";
    - set the brand target to 5, unless a sixth brand is added before cut-over.
13. **Other subscriptions.** Recommended: list each in `ops/renewals.yml`, and cancel whatever isn't needed:
    - `sombrexo.com` and the `admin@sombrexo.com` mailbox, which is the privacy page contact (`build-site.mjs` line 40). If the mailbox is a paid plan, use free forwarding instead (Cloudflare Email Routing is described as free [35], unverified), or change the contact, which is legal text;
    - confirm `patchlife.tech` is on Cloudflare's Free plan (unverified);
    - Firecrawl, if it is a paid account (unverified);
    - Unraid: some licences include a year of updates and then an optional yearly fee [34] (unverified).
14. **Copy changes.** The About page, the "being reviewed" lines, README, BRIEF and CRAWLER say that Claude runs Patchlife, or that someone is reviewing a record. Recommended: approve new wording in Stage 3's copy PR.
15. **Building the business side later.** Once Stage 4's exit check passes, M4 and M6 need someone to write code: you, a contractor (decision 11), or a month of a plan for build sessions, cancelled again after. Recommended: decide then. The drafts in #99 are the starting point.

## Sources

Items marked (docs source) were read from GitHub's documentation source on raw.githubusercontent.com, because docs.github.com could not be opened from the research container. Items marked (search summary) were seen only in search results; re-check them before quoting them elsewhere. Repository facts come from the files named above, and from `git` and `gh api` at 03:10 UTC on 22 Oct 2026.

1. https://raw.githubusercontent.com/github/docs/main/data/reusables/actions/actions-do-not-trigger-workflows.md (docs source)
2. https://raw.githubusercontent.com/github/docs/main/content/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow.md (docs source)
3. https://raw.githubusercontent.com/actions/create-github-app-token/main/README.md
4. https://raw.githubusercontent.com/github/docs/main/content/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens.md (docs source)
5. https://raw.githubusercontent.com/github/docs/main/data/reusables/actions/scheduled-workflows-disabled.md (docs source)
6. https://raw.githubusercontent.com/github/docs/main/content/actions/concepts/workflows-and-actions/notifications-for-workflow-runs.md (docs source)
7. https://raw.githubusercontent.com/github/docs/main/data/reusables/actions/schedule-delay.md (docs source)
8. https://raw.githubusercontent.com/github/docs/main/content/billing/concepts/product-billing/github-actions.md (docs source)
9. https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets (search summary)
10. https://raw.githubusercontent.com/github/docs/main/content/code-security/reference/supply-chain-security/dependabot-options-reference.md (docs source)
11. https://raw.githubusercontent.com/github/docs/main/content/code-security/reference/supply-chain-security/dependabot-on-actions.md (docs source)
12. https://raw.githubusercontent.com/github/docs/main/data/reusables/gated-features/code-scanning.md and https://raw.githubusercontent.com/github/docs/main/data/reusables/gated-features/secret-scanning.md (docs source)
13. https://raw.githubusercontent.com/github/docs/main/content/pages/getting-started-with-github-pages/github-pages-limits.md (docs source)
14. https://raw.githubusercontent.com/nodejs/Release/main/schedule.json
15. https://raw.githubusercontent.com/github/docs/main/data/reusables/actions/actions-group-concurrency.md and https://raw.githubusercontent.com/github/docs/main/data/features/actions-nga.yml (docs source)
16. https://docs.github.com/en/actions/reference/security/secure-use (not fetched)
17. https://raw.githubusercontent.com/github/docs/main/data/reusables/rest-api/primary-rate-limit-unauthenticated-users.md (docs source)
18. https://raw.githubusercontent.com/louislam/uptime-kuma/master/README.md
19. https://developers.cloudflare.com/dns/manage-dns-records/how-to/import-and-export/ (search summary)
20. https://developers.cloudflare.com/tunnel/ (search summary)
21. https://support.claude.com/en/articles/11049741-what-is-the-max-plan and https://claude.com/pricing
22. https://www.anthropic.com/legal/consumer-terms
23. https://platform.claude.com/docs/en/about-claude/pricing
24. https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-claude-api-usage
25. https://code.claude.com/docs/en/web-scheduled-tasks
26. https://www.watc.wa.gov.au/media/lq5l4k4u/a-monthly-march-2026.pdf (the RBA's table at https://www.rba.gov.au/statistics/frequency/exchange-rates.html could not be reached)
27. https://domainoffer.net/tld/tech?page=1 (search summary)
28. https://raw.githubusercontent.com/ggml-org/llama.cpp/master/tools/server/README.md
29. https://raw.githubusercontent.com/mdn/browser-compat-data/main/html/elements/a.json
30. https://raw.githubusercontent.com/github/docs/main/content/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository.md (docs source)
31. https://support.stripe.com/questions/updates-to-card-pricing-in-australia-from-october-2026
32. https://raw.githubusercontent.com/github/docs/main/content/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps.md (docs source)
33. https://docs.github.com/en/enterprise-server@3.19/subscriptions-and-notifications/how-tos/managing-github-actions-notifications (search summary)
34. https://unraid.net/blog/new-pricing (search summary; unverified)
35. https://www.cloudflare.com/products/email-routing (search summary; unverified)
