# Context (current state)

- 2026-10-21: Repo created from the starter kit. Nothing deployed.
- M0 done. M1 active: the evidence engine (status, polite fetcher, verifier CLI, quote-date check, source registry) is merged. The plan is `docs/PLAN.md`; the procedures are `docs/RUNBOOKS.md`.
- Data on `main`: 120 verified records from three brands, all audited: Ring 48 (#24), Google Nest 12 (#21), TP-Link Tapo 60 (#22). Arlo can't be used (robots.txt and a bot challenge, D18). The fourth brand is EZVIZ, waiting on its allowlist hosts (#23).
- Waiting on the owner: decisions P1 to P4 this week (P5 to P8 later; docs/PLAN.md), #23, the settings in G1 and G3 (TASKS.md), the prompt-fix PR, and starting `Crawl` sessions (RUNBOOKS O1).
- Labels: `audited` marks a data PR that passed RUNBOOKS A8. Heartbeat issue #27 gets one comment per daily build run once the prompt fix is merged.
- Repo is public. Ruleset `main` is active: pull request required (0 approvals), `test` check required, force pushes and deletion blocked, no bypass actors. Agents merge only PRs whose head branch is in this repo.
- Domain `patchlife.tech` bought by the owner (#2); no trade mark clashes reported. No DNS or hosting yet (M2).
- Claude GitHub App installed (#3). `@claude` workflow not planned (#6): `claude.yml` stays but has no secret.
- Scheduled task `Patchlife daily build` runs daily at 06:08 Australia/Sydney (19:08 UTC the day before) in `Default` (#5).
- Cloud environments: `Default` (Trusted network; cannot reach manufacturer sites by any route) and `Crawl` (Custom allowlist, #9). All data work runs in `Crawl` (D17).
- Crawler contact URL: `https://github.com/sombreserotonin/Patchlife/blob/main/docs/CRAWLER.md` (#10).
- Usage credits are off (#7). When usage runs out, scheduled runs are rejected until the usage window resets.
- `gh api` works for `repos/sombreserotonin/Patchlife/...` paths only; repo settings writes and branch deletions are blocked from cloud sessions.
- Licences: code AGPL-3.0-or-later, data ODbL-1.0.
