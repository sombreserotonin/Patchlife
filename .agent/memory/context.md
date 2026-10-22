# Context (current state)

- 2026-10-21: Repo created from the starter kit. Nothing deployed.
- M0, M1 and M2 done (21 Oct 2026; #54). M3 (unattended data) is active; its tasks are in TASKS.md. The site is live at https://patchlife.tech from the root, indexed, with a sitemap (#67), behind Cloudflare's proxy with Cloudflare Web Analytics (#68, D41).md`; the procedures are `docs/RUNBOOKS.md`; the cost pivot is `docs/COSTS.md`.
- Data on `main`: 340 records from five brands, all audited: EZVIZ 193 (#51), TP-Link Tapo 60 (#22), Ring 50 (#24, #43 to #45), GL.iNet 25 (#49, Velica #61), Google Nest 12 (#21, #36). 309 are cameras or doorbells. Arlo can't be used (D18).
- Decisions P1 to P8 settled 21 Oct (#30; D27 to D34). H9a approved (#52, 21 Oct). Privacy page live (#69): no cookies, search in the browser, GitHub Pages and Cloudflare disclosed (#60, #68 option C), contacts admin@sombrexo.com and GitHub issues. Agents can dispatch workflows and re-run jobs with `gh api` (probe dispatched 21 Oct). G1 and G3 done 21 Oct. The prompt fixes are merged (#29, 21 Oct).
- Labels: `audited` marks a data PR that passed RUNBOOKS A8. Heartbeat issue #27 gets one comment per daily build run (from 22 Oct, #29). The daily build merges a data PR only with `audited` or when it changes only `verification:` fields.
- Repo is public. Ruleset `main` is active: pull request required (0 approvals), `test` check required, force pushes and deletion blocked, no bypass actors. Agents merge only PRs whose head branch is in this repo.
- Search Console Domain property verified and sitemap submitted (H7, #77, 22 Oct; a Domain property needs the full sitemap URL). Domain `patchlife.tech` bought by the owner (#2); no trade mark clashes reported. DNS is at Cloudflare, proxied, with Web Analytics injected automatically; the owner keeps both (#68, D41). A plain visit gets no cookie (securityheaders.com raw headers, 21 Oct).
- Claude GitHub App installed (#3). `@claude` workflow not planned (#6): `claude.yml` stays but has no secret.
- Scheduled task `Patchlife daily build` runs daily at 06:08 Australia/Sydney (19:08 UTC the day before) in `Default` (#5). `Patchlife nightly data` runs at 01:17 Sydney in `Crawl` with no connectors (#41, D27); its first run opened #49.
- Cloud environments: `Default` (Trusted network; cannot reach manufacturer sites by any route) and `Crawl` (Custom allowlist, #9). All data work runs in `Crawl` (D17). Routine re-verification runs on GitHub Actions (`Re-verify evidence`, #80, D42) nightly at 12:41 UTC; first manual run 39702142924 passed on 22 Oct. Every evidence host answered a runner on 21 Oct (Probe hosts run 39695382968). Default `run` steps use `bash -e` without pipefail, so read exit codes with `PIPESTATUS`.
- Crawler contact URL: `https://github.com/sombreserotonin/Patchlife/blob/main/docs/CRAWLER.md` (#10).
- Usage credits are off (#7). When usage runs out, scheduled runs are rejected until the usage window resets.
- `gh api` works for `repos/sombreserotonin/Patchlife/...` paths only; repo settings writes and branch deletions are blocked from cloud sessions.
- Licences: code AGPL-3.0-or-later, data ODbL-1.0.
- Draft PRs: the REST API cannot mark a draft ready. The GitHub MCP tool `update_pull_request` with `draft: false` can, so the coordinating session marks an audited data PR ready before merging it.
- Owner's machine for local models: Windows, 64 GB DDR4, RX 9070 XT (21 Oct 2026); Vulkan backend, Task Scheduler (docs/COSTS.md).
- Sessions created with the session tools inherit the owner's Firecrawl connector; data and audit sessions may use it to search for URLs (D35), never as the source of a quote or category (D17).
- Scheduled tasks: an agent can create one with the session tools, but it gets no repository and no connectors, so its runs have no checkout. The owner creates scheduled tasks in the claude.ai routines UI (nightly data task: #41).
