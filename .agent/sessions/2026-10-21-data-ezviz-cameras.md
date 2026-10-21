# 2026-10-21 EZVIZ camera and doorbell records

Source: EZVIZ EOL Product List (support.ezviz.com), read only with the A2 step 3 fetcher. robots.txt allowed it, no bot challenge, dates in the raw HTML.

What the page states: a table of "Day of firmware update cessation" per model and targeted area (every row says Europe), and a definition that EOL "means that EZVIZ no longer maintain any firmware updates (including security updates)". EZVIZ's upgrade policy (www.ezviz.com trust centre) links this list as the list of products whose firmware updates are no longer supported, and separately promises security updates for at least two years after first shipment, with no per-model shipment dates. So each record is `fixed_date` from its row, `at_least: false`, region EU, with the definition as a second evidence item.

Added 191 records: 171 "Smart Home Camera" rows (camera) and 20 "Smart Video Doorbell" rows (doorbell), one per row, model number as EZVIZ writes it and no aliases (the page gives no marketing names). All dates have a day (YYYY/M/D, year first, so no DD/MM ambiguity). Validator: `mentionsDate` now accepts `2027/12/31` and `2028/1/20`, with tests.

Skipped: other product lines (Action Camera, NVR, Smart Entry locks, sensors, networking, vacuums, gateways, controls).

Judgement calls for the auditor: "Europe" recorded as EU, not UK; category follows the page's product line, so two chimes (CS-CMT-*) and CS-DL01CP-BT / CS-DL01P-BT are doorbells, and CS-DB2-A0-1B3WPMFBR / CS-DP1-* are cameras; the page calls the dates "expected", noted in each record.

Audit fixes (A8 on #51, fix-then-merge): every record now has `conditions` "EZVIZ gives this as an expected EOL date and says its EOL product list is subject to change.", backed by two more quotes: the list's "currently active products with an expected EOL date" and the upgrade policy's "the EOL product list are subject to change". The policy's "for reference only" refers to the policy page itself, so it is not claimed for the list. Categories now follow EZVIZ's own product page names, read with the polite fetcher: four chimes (CS-CMT-A0/B0-CHIME, CS-CH1-A0/R100-10AWFK) to `other`, CS-DL01CP-BT and CS-DL01P-BT to `smart-lock`, CS-DB2-A0-1B3WPMFBR, CS-DP1 and CS-DP1C to `doorbell`. Added the two Smart Entry doorbells, CS-DB2C-A0-1E3WPBR (DB2C video doorbell kit) and CS-DP2-A0-6E2WPFBS (DP2 peephole doorbell). Totals: 193 records, 168 camera, 19 doorbell, 4 other, 2 smart-lock.

Verified after the fixes: verify:evidence 193 checked, 0 problems; validate 315 records, 0 errors; npm test 137 pass; a local site build shows the condition on the device page.

First pass verified: verify:evidence 191 checked, 0 problems; validate 313 records, 0 errors; npm test 137 pass.

Inefficient: the validator did not know the year-first slash date form, found only after reading the page.
