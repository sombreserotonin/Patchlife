# 2026-10-21 data: TP-Link cameras and doorbells

Added 58 Tapo camera and doorbell records from TP-Link's Australian statement of compliance
(https://www.tp-link.com/au/landing/au-cyber-compliance/). All 58 are `verified` by `npm run verify:evidence`.

## Sources checked
- UK PSTI page (https://www.tp-link.com/uk/support/psti/): rule in HTML, "The defined support period will end 3 years after the product’s end-of-life date." It names no camera model; per-model periods are only in the linked PDF (static.tp-link.com, "Statements of PSTI Compliance_TP-Link.pdf"). The verifier cannot read PDFs, so no UK records.
- UK end-of-life list (https://www.tp-link.com/uk/support/faq/3562/): networking products only, no cameras or doorbells, so no HTML anchors.
- AU: /au/support/psti/ and /au/support/faq/3562/ return 404. The AU statement lives at /au/landing/au-cyber-compliance/ (updated 3/03/2026) and has a per-model HTML table. Its rule wording differs from the UK: "will end up to 3 years after the product’s end-of-sales date".

## Decisions
- One record per model and hardware version (`tp-link-tapo-c200-v5`), because the UK PDF gives different dates for different hardware versions of the same model. `conditions` names the version.
- Every Tapo camera and doorbell row reads "31/12/2028 or later*", recorded as `fixed_date` 2028-12-31 with `at_least: true`. The footnote: "The non-EOL product’s defined support period may be refreshed to extend specified date."
- Skipped: TC and TD rows (not labelled Tapo on the page), pack and kit variants of a listed model, Tapo C410 KIT V2.20 and Tapo C410(4-pack) V1 (no base row for that version), VIGI (business range, out of scope), and no Kasa cameras or doorbells appear on either page.

## Inefficient
- The AU statement is not at the URL pattern the UK uses; a search found it.
