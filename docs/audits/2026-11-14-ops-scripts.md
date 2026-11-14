# Verified security sweep: ops-scripts, 2026-11-14

## Context
Scope: `scripts/watchdog.mjs`, `scripts/audit-sample.mjs`, `scripts/check-licences.mjs` and `scripts/renewals.mjs`. The steps of `.github/workflows/housekeeping.yml` that run them were read as well.

Trigger: the owner's request of 14 Nov 2026 to audit the whole codebase. This is the first sweep of the zone recorded in `docs/audits/`.

Commit read: e484c80.

## Delegation
One fresh reviewer read the zone: a general-purpose agent, read-only, with no network. It worked from the shared brief described in `docs/audits/2026-11-14-merge-gate.md` and ran in the second wave.

I verified every finding on its cited lines and re-ran the reviewer's reproductions. Before #230 merged, a second fresh reviewer checked it for false and missed alarms.

## Verification
| Finding | Zone | Verdict | Claimed | Verified | Reservations | Proof |
|---|---|---|---|---|---|---|
| L1 nothing reports the weekly data refresh not running, and a missing crawl workflow (404) is skipped | ops-scripts | VERIFIED REAL | Low | Low | changed rows still surface late, through stale records | `tests/watchdog.test.mjs` "data refresh: a line when no weekly refresh has succeeded for 8 days, none before" and "cancelled runs: every crawl workflow is read, and a missing one (404) or another error is reported", ran (the reviewer's form fails on e484c80), pass after #230 |
| L2 the Unchecked records line depends on an annotation title no test ties to `reverify.yml` | ops-scripts | VERIFIED REAL | Low | Low | needs a trusted edit to a protected workflow | `tests/watchdog.test.mjs` "reverify.yml still has the step name and the annotation title the watchdog reads", ran, passes on both (a guard against drift) |
| L3 the shallow-clone probe runs outside the read wrapper, so a git failure stops every check | ops-scripts | VERIFIED REAL | Low | Low | fails loudly; Actions always has a git checkout | `tests/watchdog.test.mjs` "gitStaleSince outside a git checkout fails on its first call, inside the read that reports it", ran (the reviewer's form fails on e484c80), passes after #230 |
| L4 a re-verify branch whose PR merged is reported as "unmerged" | ops-scripts | VERIFIED REAL | Low | Low | rare: GitHub deletes merged branches | `tests/watchdog.test.mjs` "re-verify branches: one over 36 hours old, one whose PRs were all closed without merging, or one that outlived its merged PR", ran, fails as expected, passes after #230 |
| L5 a dry run prints model names to the log without D62's cleaning | ops-scripts | VERIFIED REAL | Low | Low | needs a hostile model name merged, a Sunday dry run, and that record sampled | `tests/watchdog.test.mjs` "the log's copy of the summary holds no workflow command from a model name", ran (the reviewer's form fails on e484c80), passes after #230 |
| L6 spot-check links highlight only the first quote, so "at least" and other regions are never shown | ops-scripts | VERIFIED REAL | Low | Low | rules R1 to R8 check those fields; this is the owner's second look | `tests/audit/open-findings.test.mjs` "ops-scripts L6: a record's at-least quote on its second item is linked too", ran, fails as expected (open) |
| C1 the watchdog reports all clear after a failed read | ops-scripts | FALSE POSITIVE | - | - | lens: claim correctness | see the refused section |
| C2 text from an outsider or a maker reaches the watchdog issue or the #27 summary | ops-scripts | FALSE POSITIVE | - | - | lens: existing mitigation | see the refused section |
| C3 `check-licences.mjs` or `renewals.mjs` miscounts | ops-scripts | FALSE POSITIVE | - | - | lens: claim correctness | see the refused section |

## Confirmed defects
- **L1, `scripts/watchdog.mjs:120`, monitoring.** Only re-verify and Pages had a run-age check, and a 404 on a crawl workflow was treated as "not added yet". Fix (#230):
  - a "Data refresh" read and line when no `data-refresh.yml` run has succeeded for 8 days;
  - a missing crawl workflow is now a failed read;
  - OPERATIONS lists the new line.
- **L2, `scripts/watchdog.mjs:29`, monitoring.** Fix (#230): `PUSH_STEP` and `UNCHECKED_TITLE` are exported, a test reads `reverify.yml` for both, and the comment says which rename does what.
- **L3, `scripts/watchdog.mjs:63`, monitoring.** Fix (#230): the probe runs on the first call, inside the Data health read.
- **L4, `scripts/watchdog.mjs:215`, monitoring.** Fix (#230): a branch whose PR merged is named as such, and the owner is told to delete it. OPERATIONS lists the line.
- **L5, `scripts/watchdog.mjs:459`, log injection.** Fix (#230): the dry run prints the summary through `forLog`, which is D62's `sed` in JavaScript. The posted comment keeps the text.
- **L6, `scripts/audit-sample.mjs:62`, review support: open.** `record.evidence.find((item) => item.quote)` links one quote. For 240 `at_least` records the "at least" sentence is a later item, so the owner's link never highlights it.

## Refused or unconfirmed candidates
- C1, all clear after a failed read: refused, lens claim correctness. Every API error, timeout or empty answer becomes a reported problem, so the issue never closes on a failed read.
- C2, outside text in the issue or the summary: refused, lens existing mitigation. Only the App's own data, record fields and fixed text reach them, and `markdown()` escapes record fields.
- C3, licence check and renewals: refused, lens claim correctness. Every case the brief asked about is correct.
- RUNBOOKS O5 telling the owner to read "the newest comment on #27", which anyone can post: needs deeper review. Whether to say "the newest comment by `patchlife-bot[bot]`" or to lock #27 is the owner's choice. Decision pending.
- After `refresh_open_pr`, the body lists only that run's records: out of zone, `workflows` L4, answered in #224.
- GitHub returning a short page before the last one, which would cut the shared paging: needs deeper review. It can't be checked offline.

## Coverage
- Read in full: the four scripts, their tests, and the housekeeping workflow.
- Lenses: exploitability, claim correctness and existing mitigation; missed and false alarms in particular.

Code quality, from the reviewer: five notes. The out-of-date 404 comment and the rename comment are fixed in #230. The rest are left.

## Hand-off
- L6: link every quoted item, with one text directive per quote joined by `&` (`#:~:text=A&text=B`) and one link per page. Apply it in `scripts/audit-sample.mjs` and in the watchdog's summary. `highlightLink` already percent-encodes `&` inside a quote. `tests/audit/open-findings.test.mjs` is the reproduction.
- RUNBOOKS O5: name the bot's comment on #27, or lock the issue. Decision pending.
