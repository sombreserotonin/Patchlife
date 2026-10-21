# 2026-10-21 Data report

Added `node scripts/data-report.mjs`. Its first four lines are the Measures rows of `docs/PLAN.md`, with the same labels in the same order: verified records, brands with verified records, the share of verified records with a computable status (rounded down) and stale records. Then it prints the total, the oldest `checked` date and counts by brand, category, status and verification state. It reads only local files, so it runs in `Default`. No `package.json` script, because that path is protected; the CLAUDE.md Commands entry goes in the protected PR #29.

On `main` (21 Oct 2026, UTC): 120 records, all verified and none stale, from 3 brands; 105 supported, 2 ending soon, 13 ended, 0 unknown. The Measures table already had these numbers; PLAN.md now says where they come from.

A review of #35 found the share counted stale and unverified records, the headline did not follow the Measures rows, and the tests could not tell whether `today` was used. All fixed, with each new test checked by mutation.

Next: the verifier redirect check, the only Default task left in TASKS.md.
