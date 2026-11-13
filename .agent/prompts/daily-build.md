# Scheduled task: daily build (retired)

This scheduled task was retired on 13 November 2026 (docs/MIGRATION.md, Stage 3). Patchlife runs on GitHub Actions with no AI session: the nightly `Housekeeping` workflow merges the routine pull requests and runs the watchdog (docs/OPERATIONS.md).

Do nothing. A run of this task can't switch the task off: it has no tool for that, as the run of 13 November found. Only the owner can, at https://claude.ai/code/routines, and docs/OPERATIONS.md already says so.

End the run at once with the line `RETIRED: nothing done`. Read no other file, run no command, send no notification, and make no commit, branch, pull request, issue or comment.
