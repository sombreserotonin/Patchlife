# Tasks

## Active: M1 and M2 done (2026-10-21); M3 is next
The coordinating session writes the M3 tasks.

The plan and the reasons for this order are in `docs/PLAN.md`. Data tasks need a `Crawl` session (D17), which only the owner or a coordinating session can start until decision P1 is made, so they are marked waiting.

Rules for the daily build:
- Never start a task under **Waiting**: those need a `Crawl` session or the owner.
- When every task under **Next** is done, do housekeeping only and end the run with `WAITING: no Default task; waiting on #23 and a Crawl session`.
- Never mark M1 done or write M2 tasks. Only the `Crawl` session that runs the M1 exit check may do that, and only if it passes.

Next for the daily build (`Default`), in order:
- [ ] Validator: make numeric dates unambiguous. `mentionsDate` in `scripts/validate-data.mjs` accepts both day/month/year and month/day/year, so "3/4/2027" passes for both 2027-04-03 and 2027-03-04 (Google's quotes are month/day, TP-Link AU's are day/month). Add an optional `date_order: dmy | mdy` to source registry entries (`data/sources/*.yaml`, schema in `data/schema/source.schema.json`); for evidence whose URL starts with one of an entry's URLs, accept only that numeric order. A numeric date whose day and month are both 12 or under and differ, on evidence no entry covers, fails validation. Set `date_order` on the Google (mdy) and TP-Link (dmy) entries. Tests for both orders and the uncovered case. No change to `data/devices`.
- [ ] Validator: every record's `model` or one of its `aliases` must appear in at least one evidence quote (normalised as the verifier does), and no alias or model may be shared by two records of the same brand unless they are region-date splits of one product (D33: same `model`, different regions). Tests. All 122 current records should pass; if any fails, list it in the PR instead of editing data.

Waiting:
- [ ] EZVIZ camera records per RUNBOOKS A2, then an A8 audit by a second session: the fourth brand. Hosts added (#23); a `Crawl` session started by the coordinating session on 21 Oct is doing it.
- [ ] Audit and merge #49 (GL.iNet, 24 router, mesh and hub records from the nightly task's first run): an A8 session started on 21 Oct. Routers don't count toward M1's camera and doorbell exit.


Leads for after M1 (need `Crawl`): Google's regulatory page `https://support.google.com/chromecast/answer/10367042` also links Australian statements for Google TV Streamer (4K), Google Nest Mini, Google Nest Wifi Pro and Nest x Yale Lock (found by the #36 audit).

Moved to M3 (D29): PDF text (needs a `package.json` dependency PR) and archive snapshots (test in `Crawl`).

Done:
- [x] M1 exit check (2026-10-21): full `npm run verify:evidence` reported "338 record(s) checked, 0 problem(s)"; 309 verified camera and doorbell records from four brands (EZVIZ 187, TP-Link 60, Ring 50, Google 12). M1 and M2 marked done in ROADMAP.md.
- [x] Status computation as in SPEC 2 (`scripts/status.mjs`), tested at the 12-month boundary and for relative rules without anchors.
- [x] Evidence verifier core as in SPEC 3 for HTML (`scripts/verify-evidence.mjs`), with offline fixture tests.
- [x] Crawler contact page `docs/CRAWLER.md` (#10).
- [x] Polite fetcher (`scripts/polite-fetch.mjs`) and the verifier CLI (`verifyDevices`), reviewed by a multi-agent workflow with 13 confirmed defects fixed (#17).
- [x] `npm run verify:evidence` wired into `package.json` and CLAUDE.md (#16).
- [x] First real verifier run in `Crawl`: both Ring seed records verified (#19).
- [x] `npm run validate` checks that quotes state each record's dates and years (#20).
- [x] Source registry format, validated by `npm run validate` (#26).
- [x] `data/sources/seed.yaml` updated with the research leads of 21 Oct 2026: Google and TP-Link URLs and kinds, the Arlo exclusion, and EZVIZ, Aqara and Reolink entries.
- [x] Verifier options `--due <days>` and `--limit <n>` select the verified records to re-verify, oldest first (#37).
- [x] Data, audited per RUNBOOKS A8: Ring 48 (#24), Google Nest 12 (#21), TP-Link Tapo 60 (#22). 120 verified records from three brands on `main`.
- [x] Google's Australian statements added to 6 Google Nest records, audited (#36).
- [x] M2 Pages workflow, Lighthouse gate and `npm run build:site` (#47). Preview live at https://sombreserotonin.github.io/Patchlife/ with noindex. M2's exit checks are met on the preview (Lighthouse 100 for performance, accessibility and SEO on the home page and a model page, in CI); M2 closes after M1.
- [x] M2 site generator (`scripts/build-site.mjs`, `site/search.js`), held for P2 and merged after three review rounds and two independent pre-merge checks (#34): 131 pages for 122 records, Lighthouse 100 in every category locally.
- [x] Ring region-date records (D33): `ring-video-doorbell-4-us` and `ring-spotlight-cam-4k-pro-au-us` (#43); missing regions added to 7 Ring records (#44); former product names from Ring's name-change article added as aliases to 14 records (#45). All audited. Not settled from Ring's own pages, so unchanged: the AU "Ring Video Doorbell" row (no generation named) and the US Battery Doorbell, Battery Doorbell Plus, Battery Doorbell Pro, Floodlight Cam Plus and Floodlight Cam Pro rows.
- [x] `node scripts/data-report.mjs` prints counts by brand, category, status and verification state, plus the oldest `checked` date; the Measures table in docs/PLAN.md cites it (#35).
- [x] Verifier reports `error (redirected to <final url>)` when the cited page redirects to another origin or path, and leaves the record unchanged (#33).
- [x] `needs-human` issues for the `Crawl` environment (#9) and the crawler contact URL (#10).

## Done: M0 (2026-10-21)
- [x] Read CLAUDE.md, `.agent/` and `docs/`; contradictions listed in the M0 PR.
- [x] CI green on the first PR (run 39556734862) and on `main` (run 39556895076). No fix needed.
- [x] M0 labels created with `gh api`: `needs-human`, `claude`, `data-correction`, `add-model`. `bug` and `needs-human-merge` already existed.
- [x] `needs-human` issues opened: H1 #2, H2 #3, H3 #4, H4 #5, H8 #6, H11 #7.
- [x] End-of-task updates (LOG, TASKS, session note).

## Human gates (the agent opens an issue; a human closes it)
- H1 Name chosen: Patchlife. Check domain and trade mark availability before buying anything. Done (#2): owner bought `patchlife.tech`; owner reports no trade mark clashes.
- H2 Connect GitHub to Claude Code (claude.ai/code onboarding) and install the Claude GitHub App on this repo. Done (#3).
- H3 Ruleset on `main`: require a pull request and the `test` status check; block force pushes and deletion. Done (#4): repo made public; ruleset `main` active, no bypass actors.
- H4 Daily build scheduled task at claude.ai/code/routines: this repo, Default environment, daily at a few minutes past the hour, prompt `Follow .agent/prompts/daily-build.md`. Done (#5): `Patchlife daily build`, 06:08 Australia/Sydney.
- H5 `Crawl` cloud environment with the Custom allowlist in ARCHITECTURE.md (done, #9), plus a nightly scheduled task with prompt `Follow .agent/prompts/data-refresh.md` (P1 is B, D27; done, #41: `Patchlife nightly data`, 01:17 Sydney). EZVIZ hosts: done, #23.
- H6 (M2) P2 is GitHub Pages (D28): Pages source set to GitHub Actions (done 21 Oct; preview live, #47). After the H9a read: verify `patchlife.tech`, set its DNS records and tick Enforce HTTPS (no account, token or secret). Steps in docs/PLAN.md M2.
- H7 (M2 launch, not M4) Google Search Console Domain property for `patchlife.tech` (DNS TXT record), then submit the sitemap. Indexing needs weeks before M4 can start.
- H8 Optional: `@claude` in issues. Run `/install-github-app` in Claude Code, or add a `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` Actions secret. Not planned (#6).
- H9 Legal, in three stages (checklists in docs/PLAN.md): H9a (#52) before the site moves to `patchlife.tech` (disclaimer next to dates, privacy policy, quote and brand use, UK GDPR); H9b before the M4 waitlist collects emails (collection notice, provider DPA, Spam Act unsubscribe, retention); H9c before charging (ABN, GST, terms and refunds, Stripe, data licence, overseas tax). Crawler contact URL done (#10).
- H10 (M5 to M7) Stripe, browser store developer accounts, email provider.
- H11 Usage: watch claude.ai/settings/usage and decide whether to allow usage credits. Done (#7): usage credits off, so runs stop when usage runs out until the window resets.
- H12 (before accepting outside contributions) A contributor licence agreement, so the owner keeps the right to relicense.
- G1 GitHub settings the agent cannot change (the proxy blocks settings writes): turn on Settings > General > Automatically delete head branches, and turn on emails about your own activity at https://github.com/settings/notifications (agents act as you, so you are not emailed about their issues and PRs otherwise).
- G2 Decisions P1 to P8 in docs/PLAN.md.
- G3 Security settings: turn on Dependabot alerts and secret scanning with push protection (Settings > Code security), and auto-renew plus two-factor sign-in at the domain registrar for `patchlife.tech`.
