# 2026-10-22 A8 audit: #111 Kyocera

- Read the UK PSTI page with the polite fetcher: 43 ECOSYS rows, 41 models (ECOSYS PA5500x three times, each 31st December 2026).
- Checked all 41 records by script against the rows: model, end date, UK only, no aliases, category `printer` (the page calls them A4 printers and MFPs; the schema has no MFP category). No other brand names Kyocera or ECOSYS. Dates are written out ("31st December 2026"), so no `date_order` is needed.
- Fixed: the second quote, "no less than three years from the point the relevant model was first made available in the UK", is a floor from first availability, not the row's end date (for example PA4500x, Jan-23, ends 31st December 2026). Replaced it on all 41 with the page's "At no point shall the support periods advertised on this webpage be reduced" sentence, which does make the row date a minimum; `conditions` and `notes` now use the page's words.
- Verified: `verify:evidence` 41 checked, 0 problems (page unchanged); validate 736/0 and tests 263 pass on `main` merged with the branch.
- Scope: the page says A4 ECOSYS and TASKalfa devices are in scope but lists only ECOSYS rows, so no TASKalfa record is supported.
