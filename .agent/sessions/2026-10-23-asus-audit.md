# 2026-10-23 A8 audit: #114 ASUS

- Read the UK PSTI networking page with the polite fetcher, and its raw HTML. It is a two-column table: each row has the models in its first cell and "4 years (until 31th December YYYY)" in its second, so a date follows its own models and quoting forward from a model to the next date is correct.
- Checked all 54 records by script against the table rows. Each model is in exactly one row as a whole name, `end_date` matches that row, and the quote lies inside the row (none crosses a group boundary). Quotes run 46 to 299 characters and start at the record's own name, never a prefix (RT-BE58U against V2, BT7 against BT7 Z). Region is UK only, there are no aliases and there are no ASUS records on `main`.
- `at_least: true` kept: "will offer ... until the date specified below" plus "extended support may be provided after the stated date" makes the date a minimum (D23, as Kyocera). Each record quotes that sentence.
- Exclusions confirmed: RT-AXE7800 and TUF-AX3000 V2 are in the 2025 and 2026 rows, and the 12 2026-row models sit 307 to 519 characters from the date.
- Not blocking: ZenWiFi AX Mini XD4(XD4R+XD4N) (2025) and ZenWiFi BT7 Z (2030) were neither recorded nor listed as excluded. Follow-up.
- Verified: validate 790/0, tests 263 pass, `verify:evidence` 54 checked, 0 problems (page unchanged). No fixes needed; labelled `audited`.
- Inefficient: my check script first sliced the table after the header cell, so it dropped the 2025 row and flagged 9 false failures. Slice from the table start next time.
