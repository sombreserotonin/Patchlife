# 2026-10-30 nightly data: TP-Link AU batch

- Pull #153 and #149 await the owner's label; no failing data PR; the last Re-verify run (29 Oct) had no "Records not checked" annotation.
- Source: TP-Link (oldest `last_checked` among usable sources, 21 Oct). `unquoted-dates.mjs` on the UK pages: PSTI 0; FAQ 3562 lists end-of-life dates only, not support ends, so nothing recorded.
- AU compliance page: 57 new records, quote `<label> <model> <version> 31/12/2028 or later*` plus the footnote, `at_least: true`, region AU.
- Not done: the 31/6 dates (invalid day) for S6500/S7500 switches, mesh pack variants, PON/OLT, adapters, hubs, business and Tapo rows (a later batch).
- Needs an A8 audit by a separate `Crawl` session before merge.
