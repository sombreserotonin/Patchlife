# Architecture

## Decided
- Node LTS, plain ESM JavaScript, `node:test`. No build step for tooling.
- Data lives as YAML files in git. The repo is the database and the audit trail.
- Static-first: the site and free feed are static files on a CDN. Servers only for paid features (M6).

## To decide (record in decisions.md when chosen; check current docs and versions first)
- Static site generator and hosting (M2). Decided 21 Oct 2026 (P2, D28): a plain Node ESM build script (`scripts/build-site.mjs`, no new dependency) and GitHub Pages deployed from Actions (no account, token or secret), with a hand-written search over a JSON index and Lighthouse for the exit checks. Paid services (M6) are hosted off Pages, on the owner's Unraid server behind the owner's Pangolin VPS (D40). Astro and Eleventy were checked on 21 Oct 2026 and rejected as more than the build needs (260 and 114 packages, against none for the build script). The `lighthouse` dev dependency for the exit checks adds 114 packages of its own, used only in CI.
- Extension tooling (M5). Settled 27 Oct 2026 (D46): no extension; M5 is `?q=` search links in `site/search.js` (#132).

## Automation loops
Everything routine runs on GitHub Actions with no model (D42, D44; the plan is [`MIGRATION.md`](MIGRATION.md), the owner's guide [`OPERATIONS.md`](OPERATIONS.md)). The Claude scheduled tasks and sessions run only until MIGRATION Stage 2 (5 Nov 2026) and are deleted at Stage 3.

| Loop | Runs in | Trigger | Output |
| --- | --- | --- | --- |
| Re-verification | `reverify.yml`, a GitHub runner, no model (D42) | Daily at 12:41 UTC, or **Run workflow** with `due` and `limit` | Up to 1000 due records re-checked and up to 5 cited pages archived (D43); a `claude/reverify-*` PR opened as `patchlife-bot` when a record changed |
| Housekeeping | `housekeeping.yml`, as `patchlife-bot` | Daily at 21:23 UTC | The merge bot (`scripts/merge-bot.mjs`, while `BOT_MERGE` is `on`), the watchdog (`scripts/watchdog.mjs`, one `watchdog` issue; a red run is the alarm), the Sunday summary on #27, the monthly measures PR |
| Site | `pages.yml` | Every merge to `main`, daily at 00:17 UTC, and the watchdog when the last deploy is over 36 hours old | https://patchlife.tech rebuilt with today's statuses (D7); on a PR, `build` and `lighthouse` only |
| Data gate | `data-gate.yml` | Every pull request event | `data-gate` passes for verification-only changes (RUNBOOKS A9) or with the owner's `audited` label, which every push removes |
| CI | `ci.yml` | Every PR and push to `main` | Licence check, `npm run validate`, `npm test`; the `needs-human-merge` label on protected paths |
| Owner tools (P3, #140) | `owner-tools.yml` | **Run workflow** | `read-page`, `check-source`, `verify` (a bot PR), `repoint` and `withdraw` (PRs for the owner) |
| Weekly data refresh (P3, not built yet) | `data-refresh.yml` | Sundays at 16:17 UTC while `DATA_REFRESH` is `on` | One candidate PR of at most 60 rows on `claude/data-auto-*`, from the parsers and the source profiles (B2 to B4), for the owner to review (RUNBOOKS O9) |
| Until Stage 2: roadmap work | The `Patchlife daily build` scheduled task, `Default` environment | 06:08 Sydney daily (`.agent/prompts/daily-build.md`) | One task per run; green `claude/` PRs merged |
| Until Stage 2: data work | `Crawl` sessions and the `Patchlife nightly data` task (`.agent/prompts/data-refresh.md`) | 01:17 Sydney daily; the owner or a coordinating session (RUNBOOKS O1) | One source per data PR, audited before merge (RUNBOOKS A8); re-checks of records the runner could not fetch |
| Issue fixes (never enabled) | `claude.yml` | A `claude` mention or label from someone with write access; it has no secret (#6), so a trigger fails | Nothing; deleted at Stage 3 (P4) |

Scheduled tasks are created at claude.ai/code/routines and run on the owner's Claude subscription, which ends on 19 Nov 2026 (D46).

## Cloud environments (a human sets these up; until Stage 3)
- `Default`: Trusted network (package registries, GitHub and common development domains). For code, tests and docs. Its network cannot reach manufacturer sites: the shell, Node's fetch and Claude Code's fetch tool all fail. Connectors that can (such as Firecrawl) must not be used for manufacturer pages (D17).
- `Crawl`: Custom network access, including the defaults, plus: ring.com, kb.arlo.com, www.arlo.com, www.tp-link.com, static.tp-link.com, www.gl-inet.com, www.kyoceradocumentsolutions.co.uk, www.asus.com, gopro.com, support.google.com, www.lenovo.com, en-gb.support.motorola.com, kb.netgear.com, news.samsung.com, web.archive.org. This is the list requested in #9; the agent cannot read the live list. On 22 Oct 2026 the proxy refused archive.org and dropped web.archive.org, so archive links are made on GitHub's runners instead (D43). EZVIZ hosts (support.ezviz.com, www.ezviz.com) are requested in #23. New hosts are added through a `needs-human` issue (RUNBOOKS O3). A blocked host shows up as `robots.txt unreachable (...)` from the verifier, `getaddrinfo ENOTFOUND` from the fetch tool, or `CONNECT tunnel failed, response 403` from curl.
- After cut-over there is no allowlist: GitHub's runners and the owner's own machine reach any host, and a page they can't fetch is the maker's own bot wall (D18). Every page-reading script runs there without `--use-env-proxy` (RUNBOOKS, "Where work can run").

## Security model
- Main threats: until cut-over, prompt injection from crawled pages, PDFs and issue text steering an agent that can write to the repo; after it, a parser or a re-verification writing a wrong row, and anyone with write access pushing to a bot branch.
- Controls on the data: every record's quote is checked against its page by the verifier (nightly, D42); the source profiles in `data/sources/seed.yaml` and rules R1 to R8 in `scripts/validate-data.mjs` (B2) check the judgement fields the audits used to catch (aliases, regions, `at_least`, conditions, footnotes, hardware versions, categories, cut-short YAML values); the parser gate stops a run whose candidates don't reproduce the audited records (MIGRATION, "The parser gate"); `data-gate` lets a PR merge only when it changes nothing but verification (RUNBOOKS A9) or carries the owner's own `audited` label, which every push removes.
- Controls on who writes: the merge bot merges only PRs that `patchlife-bot` opened from `claude/reverify-*` or `claude/measures-*` in this repository, with `test`, `data-gate` and `build` green on the exact commit, and only while `BOT_MERGE` is `on` (MIGRATION decision 2); the App has no Workflows permission, so no bot can change a workflow; protected paths are labelled by CI and merged only by the owner; workflow inputs reach shells through `env`, never inline; least-privilege `permissions` in every workflow; the only secret is the App's private key, rotated yearly (RUNBOOKS O12); agents merge only PRs whose head branch is in this repo, never a fork (CLAUDE.md), and follow the untrusted-data rule; the `Crawl` allowlist until Stage 3; deny rules in `.claude/settings.json`.
- Known gaps: until Stage 3, sessions act with the owner's GitHub identity, so GitHub cannot tell the agent from the owner, and the protected-path rule is enforced by CI labelling and CLAUDE.md rather than permissions. After cut-over the only writers are the App and the owner. A branch ruleset letting only the App push to its branches is still to be created (MIGRATION, "Your actions in Stage 1", item 4).

## Cost
Until Stage 3, cloud sessions and scheduled tasks draw on the owner's subscription, and scheduled prompts cap work per run: one task for the daily build, one source for the nightly data task (D27). After cut-over nothing is subscribed: GitHub Actions and Pages on a public repository, Cloudflare's free plan and the domain (MIGRATION, "Summary"). `claude.yml` would need a `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` secret, has none, and is deleted at Stage 3. The earlier staged plan in `docs/COSTS.md` is superseded by `MIGRATION.md` (D44).
