# 2026-10-22 Unquoted dates (COSTS stage 2, first part)

- H7 done (#77). A Domain property's sitemap box needs `https://patchlife.tech/sitemap.xml`, not `sitemap.xml`.
- `scripts/unquoted-dates.mjs`: dates on cited pages outside every record quote. Generic, no per-brand parser, stores nothing.
- Trial in `Crawl` (session_01UawSYr1SqeH4NSMRk6MaB8): 19 pages, 0 errors. Unquoted dates: TP-Link AU 797, EZVIZ 119, Google 10231940 55, Ring US ri2p1 45, UK 19, AU 8; name-change articles 6 or 7 (prose); single prose dates elsewhere.
- Next: the nightly task (one source a night) works through those rows; TP-Link and EZVIZ routers, switches and NVRs count toward M4's small-office target. A stored baseline per page would let a revisit with nothing new end without reading the list; not built (YAGNI until the lists are short).
