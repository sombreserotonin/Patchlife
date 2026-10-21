# 2026-10-21 Data report

Added `node scripts/data-report.mjs`, which prints counts by brand, category, status and verification state, the number of brands with verified records, the share with a computable status and the oldest `checked` date. It reads only local files, so it runs in `Default`. No `package.json` script, because that path is protected.

On `main` (21 Oct 2026, UTC): 120 records, all verified and none stale, from 3 brands; 105 supported, 2 ending soon, 13 ended, 0 unknown. The Measures table already had these numbers; PLAN.md now says where they come from.

Next: the remaining Default tasks in TASKS.md (verifier redirects, seed.yaml leads, `--due` and `--limit`).
