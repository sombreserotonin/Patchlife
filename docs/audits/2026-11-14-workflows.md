# Verified security sweep: workflows, 2026-11-14

## Context
Scope: `.github/workflows/data-refresh.yml`, `.github/workflows/reverify.yml`, `.github/workflows/owner-tools.yml`, `.github/workflows/pages.yml`, `.github/workflows/codeql.yml`, `.github/workflows/probe-hosts.yml` and `.github/dependabot.yml`. The scripts they run were read for their output and exit codes. Their own logic belongs to other zones.

Trigger: the owner's request of 14 Nov 2026 to audit the whole codebase. This is the first sweep of the zone recorded in `docs/audits/`. The closed-earlier list from the shared brief applied: #198, #203, #205, #206, #207, #213, #215 and D62.

Commit read: e484c80.

## Delegation
One fresh reviewer read the zone. It was a general-purpose agent, read-only, with no network, given the shared brief described in `docs/audits/2026-11-14-merge-gate.md`. It ran in the first wave.

I verified every finding on its cited lines.

A second fresh reviewer then checked #224, asking only what the fix broke. It ran every scheduled and owner path on stub commands, and ran the gate end to end on real commits. It also compared the push header, byte for byte, against a local git server. It found nothing that breaks a routine run. It did find one labelling gap, which belongs to the merge-gate zone, and asked for four guards. Both were done before #224 merged.

After the merge, a re-verify run (43567904406) and an Owner tools `verify` run (43568139357) on `main` pushed with the new command. They opened #228 and #229, which were merged.

## Verification
| Finding | Zone | Verdict | Claimed | Verified | Reservations | Proof |
|---|---|---|---|---|---|---|
| M1 page text in the weekly PR body's flags is live markdown: closing keywords and mentions act | workflows | VERIFIED REAL | Medium | Medium | needs a maker's page to carry the text, and the owner to merge | `tests/workflows.test.mjs` "the weekly PR body fences the flags, and the push alone gets the App's token", ran, fails as expected on e484c80, passes after #224 |
| M2 `probe-hosts.yml` prints a maker's redirect target to the log without D62's cleaning | workflows | VERIFIED REAL | Medium | Medium | manual workflow with a read-only token | `tests/workflows.test.mjs` "every command that reads makers' pages sends its output to a file or through D62's cleaning", ran, fails as expected, passes after #224 |
| M3 the App's write token stays in the git configuration for every step of the crawl jobs | workflows | VERIFIED REAL | Medium | Medium | the fix narrows the gap; code that runs in a job can still plant something for its push step, because runners allow sudo | `tests/workflows.test.mjs` "no job that holds the App's token keeps it in the git configuration or hands it to a step that reads pages", ran, fails as expected, passes after #224 |
| M4 `refresh_open_pr` re-parses over the PR's own rows, so the rename fix RUNBOOKS O9 prescribed fails the parser gate | workflows | VERIFIED REAL | Medium | Medium | answered by a documented route, not a code change: the code behaviour stays | `tests/audit/open-findings.test.mjs` "workflows M4: a refresh after a rename on the PR's branch passes the parser gate", ran, fails as expected (open). The route's own test in `tests/candidates.test.mjs` passes |
| M5 Owner tools `verify` puts every id in the PR title, and pushes first | workflows | VERIFIED REAL | Medium | Medium | GitHub's 256-character limit was not hit live; it is GitHub's documented limit | `tests/workflows.test.mjs` "owner tools verify keeps its PR title short, whatever the number of ids", ran, fails as expected, passes after #224 |
| L1 Owner tools `verify` takes a crashed verifier for a finished one | workflows | VERIFIED REAL | Low | Low | | `tests/workflows.test.mjs` "owner tools verify stops when the verifier crashes, and goes on when it finishes", ran, fails as expected, passes after #224 |
| L2 the open-PR lookup loses a `gh` failure, so the weekly run can open a second PR | workflows | VERIFIED REAL | Low | Low | | `tests/workflows.test.mjs` "the weekly PR's lookup fails the run when GitHub fails, instead of opening a second PR", ran, fails as expected, passes after #224 |
| L3 a SARIF file the summary step can't read reads as "No findings." | workflows | VERIFIED REAL | Low | Low | | `tests/workflows.test.mjs` "the CodeQL summary fails when it can't read the scan's output, and lists what it can", ran, fails as expected, passes after #224 |
| L4 after `refresh_open_pr`, the PR body describes only that run's writes | workflows | VERIFIED REAL | Low | Low | fixed by saying so in the body, not by keeping the earlier rows | `tests/workflows.test.mjs` "the weekly PR body fences the flags, and the push alone gets the App's token" (its refresh case), ran, fails as expected, passes after #224 |
| C1 `queue: max` on the crawl group lets runs pile up | workflows | FALSE POSITIVE | - | - | lens: claim correctness | see the refused section |
| C2 an input reaches a shell inline | workflows | FALSE POSITIVE | - | - | lens: claim correctness | see the refused section |
| C3 the bot-merged PR bodies carry page text | workflows | FALSE POSITIVE | - | - | lens: claim correctness | see the refused section |
| C4 the fenced blocks in the weekly body can be broken out of | workflows | FALSE POSITIVE | - | - | lens: existing mitigation | see the refused section |
| C5 `reverify.yml` grants `contents: write` to every run | workflows | FALSE POSITIVE | - | - | lens: claim correctness | see the refused section |
| C6 a page can forge the "Records not checked" annotation | workflows | FALSE POSITIVE | - | - | lens: existing mitigation | see the refused section |

## Confirmed defects

### M1, `.github/workflows/data-refresh.yml:161`, output encoding (PR body)
1. The flags were printed as list items, outside any fence.
2. Data flow: the maker's cell text goes through `htmlToText`, which decodes `&#35;` and `&#64;`, into a quote or a model name. From there it reaches a flag, then `report.json`, then the PR body.
3. Controls: D62 cleans logs, not PR bodies, and the same flags were also fenced in the per-page block.

Scenario: a cell reading `Fixes #12 @someone` mentions someone and closes issue 12 when the owner merges.

Fix (#224): the flags print inside a fence, one per line, with whitespace collapsed and every value made a string.

### M2, `.github/workflows/probe-hosts.yml:29`, log injection
The script's lines carry a redirect target, fragment included, such as `##[set-env]`, which fails the step. The output now goes through D62's `sed`, with `pipefail` (#224). A test checks every page-reading command in every workflow for that cleaning or a file redirect.

### M3, `.github/workflows/data-refresh.yml:55`, token scope
The checkout passed the App's token and persisted it. That left it for `npm ci` and for the steps that parse makers' HTML and PDFs, and `unquoted-dates.mjs` fetched pages with it in `GH_TOKEN`. The same was true of `reverify.yml` and `owner-tools.yml`.

Fix (#224):
- The checkouts use `persist-credentials: false`, and the push passes the token in one `-c http.https://github.com/.extraheader=...` argument.
- `unquoted-dates.mjs` moved to a step without the token.
- Every job that mints the App's token runs `npm ci --ignore-scripts`.
- Proven on `main` by runs 43567904406 and 43568139357.

### M4, `.github/workflows/data-refresh.yml:81`, legitimate path blocked
After `git switch` to the PR's branch, the parsers treat the PR's own unaudited rows as published records. A rename made on the branch then gives `differs: model` and `id differs`, and the run writes nothing.

Answer (#225): RUNBOOKS O9 says to delete that row's record on the branch first. A test runs that route and it passes. The code behaviour is unchanged, and the hand-off proposes the code fix.

### M5, `.github/workflows/owner-tools.yml:181`, legitimate path blocked
Ten ids made a title over 256 characters after the branch was pushed, and the leftover branch stopped the nightly run at its guard.

Fix (#224): the title gives a count, the ids are in the body, and every title is capped at 256 characters.

### L1 to L4
- **L1, `.github/workflows/owner-tools.yml:134`:** the step also needs the verifier's closing summary line, as `reverify.yml` does.
- **L2, `.github/workflows/data-refresh.yml:69`:** the lookup reads the whole list, then takes its first line, so a failed call fails the step.
- **L3, `.github/workflows/codeql.yml:48`:** `set -o pipefail`.
- **L4, `.github/workflows/data-refresh.yml:200`:** a refreshed body now starts by saying it lists only that run's rows. RUNBOOKS O9 says to review the whole PR under Files changed.

All four were fixed in #224.

## Refused or unconfirmed candidates
- C1, `queue: max`: refused, lens claim correctness. The setting is documented (MIGRATION decision 14), the workflows have run with it since 27 Oct, and the watchdog reports a cancelled crawl run.
- C2, inputs into shells: refused, lens claim correctness. No `${{ }}` appears inside any `run:`, as the reviewer checked by parsing. Every dispatch input is validated before use.
- C3, the PR bodies the bot merges: refused, lens claim correctness. They are built from fixed-format last lines and the run URL, never from page text.
- C4, breaking out of the weekly body's fences: refused, lens existing mitigation. Every line there starts with a fixed prefix, an id or a URL, and page text holds no newline. A residual case would need the repository's squash message to include the PR description, which it does not (the setting is "commit messages").
- C5, `contents: write` on every `reverify.yml` run: refused, lens claim correctness. Only the documented no-App fallback uses it, and it reaches only pinned actions.
- C6, a forged "Records not checked" annotation: refused, lens existing mitigation. Ids must match `^[a-z0-9]+(-[a-z0-9]+)*` before the warning is written.
- The 65,536-character body limit: refused, lens exploitability. Only a hostile page could reach it, and such a page can already fail the refresh by design.
- MIGRATION.md's note that `protected-paths` fails on Dependabot's PRs: refused as a defect, lens claim correctness. It describes the time before #206 and is a document, not behaviour; OPERATIONS describes the current behaviour.

## Coverage
- Read in full: the seven files in scope.
- Read for output and exit codes: `candidates.mjs`, `verify-evidence.mjs`, `archive-evidence.mjs`, `unquoted-dates.mjs`, `audit-sample.mjs`, `probe-hosts.mjs`, `page-text.mjs`, `repoint-source.mjs`, `verification-only.mjs`, `polite-fetch.mjs`, `table-rows.mjs` and the parsers.
- Lenses: exploitability, claim correctness and existing mitigation.
- Not run on GitHub during the read; the push path was run on GitHub after #224 merged.

Code quality, from the reviewer:
- The comment on the capped body blocks now says which two are capped.
- The exit-1 comment names every cause.
- The `grep -v` in the body has `|| true`.
- `probe-hosts.yml`'s header no longer refers to the retired COSTS stage.

All four changed in #224.

## Hand-off
- M4: proposed code fix for the owner. On the refresh path, restore `data/devices/<brand>` from `main` for the brands being refreshed before the parsers run, so a refresh redoes the weekly run with the fixed profile. This changes what a refresh writes, so it is the owner's call; until then, RUNBOOKS O9 has the route.
- M3: proposed design change. Move the push into a separate job that receives only the data change, so no code that read a maker's page shares a runner with the App's token.
