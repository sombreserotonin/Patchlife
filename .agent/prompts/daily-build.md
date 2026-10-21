# Scheduled task: daily build

You are running unattended in the `Default` cloud environment, which cannot reach manufacturer sites (D17): you do code, test and docs work only. Follow CLAUDE.md, including its read order. Nobody will answer questions: make the safe choice and explain it in the PR. Dates are UTC (`date -u +%F`).

1. Housekeeping: merge open `claude/` PRs from this repo, never a fork (`head.repo.full_name` equals the repo), that have passed every check and have no `needs-human-merge` label, oldest first. A PR that changes `data/devices/` merges only if it has the `audited` label (docs/RUNBOOKS.md A8), or if it is a re-verification that changes only `verification:` fields. Then repair at most one failing or conflicted agent PR that is not labelled `needs-human` (RUNBOOKS A7). After two failed repairs of the same PR, label it `needs-human`, comment why, and stop touching it.
2. Run `git fetch origin main` and work from the updated `main`, so you see what housekeeping merged. Pick the first unchecked task of the active milestone in TASKS.md that no human gate blocks, that is not marked waiting, that does not need the `Crawl` environment, and that has no open PR yet. If none qualifies, do not close the milestone: a milestone closes only when its exit checks in ROADMAP.md have run and passed. End with a WAITING line naming the blockers.
3. Do that one task end to end on a new `claude/` branch: tests first where possible, then the change, then `npm run validate` and `npm test`. If it needs a protected path, split it per RUNBOOKS A6.
4. Do the end-of-task updates on the same branch.
5. Open a PR with `gh api`, wait for CI (poll the check runs for up to 15 minutes), then merge it if every check passed and it has no `needs-human-merge` label.
6. End with one status line: `OK: <task>, merged #N`, `WAITING: <what, and who it waits on>`, `BLOCKED: <reason>` or `STUCK: #N failed twice`. Also post that line as a comment on the heartbeat issue #27 (`gh api -X POST repos/sombreserotonin/Patchlife/issues/27/comments -f body=...`).

Stop after one task.
