# Spec

## 1. Device record
One YAML file per model at `data/devices/<brand_slug>/<id>.yaml`. The contract is `data/schema/device.schema.json`; `npm run validate` enforces it plus the integrity rules in `scripts/validate-data.mjs`. Copy the shape of `data/devices/ring/ring-video-doorbell-3.yaml`. Quote dates in YAML (`"2027-12-31"`).

| `support.rule` | Meaning | Required |
| --- | --- | --- |
| `fixed_date` | The source gives a date | `end_date` |
| `years_after_eol` | N years after the maker ends sale or declares end of life | `years`; `anchor_date` and `end_date` only once the EOL date is published |
| `years_after_launch` | N years after launch or first availability | as above |
| `years_after_manufacture` | N years after manufacture (varies by batch) | `years` |
| `years_after_purchase` | N years after the buyer's purchase | `years` |
| `none_published` | Searched and found nothing | evidence URLs, no quote |

`at_least: true` when the source says "at least" or "minimum". Caveats such as a purchase-channel condition go in `conditions` as one short sentence.

Source registry: `data/sources/*.yaml` lists starting URLs per brand. Each file is a list of entries with `brand`, `brand_slug`, `kind` (how the pages state support), `urls` (one or more `https` links), an optional `date_order` (`dmy` or `mdy`: how the pages write numeric dates such as 3/4/2027), an optional `note` and `last_checked` (the date the data refresh last fetched them, or null). The contract is `data/schema/source.schema.json`; `npm run validate` enforces it and also rejects a `brand_slug` listed twice or a `last_checked` date in the future. It reads numeric dates in quotes from an evidence URL that starts with one of an entry's `urls` in that entry's `date_order` only.

## 2. Status (computed at build time, never stored)
Against today's date: `supported` (more than 12 months left), `ending_soon` (12 months or less), `ended`, `unknown` (no computable date). A relative rule without an anchor is `unknown` and shown in words, for example "3 years after Acme ends sales of this model (date not yet published)".

## 3. Evidence verifier (M1): `npm run verify:evidence`
- Fetch each evidence URL (HTML or PDF) and extract the text.
- Normalise: Unicode NFKC, collapse whitespace, table cells joined by single spaces, case-insensitive comparison.
- Pass when the normalised quote appears in the normalised text; then set `verification.status: verified`, `checked`, and `text_sha256` of the normalised text.
- Request an archive snapshot (best effort) and store `archive_url`.
- Store hashes and quotes only, never whole pages.
- Unit tests run offline against saved fixtures. CI never hits the network.

## 4. Public site (M2)
- Pages: home search, model, brand, category, methodology, corrections, about.
- Model page: end date or rule in words, time left, status, quote, source link, date checked, "Report a correction" link.
- Copy pattern: "Security updates until at least 31 December 2027, as published by Ring (checked 21 Oct 2026)."
- Static output, client-side search, sitemap, structured data, WCAG 2.1 AA, fast on mobile.
- JSON: `/api/v1/devices.json` (all records) and `/api/v1/devices/<id>.json`. Every response includes `license: "ODbL-1.0"` and the attribution line from `data/NOTICE.md`.
- Footer on every page: links to the source code (AGPL-3.0-or-later), the data licence (ODbL) and the attribution line.

## 5. Browser extension (M5)
- Manifest V3. On product pages of three chosen AU or UK retailers, match the model locally against a downloaded index and show a badge with status and end date, plus up to three longer-supported alternatives.
- No browsing data leaves the device. Matching uses the page title and model numbers only.
- Tests run against saved HTML fixtures for each retailer.

## 6. B2B (M6)
- CSV upload (make, model) produces an unsupported and ending-soon report, processed in the browser.
- Paid API keys: Stripe Checkout, a webhook issues the key, the key is checked at the edge. Test mode first.
- Supplier check: SKU list in, statement found or not found out, with links.

## 7. Alerts and reports (M7)
- Email alerts per device with double opt-in and one-click unsubscribe.
- Monthly stats report generated from the data, for example the share of on-sale cameras with under two years of support left.

## Acceptance for every feature
Ships with tests that fail without it, passes `npm run validate` and `npm test`, and any new command is added to CLAUDE.md.
