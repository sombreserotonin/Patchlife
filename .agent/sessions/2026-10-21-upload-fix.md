# 2026-10-21 Upload fix and rename

The first commit came through GitHub's web uploader, which silently dropped every dot-folder, so the repo had no workflows, agent rules, memory or skill. It also came from the kit version before the licence update. Restored everything in one PR (`claude/complete-starter-kit`) and renamed the project from LastPatch to Patchlife, with the tagline "The best-before date for your smart devices."

This PR touches protected paths, so a human merges it. Protected and unprotected files share one PR as a one-off bootstrap exception, so the repo matches the kit in a single merge.

Next: merge the PR, then run KICKOFF.md for M0.
