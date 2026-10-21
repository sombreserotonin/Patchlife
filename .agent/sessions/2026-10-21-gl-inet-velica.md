# 2026-10-21 GL.iNet Velica (GL-B2200) per D39

Added two records for Velica (GL-B2200), one per GL.iNet page, as D39 asks:
- `gl-inet-gl-b2200`: UK, fixed_date 2027-06-11, at_least true, from the PSTI support period page ("Velica (GL-B2200) June 11, 2027 or later*" plus the "*Actual Support Periods" footnote), same conditions and evidence pattern as the other PSTI-only GL.iNet records.
- `gl-inet-gl-b2200-global`: GLOBAL (D24), fixed_date 2026-10-10, at_least false, from the firmware versions EOL table row "GL-B2200 3.218 QSDK 15.05.1 Maintenance Oct 10th, 2024 Oct 10th, 2026", quoted like Beryl GL-MT1300. The column is "Supported Until", with no "at least" wording, so at_least is false. The date has passed, so the site will show it as ended.

Each note names the other record and says the two pages differ. Category `mesh-wifi`: the #49 audit found GL.iNet's menu lists the Velica series as mesh hubs and nodes; no page read describes GL-B2200 itself.

Pages read only with the A2 step 3 polite fetcher. Verified: `npm run verify:evidence -- gl-inet-gl-b2200 gl-inet-gl-b2200-global` gave both `verified`, 0 problems; `npm run validate` 340 records, 0 errors; `npm test` 137 pass.

Inefficient: nothing notable; the PR #49 audit comment already had the EOL row, which saved a search.
