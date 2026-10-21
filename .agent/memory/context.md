# Context (current state)

- 2026-10-21: Repo created from the starter kit. Nothing deployed.
- M0 done. M1 active: the evidence engine (status, polite fetcher, verifier CLI with the redirect check and `--due`/`--limit`, quote-date check, source registry, data report) is merged. Every `Default` task in TASKS.md is done; M1 waits on a fourth brand. M2 is built: the generator (#34) and the Pages workflow (#47) are merged, and the preview is live at https://sombreserotonin.github.io/Patchlife/ with noindex; its exit checks pass, and it closes after M1. The plan is `docs/PLAN.md`; the procedures are `docs/RUNBOOKS.md`.
- Data on `main`: 122 verified records from three brands, all audited: Ring 50 (#24, region-date records and regions from #43 to #45), Google Nest 12 (#21, 6 with Australian evidence from #36), TP-Link Tapo 60 (#22). Arlo can't be used (robots.txt and a bot challenge, D18). The fourth brand is EZVIZ (hosts added, #23; records in progress). GL.iNet routers (24 records, #49) await an audit.
- Decisions P1 to P8 settled 21 Oct (#30; D27 to D34). Waiting on the owner: the settings in G1 and G3 (TASKS.md) and the H9a legal read of the draft wording on the preview. The prompt fixes are merged (#29, 21 Oct).
- Labels: `audited` marks a data PR that passed RUNBOOKS A8. Heartbeat issue #27 gets one comment per daily build run (from 22 Oct, #29). The daily build merges a data PR only with `audited` or when it changes only `verification:` fields.
- Repo is public. Ruleset `main` is active: pull request required (0 approvals), `test` check required, force pushes and deletion blocked, no bypass actors. Agents merge only PRs whose head branch is in this repo.
- Domain `patchlife.tech` bought by the owner (#2); no trade mark clashes reported. No DNS or hosting yet (M2).
- Claude GitHub App installed (#3). `@claude` workflow not planned (#6): `claude.yml` stays but has no secret.
- Scheduled task `Patchlife daily build` runs daily at 06:08 Australia/Sydney (19:08 UTC the day before) in `Default` (#5). `Patchlife nightly data` runs at 01:17 Sydney in `Crawl` with no connectors (#41, D27); its first run opened #49.
- Cloud environments: `Default` (Trusted network; cannot reach manufacturer sites by any route) and `Crawl` (Custom allowlist, #9). All data work runs in `Crawl` (D17).
- Crawler contact URL: `https://github.com/sombreserotonin/Patchlife/blob/main/docs/CRAWLER.md` (#10).
- Usage credits are off (#7). When usage runs out, scheduled runs are rejected until the usage window resets.
- `gh api` works for `repos/sombreserotonin/Patchlife/...` paths only; repo settings writes and branch deletions are blocked from cloud sessions.
- Licences: code AGPL-3.0-or-later, data ODbL-1.0.
- Draft PRs: the REST API cannot mark a draft ready. The GitHub MCP tool `update_pull_request` with `draft: false` can, so the coordinating session marks an audited data PR ready before merging it.
- Scheduled tasks: an agent can create one with the session tools, but it gets no repository and no connectors, so its runs have no checkout. The owner creates scheduled tasks in the claude.ai routines UI (nightly data task: #41).
