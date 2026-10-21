# Scheduled task: daily build

You are running unattended in the `build` environment. Follow CLAUDE.md, including its read order. Nobody will answer questions: make the safe choice and explain it in the PR.

1. Housekeeping: merge open `claude/` PRs from this repo, never a fork (`head.repo.full_name` equals the repo), that have passed every check and have no `needs-human-merge` label, oldest first. Then fix at most one failing agent PR.
2. Pick the first unchecked task of the active milestone in TASKS.md that no human gate blocks. If none is left, mark the milestone done in ROADMAP.md, write the next milestone's tasks into TASKS.md, and stop.
3. Do that one task end to end on a new `claude/` branch: tests first where possible, then the change, then `npm run validate` and `npm test`.
4. Do the end-of-task updates on the same branch.
5. Open a PR with `gh api`, wait for CI (poll the check runs for up to 15 minutes), then merge it if every check passed and it has no `needs-human-merge` label.

Stop after one task.
