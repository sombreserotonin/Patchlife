# Roadmap

A milestone ends only when every exit check has been run and has passed. Human gates (H numbers) are in TASKS.md.

## M0 Foundation
- CI green on `main` (`npm ci`, `npm run validate`, `npm test`).
- Labels exist: `needs-human`, `needs-human-merge`, `claude`, `data-correction`, `add-model`, `bug`.
- `needs-human` issues open for H1 to H4, H8 and H11, each with exact steps.

Exit: link to a green CI run in the PR; issue numbers recorded in TASKS.md.

## M1 Evidence engine and first 50 records
- `npm run verify:evidence` as in SPEC 3, with offline fixture tests.
- Status computation as in SPEC 2, tested at the 12-month boundary and for relative rules without anchors.
- 50 verified camera and doorbell records from at least four brands, starting from `data/sources/seed.yaml`.

Exit: `npm run validate`, `npm test` and `npm run verify:evidence` pass; 50 records are `verified`.

## M2 Public site, search only
- Site generator and host chosen and recorded (ARCHITECTURE, "To decide").
- Pages and JSON as in SPEC 4; sitemap; structured data.
- Deploy on merge to `main` (needs H6).

Exit: live preview URL; automated accessibility check passes on the home page and one model page; Lighthouse performance, accessibility and SEO at 90 or above on a model page.

## M3 Unattended data
- Nightly data refresh scheduled task live in the `crawl` environment (needs H5).
- Weekly pass: re-verify records older than 90 days and report dead sources.

Exit: three consecutive nightly runs each end in a correct PR or a correct no-op; a deliberately broken fixture source is detected and flagged.

## M4 Demand check (four weeks)
- Weekly Search Console numbers in LOG.md (needs H7).
- B2B probe: an MSP feed section on the site with a waitlist (form provider is a human gate).

Exit: the owner's go or no-go decision recorded in decisions.md.

## M5 Browser extension
- As in SPEC 5, for three retailers. Zip built in CI. Store submission is H10.

Exit: fixture tests pass for all three retailers; the zip is attached to a CI run.

## M6 B2B
- CSV report, API keys through Stripe test mode, supplier SKU check (SPEC 6).

Exit: a test-mode purchase issues a key that works end to end.

## M7 Growth
- Monthly report generator and alerts (SPEC 7).

Exit: first report published; alert flow tested against a test inbox.
