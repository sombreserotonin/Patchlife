# 2026-10-21 Google Nest camera and doorbell records

Added 12 Google records (8 cameras, 4 doorbells) under `data/devices/google/`, all `verified` by `npm run verify:evidence` in `Crawl`.

Sources, all on support.google.com and in the raw HTML (no JavaScript rendering needed):
- Main source: "Security updates & security validation results for Google's connected home devices" (`answer/10231940`), a table of each device's US Google Store release date and "Release date + 5 year minimum". Recorded as `years_after_launch`, 5 years, `at_least: true`, anchor and end date from the row, regions `GLOBAL`.
- UK PSTI statement of compliance (`answer/14869041`, April 2024): lists six of these models with model numbers under Group 2, "At least five years". Added as `uk_psti` evidence and region `UK` for those six; model numbers added as aliases.
- Found through "Security support periods for Google Hardware products" (`answer/15107519`).

Skipped: none with a camera or doorbell category. Nest Hub Max (has a camera) is a smart display, left for a display batch.

Open questions:
- Dates appear on the page in US format (for example `8/24/2026`); the planned "date appears in a quote" validator rule must accept that format.
- The years appear as "5" on the Nest page and "five" on the PSTI page.
- `GLOBAL` is a judgement: the Nest page names no region, only the US Google Store as the anchor.
- Correction after audit: Google does publish Australian statements of compliance for 6 of these models (for example `answer/16889039`); I missed them. Adding them is a follow-up.

Audit fixes (same day): row quotes now include the "Currently receiving critical security updates" cell, so a flip to "No" marks the record stale; the scope sentence is extra evidence and `conditions`; notes on region, past-minimum support and the wired doorbell; duplicate aliases removed.

Inefficient: none worth noting; the PSTI page's "Security support periods" link led straight to the Nest table.
