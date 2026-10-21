# Architecture

## Decided
- Node LTS, plain ESM JavaScript, `node:test`. No build step for tooling.
- Data lives as YAML files in git. The repo is the database and the audit trail.
- Static-first: the site and free feed are static files on a CDN. Servers only for paid features (M6).

## To decide (record in decisions.md when chosen; check current docs and versions first)
- Static site generator (M2). Suggested: Astro, for static output from content files.
- Hosting (M2). Suggested: Cloudflare Pages, deployed from GitHub Actions.
- Extension tooling (M5).

## Automation loops
| Loop | Runs in | Trigger | Output |
| --- | --- | --- | --- |
| Roadmap work | Claude Code cloud session, `build` environment | KICKOFF.md once, then the daily build scheduled task (`.agent/prompts/daily-build.md`) | One task per run; PR merged when green |
| Data refresh | Scheduled task, `crawl` environment | Nightly from M3 (`.agent/prompts/data-refresh.md`) | Data PR, or nothing when no change |
| Repair | Start of every scheduled run | Failing agent PRs | At most one fix per run |
| Issue fixes (optional) | GitHub Actions `claude.yml` | `@claude` mention or `claude` label from someone with write access | PR |
| CI | GitHub Actions `ci.yml` | Every PR and push to `main` | Tests; `needs-human-merge` label on protected paths |

Scheduled tasks are created at claude.ai/code/routines and run on the owner's Claude subscription usage. They are in research preview, so check the docs if behaviour changes.

## Cloud environments (a human sets these up)
- `build`: the Default environment (Trusted network: package registries, GitHub and common development domains). For coding.
- `crawl`: Custom network access, including the defaults, plus: ring.com, kb.arlo.com, www.arlo.com, www.tp-link.com, static.tp-link.com, www.gl-inet.com, www.kyoceradocumentsolutions.co.uk, www.asus.com, gopro.com, support.google.com, www.lenovo.com, en-gb.support.motorola.com, kb.netgear.com, news.samsung.com, web.archive.org. New hosts are added through a `needs-human` issue. Blocked requests fail with 403 `host_not_allowed`.

## Security model
- Main threat: prompt injection from crawled pages, PDFs and issue text steering an agent that can write to the repo.
- Controls: the untrusted-data rule in CLAUDE.md; the crawl network allowlist; protected paths labelled by CI and merged only by a human; `claude.yml` runs only for users with write access (the action's default); least-privilege `permissions` in every workflow; no secrets in the repo; deny rules in `.claude/settings.json`.
- Known gap: cloud sessions and scheduled tasks act with the owner's GitHub identity, so GitHub cannot tell the agent from the owner. The protected-path rule is enforced by CI labelling and CLAUDE.md, not by GitHub permissions. Hard boundary for later: give the agent its own GitHub account with write but not admin access, and require the owner's code-owner review on protected paths.

## Cost
Cloud sessions and scheduled tasks draw on the owner's subscription usage. `claude.yml` needs a `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` Actions secret. Scheduled prompts cap work per run (one task, or 15 sources).
