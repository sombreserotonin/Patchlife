# 2026-10-22 Plan to run without AI or subscriptions (D44)

- Owner ask: a detailed plan to stop using AI systems and not rely on subscriptions. Plan: `docs/MIGRATION.md`; it supersedes COSTS stages 3 and 4 and "Getting to Pro" (D37).
- Stages: 0 decide (owner answers open decisions 1 to 5), 1 build with the remaining Max time (Tiers A housekeeping, B data without AI, C cut-down features), 2 shadow fortnight with the routines paused, 3 retire and cancel by 30 Nov, 4 watch the December re-verify wave.
- Key choices: a private GitHub App for the bot (tokens from `GITHUB_TOKEN` don't trigger CI); the bot merges only re-verify and measures PRs; a required `data-gate` check enforces A9; parsers must reproduce every audited record before they may propose new ones.
- Facts checked here: #98 merged 02:07 UTC; no scheduled workflow has run in this repo yet; heartbeat #27 has no comments; B1's data fixes are real (2 aliases, 98 Ring `at_least`, 15 non-US Ring conditions).
- Pending: the critique pass of workflow wd6jfrbfo (feasibility, external facts, completeness). Apply valid fixes in a follow-up PR.
- Workflow agents run two at a time in this container (4 CPUs), so plan for about 5 minutes per agent pair.
