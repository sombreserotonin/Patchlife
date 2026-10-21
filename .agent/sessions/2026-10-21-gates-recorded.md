# 2026-10-21 Gate outcomes recorded

The owner worked through every open `needs-human` issue. Checked each one against the live state rather than the closure: public repo, active ruleset, scheduled task config and first run, `Crawl` environment. Recorded the outcomes in TASKS.md and context.md and wrote `docs/CRAWLER.md`, the contact page chosen in #10.

Open points: #7 closed without a usage-credits decision; #2 reported the domain but no trade mark result.

Found while checking: now the repo is public, a fork PR can use a `claude/` branch name. The fork's PR gets no `needs-human-merge` label (the CI job skips forks) and the daily build prompt merges any open `claude/` PR that passes its checks. Fix is in a separate protected PR.

Next: the verifier remainder (fetch with the contact URL, PDF, archive, CLI), built offline in Default and run for real in `Crawl`.
