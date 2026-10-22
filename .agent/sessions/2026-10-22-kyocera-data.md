# 2026-10-22 Nightly data: Kyocera

- Repair and re-verification: nothing to do (no open data PRs; run 39702142924 passed; 0 stale).
- Source: Kyocera UK PSTI page (oldest `last_checked`, null). robots.txt allows; dates are in the raw HTML.
- Added 41 printer records (UK), one per model, from 43 rows (ECOSYS PA5500x appears three times with the same date, so one record). All dates are full days; none skipped.
- Each record has two quotes: the model's row and the "no less than three years" sentence that justifies `at_least: true`.
- Page covers A4 ECOSYS and TASKalfa devices; only ECOSYS rows were listed.
- Verified: `verify:evidence` 41/0; validate 736/0; tests 263 pass.
- Needs an A8 audit by a different `Crawl` session before merge.
