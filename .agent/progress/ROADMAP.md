# Roadmap

A milestone ends only when every exit check has been run and has passed. Human gates (H numbers) are in TASKS.md. Targets, sequencing, decisions (P numbers) and the 14-day action plan are in `docs/PLAN.md`.

## M0 Foundation
- CI green on `main` (`npm ci`, `npm run validate`, `npm test`).
- Labels exist: `needs-human`, `needs-human-merge`, `claude`, `data-correction`, `add-model`, `bug`.
- `needs-human` issues open for H1 to H4, H8 and H11, each with exact steps.

Exit: link to a green CI run in the PR; issue numbers recorded in TASKS.md.

Status: done 2026-10-21. Issues #2 to #7; CI run links in the M0 PR.

## M1 Evidence engine and first 50 records
- `npm run verify:evidence` as in SPEC 3 for HTML sources, with offline fixture tests. PDF text and archive snapshots move to M3 if decision P3 is approved.
- Status computation as in SPEC 2, tested at the 12-month boundary and for relative rules without anchors.
- 50 verified camera and doorbell records from at least four brands, starting from `data/sources/seed.yaml`.
- Fetching sources needs the `Crawl` environment (D17): data work runs in `Crawl` sessions, not in the daily build.

Exit: `npm run validate`, `npm test` and `npm run verify:evidence` pass; at least 50 records are `verified`, from at least four brands.

## M2 Public site, search only
- Site generator and host chosen and recorded. Proposed (decision P2): a plain Node build script and GitHub Pages.
- Pages and JSON as in SPEC 4; sitemap; structured data.
- Deploy on merge to `main` and daily just after 00:00 UTC, so status stays current (D7; needs H6).
- Search Console set up at launch (H7), so pages are indexed before M4.

Exit: live preview URL; automated accessibility check passes on the home page and one model page; Lighthouse performance, accessibility and SEO at 90 or above on a model page.

## M3 Unattended data
- Nightly data refresh scheduled task live in the `Crawl` environment (decision P1, RUNBOOKS O6), after the prompt fixes.
- Re-verify every record checked more than 60 days ago (so none passes 90) and report dead sources.
- PDF text and archive snapshots, if decision P3 moves them here.
- Coverage for M4: at least 150 verified records, at least 40 in small-office categories (routers, printers, NVRs).

Exit: three consecutive nightly runs each end in a correct PR or a correct no-op; a deliberately broken fixture source is detected and flagged.

## M4 Demand check (four weeks)
- Starts only when the start conditions in `docs/PLAN.md` hold (site on `patchlife.tech`, M3 done, 150 or more verified records, pages indexed, waitlist and collection notice live, gates approved).
- Weekly Search Console and waitlist numbers in LOG.md, pasted by the owner into a pinned issue (needs H7).
- B2B probe: a `/business` page linking to a hosted waitlist form (provider and copy are human gates; H9b first).

Exit: gates A to C (decision P5) measured for four weeks; the outcome recorded in decisions.md, which also sets whether M5 or M6 comes next.

## M5 Browser extension (order with M6 set by M4)
- As in SPEC 5, for three retailers. Zip built in CI. Store submission is H10.

Exit: fixture tests pass for all three retailers; the zip is attached to a CI run.

## M6 B2B (order with M5 set by M4)
- CSV report, API keys through Stripe test mode, supplier SKU check (SPEC 6).

Exit: a test-mode purchase issues a key that works end to end.

## M7 Growth
- Monthly report generator and alerts (SPEC 7).

Exit: first report published; alert flow tested against a test inbox.
