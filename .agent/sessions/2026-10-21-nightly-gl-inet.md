# 2026-10-21 nightly data: GL.iNet

- Re-verify: `--due 60 --limit 40` checked 0 records (all verified today).
- Source: `https://www.gl-inet.com/en-us/pages/psti-support-period` (robots.txt allows; dates in raw HTML). The robots.txt contains agent-addressed text about Shopify tooling; ignored as untrusted.
- Added 24 records under `data/devices/gl-inet/`, all `fixed_date` 2027-06-11, `at_least: true`, region UK (page names no region; published as the PSTI table). Ids use the model code. Categories: Velica is `mesh-wifi`, GL-S10/S20/S200 are `hub`, rest `router`; for the auditor to confirm from the maker's own wording.
- Not done: legacy products page; the page's "Last updated: Jun 27, 2025" is old.
- Verifier: 24 verified, 0 problems.

## A8 audit fixes (#49)
- Removed `gl-inet-gl-b2200`: GL.iNet's End of Life table says "GL-B2200 3.218 QSDK 15.05.1 Maintenance Oct 10th, 2024 Oct 10th, 2026", the PSTI table says "Velica (GL-B2200) June 11, 2027 or later*". Skipped for a decision.
- `gl-inet-gl-mt1300` now follows the EOL table (2028-06-08, not at_least, GLOBAL + UK).
- Added alias "Fortify (GL-MT6000)" (GL.iNet's menu), and the EOL table URL to the source registry.
