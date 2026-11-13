# Runbooks

Step-by-step procedures for the owner. Each runbook says when to use it, the steps, and how you know it's done. How the project runs is in [`OPERATIONS.md`](OPERATIONS.md); the evidence rules are in [`DATA-POLICY.md`](DATA-POLICY.md); the rules for changing the repository are in [`CONTRIBUTING.md`](../CONTRIBUTING.md).

**Where work runs.** No AI session runs any of this: the cut-over was on 13 November 2026 ([`MIGRATION.md`](MIGRATION.md)). Every command here that reads a maker's page (`npm run verify:evidence`, `scripts/check-source.mjs`, `scripts/page-text.mjs`, `scripts/unquoted-dates.mjs`, `scripts/repoint-source.mjs` and `scripts/candidates.mjs`) runs in one of two places:
- **GitHub's runners:** the scheduled workflows, and the `Owner tools` workflow for the five by-hand actions (`read-page`, `check-source`, `verify`, `repoint` and `withdraw`), started from **Actions > Owner tools > Run workflow**. Nothing to install.
- **Your own machine:** with the repository cloned and `npm ci` done, on Node 22.21 or later.

There is no allowlist: a page neither place can fetch is the maker's own bot wall (D18, D50).

The runbooks keep their old numbers, because workflow messages and older notes cite them. O1, O3, O6 and most of the A runbooks belonged to the AI sessions and are retired; each says where its job went.

All dates in records and logs are UTC (`date -u +%F`).

## Owner runbooks

### O1 Start a `Crawl` session (retired)
Retired at cut-over (13 Nov 2026): there are no sessions and no `Crawl` environment. Adding a source is O11, a correction is O10, and reviewing a data PR is O9.

### O2 Merge a protected PR
**When:** a PR has the `needs-human-merge` label.
1. Open the PR. Check that its head branch is in `sombreserotonin/Patchlife`, not a fork.
2. Read **Files changed**. Reject anything that:
   - adds secrets; adds `pull_request_target`, `workflow_run` or `issue_comment` triggers; or adds any trigger or permission that the PR description doesn't list and explain;
   - weakens the `protected-paths` job or `data-gate`;
   - changes what the merge bot may merge (`scripts/merge-bot.mjs`) or what counts as a re-verification (`scripts/verification-only.mjs`) without saying so.
3. Confirm the `test` check is green. Then use **Squash and merge**. Never remove the label.

**Done when:** the PR is merged and CI is green on `main`.

### O3 Add a host to the `Crawl` allowlist (retired)
Retired at cut-over (13 Nov 2026): there is no allowlist. GitHub's runners and your own machine reach any host (O11 step 9).

### O4 Recover failing housekeeping
**When:** GitHub emails you that a `Housekeeping` run failed, a `watchdog` issue is open, or the Monday summary on #27 is missing. A red run is the alarm (MIGRATION decision 7): most red runs mean the watchdog found a problem, not that the workflow broke. [`OPERATIONS.md`](OPERATIONS.md), "Alerts", says what each failure line and each `watchdog` line means.
1. Open https://github.com/sombreserotonin/Patchlife/actions/workflows/housekeeping.yml, open the latest run, then the `housekeeping` job. Find the red step.
2. **The first step, `Run actions/create-github-app-token@v3`, is red:** the App's token could not be minted, so nothing else ran. Check `BOT_CLIENT_ID` at https://github.com/sombreserotonin/Patchlife/settings/variables/actions, the secret `BOT_APP_PRIVATE_KEY` at https://github.com/sombreserotonin/Patchlife/settings/secrets/actions, and that `patchlife-bot` is still installed at https://github.com/sombreserotonin/Patchlife/settings/installations. A new key is O12 step 8.
3. **`Merge the routine PRs` is red:** the merge bot stopped. Lines like `#N: skipped (<reason>)` are not errors: they say why a PR waits for you. The last line says what stopped it. `Missing environment variable(s)` or `BOT_LOGIN must be the App's login`: the workflow file changed, which needs a protected PR (O2). `HTTP 4xx` or `5xx`: a GitHub call failed; re-run the workflow once with **Re-run all jobs**. `GitHub did not confirm the merge, so <branch> stays`: the branch moved while merging; the next run tries again. The watchdog still ran, so read step 4 too.
4. **`Watchdog` is red:** the log lists one `<check>: <message>` line per problem and ends `N problem(s)`. The same lines are in the `watchdog` issue at https://github.com/sombreserotonin/Patchlife/issues?q=is%3Aissue+label%3Awatchdog. Fix each cause; the next run that finds nothing closes the issue. One line needs you and nobody else: `Workflows: <name> (<path>) is switched off`. Open https://github.com/sombreserotonin/Patchlife/actions/workflows/<file> and select **Enable workflow**. The watchdog never re-enables a workflow, because whoever re-enables it gets its failure emails, and GitHub switches scheduled workflows off after 60 days without activity in a public repository. `Set GH_TOKEN and GITHUB_REPOSITORY first` or `Unknown argument` means the workflow file changed (O2).
5. **`Open the monthly measures PR` is red:** the push or the PR failed on the 1st. Re-run the workflow; it opens no second PR while `claude/measures-<yyyy-mm>` exists. If that branch exists with no PR, open one from https://github.com/sombreserotonin/Patchlife/branches.
6. **Any other step (the checkout, `Run npm ci`):** a GitHub or npm outage. Check https://www.githubstatus.com and re-run later.
7. To test a fix without merging or posting anything, select **Run workflow** with **dry_run** ticked. The log then shows `Dry run: would ...` lines instead of actions.

**Done when:** the next scheduled run is green, or red only for `watchdog` lines you have explained in a comment on the issue.

### O5 Weekly routine (Monday morning, about 30 to 45 minutes)
**When:** every Monday morning (Sydney time), after Sunday's UTC runs: the data refresh at 16:17 UTC and the summary at 21:23 UTC (08:23 Monday in daylight time). GitHub often starts both hours late.
1. **The summary (5 minutes):** read the newest comment on https://github.com/sombreserotonin/Patchlife/issues/27. It must be under 8 days old: apart from the dead-man's switch, this is the only check on the watchdog itself. If it is missing by early afternoon, O4. Read the `watchdog` issue if one is open (https://github.com/sombreserotonin/Patchlife/issues?q=is%3Aissue+label%3Awatchdog) and act on each line per OPERATIONS.md, "Alerts". Act on any GitHub failure email from the week you haven't yet.
2. **The data PR waiting for you (0 to 20 minutes):** the weekly candidate PR (O9), or any other data PR. On your machine, `git fetch origin`, check out the PR's branch, and run `node scripts/audit-sample.mjs <pr number>`. It prints a fixed sample (3 records or 5%, at most 10), one line each: id, model, end date and a link to the maker's page with the quote highlighted. Open each link and check the date and its order (DD/MM against M/D), the model, "or later" or "at least" against `at_least`, and the region. Open the rows the PR body flags too. A wrong category: O9 step 4. Add `audited` last, because any later push removes it, then **Squash and merge**. A record you wrote yourself has no second reader: re-read it the next day through its highlight link (D48).
3. **Spot check (8 to 10 minutes):** the summary's five random records. Open each "maker's page" link and compare the record with the highlighted words: the model, the date, "at least" and any condition. A mismatch: O8 to pull the date now, then a `data-correction` issue for the proper fix (O10).
4. **Waiting on you (0 to 10 minutes):** merge `needs-human-merge` PRs (O2) and clear `needs-human` items (O7). The summary lists both.
5. **Public queue (0 to 15 minutes):** `data-correction` and `add-model` issues (O10), PRs from forks (the bot never merges them, and outside contributions are not accepted yet, D10: close them, or read every file before you merge one, because a fork's PR runs its own copy of the checks), and data PRs waiting for your review.
6. **Monthly work, averaged (5 minutes):** O12's monthly items: Dependabot's grouped PRs, CodeQL and Dependabot alerts, Search Console, and `docs/MEASURES.md` against the Measures targets in [`PLAN.md`](PLAN.md).
7. **Quarterly and yearly work, averaged (2 minutes):** O12.

A red `Re-verify evidence` run means the verifier, validation or the push broke, so read the `watchdog` issue that morning. Records that couldn't be checked show only as a warning; they reach the `watchdog` issue after 3 nights, and then you follow O11 for a blocked source, or O8.

**Done when:** the summary is read and under 8 days old, no `watchdog` line is unexplained, and no PR or `needs-human` issue waits on you.

### O6 Create the nightly `Crawl` scheduled task (retired)
Retired at cut-over (13 Nov 2026): the nightly AI task is gone. The weekly `Data refresh` workflow proposes new and changed rows from the pages that have a parser (O9), and a new maker is O11.

### O7 Answer a `needs-human` issue
1. Follow the steps in the issue, or make the decision it asks for.
2. Comment with the result, for example "added", "A", or "approved with changes: ...".
3. Close the issue.

### O8 Pull a wrong date now, or move records to a page that moved
**When:** a published date is wrong and the proper fix (O10) can wait, but the date can't; or a maker moved a page, so the records that cite it go stale. Both run on GitHub's runners from **Actions > Owner tools > Run workflow**, so you need no clone. The runs queue in the `crawl` group, one at a time.
1. **One record, now (`withdraw`):** action `withdraw`, `ids` the record id (one per run; it is the file name under `data/devices/<brand>/` and the end of the model page's address, `/devices/<id>/`), `text` why. The run makes the record `rule: none_published` with no quotes, `unverified`, keeps its cited pages, adds `Withdrawn pending review (<date>): <reason>.` to its notes, validates, and opens a PR on `claude/withdraw-<run id>` as `patchlife-bot`. Add `audited` and **Squash and merge**; the site rebuilds and shows "No published period found". An unknown id, or a record already withdrawn, fails the run before any push, and the log says which.
2. **Several records:** one `withdraw` run per record; or, on your machine with the repository cloned and `npm ci` done, `node scripts/withdraw-record.mjs <id> "<reason>"` for each, then one PR for all of them, `audited`, merge.
3. **A page that moved (`repoint`):** action `repoint`, `url` the old address exactly as the records cite it (copy it from a record's `evidence`), `new_url` the new one. The run moves every evidence item that cites the old address to the new one, clears their `archive_url` so the nightly run captures the new page, re-verifies every record it touched, and opens a PR on `claude/repoint-<run id>` with the verifier's output in the body. Every record `verified`: add `audited` and merge. Some `stale`, `failed` or `error`: the new page no longer holds their quotes. Read it with `read-page` and the model name in `text` (O11 step 3); when the maker now says something else, merge the PR and withdraw those records (step 1), then O10 for each; when most records failed, the address is wrong: close the PR and try again.
4. **Without a runner** (Actions is down, or the host blocks runners): on GitHub open `data/devices/<brand>/<id>.yaml`, select **Edit**, change the support block to `rule: none_published` with `end_date`, `years` and `anchor_date` set to `null`, `at_least: false` and `conditions: null`, set `verification.status: unverified`, delete the evidence quotes (keep each page's `url`, `retrieved` and `regime`), add the note from step 1, commit to a new branch, open a PR, add `audited` once `test` is green, and merge.
5. Then O10 for the proper fix, unless the withdrawal came from an issue you are already handling.

**Done when:** the record no longer shows a date, or every record cites a page that exists.

### O9 Review a candidate data PR
**When:** a PR changes records, or the registry beyond `last_checked`, so `data-gate` fails until you add `audited`: the weekly candidate PR from `data-refresh.yml` (branch `claude/data-auto-<date>-<run id>`, titled `data: weekly refresh <date>`, Sundays), a `repoint` or `withdraw` PR from Owner tools (O8), or a data PR you opened yourself (O11). Only your own label event counts, and every push to the PR removes the label, so label last. This is the review that an AI session's audit (A8) used to be. About 0 to 20 minutes a week.
1. **Read the PR body.** The weekly PR holds: a table of each written record (`new`, or `changed` with the row's values before and after: end date, "at least", conditions); **Flags for a person**, what the parsers could not settle on their own (a row they could not place, a rename, a footnote); the per-page summary (`rows found` against the profile's `min_rows`, then how many rows were cited, reproduced, changed, new and skipped); the verifier's last lines; a **Spot check** block with one highlight link per sampled record; and the dates on the parsed pages that no record quotes yet, which are the rows left for later runs. A `repoint` or `withdraw` PR holds the script's output instead.
2. **The sample.** Open each **Spot check** link: the maker's page opens with the quote highlighted (on your machine, on the PR's branch, `node scripts/audit-sample.mjs <pr number> <the ids in the table>` prints the same links; with no ids it samples every record the branch changes). Check each record against the highlighted words and the row around them: the date and its order (DD/MM against M/D), the model and its hardware version, "or later" or "at least" against the record's "at least", the region the page covers, and the category (DATA-POLICY, "Reviewing a record"). For a changed row, the page must now say the new value, not the old one.
3. **The flags.** Open the record each flag names the same way, and settle it from the page.
4. **Fix or refuse:**
   - **A wrong category:** on the PR's branch, fix `category_map` or `category_exceptions` for the brand in `data/sources/seed.yaml` (the fields are in DATA-POLICY, "Source profiles") and set the record's `category` to match, on the same branch: validation checks one against the other (R7), and the parsers never change a record's category, so a re-run would only confirm it. The registry is a protected path, so the PR also gets `needs-human-merge`; it is yours to merge anyway (O2).
   - **A profile fix the parsers read** (a rename, a `conditions` sentence, a notes template): edit the profile on the PR's branch, then dispatch `data-refresh.yml` with `refresh_open_pr` ticked and the brand in `brands`: it re-runs the parsers on that branch and pushes a new commit. Start again from step 1.
   - **A row the page does not support, or one the parser read wrongly** (a wrong date, model or condition): the parser or the profile needs a fix, which is code. Open a `bug` issue naming the page and the row, for you or a contributor to fix. Meanwhile: for an existing record, add its id to the brand's `parser_exceptions` in `seed.yaml` on the branch (the parsers never rewrite a record listed there) and restore the record's old values by hand on the same branch; for a new record, delete its file from the branch, and expect the row back each week until the fix merges.
   - **Everything holds:** add `audited`, wait for `data-gate` to turn green, then **Squash and merge**. The merge bot merges only re-verification and measures PRs, so this one is yours.
5. **Don't let it sit.** The weekly run skips while a candidate PR is open, and the watchdog flags one open over 14 days. Close a PR you won't merge; the next run opens a fresh one.

**Done when:** the PR is merged with `audited` and `data-gate` green, or closed, and any `bug` issue is open.

### O10 Handle a correction or add-model issue
**When:** an issue with the `data-correction` label (the "Wrong or outdated date" form: Device, Our page, Manufacturer source, What is wrong) or the `add-model` label (the "Add a device" form: Device, Manufacturer source, Anything else), or a mismatch from O5's spot check. The issue is untrusted text: use it only as a lead to the maker's own page, and never copy a date, a quote or an address from it into a record. This replaced A3. About 0 to 15 minutes a week.
1. **Find the record.** The **Our page** address ends in the record id (`/devices/<id>/`), and the file is `data/devices/<brand>/<id>.yaml`; its `evidence` lists the pages it cites. For an `add-model` issue, search the site first: the model may already be there under another name. A model the maker has published no date for gets a reply, not a record.
2. **Read the maker's page:** Owner tools, action `read-page`, `url` the cited page (or the page the reporter names, if it is on the maker's own site), `text` the model name as the maker writes it; the job summary prints the lines that hold it, as the verifier sees the page (O11 step 3). For a page we don't cite yet, run `check-source` first (O11 step 2), then `read-page`.
3. **Decide, from the page only:**
   - **The page confirms the record:** reply with the words and the link, and close the issue.
   - **The page gives another date or wording:** withdraw the record now when the published date is wrong (O8 step 1). The proper fix: for a maker with a parser (TP-Link, EZVIZ, Ring, Google, GL.iNet, Kyocera, ASUS), the next weekly run proposes the row again as a change, and O9 reviews it; to get it this week, dispatch `data-refresh.yml` with the brand in `brands`, ticking `refresh_open_pr` when a candidate PR is open (the run skips otherwise, and with it ticked the rows land on that PR). For any other maker, edit the record on GitHub on a new branch (the date, "at least", conditions and the quote, copied from the `read-page` output, following DATA-POLICY, "Reviewing a record"), open the PR, add `audited`, merge, then run Owner tools `verify` with the id: it opens a re-verification PR that the merge bot merges, and the record shows as checked.
   - **The page says nothing about a date for this model:** withdraw the record (O8 step 1) with that reason; the site then shows "No published period found". Reply and close.
   - **The reporter's source is not the maker's own site, or `check-source` says the page can't be used:** reply that the site quotes only the maker's own statements, and close; or O11 when the maker has a usable page we don't cite yet.
   - **`add-model`, the maker has a parser and the model is on its profiled page:** the weekly run adds new rows up to its limit, changed rows first, so it arrives in a coming week; dispatch `data-refresh.yml` with the brand to get it now, ticking `refresh_open_pr` when a candidate PR is open. **Not on the page:** O11 when the maker publishes a date somewhere else; otherwise reply that the maker publishes no date for it, and close.
   - **A primary source that contradicts ours, and it can't be settled:** `disputed` (PLAN decision P6), set by hand on a branch; the site shows "Under review".
4. **Reply and close** with what you checked (the page and the words you found or didn't), in plain words and with no promises. Close as completed when the data changed or was confirmed, as not planned otherwise.

**Done when:** the issue is closed with the page named, and any date change went through O8 or O9.

### O11 Check and add a source
**When:** you want to add a maker, an `add-model` issue names one, a `needs-human` issue asks about a host, or an entry in `data/sources/seed.yaml` is still waiting with `last_checked: null`. This replaced A2 and A5. One source per PR: one maker's statement, with its regional copies and any page it links for the same models (D19).

**Where to run it:** on your own machine, with the repository cloned and `npm ci` done (Node 22.21 or later). The `Owner tools` workflow's `check-source` and `read-page` actions run steps 2 and 3 on GitHub's runners instead, with nothing installed.

1. **Find the primary source** with the ranking in [`DATA-POLICY.md`](DATA-POLICY.md): the maker's statement of compliance (Australian Smart Device Rules, UK PSTI) or security support page first, then its end-of-life page. News, forums, retailers, distributors and AI answers only lead you to it. To revisit a source already in the data, first run `node scripts/unquoted-dates.mjs <cited url>`: it lists each date on the page that no record's quote covers, with the text before it. If none is a new model's row, there is nothing to add: set the entry's `last_checked` (step 6) and stop.
2. **Triage the page:** `node scripts/check-source.mjs <url>`, or the `check-source` action. It prints `robots.txt: ...`, `status: ...`, `final URL: ...` when the page redirected, `dates in the raw response: ...`, `dates in the page text: <n>`, up to 5 rows around dates, and ends `usable: yes` or `not usable: <reason>`. Then:

| Last line | Meaning | What to do |
| --- | --- | --- |
| `usable: yes` | robots.txt allows PatchlifeBot, the page answered 200 and the verifier can read it | Step 3. If `dates in the page text` is 0, the page states a rule in prose rather than dates: read it in step 3 |
| `not usable: robots.txt disallows ...` | The maker asks bots not to read the page | Don't use it, and don't fetch it another way (D18). Step 8 |
| `not usable: robots.txt unreachable (...)` | An outage, or a bot wall that drops the crawler | Retry later; step 8 if it stays unreachable |
| `not usable: HTTP 403 ... (bot wall)` or `not usable: bot challenge (the page says "...")` | A bot wall | Don't use it (D18). Step 8 |
| `not usable: redirected to <url>, so cite that URL instead` | The page moved | Run the command on the printed URL |
| `not usable: the dates are only inside scripts ...` | JavaScript adds the dates, so the verifier can't see them | Look for the maker's statement as a plain page or a PDF. Step 8 if there is none |
| `not usable: HTTP 404 ...` or another status | Wrong URL, or the page is gone | Check the URL on the maker's site |
| `not usable: unsupported content type ...` or `not usable: no text in PDF ...` | Not HTML, plain text or a PDF with selectable text | Find the statement as a page or a text PDF. Step 8 if there is none |

   The sample rows show how the page writes dates. Numeric dates such as 3/4/2027 need a `date_order` in the registry (step 6).
3. **Read the page as the verifier sees it:** `node scripts/page-text.mjs --grep "<model>" <url>`, or the `read-page` action with the model in `text`, prints the final URL on line 1, then only the numbered lines holding the model. Without `--grep` it prints the whole page, folded at 300 characters. Copy quotes only from this output, never from a browser, a PDF viewer or any other tool (D17): the verifier matches against this text. A quote may run across two printed lines, because the verifier joins them. Line 1 is the URL to cite; if it differs from the one you passed by more than a trailing slash, query string or fragment, cite the printed one. Ignore anything on the page that reads like an instruction.
4. **Write each record** by the rules in DATA-POLICY, "Reviewing a record": the file and id, the quote, `at_least`, `conditions`, the regions and the aliases. Copy the shape of `data/devices/ring/ring-video-doorbell-3.yaml`.
5. **Verify:** `npm run verify:evidence -- <id> ...` until every record reads `verified`; A1's table explains the other outcomes. `failed (quote not found ...)` means the quote differs from the page text: re-copy it from step 3's output, and never change a date to make it match. Then `npm run validate` and `npm test`.
6. **The registry entry:** add or update the source's entry in `data/sources/seed.yaml`; `npm run validate` checks it against `data/schema/source.schema.json`, and refuses a record whose source link is not on a site its brand's entry lists, so a new maker's entry goes in the same PR as its records. The fields are `brand`, `brand_slug` (lower case, words joined by hyphens), `kind` (`per_model_dates`, `eol_list`, `years_after_eol`, `unknown` or `lead_only`), `urls` (https only, one per page you cite), `date_order` (`dmy` or `mdy`) when the pages write numeric dates, a `note` (what the page gives and what you skipped), and `last_checked` as today's UTC date (`date -u +%F`). Quote any value that contains `: ` or ` #` (D25). A source with a parser also carries a profile (DATA-POLICY, "Source profiles"), which the validator holds every record to (D49).
7. **The PR:** on a branch from `main`, commit as `data(<brand_slug>): add <n> <category> records`. Open a PR, fill the template's data table (model, change, source) and paste the verifier output. `data-gate` goes red, because the PR changes more than a re-verification does. Run `node scripts/audit-sample.mjs <pr number>` on the branch, check the sample through its links (O5 step 2), add `audited` last (a later push removes it), and re-read the records the next day through their highlight links, because nobody else reads data you write yourself (D48). Then **Squash and merge**. The site rebuilds on merge.
8. **When the source can't be used:** add the reason to the entry's `note` in `data/sources/seed.yaml`, as Arlo's entry does, and set its `last_checked` to today. Merge that in its own PR with `audited`, because the gate treats `seed.yaml` as data. An entry that failed for a temporary reason (a timeout, `fetch failed`, HTTP 429 or 5xx) keeps its `last_checked`. The makers still waiting are listed in the source queue issue (#194).
9. **A host that's blocked:** there is no allowlist. Your machine and GitHub's runners reach any host, so a page they can't fetch is the maker's own bot wall, and the source can't be used (D18): step 8.

**Done when:** every new record reads `verified`, the PR is merged with `audited`, and the source's entry in `seed.yaml` has today's `last_checked`.

### O12 Monthly, quarterly and yearly upkeep
**When:** the first Monday of the month for the monthly items, with O5; the first Monday of January, April, July and October for the quarterly ones; and the yearly ones when `ops/renewals.yml` says so. The watchdog warns 60 and 14 days before each `due` date, as a `Renewals` line on the `watchdog` issue.

**Monthly**
1. **The measures PR:** on the 1st (UTC), Housekeeping opens `claude/measures-<yyyy-mm>`, which regenerates `docs/MEASURES.md` from `node scripts/data-report.mjs`, and the bot merges it the next night. If it is still open on the 3rd, open it: `test`, `data-gate` and `build` must be green and `docs/MEASURES.md` must be its only file; otherwise O4. Compare the file's first four lines with the targets in [`PLAN.md`](PLAN.md), "Measures".
2. **Dependabot's grouped PRs:** one for npm packages and one for Actions each month, after a 7-day cooldown (`.github/dependabot.yml`). They change protected paths, so you merge them (O2), and `protected-paths` may fail on them because Dependabot's runs get a read-only token. Merge each once `test` is green. If a major version breaks `test`, don't fix code: add an `ignore` entry for that package in `.github/dependabot.yml` (a protected PR) and open an issue.
3. **Security alerts:** https://github.com/sombreserotonin/Patchlife/security, for Dependabot and, once set up, CodeQL. Fix or dismiss each with a reason.
4. **Search Console:** https://search.google.com/search-console, the `patchlife.tech` Domain property: indexing, and that `https://patchlife.tech/sitemap.xml` is still read.
5. **Renewals:** read `ops/renewals.yml`. Fill in any `due: null` you now know: one item per entry, with `name`, `due` as `"YYYY-MM-DD"` or `null`, and `note`. After renewing something, set its next `due` in a PR; the watchdog keeps warning until you do.

**Quarterly**
6. **Cloudflare zone export:** in the Cloudflare dashboard, the `patchlife.tech` zone, then DNS, Records, **Export** (a BIND zone file; the menu names come from the plan's search summary and are unverified). Keep it with the Unraid backups.
7. **Restore test:** from the Unraid mirror, `git clone /path/to/patchlife.git patchlife-restore`, then `npm ci`, `npm run validate`, `npm test` and `npm run build:site` in the clone. Check that the issues export has files from the last week. OPERATIONS.md, "Backups", says what each backup holds.

**Yearly**
8. **The App's key (keys don't expire, so rotate it once a year):** at https://github.com/settings/apps/patchlife-bot, under **Private keys**, select **Generate a private key**. Paste the whole `.pem` into the secret `BOT_APP_PRIVATE_KEY` at https://github.com/sombreserotonin/Patchlife/settings/secrets/actions. Run **Housekeeping** with **dry_run** ticked and check that its first step is green. Then delete the old key in the App's settings, and set the next `due` in `ops/renewals.yml`. If a key leaks, do the same at once, deleting the old key first.
9. **Node upgrade:** before the pinned version's end of life (`ops/renewals.yml`; Node 26's is 30 April 2029), on a branch change every `node-version: 26` under `.github/workflows/` to the next even-numbered version, which is the LTS line, and raise `engines.node` in `package.json` only if a script needs it. CI runs on the PR, which is protected (O2). If `test` is red on the new version, stay on the old one and open an issue. The move from 24 to 26 was made this way on 13 Nov 2026.
10. **Domain:** `patchlife.tech` renews at your registrar, with auto-renew and two-factor sign-in on (G3); record the price and expiry in `ops/renewals.yml`. The other entries there (`sombrexo.com`, its mailbox, Cloudflare's plan, Unraid's licence) follow MIGRATION decision 13.
11. **Re-read this file and OPERATIONS.md** against what actually ran this year, and fix anything that has drifted.

**Done when:** every item is done or has a date in `ops/renewals.yml`, and the `watchdog` issue has no `Renewals` line.

## Reference: the former agent runbooks

AI sessions followed these until 13 November 2026. A1, A4, A8 and A9 are kept, because workflow messages and the runbooks above cite them; the rest say where their job went.

### A1 Verifier outcomes
What `npm run verify:evidence` prints, on your machine (after `npm ci`, on Node 22.21 or later) or in the `verify` action of Owner tools and the nightly `Re-verify evidence` run.
1. Run `npm run verify:evidence -- <ids>`, passing only the records you touched or that are due.
   - `--due <days>` and `--limit <n>` choose only `verified` records. `--due` keeps those whose `checked` date is more than `<days>` days before today (UTC). `--limit` keeps the `<n>` oldest of them, and on its own takes the `<n>` oldest `verified` records. Oldest first only decides which records the limit keeps: the chosen records are then checked and printed in file order. For example: `npm run verify:evidence -- --due 60 --limit 40`.
   - With ids as well, the options choose only among those ids. Unverified, `stale`, `disputed` and `none_published` records are never chosen: they need repair (A4), not a re-check.
   - A `verified` record whose fetch keeps ending in `error` keeps its old `checked` date, so it stays at the front of every run. After repeated errors, follow A4 or O11 step 8 instead of waiting; the watchdog lists such records after three nights.
2. Read each outcome:

| Output | Meaning | Action |
| --- | --- | --- |
| `verified` | Every quote matched | Keep |
| `failed (quote not found at <url>)` | The quote isn't in the page text | Re-copy the quote from the page text (O11 step 3). Never change a date to make it match |
| `stale (...)` | A verified record's quote is gone, or the cited page itself returns 404 or 410 | A4 |
| `error (robots.txt disallows <url>)` | The site asks bots not to fetch this page | Don't use the source (O11 step 8). If `<url>` has a different origin from the cited URL, the cited page redirected there: A4 first |
| `error (robots.txt unreachable (...) for <origin>)` | An outage or a bot wall | Retry later; O11 step 8 if it stays unreachable. If `<origin>` differs from the cited URL's origin, the cited page redirected there: A4 first |
| `error (HTTP 403 for <url>)` or a bot challenge | Bot wall | Don't use the source (O11 step 8) |
| `error (HTTP 429 ...)`, `(HTTP 5xx ...)`, `(<host> asked us to back off)` | Temporary | Retry in a later run; change nothing |
| `error (unsupported content type "<type>" ...)` | Not HTML, plain text or PDF | Don't use it as evidence; find the statement as a page or PDF |
| `error (unreadable PDF at <url> (...))` | The file isn't a PDF pdf.js can read | Re-check the URL; if it is a real PDF, don't use it (O11 step 8) |
| `error (no text in PDF at <url> (...))` | A scanned PDF (images only), or text in fonts pdf.js can't map, such as CJK fonts that need CMap files | Don't use it (O11 step 8); never type a quote from an image. If the PDF shows selectable text in a browser, note it in the PR: adding `pdfjs-dist` 6.1.200 (protected) gives pdf.js its CMaps |
| `failed (quote not found ...)` on a PDF | Usually a quote that differs from the page text | Run O11 step 3 on the URL. If it prints the row, re-copy the quote from that output. If the row's words are missing although the PDF shows them, treat it as the row above |
| `error (HTTP 404 for <url>)` on an unverified record | Wrong URL | Re-check the URL on the maker's site (O11 step 1) |
| `error (redirected to <url>)` or `error (redirected to <url>, HTTP <status>)` | The cited page now redirects to another site or page, such as the homepage. The status is that page's error | Find where the statement moved (A4). A login page or bot challenge: O11 step 8 |
| `error (no record with this id)` | Typo in the ids | Re-run with the right id |
| `error (more than 5 redirects ...)`, a timeout or `fetch failed` | Network or site problem | Retry in a later run; change nothing |
| `skipped (none_published)` or `skipped (disputed)` | Not checked by design | None |

   After the record lines comes one line per page read, compared with the hash stored for its URL in `data/sources/page-hashes.json`, then a count of each kind. A page that could not be read gets no line and keeps its stored hash.

| Output | Meaning | Action |
| --- | --- | --- |
| `<url>: page unchanged` | The page text is the same as at the last read | None |
| `<url>: page changed` | The page text differs from the last read, whether or not its quotes still match | If every record citing it verified, something else on the page changed, such as a new model or another model's date: name the page in the PR |
| `<url>: page not seen before` | No hash is stored for this URL yet, such as a new source or a moved statement | None |

3. After a run on your machine: `npm run validate` and `npm test`, then paste the verifier output into the PR and commit `data/sources/page-hashes.json` with the records.

### A2 Add records from one source (retired)
Now O11.

### A3 Handle a `data-correction` issue (retired)
Now O10.

### A4 Stale record
A `stale` record's quote is no longer on its page.
1. **The statement moved:** find it on the maker's own site and repoint the records (O8 step 3).
2. **The maker now says something else, or nothing:** pull the date (O8 step 1), then O10 for the proper fix. For a maker with a parser, the weekly refresh proposes the changed row (O9).
3. When you change an item's quote or URL by hand, set its `archive_url: null`; the nightly run captures the page again (D43).

Never keep a date without a matching quote.

### A5 Blocked or unusable source (retired)
Now O11 steps 8 and 9. The makers that could not be used are listed in the source queue issue (#194).

### A6 Waiting on the owner (retired)
### A7 Conflicted or failing agent PR (retired)
Both said how a session worked around the owner or repaired its own PR. Nothing replaces them: you merge protected PRs (O2), and a red run or a stuck bot PR is O4.

### A8 What `audited` means
A data PR that changes more than a re-verification does (A9) merges only with the `audited` label. Until cut-over a second AI session added it, after checking every record against the maker's page. Now the label is yours alone (D48): add it after the review in O9. `data-gate` counts only a label you added yourself, and every push to the PR removes it, so label last. A push from a fork can't remove the label, so on a fork's PR the check passes only on the run your label starts: after a later push or edit, read the new commits, then remove the label and add it again.

### A9 What a re-verification may change, and who merges it
A re-verification changes no data but `verification` blocks, empty `archive_url` fields it fills with a capture that holds the item's quote (D43), and `data/sources/page-hashes.json`. A registry entry's `last_checked` moving on its own counts the same. Such a PR needs no `audited` label:
1. `data-gate` runs the base branch's `scripts/verification-only.mjs` against the PR and passes when it prints `Only verification changed`, or when you have added `audited` (A8). To check by hand, on the PR's branch: `node scripts/verification-only.mjs $(git merge-base origin/main HEAD)`.
2. The `Re-verify evidence` workflow pushes `claude/reverify-<date>-<run id>` with the App's token and opens the PR itself, so CI runs at once. Housekeeping's merge bot merges it at 21:23 UTC while the repository variable `BOT_MERGE` is `on`, and deletes the branch (D47). The workflow stops at its guard while any such branch exists, so a branch whose PR was closed without merging blocks it until you delete the branch.
3. A run lists the records it couldn't check in a warning annotation titled `Records not checked` (the run still passes; it fails only when the verifier itself broke). The watchdog reports ids that recur on three nights.
4. Records it marked `stale` are yours: A4.
