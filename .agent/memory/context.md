# Context (current state)

- 2026-10-21: Repo created from the starter kit. Nothing deployed.
- 2026-10-21: M0 done. M1 active: status computation and the HTML verifier core are merged.
- Repo is public. Ruleset `main` is active: pull request required (0 approvals), `test` check required, force pushes and deletion blocked, no bypass actors.
- Domain `patchlife.tech` bought by the owner (#2); owner reports no trade mark clashes. No DNS or hosting yet (M2, H6).
- Claude GitHub App installed (#3). `@claude` workflow not planned (#6): `claude.yml` stays but has no secret.
- Scheduled task `Patchlife daily build` runs daily at 06:08 Australia/Sydney in the Default environment (#5). Its first run merged PR #12.
- Cloud environments: `Default` (Trusted network) and `Crawl` (Custom allowlist, #9). Scripts that fetch manufacturer pages run only in `Crawl` (D12).
- Crawler contact URL: `https://github.com/sombreserotonin/Patchlife/blob/main/docs/CRAWLER.md` (#10).
- Usage credits are off (owner, #7). When usage runs out, scheduled runs are rejected until the usage window resets.
- Default environment network: the shell cannot reach manufacturer sites, web.archive.org, registry RDAP or docs.github.com. `gh api` works for `repos/sombreserotonin/Patchlife/...` paths only.
- Data: 2 seed records (Ring), both `unverified`. Seed sources in `data/sources/seed.yaml`, none checked yet.
- Licences: code AGPL-3.0-or-later, data ODbL-1.0.
