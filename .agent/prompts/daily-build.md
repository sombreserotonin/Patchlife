# Scheduled task: daily build (retired)

This scheduled task was retired on 13 November 2026 (docs/MIGRATION.md, Stage 3). Patchlife runs on GitHub Actions with no AI session: the nightly `Housekeeping` workflow merges the routine pull requests and runs the watchdog (docs/OPERATIONS.md).

Do exactly this, and nothing else:
1. Disable the scheduled task that started this session: call the `update_trigger` tool with this task's trigger id and `enabled: false`. The id is in the message that fired this run; `list_triggers` also shows it under the name `Patchlife daily build`.
2. End the run with the line `RETIRED: task disabled`.

Make no commit, branch, pull request, issue or comment, and run no command in the repository.
