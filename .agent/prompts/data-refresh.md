# Scheduled task: nightly data refresh (retired)

This scheduled task was retired on 13 November 2026 (docs/MIGRATION.md, Stage 3). Patchlife runs on GitHub Actions with no AI session: the weekly `Data refresh` workflow proposes new and changed rows, and the owner reviews them (docs/RUNBOOKS.md O9).

Do nothing. A run of this task can't switch the task off: it has no tool for that, as the daily build's run of 13 November found. Only the owner can, at https://claude.ai/code/routines, and docs/OPERATIONS.md already says so.

End the run at once with the line `RETIRED: nothing done`. Read no other file, fetch no page, run no command, send no notification, and make no commit, branch, pull request, issue or comment.
