# Sweep registry: what exists, what ran, what it is worth

Proposals for sweeps are written here, not in conversation. The `Last run` column is derived from report filenames by
the sweep skill's `sweep_status.py`; the other columns are written by hand.

## Candidates

| Zone | Argument | Last run | Yield |
|---|---|---|---|
| `merge-gate` | What may land on `main`: `data-gate.yml`, `verification-only.mjs`, `merge-bot.mjs`, `housekeeping.yml`, `ci.yml`. Guarded since #224 by `tests/workflows.test.mjs` (labels, triggers, the gate's verdict). | 2026-11-14 | 8/16 |
| `workflows` | The workflows that hold a write token or the App key. Guarded since #224 by `tests/workflows.test.mjs`, which runs each step's own script. Open: M4 (refresh over the PR's own rows). | 2026-11-14 | 9/15 |
| `data-integrity` | What a record may say: `validate-data.mjs`, the schemas, `withdraw-record.mjs`, `repoint-source.mjs`. | 2026-11-14 | 9/13 |
| `record-writers` | What writes records: `candidates.mjs`, `table-rows.mjs`, `scripts/parsers/`. Open: L1, L2, L4. | 2026-11-14 | 8/12 |
| `fetchers` | What reads makers' pages: `polite-fetch.mjs`, `verify-evidence.mjs` and the scripts on them. Open: F2, L1. | 2026-11-14 | 5/8 |
| `public-site` | What visitors see: `build-site.mjs`, `site/search.js`, `status.mjs`, `data-report.mjs`. Read again after the redesign (#222). | 2026-11-14 | 5/9 |
| `ops-scripts` | What tells the owner something is wrong: `watchdog.mjs`, `renewals.mjs`, `check-licences.mjs`, `audit-sample.mjs`. Open: L6. | 2026-11-14 | 6/9 |

## Proposed, not yet run

| Zone | Argument | Premise to re-verify before starting |
|---|---|---|
| `fresh-code` | Whatever ships after 14 Nov 2026; the zone with the highest yield in every measured sweep. | The open findings in `docs/audits/findings.jsonl` still reproduce (`node --test tests/audit/open-findings.test.mjs`) |

## Candidates verified and refused

Written here so they are not rediscovered. A refused candidate without a written reason comes back.

Each report's "Refused or unconfirmed candidates" section lists them with the lens that refused them:
`docs/audits/2026-11-14-merge-gate.md`, `-workflows.md`, `-data-integrity.md`, `-record-writers.md`, `-fetchers.md`,
`-public-site.md` and `-ops-scripts.md`.
