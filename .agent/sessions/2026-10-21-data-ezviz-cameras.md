# 2026-10-21 EZVIZ camera and doorbell records

Source: EZVIZ EOL Product List (support.ezviz.com), read only with the A2 step 3 fetcher. robots.txt allowed it, no bot challenge, dates in the raw HTML.

What the page states: a table of "Day of firmware update cessation" per model and targeted area (every row says Europe), and a definition that EOL "means that EZVIZ no longer maintain any firmware updates (including security updates)". EZVIZ's upgrade policy (www.ezviz.com trust centre) links this list as the list of products whose firmware updates are no longer supported, and separately promises security updates for at least two years after first shipment, with no per-model shipment dates. So each record is `fixed_date` from its row, `at_least: false`, region EU, with the definition as a second evidence item.

Added 191 records: 171 "Smart Home Camera" rows (camera) and 20 "Smart Video Doorbell" rows (doorbell), one per row, model number as EZVIZ writes it and no aliases (the page gives no marketing names). All dates have a day (YYYY/M/D, year first, so no DD/MM ambiguity). Validator: `mentionsDate` now accepts `2027/12/31` and `2028/1/20`, with tests.

Skipped: other product lines (Action Camera, NVR, Smart Entry, sensors, networking, vacuums, gateways, controls).

Judgement calls for the auditor: "Europe" recorded as EU, not UK; category follows the page's product line, so two chimes (CS-CMT-*) and CS-DL01CP-BT / CS-DL01P-BT are doorbells, and CS-DB2-A0-1B3WPMFBR / CS-DP1-* are cameras; the page calls the dates "expected", noted in each record.

Verified: verify:evidence 191 checked, 0 problems; validate 313 records, 0 errors; npm test 137 pass.

Inefficient: the validator did not know the year-first slash date form, found only after reading the page.
