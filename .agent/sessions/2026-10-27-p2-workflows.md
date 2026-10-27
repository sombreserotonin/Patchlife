# 2026-10-27 Stage 0 answered, the App created, P2 opened

- The owner answered #102 (D46, #127): create the App, don't renew Max, accept the scope cuts, decision 5 left to me (took the recommendation). Walked them through the App in #126; they created `patchlife-bot` within half an hour.
- P2 (#128, protected): `housekeeping.yml`, `data-gate.yml`, the App token in `reverify.yml` with `due` and `limit` inputs and a warning for unchecked records, `queue: max` on the `crawl` group, Lighthouse in a PR-only job, the licence check in CI, plus the daily-build and data-refresh prompts, CLAUDE.md commands and RUNBOOKS A9.
- Design points worth keeping: the gate restores `scripts/` from `HEAD^1` on the PR's merge commit, so the PR can't change the script that judges it; a skipped job would count as not passed by the merge bot (it takes the latest run's conclusion), so `data-gate` runs on every label event rather than filtering with `if:`; the `audited` check reads the issue events and takes the last `labeled` or `unlabeled` for that label.
- Owner steps after merging are in #128: a dry-run Housekeeping, a `due=0 limit=5` re-verify that opens the test PR as the App, `data-gate` into ruleset 25530330 once it has reported, `BOT_MERGE=on` and a real Housekeeping run, and Actions failure emails.
- Expect the watchdog to go red on 29 Oct over #102 (`needs-human` for 7 days), then #117 and #123: the alarm working.
- Verified: see LOG. Inefficient: the first gate simulation changed no data because `end_date` is nested under `support:`.
