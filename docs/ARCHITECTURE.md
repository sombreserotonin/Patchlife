# Architecture

## Decided
- Node LTS, plain ESM JavaScript, `node:test`. No build step for tooling.
- Data lives as YAML files in git. The repo is the database and the audit trail.
- Static-first: the site and free feed are static files on a CDN. Servers only for paid features (M6).

## Decided later (recorded in [`DECISIONS.md`](DECISIONS.md))
- Static site generator and hosting (M2). Decided 21 Oct 2026 (P2, D28): a plain Node ESM build script (`scripts/build-site.mjs`, no new dependency) and GitHub Pages deployed from Actions (no account, token or secret), with a hand-written search over a JSON index and Lighthouse for the exit checks. Paid services (M6) are hosted off Pages, on the owner's Unraid server behind the owner's Pangolin VPS (D40). Astro and Eleventy were checked on 21 Oct 2026 and rejected as more than the build needs (260 and 114 packages, against none for the build script). The `lighthouse` dev dependency for the exit checks adds 114 packages of its own, used only in CI.
- Extension tooling (M5). Settled 27 Oct 2026 (D46): no extension; M5 is `?q=` search links in `site/search.js` (#132).

## Automation loops
Everything routine runs on GitHub Actions with no model (D42, D44; the owner's guide is [`OPERATIONS.md`](OPERATIONS.md)). No AI session runs any part of Patchlife since the cut-over on 13 Nov 2026 (D59; [`MIGRATION.md`](MIGRATION.md) is the plan that got here).

| Loop | Runs in | Trigger | Output |
| --- | --- | --- | --- |
| Re-verification | `reverify.yml`, a GitHub runner, no model (D42) | Daily at 12:41 UTC, or **Run workflow** with `due` and `limit` | Up to 1000 due records re-checked and up to 5 cited pages archived (D43); a `claude/reverify-*` PR opened as `patchlife-bot` when a record changed |
| Housekeeping | `housekeeping.yml`, as `patchlife-bot` | Daily at 21:23 UTC | The merge bot (`scripts/merge-bot.mjs`, while `BOT_MERGE` is `on`), the watchdog (`scripts/watchdog.mjs`, one `watchdog` issue; a red run is the alarm), the Sunday summary on #27, the monthly measures PR |
| Site | `pages.yml` | Every merge to `main`, daily at 00:17 UTC, and the watchdog when the last deploy is over 36 hours old | https://patchlife.tech rebuilt with today's statuses (D7); on a PR, `build` and `lighthouse` only |
| Data gate | `data-gate.yml` | Every pull request event, always from `main`'s copy | `data-gate` passes for verification-only changes (RUNBOOKS A9) or with the owner's `audited` label on the latest commit; `protected-paths` adds the `needs-human-merge` label |
| CI | `ci.yml` | Every PR and push to `main` | Licence check, `npm run validate`, `npm test` |
| CodeQL | `codeql.yml` | Code changes on `main` and in PRs; weekly | Code scanning alerts for the scripts, the site's JavaScript and the workflows |
| Owner tools | `owner-tools.yml` | **Run workflow** | `read-page`, `check-source`, `verify` (a bot PR), `repoint` and `withdraw` (PRs for the owner) |
| Weekly data refresh | `data-refresh.yml` | Sundays at 16:17 UTC | One candidate PR of at most 60 rows on `claude/data-auto-*`, from the parsers (`scripts/parsers/`) and the source profiles, for the owner to review (RUNBOOKS O9) |

## Where pages are read
Makers' pages are read only by the polite fetcher (`scripts/polite-fetch.mjs`: PatchlifeBot's user agent, robots.txt, one request per second per host), on GitHub's runners through the workflows or on the owner's own machine (D50). There is no allowlist: a page neither can fetch is the maker's own bot wall, and that source can't be used (D18).

Until 13 Nov 2026, AI sessions did the data work from a `Crawl` cloud environment whose network allowed a fixed list of makers' hosts, and code work from a `Default` environment that could reach none. Both are retired.

## Security model
- Main threats: a parser or a re-verification writing a wrong row; markup or a script address in text copied from a maker's page reaching the site; anyone with write access pushing to a bot branch; a compromised dependency or action. Until 13 Nov 2026 the main threat was prompt injection steering an AI session that could write to the repository; no session runs now.
- Controls on the data: every record's quote is checked against its page by the verifier (nightly, D42); the source profiles in `data/sources/seed.yaml` and rules R1 to R8 in `scripts/validate-data.mjs` check the judgement fields the audits used to catch (aliases, regions, `at_least`, conditions, footnotes, hardware versions, categories, cut-short YAML values); the parser gate stops a run whose candidates don't reproduce the audited records (MIGRATION, "The parser gate"); `data-gate` lets a PR merge only when it changes nothing but verification (RUNBOOKS A9) or carries the owner's own `audited` label, which every push removes (D48). The gate and the protected-path label run on `pull_request_target`, so it is always `main`'s copy of the workflow, the scripts and their dependencies that judges a PR, and nothing a PR brings is run; the owner's label counts only for the commit it was added on, recorded as a commit status that only the gate writes; the gate reads git's paths unquoted and refuses symbolic links; and the validator accepts a record only at `<brand_slug>/<id>.yaml` (the security read of the gate, 13 Nov 2026).
- Controls on who writes: the merge bot merges only PRs that `patchlife-bot` opened from `claude/reverify-*` or `claude/measures-*` in this repository, with `test`, `data-gate` and `build` green on the exact commit in runs this repository's own branches started, and only while `BOT_MERGE` is `on` (D47); the App has no Workflows permission, so no bot can change a workflow; every action is pinned to a commit, which Dependabot moves in its monthly PR; protected paths are labelled by the gate's workflow and merged only by the owner; workflow inputs reach shells through `env`, never inline; least-privilege `permissions` in every workflow; the only secret is the App's private key, rotated yearly (RUNBOOKS O12).
- Controls on the site: it is static, sets no cookies and loads nothing from a third party; every record field is escaped when the pages are built; the validator refuses control and bidirectional-override characters in a record, and an evidence address that carries a user name or password; an evidence address must be on a site the brand's registry entry lists, and source links are shown as links only when they are https addresses without credentials; a record holds at most 20 aliases and 20 evidence items; the search box sends nothing, with or without JavaScript (the security read of 13 Nov 2026, #198).
- Known gaps: the only writers are the App and the owner, and the protected-path rule is a CI label, not a permission, so the owner's own account can merge anything. A branch ruleset letting only the App push to its branches is still to be created (OPERATIONS, "What is left for you"). The `test` and `build` checks run a PR's own code and its own copy of their workflow files, so a PR that changes them can make them pass: they catch honest mistakes, and the owner reads every file of a PR that carries `needs-human-merge`, and never merges a fork's PR on green checks alone. #202, closed on 13 Nov 2026, says how each smaller point from the two security reads was settled; what a workflow prints from outside goes through D62's cleaning.

## Cost
Nothing is subscribed: GitHub Actions and Pages on a public repository, Cloudflare's free plan and the domain (MIGRATION, "Summary"). The Max subscription that paid for the AI sessions ends on 19 Nov 2026 and is not renewed (D46). The earlier staged plan in `docs/COSTS.md` is superseded by `MIGRATION.md` (D44).
