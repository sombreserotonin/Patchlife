# Verified security sweep: merge-gate, 2026-11-14

## Context
Scope: `.github/workflows/data-gate.yml` (jobs `data-gate` and `protected-paths`), `scripts/verification-only.mjs`, `scripts/merge-bot.mjs`, the merge bot's step in `.github/workflows/housekeeping.yml`, and `.github/workflows/ci.yml`.

Trigger: the owner's request of 14 Nov 2026 to audit the whole codebase before calling it production ready. This is the first sweep of the zone recorded in `docs/audits/`. Earlier security reads closed #198, #203, #205, #206, #207, #213 and #215, and the brief listed them as closed.

The code read is commit e484c80, which is `main` at 056ead7 plus `docs/audits/`.

## Delegation
One fresh reviewer read the zone: a general-purpose agent, read-only, with no network. It ran in the first wave beside `workflows`, `data-integrity` and `public-site`. The shared brief set out:
- the pre-read: CLAUDE.md, CONTRIBUTING.md, `docs/DATA-POLICY.md`, `docs/audits/categories.md`, `docs/ARCHITECTURE.md` ("Security model" and "Where pages are read"), DECISIONS and SPEC;
- the closed-earlier list above, the actors, and this project's severity calibration;
- at most ten findings, each with an evidence chain of three and a reproduction;
- a section of candidates examined and not confirmed, and a coverage section.

I verified every finding on its cited lines. Each fix then went to a second fresh reviewer, whose only question was what the fix broke:
- The check of #223 found a test pinned to a fixed date and three smaller regressions. All four were repaired before merge.
- The check of #224 found one more rename case (the registry moved out of `data/sources/`). It was repaired before merge.

## Verification
| Finding | Zone | Verdict | Claimed | Verified | Reservations | Proof |
|---|---|---|---|---|---|---|
| M1 a protected file renamed out of its path gets no `needs-human-merge` label | merge-gate | VERIFIED REAL | Medium | Medium | needs a PR that moves a protected file; `data-gate` still refuses a renamed record or registry file | `tests/workflows.test.mjs` "protected-paths labels a protected file moved out of its path, a new registry file and the bot's modules", ran, fails as expected on e484c80, passes after #224 |
| M2 the protected list leaves out the modules the bot and the gate load, the other registry files and `.npmrc` | merge-gate | VERIFIED REAL | Medium | Medium | every code PR is merged by the owner anyway; the label only prompts the careful read of RUNBOOKS O2 | `tests/workflows.test.mjs` "every module the bot's and the gate's scripts load is a protected path, and CONTRIBUTING lists it", ran, fails as expected, passes after #224 |
| M3 a fork's PR on the bot's head commit, aimed at another base, leaves a failing `data-gate` that holds the bot's PR | merge-gate | VERIFIED REAL | Medium | Medium | the GitHub half (two runs under one check name) was not run live; the repository's own merge-bot tests assume it. A branch cut from before #224 still carries the old trigger, and none remains once this report's branch takes `main` | `tests/workflows.test.mjs` "data-gate runs only for PRs into main, and protected-paths reads a PR again when it is pointed at main", ran, fails as expected, passes after #224 |
| L1 `protected-paths` does not run again when a PR is pointed at another base | merge-gate | VERIFIED REAL | Low | Low | | the same test as M3, ran, fails as expected, passes after #224 |
| L2 `page-hashes.json` is skipped before the regular-file check | merge-gate | VERIFIED REAL | Low | Low | needs the owner to merge a fork's PR | `tests/verification-only.test.mjs` "the page hash file must be a regular file too", ran, fails as expected on e484c80, passes after #223 |
| L3 the whole `verification` block is exempt, including changes the verifier never makes | merge-gate | VERIFIED REAL | Low | Low | the fix narrows the gap; no gate can prove a check ran | `tests/verification-only.test.mjs` "within the verification block, only what the verifier does: a disputed record stays as it is, and a check date never moves back", ran, fails as expected, passes after #223 |
| L4 the gate passes on exit 0 alone, and the script exits 0 silently when started through a link | merge-gate | VERIFIED REAL | Low | Low | no attacker controls the runner's workspace today | `tests/workflows.test.mjs` "data-gate passes only on the script's closing line, and gives its write token only to the steps that call gh" and `tests/verification-only.test.mjs` "the CLI judges the tree when it is started through a symbolic link, rather than doing nothing", ran, fail as expected, pass after #224 and #223 |
| L5 the audit binds to the head when the label is added, not to the commit the owner reviewed | merge-gate | NEEDS DEEPER REVIEW | Low | - | needs GitHub's event order for a push and a label close together; not reproducible offline | none; proposal in the hand-off |
| L6 the write token is in the environment of the step that parses the PR's tree | merge-gate | VERIFIED REAL | Low | Low | no code-execution primitive is known in that step | the same test as L4, ran, fails as expected, passes after #224 |
| C1 the gate's diff could differ from GitHub's three-way squash on a criss-cross merge base | merge-gate | FALSE POSITIVE | - | - | lens: claim correctness | see the refused section |
| C2 a record renamed or deleted passes as verification | merge-gate | FALSE POSITIVE | - | - | lens: existing mitigation | see the refused section |
| C3 a submodule, an LFS pointer, `.gitattributes`, a mode change or a binary or huge file passes | merge-gate | FALSE POSITIVE | - | - | lens: existing mitigation | see the refused section |
| C4 parse-equal YAML or `%YAML 1.1` slips past the gate | merge-gate | FALSE POSITIVE | - | - | lens: existing mitigation | see the refused section |
| C5 the textual `seed.yaml` exemption can hide a profile change | merge-gate | FALSE POSITIVE | - | - | lens: existing mitigation | see the refused section |
| C6 a fork's PR adds a workflow with a job named `data-gate` | merge-gate | FALSE POSITIVE | - | - | lens: existing mitigation | see the refused section |
| C7 the merge bot merges outside its rules | merge-gate | FALSE POSITIVE | - | - | lens: claim correctness | see the refused section |

## Confirmed defects

### M1, `.github/workflows/data-gate.yml:134`, labelling (input validation)
1. `files=$(gh api "repos/$REPO/pulls/$PR/files" --paginate --jq '.[].filename')` keeps only each file's new name.
2. For a rename, GitHub's list of PR files gives `previous_filename` as well. When nothing matches, line 149 removes a `needs-human-merge` label that an earlier push had earned.
3. `verification-only.mjs` sees renames only under `data/`. The merge bot refuses `renamed` only for its own PRs.

Scenario: `git mv .github/workflows/codeql.yml docs/codeql.yml` gets no label, so the owner's O2 read never happens, and code scanning stops once it merges.

Fix (#224): select both names (`.filename, (.previous_filename // empty)`). The `last_checked` exemption now selects registry patches by either name, and only for a modified file.

Reproduction: the test named in the table. On e484c80 a rename out of `.github/` and a registry moved to `data/seed.yaml` are unlabelled; routine bot PRs stay unlabelled on both commits.

### M2, `.github/workflows/data-gate.yml:135`, protected paths (supply chain)
1. The pattern protects four scripts and `seed.yaml`.
2. `merge-bot.mjs` imports `polite-fetch.mjs`. `watchdog.mjs` loads `build-site.mjs`, `data-report.mjs`, `status.mjs`, `renewals.mjs` and `site/search.js`, all in a process holding the App's token. `validateSources` reads every `data/sources/*.yaml`, and npm reads a root `.npmrc` on every `npm run`.
3. CONTRIBUTING's list matched the pattern, so neither control covered these files.

Scenario: a routine-looking change to `polite-fetch.mjs` merges unlabelled, and top-level code in it runs inside the next nightly merge bot with the App's token.

Fix (#224): the pattern and CONTRIBUTING list every module those scripts load, every registry file and `.npmrc`. A test walks the imports, so a new module can't slip past.

### M3, `.github/workflows/data-gate.yml:19`, gate integrity (availability of the nightly run)
1. `pull_request_target:` had no `branches` filter, and the check name carries no base.
2. A fork's PR from the bot's public head commit into an older branch is judged against that branch, fails, and leaves the newest `data-gate` run on that commit failing.
3. The bot's own filter (#205) ignores fork runs, but the ruleset can't tell two runs of one name apart.

Scenario: an outsider stalls the nightly re-verification every night by reopening or editing such a PR.

Fix (#224): `branches: [main]`, so a PR into another branch starts no run. Skipping the job instead would have reported a skipped check, which counts as passed.

### L1 to L6
- **L1, `.github/workflows/data-gate.yml:122`:** `protected-paths` now also runs on an `edited` event that changes the base (#224).
- **L2, `scripts/verification-only.mjs:61`:** `page-hashes.json` must be a regular file, and the validator refuses a registry file or hash file that is a link, dangling or not (#223).
- **L3, `scripts/verification-only.mjs:30`:** within `verification`, the gate refuses changes to a disputed record and a `checked` date that moves back. A person disputing a record still passes; settling a dispute needs `audited`, as RUNBOOKS A9 and O10 now say (#223).
- **L4, `.github/workflows/data-gate.yml:89`:** the gate needs exit 0 and the line `Only verification changed` (#224). Both gate scripts use `import.meta.main` and stop on a Node too old to set it (#223).
- **L6, `.github/workflows/data-gate.yml:41`:** `GH_TOKEN` moved from the job to the two steps that call `gh` (#224).

## Refused or unconfirmed candidates
- C1, criss-cross merge base: refused, lens claim correctness. `main` is linear (squash merges only), so the best common ancestor is unique.
- C2, a renamed or deleted record passing as verification: refused, lens existing mitigation. The gate's `--no-renames` reports a deleted record and a new file, and both are refused (`tests/verification-only.test.mjs`).
- C3, a submodule, an LFS pointer, `.gitattributes`, a mode change, a binary file or a huge file: refused, lens existing mitigation. A gitlink is a type change and is refused. LFS smudge is skipped, so a pointer parses as a string and is refused. The gate reads the checked-out bytes, as the build does. A mode change publishes nothing. Binary or huge content gives a parse error or overflows the buffer, so the gate fails closed.
- C4, parse-equal YAML or `%YAML 1.1`: refused, lens existing mitigation. Every consumer parses the same way, and 1.1 typing changes values, which are then refused.
- C5, the textual `seed.yaml` exemption hiding a profile change in a multi-line scalar: refused, lens existing mitigation. `sameButLastChecked` refuses the change, so it still needs `audited`.
- C6, a fork's PR adding a workflow with a job named `data-gate`: refused, lens existing mitigation. It touches `.github/`, so it is labelled, and the owner never merges a fork's PR on green checks alone (ARCHITECTURE).
- C7, the merge bot merging outside its rules: refused, lens claim correctness. Each rule was traced: own head repository, the bot's login, not a draft, base `main`, the branch type, hold labels, files that fit the type, check runs of this repository's own suites, and the merge pinned to the SHA it checked.
- Older copies of the gate on stale branches: closed earlier. The leftover branches were deleted by the tidy-up run of 13 Nov 2026 (#221), and today only this report's branch carries a pre-#224 copy.
- A label and an unlabel processed out of order: needs deeper review. The final status comes from whichever run executes last, and GitHub's order can't be checked offline.

## Coverage
- Read in full: `data-gate.yml`, `verification-only.mjs`, `merge-bot.mjs`, `ci.yml` and `housekeeping.yml`.
- Read as context: `tests/verification-only.test.mjs`, `tests/merge-bot.test.mjs`, `validate-data.mjs`, `reverify.yml` and `pages.yml`, plus parts of `owner-tools.yml`, `watchdog.mjs` and `build-site.mjs`.
- Lenses applied: exploitability, claim correctness and existing mitigation, against an outsider with forks and PRs, the owner making mistakes, and the App on untrusted input.
- Not run live: GitHub's handling of duplicate check names, its order of label events, and a fork run's head repository.

Code quality, from the reviewer:
- The duplicated GitHub paging in `merge-bot.mjs` and `watchdog.mjs` is left, to keep the bot unchanged.
- The gate's header now lists the `last_checked` exemption (#224).
- The fallback message for a failed label removal no longer claims the label was gone (#224).
- `merge-bot.mjs`'s log helper now says why it needs no D62 cleaning (#230).

## Hand-off
- L5: have `scripts/audit-sample.mjs` print the commit it sampled, and add to RUNBOOKS O5 and O9: "before adding `audited`, check that the PR's latest commit is the one you reviewed". This needs the owner's agreement, because it changes the review routine (D48).
- M2: the parsers and fetchers run in jobs that hold the App's token but are not protected paths. #224 keeps the token out of those steps' configuration and environment. Code that runs in a job can still plant something for that job's push step, because runners allow `sudo`. The full fix is a separate push job that receives only the data change. That is a design change for the owner.
- Housekeeping gives one token, with `actions` and `issues: write`, to the merge bot step, which needs neither. A second, narrower token for that step is a small change, proposed for the owner.
