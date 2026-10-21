# Architecture

## Decided
- Node LTS, plain ESM JavaScript, `node:test`. No build step for tooling.
- Data lives as YAML files in git. The repo is the database and the audit trail.
- Static-first: the site and free feed are static files on a CDN. Servers only for paid features (M6).

## To decide (record in decisions.md when chosen; check current docs and versions first)
- Static site generator and hosting (M2). Proposed in `docs/PLAN.md` (decision P2): a plain Node ESM build script (`scripts/build-site.mjs`, no new dependency) and GitHub Pages deployed from Actions (no account, token or secret), with a hand-written search over a JSON index and Lighthouse for the exit checks. Astro and Eleventy were checked on 21 Oct 2026 and rejected as more than the build needs (260 and 114 packages, against none for the build script). The `lighthouse` dev dependency for the exit checks adds 114 packages of its own, used only in CI.
- Extension tooling (M5).

## Automation loops
| Loop | Runs in | Trigger | Output |
| --- | --- | --- | --- |
| Roadmap work | Daily build scheduled task, `Default` environment | 06:08 Sydney daily (`.agent/prompts/daily-build.md`) | One code, test or docs task per run; green agent PRs merged |
| Data work | Cloud sessions in the `Crawl` environment | Started by the owner or a coordinating session (RUNBOOKS O1); a nightly scheduled task once decision P1 is made (`.agent/prompts/data-refresh.md`) | One source per data PR, audited before merge (RUNBOOKS A8) |
| Repair | Start of every scheduled run | Failing agent PRs | At most one fix per run |
| Issue fixes (optional, not enabled) | GitHub Actions `claude.yml` | `@claude` mention or `claude` label from someone with write access; it has no secret (#6), so a trigger fails | PR |
| CI | GitHub Actions `ci.yml` | Every PR and push to `main` | Tests; `needs-human-merge` label on protected paths |

Scheduled tasks are created at claude.ai/code/routines and run on the owner's Claude subscription usage. They are in research preview, so check the docs if behaviour changes.

## Cloud environments (a human sets these up)
- `Default`: Trusted network (package registries, GitHub and common development domains). For code, tests and docs. Its network cannot reach manufacturer sites: the shell, Node's fetch and Claude Code's fetch tool all fail. Connectors that can (such as Firecrawl) must not be used for manufacturer pages (D17).
- `Crawl`: Custom network access, including the defaults, plus: ring.com, kb.arlo.com, www.arlo.com, www.tp-link.com, static.tp-link.com, www.gl-inet.com, www.kyoceradocumentsolutions.co.uk, www.asus.com, gopro.com, support.google.com, www.lenovo.com, en-gb.support.motorola.com, kb.netgear.com, news.samsung.com, web.archive.org. This is the list requested in #9; the agent cannot read the live list. EZVIZ hosts (support.ezviz.com, www.ezviz.com) are requested in #23. New hosts are added through a `needs-human` issue (RUNBOOKS O3). A blocked host shows up as `robots.txt unreachable (...)` from the verifier, `getaddrinfo ENOTFOUND` from the fetch tool, or `CONNECT tunnel failed, response 403` from curl.

## Security model
- Main threat: prompt injection from crawled pages, PDFs and issue text steering an agent that can write to the repo.
- Controls: the untrusted-data rule in CLAUDE.md; the `Crawl` network allowlist; agents merge only PRs whose head branch is in this repo, never a fork (CLAUDE.md); every data PR is audited against its source before merge (RUNBOOKS A8); protected paths labelled by CI and merged only by a human; `claude.yml` runs only for users with write access (the action's default); least-privilege `permissions` in every workflow; no secrets in the repo; deny rules in `.claude/settings.json`.
- Known gap: cloud sessions and scheduled tasks act with the owner's GitHub identity, so GitHub cannot tell the agent from the owner. The protected-path rule is enforced by CI labelling and CLAUDE.md, not by GitHub permissions. Hard boundary for later: give the agent its own GitHub account with write but not admin access, and require the owner's code-owner review on protected paths.

## Cost
Cloud sessions and scheduled tasks draw on the owner's subscription usage. `claude.yml` needs a `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` Actions secret. Scheduled prompts cap work per run (one task, or 15 sources).
