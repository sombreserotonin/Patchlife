# Sweep registry: what exists, what ran, what it is worth

Proposals for sweeps are written here, not in conversation. The `Last run` column is derived from report filenames by
the sweep skill's `sweep_status.py`; the other columns are written by hand.

## Candidates

| Zone | Argument | Last run | Yield |
|---|---|---|---|

## Proposed, not yet run

| Zone | Argument | Premise to re-verify before starting |
|---|---|---|
| `merge-gate` | What may land on `main`: `data-gate.yml`, `verification-only.mjs`, `merge-bot.mjs`, `housekeeping.yml`, `ci.yml`. Read twice on 13 Nov 2026 (#203, #205 to #207, #213, #215). | The gate still runs on `pull_request_target` |
| `workflows` | The workflows that hold a write token or the App key: `data-refresh.yml`, `reverify.yml`, `owner-tools.yml`, `pages.yml`, `codeql.yml`, `probe-hosts.yml`, `dependabot.yml`. | Inputs still reach shells through `env` |
| `data-integrity` | What a record may say: `validate-data.mjs`, the two schemas, `withdraw-record.mjs`, `repoint-source.mjs`. | |
| `record-writers` | What writes records: `candidates.mjs`, `table-rows.mjs`, `scripts/parsers/`. | |
| `fetchers` | What reads makers' pages: `polite-fetch.mjs`, `verify-evidence.mjs`, `archive-evidence.mjs`, `page-text.mjs`, `check-source.mjs`, `unquoted-dates.mjs`, `probe-hosts.mjs`. | |
| `public-site` | What visitors see: `build-site.mjs`, `site/search.js`, `status.mjs`, `data-report.mjs`. Read once on 13 Nov 2026 (#198). | |
| `ops-scripts` | What tells the owner something is wrong: `watchdog.mjs`, `renewals.mjs`, `check-licences.mjs`, `audit-sample.mjs`. | |

## Candidates verified and refused

Written here so they are not rediscovered. A refused candidate without a written reason comes back.
