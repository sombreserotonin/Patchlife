# Roadmap

A milestone ends only when every exit check has been run and has passed. Human gates (H numbers) are in TASKS.md. Targets, sequencing, decisions (P numbers) and the 14-day action plan are in `docs/PLAN.md`.

## M0 Foundation
- CI green on `main` (`npm ci`, `npm run validate`, `npm test`).
- Labels exist: `needs-human`, `needs-human-merge`, `claude`, `data-correction`, `add-model`, `bug`.
- `needs-human` issues open for H1 to H4, H8 and H11, each with exact steps.

Exit: link to a green CI run in the PR; issue numbers recorded in TASKS.md.

Status: done 2026-10-21. Issues #2 to #7; CI run links in the M0 PR.

## M1 Evidence engine and first 50 records
- `npm run verify:evidence` as in SPEC 3 for HTML sources, with offline fixture tests. PDF text and archive snapshots moved to M3 (D29).
- Status computation as in SPEC 2, tested at the 12-month boundary and for relative rules without anchors.
- 50 verified camera and doorbell records from at least four brands, starting from `data/sources/seed.yaml`.
- Fetching sources needs the `Crawl` environment (D17): data work runs in `Crawl` sessions, not in the daily build.

Exit: `npm run validate`, `npm test` and `npm run verify:evidence` pass; at least 50 records are `verified`, from at least four brands.

Status: done 2026-10-21. `npm run validate`: 338 records, 0 errors. `npm test`: 137 of 137 pass. Full `npm run verify:evidence`: "338 record(s) checked, 0 problem(s)". Verified camera and doorbell records: 309 from four brands (EZVIZ 187, TP-Link 60, Ring 50, Google 12); the other 29 verified records (GL.iNet 23, EZVIZ 6: routers, hubs, smart locks and other) don't count.

## M2 Public site, search only
- Site generator and host chosen and recorded: a plain Node build script and GitHub Pages (P2, D28).
- Pages and JSON as in SPEC 4; sitemap; structured data.
- Deploy on merge to `main` and daily just after 00:00 UTC, so status stays current (D7; needs H6).
- Search Console set up at launch (H7), so pages are indexed before M4.

Exit: live preview URL; automated accessibility check passes on the home page and one model page; Lighthouse performance, accessibility and SEO at 90 or above on a model page.

Exit checks met on 21 Oct 2026 on the preview (https://sombreserotonin.github.io/Patchlife/; #47's CI run scored 100 in all three categories on the home page and a model page). M2 is marked done after M1 closes.

Status: done 2026-10-21, on the exit checks above, after M1 closed.

## M3 Unattended data
- Nightly data refresh scheduled task live in the `Crawl` environment (decision P1, RUNBOOKS O6); the prompt fixes it needs are merged (#29).
- Re-verify every record checked more than 60 days ago (so none passes 90) and report dead sources.
- PDF text and archive snapshots (moved from M1, D29).
- Coverage for M4: at least 150 verified records, at least 40 in small-office categories (routers, printers, NVRs).

Exit: three consecutive nightly runs each end in a correct PR or a correct no-op; a deliberately broken fixture source is detected and flagged.

Progress: the broken-source half passed on 22 Oct 2026 (drill of the `reverify.yml` steps, TASKS.md); the three nightly runs start that night.

## M5 Search links (D46: no browser extension)
- `?q=` search in the existing `site/search.js`, so a link such as `https://patchlife.tech/?q=<model>` opens the matching records. No store extension, bookmarklet or store accounts, so H10 isn't needed.

Exit: a `?q=` link opens the matching records, with tests that prefer the longest exact match (PLAN, "Matching").

Done 27 Oct 2026 (MIGRATION C4): the home page reads `?q=` on load and runs the search; what is typed is never written into the URL.

## M7 Growth (D46: feeds, not email)
- Atom feeds in place of email alerts, and the monthly stats report as `/stats/` (SPEC 7). No email provider, subscriber list or personal data.

Exit: the feeds validate, and `/stats/` builds with the site.

## Planned (not active)
The owner shelved the business side on 22 Oct 2026 (D45): revisit once the no-AI setup is up and working (`docs/MIGRATION.md`, after Stage 4's exit check). Nothing here starts before then. The H9b drafts are in #99, on `claude/m4-drafts`.

### M4 Demand check (four weeks)
- Starts only when the start conditions in `docs/PLAN.md` hold (site on `patchlife.tech`, M3 done, 150 or more verified records, pages indexed, waitlist and collection notice live, gates approved).
- Weekly Search Console and waitlist numbers in LOG.md, pasted by the owner into a pinned issue (needs H7).
- B2B probe: a `/business` page linking to a hosted waitlist form (provider and copy are human gates; H9b first).

Exit: gates A to C (decision P5) measured for four weeks; the outcome recorded in decisions.md, which also sets whether M5 or M6 comes next.

### M6 B2B
- CSV report, API keys through Stripe test mode, supplier SKU check (SPEC 6).

Exit: a test-mode purchase issues a key that works end to end.
