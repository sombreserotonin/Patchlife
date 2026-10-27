# Operations

How Patchlife runs, written for the owner. It is as at 27 October 2026, in MIGRATION Stage 1 ([`MIGRATION.md`](MIGRATION.md)), and it covers what runs today and what changes at cut-over. The procedures are in [`RUNBOOKS.md`](RUNBOOKS.md) (the O runbooks are yours) and the evidence rules in [`DATA-POLICY.md`](DATA-POLICY.md). "Unverified" marks something nobody could confirm from the repository or GitHub's API: an agent's `gh api` can read this repository, but not its Actions variables, secrets or notification settings, and nothing on your Unraid server or in your Cloudflare account.

## What runs when

Actions schedules are in UTC. The Sydney column is for daylight time (UTC+11, from the first Sunday in October to the first Sunday in April); in standard time (UTC+10) each Sydney time is one hour earlier. GitHub runs schedules late when it is busy: the first scheduled runs here started 4.5 to 6 hours late, and the watchdog's age limits allow for that.

| Job | File | When (UTC) | Sydney, daylight time | What it does and what it produces |
| --- | --- | --- | --- | --- |
| Build and deploy the site | `.github/workflows/pages.yml` | Every merge to `main`; daily at 00:17; **Run workflow**; and whenever the watchdog finds the last deploy over 36 hours old | 11:17 the same day | Runs `npm run validate` and `npm run build:site`, then deploys `_site/` to https://patchlife.tech, so every status is computed from today's date (D7). On a pull request it only builds (`build`) and scores Lighthouse (`lighthouse`); nothing deploys from a PR |
| Re-verify evidence | `.github/workflows/reverify.yml` | Daily at 12:41; **Run workflow** with `due` (default 60) and `limit` (default 1000) | 23:41 the same day | Re-checks every `verified` record last checked more than `due` days ago, oldest first and at most `limit` of them, and asks the Wayback Machine to capture up to 5 cited pages that still lack archive links (D43). When a record changed, it pushes `claude/reverify-<date>-<run id>` and opens a PR as `patchlife-bot[bot]`; otherwise it prints `Nothing to push`. Records whose pages it could not fetch are listed in a warning titled `Records not checked`. It stops at its first step while any `claude/reverify-*` branch exists |
| Housekeeping | `.github/workflows/housekeeping.yml` | Daily at 21:23; **Run workflow** with `dry_run` | 08:23 the next morning | One job, four steps. (1) Merges the bot's own PRs (`claude/reverify-*` and `claude/measures-*`) when every rule below holds, only while the variable `BOT_MERGE` is `on`. (2) Runs `scripts/watchdog.mjs`, which keeps the `watchdog` issue up to date and turns the run red when it finds a problem. (3) On Sundays (UTC) posts the weekly summary on issue #27, which lands on Monday morning in Sydney. (4) On the 1st (UTC) opens `claude/measures-<yyyy-mm>`, regenerating `docs/MEASURES.md` from `node scripts/data-report.mjs`; the bot merges it the next night |
| CI | `.github/workflows/ci.yml` | Every pull request and every push to `main` | | `test`: the licence check, `npm run validate` and `npm test`. `protected-paths`: labels a PR `needs-human-merge` when it touches `.github/`, `.claude/`, `.agent/prompts/`, `CLAUDE.md`, `package.json` or `package-lock.json`, so only you merge it |
| Data gate | `.github/workflows/data-gate.yml` | Every pull request when it is opened, pushed to, reopened, labelled or unlabelled | | `data-gate`: passes when the PR changes data only as a re-verification does (RUNBOOKS A9), or when you added the `audited` label. It removes `audited` on every push, so each push needs a fresh review. A label the App adds never counts |
| Probe hosts | `.github/workflows/probe-hosts.yml` | **Run workflow** only | | One line per evidence host: its robots.txt answer and the first cited page's status from a GitHub runner. Always green; read the log |
| Dependabot | `.github/dependabot.yml` | Monthly, on the first day of the month (GitHub's documented day for `monthly`; no run has happened yet, so unverified here) | | One grouped PR for npm packages and one for Actions, each after a 7-day cooldown. You merge them (RUNBOOKS O12) |
| Claude | `.github/workflows/claude.yml` | A comment or issue that mentions `claude` with an at-sign in front, or the `claude` label | | Nothing useful: it has no secret, so a trigger fails (#6). Deleted at Stage 3 (P4) |
| The Claude scheduled tasks (until Stage 2) | https://claude.ai/code/routines | `Patchlife daily build` at 06:08 Sydney (19:08 UTC the evening before, in daylight time) in the `Default` environment; `Patchlife nightly data` at 01:17 Sydney (14:17 UTC the evening before) in `Crawl` | | The daily build merges green `claude/` PRs, including any open re-verify PR, and does one TASKS.md item. The nightly data task re-checks the records Actions could not and adds one source's records. Both are paused at Stage 2 and deleted at Stage 3 |
| Not built yet (P3) | `.github/workflows/data-refresh.yml` and `owner-tools.yml` | Weekly at 16:17 on Sunday, acting only while `DATA_REFRESH` is `on`; `owner-tools.yml` by **Run workflow** | Monday 03:17 | The weekly candidate PR of at most 60 rows on a `claude/data-auto-*` branch, which you review (RUNBOOKS O9); and your five by-hand actions (`read-page`, `check-source`, `verify`, `repoint`, `withdraw`) |

**The merge bot's rules** (`scripts/merge-bot.mjs`). It merges a PR only when all of these hold, and otherwise prints `#N: skipped (<reason>)` and leaves it for you: the PR was opened by `patchlife-bot[bot]`; its head branch is in this repository, never a fork; it is not a draft; the branch is `claude/reverify-*` or `claude/measures-*`; it has no `needs-human` or `needs-human-merge` label; the checks `test`, `data-gate` and `build` from GitHub Actions passed on its latest commit (the PR-only `lighthouse` job doesn't count); and its files fit its type: a re-verify PR changes only records under `data/devices/` and `data/sources/page-hashes.json`, a measures PR only `docs/MEASURES.md`. It merges with a squash at the commit it checked, so a branch that moved meanwhile is refused, and then deletes the branch.

**Branches, labels and issues the jobs use**
- `claude/reverify-<date>-<run id>`: the bot's re-verification branch. One at a time: while one exists, the next re-verify run stops at its guard. The bot merges it and deletes it. A branch whose PR was closed unmerged waits for you to delete it; agents can't delete branches.
- `claude/measures-<yyyy-mm>`: the monthly measures branch; the bot merges it.
- `claude/data-auto-*` (after P3): the weekly candidate PR; you review and merge it.
- Labels: `audited` (your review is done; only a label you add counts, and every push removes it), `needs-human` (an issue waiting on you; the watchdog flags it after 7 days), `needs-human-merge` (CI's label on protected-path PRs; never remove it), `watchdog` (the watchdog's own issue), `data-correction` and `add-model` (the public issue forms), `planned` (shelved work, D45) and `claude` (deleted at Stage 3).
- Issue #27 (https://github.com/sombreserotonin/Patchlife/issues/27): the Sunday summary goes here, and until Stage 2 the daily build's one-line result too.

## Settings that matter

| Setting | Where | What it is | If it is wrong |
| --- | --- | --- | --- |
| Ruleset `main` (id 25530330) | https://github.com/sombreserotonin/Patchlife/settings/rules/25530330 (all rulesets: https://github.com/sombreserotonin/Patchlife/settings/rules) | As read through the API on 27 Oct 2026: a pull request is required (0 approvals); the checks `test` and `data-gate` from GitHub Actions must pass (not strict, so a PR needn't be up to date with `main`); deletion and force pushes are blocked; no bypass actors; "require extra approval for unattributed changes" is on. The plan thought that last setting might hold the bot's PRs; #130 merged under it, so it has not | Without `data-gate`, data could merge with no review; without `test`, broken code could. Agents can't change rulesets, because the proxy blocks settings writes |
| Actions variables | https://github.com/sombreserotonin/Patchlife/settings/variables/actions | `BOT_CLIENT_ID`: the App's Client ID, used to mint its token in `housekeeping.yml` and `reverify.yml`. `BOT_APP_ID`: the App ID, kept because older token examples take it; no workflow reads it today. `BOT_MERGE`: `on` lets Housekeeping run the merge bot and anything else skips that step; it is the kill switch, and it has been `on` since 27 Oct (#130). `DATA_REFRESH`: `off`; nothing reads it until P3's `data-refresh.yml`, whose schedule acts only while it is `on`. Agents can't read the values, so these come from #126, #128 and #130 | `BOT_CLIENT_ID` empty: re-verify pushes with Actions' own token and opens no PR (the daily build opens one until Stage 2), and Housekeeping fails at its first step. `BOT_MERGE` off: nothing merges by bot, and re-verify PRs wait for you or the daily build |
| Secret `BOT_APP_PRIVATE_KEY` | https://github.com/sombreserotonin/Patchlife/settings/secrets/actions | The App's private key, the whole `.pem` file. It is used only in scheduled and dispatched jobs, never in `pull_request` jobs. Keys don't expire, so rotate it yearly (RUNBOOKS O12) | Wrong or missing: the token step fails and both `Housekeeping` and `Re-verify evidence` go red at their first step |
| The App `patchlife-bot` | https://github.com/settings/apps/patchlife-bot (your developer settings). Its installation on this repository: https://github.com/sombreserotonin/Patchlife/settings/installations | Private to your account, webhook off, installed on this repository only (#126). Repository permissions: Actions, Contents, Issues and Pull requests read and write; Checks read; Workflows none, so it can never change a workflow. Its login is `patchlife-bot[bot]`, and the merge bot merges only PRs that login opened. Each run mints a token that lasts an hour | Uninstalled, or a permission removed: every bot step fails with an HTTP error naming what it lacks |
| Actions, general | https://github.com/sombreserotonin/Patchlife/settings/actions | "Allow GitHub Actions to create and approve pull requests" is the zero-secret fallback if the App ever fails (MIGRATION, "Bot identity"): with it on, a run can open PRs with Actions' own token, and you click **Approve workflows to run** on each. Whether it is on is unverified; it isn't needed while the App works | |
| Code security | https://github.com/sombreserotonin/Patchlife/settings/security_analysis; the alerts at https://github.com/sombreserotonin/Patchlife/security | As read on 27 Oct 2026: secret scanning on, push protection on, Dependabot security updates off, CodeQL default setup not configured. Dependabot alerts can't be read by agents (TASKS G3 says you turned them on 21 Oct). MIGRATION's "Your actions in Stage 1", item 4, asks for CodeQL default setup (Code security > CodeQL > Default) and Dependabot security updates | After cut-over, only you and CodeQL review code |
| Dependabot version updates | `.github/dependabot.yml` (a protected path) | Monthly grouped PRs for npm and for Actions, with a 7-day cooldown. They carry `needs-human-merge`, and `protected-paths` may fail on them because Dependabot's runs get a read-only token, so the label can be missing. The daily build never merges a PR with a red check and the bot merges only the App's, so they wait for you (RUNBOOKS O12) | A major version that breaks `test`: add an `ignore` entry, don't fix code |
| General | https://github.com/sombreserotonin/Patchlife/settings | A public repository, and it must stay public (D40: Pages, the ruleset and secret scanning depend on it). "Automatically delete head branches" is on (confirmed by the API, G1) | Private: Pages unpublishes and the ruleset stops |
| Pages | https://github.com/sombreserotonin/Patchlife/settings/pages | Source: GitHub Actions. Custom domain `patchlife.tech`, with Enforce HTTPS | The site vanishes, or serves from `sombreserotonin.github.io` |
| Notifications | https://github.com/settings/notifications | Emails for your own activity (G1), so you see what sessions do as you. Actions: email, failed workflows only (MIGRATION's Stage 1 item 4; whether it is set is unverified). Watch the repository with the **Watch** button on https://github.com/sombreserotonin/Patchlife. GitHub emails a scheduled run's failure to the person who last changed its schedule or re-enabled it | Failures stay silent |
| Labels | https://github.com/sombreserotonin/Patchlife/labels | The labels listed above. `watchdog` exists (#128) | The watchdog recreates `watchdog` if it is missing |
| Cloudflare | The `patchlife.tech` zone in your Cloudflare dashboard | DNS proxied and Web Analytics on, which the privacy page discloses (D41). Plan: Free, unverified. Turn on nothing that sets cookies (Bot Fight Mode, challenges, rate limiting by visitor, Always Online) without changing the privacy page first | The privacy page becomes untrue |
| Registrar | Your registrar for `patchlife.tech` | Auto-renew and two-factor sign-in on (G3). Record the expiry date and price in `ops/renewals.yml` | The domain lapses |
| claude.ai (until Stage 3) | https://claude.ai/code/routines; the environment settings on the new-session screen | The two scheduled tasks, each with no connectors, and the `Crawl` environment's allowlist (RUNBOOKS O3) | |
| A ruleset for the bot's branches | https://github.com/sombreserotonin/Patchlife/settings/rules | MIGRATION's Stage 1 item 4 asks for a branch ruleset on `claude/reverify-*` and `claude/measures-*` that lets only the App push and blocks force pushes. Whether a personal account's ruleset can name an App as the only bypass actor is unverified, and whether this ruleset exists is unverified | Anyone with write access could push to a bot branch |

## Alerts

There is no daily "all good" line (MIGRATION decision 7). A problem shows as a red run with a GitHub failure email, as the `watchdog` issue, or as a missing Sunday summary. The summary's age is the only check on the watchdog itself, apart from the dead-man's switch.

### A red Housekeeping run

Open https://github.com/sombreserotonin/Patchlife/actions/workflows/housekeeping.yml, the run, then the `housekeeping` job, and find the red step. RUNBOOKS O4 has the steps; this is what each step's failure means.

| Red step | Meaning | First thing to check |
| --- | --- | --- |
| `Run actions/create-github-app-token@v3` (the first step) | The App's token could not be minted, so nothing else ran, not even the watchdog | `BOT_CLIENT_ID`, the secret `BOT_APP_PRIVATE_KEY`, and that the App is still installed (the three settings pages above) |
| `Merge the routine PRs` | The merge bot stopped. Lines like `#N: skipped (<reason>)` are normal: they say why a PR waits for you. The watchdog still ran | The last line of the step. `Missing environment variable(s)` or `BOT_LOGIN must be the App's login`: the workflow file changed. `HTTP 4xx` or `5xx`: a GitHub call failed; re-run once. `GitHub did not confirm the merge, so <branch> stays`: the branch moved while merging; the next run tries again |
| `Watchdog` | It found problems and ended with `N problem(s)`. This is the normal alarm | The `watchdog` issue (next section). `Set GH_TOKEN and GITHUB_REPOSITORY first` or `Unknown argument` means the workflow file changed |
| `Open the monthly measures PR` | The push or the PR creation failed on the 1st | Re-run the workflow; it opens no second PR while `claude/measures-<yyyy-mm>` exists. If that branch exists with no PR, open the PR from https://github.com/sombreserotonin/Patchlife/branches |
| The checkout or `Run npm ci` | A GitHub or npm outage | https://www.githubstatus.com, then re-run later |

### The `watchdog` issue

One open issue labelled `watchdog` (https://github.com/sombreserotonin/Patchlife/issues?q=is%3Aissue+label%3Awatchdog), titled `Watchdog: N problem(s)`. Every run rewrites it while problems remain. The first clean run comments `All clear on <date>` and closes it. Each line reads `- **<check>:** <message>`.

| Line | Meaning | First thing to check |
| --- | --- | --- |
| **Workflows:** `<name> (<path>) is switched off (<state>). Re-enable it in the Actions tab.` | GitHub switches a scheduled workflow off after 60 days without repository activity in a public repository, or someone disabled it | Open https://github.com/sombreserotonin/Patchlife/actions/workflows/<file> and select **Enable workflow**. Only you do this: whoever re-enables a workflow gets its failure emails, so the watchdog never does |
| **Re-verify:** `No re-verify run has completed.`, `No re-verify run got through "Push verification changes" in the last N completed runs.` or `The last re-verify run to get through "Push verification changes" finished N hours ago (...)` | No re-verification has succeeded for 48 hours | The latest run at https://github.com/sombreserotonin/Patchlife/actions/workflows/reverify.yml: its guard (`Unmerged re-verification branch`), `The verifier did not finish`, a red `npm run validate` or `npm test`, or the push step |
| **Pages:** `No successful Pages deploy found.` or `The last Pages deploy finished N hours ago (...)` | The site has not been rebuilt for 36 hours, so its statuses are going stale (D7). The line ends with `Dispatched pages.yml on main.` when the watchdog started a rebuild, or `Could not dispatch pages.yml` | https://github.com/sombreserotonin/Patchlife/actions/workflows/pages.yml for a red run, then the site |
| **Cancelled runs:** `A <workflow> run was cancelled (...)` | A run in the `crawl` group was cancelled in the last 48 hours, which `queue: max` should prevent | Run that workflow again by hand with its defaults |
| **Re-verify branches:** `<branch>: its PR #N was closed without merging. Delete the branch, or reopen the PR.` | The bot's PR was closed, and re-verification stops while the branch exists | Delete the branch at https://github.com/sombreserotonin/Patchlife/branches, or reopen the PR |
| **Re-verify branches:** `<branch> is N hours old and unmerged, so re-verification stops at its guard.` | The bot did not merge the PR | The PR's checks. A red `data-gate` means the run changed more than verification, which needs your review and `audited`. A red `test` is a real failure. Green checks merge at the next Housekeeping run, or merge it yourself with **Squash and merge** |
| **Unchecked records:** `Not checked on each of the last 3 re-verify runs: <ids>` | Those records' pages could not be fetched three nights running: a redirect, robots.txt, HTTP 403 or 5xx, or a timeout | Run `npm run verify:evidence -- <ids>` yourself (RUNBOOKS O11, "Where to run it") and read the error. A moved page: `node scripts/repoint-source.mjs <old url> <new url>` (RUNBOOKS A4). A blocked source: O11 step 9. A date you can no longer support: O8 |
| **Data health:** `N records stale since <date>, N days ago: <ids>` | A record's quote has been missing from its page for more than 14 days | Repoint the records if the statement moved (A4), otherwise pull their dates (O8). After P3 the weekly PR proposes the changed row |
| **Data health:** `N% of records are stale (N of M). The limit is under 2%.` | PLAN's stale measure is breached, usually because one page moved or was redesigned | The stale records' cited URL, then `repoint-source.mjs` for a moved page |
| **Data health:** `N stale records with no date in git history (is the checkout shallow?): <ids>` | A workflow change dropped `fetch-depth: 0` | `housekeeping.yml`'s checkout step: a protected PR |
| **Data health:** `#N (needs-human) has waited N days, since <date>.` | An issue has waited on you for more than 7 days | Answer it (RUNBOOKS O7) or close it |
| **Candidate PR:** `#N (claude/data-auto-...) has been open N days, so the weekly data refresh keeps skipping.` | After P3: the weekly PR has waited more than 14 days | Review it (RUNBOOKS O9) or close it |
| **Site:** `https://patchlife.tech/ could not be reached: ...`, `... answered HTTP <status>.`, `... has no "Status as at" date in its footer.` or `... says "Status as at <date>", N days ago.` | The site is down, or its statuses are two or more days old | https://www.githubstatus.com, the Pages settings (custom domain and HTTPS), Cloudflare's DNS and proxy, then the last Pages run |
| **Renewals:** `<name> is due on <date>, in N days (within 60 days).`, the same `(within 14 days)`, `<name> was due on <date>, N days ago.` or `<name>: the due date ... is not a YYYY-MM-DD date.` | Something in `ops/renewals.yml` falls due, or the file has a typo | Renew it (RUNBOOKS O12), then set the next `due` date in a PR |
| **<check>:** `Could not read <what>: ...` | The GitHub API or the site did not answer that read, so that check was skipped this run | If it repeats: the App's permissions, then https://www.githubstatus.com |

### The Sunday summary

Posted on https://github.com/sombreserotonin/Patchlife/issues/27 by the Sunday (UTC) Housekeeping run, which lands on Monday morning in Sydney (08:23 in daylight time, later when GitHub runs the schedule late). It holds: the `needs-human-merge` PRs waiting for you; the open issues by label; the first four lines of `node scripts/data-report.mjs`, which are PLAN's Measures; and five random records, each with a link to the maker's page that highlights the quote, for your spot check (RUNBOOKS O5). It is posted whether or not the watchdog found problems, so a missing summary means the run did not reach the watchdog step: a disabled or dropped schedule, or a failed token step. Runs have started up to six hours late, so treat the summary as missing only if it is not there by early afternoon Sydney time, then follow RUNBOOKS O4.

### The dead-man's switch (MIGRATION decision 7, optional)

Nothing outside GitHub checks that Housekeeping ran. The plan recommends an hourly job on your Unraid server that only makes outbound requests: it reads the last Housekeeping run from GitHub's public API and the site's "Status as at" date, and raises an Unraid notification when either is over 26 hours old. Whether you have set it up is unverified. The two reads need no token, because a public repository allows 60 unauthenticated requests an hour:

```
curl -s "https://api.github.com/repos/sombreserotonin/Patchlife/actions/workflows/housekeeping.yml/runs?status=completed&per_page=1" | jq -r '.workflow_runs[0].updated_at'
curl -s https://patchlife.tech/ | grep -o 'Status as at <time datetime="[0-9-]*"' | sed 's/.*datetime="//; s/"$//'
```

The plan says this file gives the notification command once it has been tested. It has not been tested. Unraid's own notifier is reported to be `/usr/local/emhttp/webGui/scripts/notify -s "<subject>" -d "<description>" -i "alert"` (unverified): run it once by hand before relying on it. When the switch fires, check the Housekeeping runs page, then https://www.githubstatus.com, then the site. Uptime Kuma with a keyword monitor can watch the site instead; whether its JSON query can compare times is unverified.

### Other red runs and emails

- **`Re-verify evidence` red:** the verifier, `npm run validate`, `npm test` or the push broke, or the guard stopped it with `Unmerged re-verification branch: merge it, or delete it if its PR was closed`. Records that could not be checked are only a warning (`Records not checked`), and they reach the watchdog issue after three nights. First check: the red step's last lines. `The verifier did not finish (exit N)` means the verifier crashed: open an issue with the log.
- **`Pages` red:** the site keeps serving its last deploy. A red `build` on `main` means `npm run validate` or the build failed on merged code: fix it with a PR. The watchdog dispatches a new run when the last deploy is over 36 hours old.
- **`CI` red on `main`:** a merge broke `test`. Fix it with a PR; nothing merges while `test` fails on PRs.
- **`Data gate` red on a PR:** the PR changes data beyond what a re-verification changes, and has no `audited` label from you. That is the gate working: review the PR (RUNBOOKS O5 step 2, or an A8 audit until cut-over), then add `audited`.
- **Dependabot and secret scanning emails:** the alerts are at https://github.com/sombreserotonin/Patchlife/security. A leaked secret: rotate it (RUNBOOKS O12 for the App's key).

## Backups

These are what the plan describes (MIGRATION, "Your actions in Stage 1" item 5, and the end-state table). Whether each is set up is unverified: they live on your Unraid server and in your Cloudflare account, which agents cannot see.

1. **The repository mirror (Unraid, nightly).** Once: `git clone --mirror https://github.com/sombreserotonin/Patchlife.git /mnt/user/backups/patchlife.git` (any folder works). Nightly: `git --git-dir=/mnt/user/backups/patchlife.git remote update --prune`. The mirror holds every branch and the whole history, which is the data and its audit trail (D2). It does not hold issues, PR discussions, settings, variables or secrets.
2. **The issues export (Unraid, weekly).** The public API needs no token and allows 60 requests an hour, and the repository has about 135 issues and PRs (27 Oct 2026), so a few requests cover it:
   ```
   curl -s "https://api.github.com/repos/sombreserotonin/Patchlife/issues?state=all&per_page=100&page=1" > issues-1.json
   curl -s "https://api.github.com/repos/sombreserotonin/Patchlife/issues/comments?per_page=100&page=1" > comments-1.json
   ```
   Repeat with `page=2`, `page=3` and so on until a page holds fewer than 100 items. The issues list includes pull requests, each marked by a `pull_request` field.
3. **The Cloudflare zone export (you, quarterly).** In the Cloudflare dashboard, open the `patchlife.tech` zone, then DNS, Records, **Export**, which gives a BIND zone file. The menu names come from the plan's search summary (unverified), and whether the Free plan allows the export is unverified. Keep the file with the Unraid backups.
4. **A restore test (you, quarterly, RUNBOOKS O12):** clone the mirror, then run `npm ci`, `npm run validate`, `npm test` and `npm run build:site`. A clone that builds the site proves the data and the code are whole.
5. **What has no backup, and how to recreate it:** the App's private key (generate a new one, RUNBOOKS O12); the Actions variables and the ruleset (their values are in this file); the Pages settings (source GitHub Actions, the custom domain); the claude.ai routines and environments (gone at Stage 3 anyway; RUNBOOKS O6 and O3 recreate them); the Wayback Machine captures (they are the archive's copies, not ours).

## Cut-over

The stages are MIGRATION's. This is the order of your switches and removals.

### Stage 2: the shadow fortnight (5 to 18 November 2026)

Before it starts, Stage 1's exit check must pass: `npm run validate` and `npm test` green on `main` with rules R1 to R8, the M3 drill and the licence check; `candidates.mjs --check` reproducing every audited record; each new workflow run once by hand; and the bot merging a test PR, which it did on 27 Oct (#130).
1. Check `BOT_MERGE` is `on` at https://github.com/sombreserotonin/Patchlife/settings/variables/actions, and set `DATA_REFRESH` to `on` there once P3's `data-refresh.yml` is merged.
2. At https://claude.ai/code/routines, pause both `Patchlife daily build` and `Patchlife nightly data` with each task's on/off switch. Don't delete them: paused tasks keep their settings, and a rollback resumes them.
3. Exercise the re-verify path, since nothing is due before 21 December. On at least 5 days, run **Re-verify evidence** by hand with `due` 0 and `limit` 40, between 21:30 and 12:30 UTC (08:30 to 23:30 Sydney in daylight time). Once its PR's checks are green, run **Housekeeping** by hand before 12:41 UTC, so the merge happens before the next scheduled re-verify run, which would otherwise stop at its guard.
4. Review each weekly candidate PR (RUNBOOKS O9, after P3) and time yourself. Merge the backlog batches that sessions open and audit until 18 November.
5. Keep the exit check over 14 consecutive days: the watchdog clean every day or its alerts explained; at least 5 re-verify PRs opened and merged with no session; three consecutive nights of `reverify.yml` and `housekeeping.yml` plus one `data-refresh.yml` run ending correctly with no session; no re-verify branch older than 36 hours; stale records under 2% and the oldest `needs-human` item under 7 days; no session running an operation beyond at most one interactive fix; your time 60 minutes a week or less.

### Stage 3: retire (your actions on 19 November 2026)

By 18 November, sessions open P4 (protected: it deletes `claude.yml` and the two prompts, rewrites CLAUDE.md's merge rule, freezes `.agent/` and moves open items to issues), the copy PR (the About page and the "being reviewed" lines, README, BRIEF, CRAWLER and DATA-POLICY: you approve the wording), the decisions PR (D47 to D50) and the draft Stage 4 PR. Then, in this order:
1. Delete both scheduled tasks at https://claude.ai/code/routines.
2. Uninstall the Claude GitHub App at https://github.com/settings/installations.
3. Revoke Claude at https://github.com/settings/apps/authorizations, because sessions acted as you. Whether step 2 already does this is unverified.
4. Check that https://github.com/sombreserotonin/Patchlife/settings/secrets/actions holds no `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` secret.
5. In claude.ai, remove the connectors (Firecrawl, D35) and disconnect GitHub.
6. Cancel Firecrawl if it is a paid account (unverified).
7. Let Max end on 19 November; it is set not to renew. Check that no renewal is pending.
8. Merge the copy PR and the decisions PR, then P4 last (RUNBOOKS O2), so that a rollback before then needs no revert. Then delete the `claude` label at https://github.com/sombreserotonin/Patchlife/labels.

Exit check: the plan has ended with no renewal, P4 is merged, and the next statement shows no Anthropic charge.

### Stage 4: watch (20 November 2026 to mid-January 2027)

The re-verification wave arrives on 21 and 22 December: about 340 and then 355 records, less those re-checked in Stage 2, each night's due records in one run. After four clean weeks and that wave, mark the draft Stage 4 PR ready and merge it (protected): it moves `decisions.md` to `docs/DECISIONS.md` and the hard rules to `CONTRIBUTING.md`, cuts CLAUDE.md to a pointer, and deletes `.claude/`. If it no longer merges cleanly, close it: frozen files do no harm. Exit check: no record last checked more than 62 days ago; the Measures rows green; a summary posted every week; no alert from the dead-man's switch.

## Rollback

From MIGRATION's "Rollback" section.

- **Turning the bot off alone (any time, 1 minute):** set `BOT_MERGE` to `off` at https://github.com/sombreserotonin/Patchlife/settings/variables/actions. Merges stop from the next Housekeeping run. Re-verification keeps opening PRs, which you merge once `test` and `data-gate` are green (RUNBOOKS A9), or the daily build does until Stage 2. To stop re-verification as well, open https://github.com/sombreserotonin/Patchlife/actions/workflows/reverify.yml and choose **Disable workflow** from the menu at the top right; the watchdog flags it until you enable it again.
- **Before P4 merges (Stages 2 and 3), about 5 minutes:** set `BOT_MERGE` and `DATA_REFRESH` to `off`. At https://claude.ai/code/routines, resume both tasks and use **Run now**; the daily build's prompt merges open re-verify PRs. You can resume the nightly data task on its own. Routines are available on Pro as well as Max.
- **After cancelling, 1 to 2 hours:** resubscribe; `git revert` P4 in a PR you merge (protected); reinstall the Claude GitHub App (TASKS H2: the claude.ai/code onboarding); recreate the routines (RUNBOOKS O6 for the nightly data task, TASKS H4 for the daily build) and the `Crawl` environment (TASKS H5, RUNBOOKS O3). Whether claude.ai keeps routines and environments after you cancel is unverified, so assume it doesn't.
- **Without a subscription:** MIGRATION decision 6: a local model on your RX 9070 XT, a one-off API key on prepaid credits with auto-reload off, or a contractor. Each is a human gate.
- **A wrong date on the site:** RUNBOOKS O8, at any stage.

## Quick reference

- Actions: https://github.com/sombreserotonin/Patchlife/actions
- The `watchdog` issue: https://github.com/sombreserotonin/Patchlife/issues?q=is%3Aissue+label%3Awatchdog
- The summary issue: https://github.com/sombreserotonin/Patchlife/issues/27
- Waiting on you: https://github.com/sombreserotonin/Patchlife/issues?q=is%3Aopen+label%3Aneeds-human and https://github.com/sombreserotonin/Patchlife/pulls?q=is%3Aopen+label%3Aneeds-human-merge
- Branches: https://github.com/sombreserotonin/Patchlife/branches
- Settings: https://github.com/sombreserotonin/Patchlife/settings
- The site: https://patchlife.tech. GitHub's status: https://www.githubstatus.com
