# Tasks

## Active: M3 Unattended data (target December 2026)
M1 and M2 are done (2026-10-21). The plan is `docs/PLAN.md` (M3) and the cost pivot is `docs/COSTS.md` (stages 1 and 2 fall in M3).

Rules for the daily build:
- Never start a task under **Waiting**: those need a `Crawl` session or the owner.
- When every task under **Next** is done, do housekeeping only and end the run with `WAITING: no Default task`.
- Never mark M3 done. Only the session that runs the M3 exit check may do that, and only if it passes.

Next for the daily build (`Default`), in order:
- Nothing. Do housekeeping only and end with `WAITING: no Default task`.

Waiting:
- [ ] In flight from the coordinating session on 22 Oct (`Crawl`; don't start these again, and finish a pushed branch if its session stopped):
  - Ring accessories audit: #90 was merged before its A8 audit finished; the auditor checks `main` and opens `claude/fix-ring-accessories` if anything is wrong;
  - EZVIZ EOL list, remaining rows: `claude/data-ezviz-eol-rest`, then an A8 audit;
  - TP-Link AU smart home (plugs, bulbs, switches, hubs): `claude/data-tp-link-au-smart-home`, then an A8 audit.
- [ ] Archive snapshots (D29): the `Crawl` network refuses archive.org (proxy 403) and drops web.archive.org before TLS (test session, 22 Oct), so the "allowlisted" note was wrong. Options: the owner adds both hosts to the `Crawl` allowlist, or snapshots are requested from GitHub Actions, whose runners reach archive.org.
- [ ] Coverage for M4 (the nightly task, one source a night): at least 40 verified small-office records (routers, printers, NVRs). GL.iNet gave routers (#49); next in the registry are Kyocera, ASUS, GoPro, Lenovo, Motorola, NETGEAR, Samsung and Grandstream.
- [ ] M3 exit check (a `Crawl` session, after the tasks above): three consecutive nightly runs each end in a correct PR or a correct "nothing to do", and a deliberately broken fixture source is caught and flagged.

Leads from `scripts/unquoted-dates.mjs` (22 Oct, need `Crawl`): rows already on cited pages that no record covers (trial run: all 19 pages read, no errors). TP-Link's AU compliance page has 797 dates, nearly all non-Tapo products (routers, switches, access points: the largest small-office source we already cite); the EZVIZ EOL list has 119, including NVRs, routers and network switches that count toward M4's 40 small-office records; Google's Nest table (`answer/10231940`) has about 40 non-camera devices (hubs, Wifi, Chromecast, thermostats, speakers); Ring's `ri2p1` pages list chimes, alarm sensors, intercoms and lighting. Run the script on a page to list them. Other leads (need `Crawl`): Google's regulatory page `https://support.google.com/chromecast/answer/10367042` also links Australian statements for Google TV Streamer (4K), Google Nest Mini, Google Nest Wifi Pro and Nest x Yale Lock (#36 audit). TP-Link's TC and TD rows (PLAN M3). Ring renames not settled by Ring's pages (#44, #45).

Done:
- [x] Coverage, 22 Oct: #86 (TP-Link routers and Deco, 60), #88 (EZVIZ NVRs, networking, gateways, locks, sensors, 60), #89 (TP-Link access points and switches, 60), #90 (Ring accessories, 48) and #91 (Google Nest table devices, 27), each audited by a separate `Crawl` session except #90 (audit running after merge). 595 verified records; M4's "150 or more" and "40 small-office" conditions are met.
- [x] COSTS stage 1, re-verification on GitHub Actions (D42): the owner merged #80 on 22 Oct; a manual run (39702142924) passed every step and ended "Nothing to push", since nothing is due until 21 Dec 2026. The daily build now opens and merges `claude/reverify-*` branches, and the nightly task re-checks what Actions couldn't.
- [x] `npm run validate` checks `data/sources/page-hashes.json`: a sorted JSON object of https URL to SHA-256 hex, so a broken merge fails at the PR, not in the nightly run.
- [x] Re-verification gate `scripts/verification-only.mjs` and RUNBOOKS A9 (#78); PDF evidence read in reading order (#79).
- [x] `Probe hosts` run 39695382968 (21 Oct): all six evidence hosts allow PatchlifeBot and answer a GitHub runner with HTTP 200 (COSTS).
- [x] Search Console (H7, #77): the owner verified the Domain property and submitted `https://patchlife.tech/sitemap.xml` (22 Oct). The M4 check "at least 70% of sitemap URLs indexed" counts from here.
- [x] COSTS stage 2, first part: `scripts/unquoted-dates.mjs` lists dates on cited pages that no record quotes (#83); RUNBOOKS A2 and the nightly task start a revisit with it (#84).
- [x] PDF evidence (D29): the fetcher returns PDF bytes and the verifier reads the text with unpdf 1.8.1 (#73), rebuilt line by line in reading order so table rows pair correctly; a PDF with no text fails with `no text in PDF`. Next: the PDF-only sources (Aqara, Reolink, TP-Link UK, GoPro) through the nightly task.
- [x] The site is live at https://patchlife.tech from the root, indexed, with a sitemap (#67, 21 Oct). Privacy page live (#69), with the Cloudflare wording the owner chose in #68 (option C: keep the proxy and Web Analytics, disclose both; D41). Lighthouse gates on the median of three runs (#75). The skill stores month-only dates (#72). The `Probe hosts` workflow is merged (#66).
- [x] Month-only dates (D38): `end_date` may be `YYYY-MM` on a `fixed_date` record. `npm run validate` requires a quote stating the month and year and rejects one that states a day in it; status counts the month's last day for ended and its first day for ending soon; the site shows "June 2027" and "ended in June 2026". The `add-device-record` skill still says to skip month-only dates until its protected PR merges.
- [x] H9a draft markers removed (#62); numeric dates read in each source's `date_order`, and a quote must name the model, with names unique per brand except D33 splits (#64); one hash per evidence URL and a per-page change report (#63); `scripts/probe-hosts.mjs` (#65). Merged 21 Oct after a combined local merge: validate 340 records, 0 errors; test 165 of 165.
- [x] Velica GL-B2200 (D39): UK and global records, one per stated scope (#61).
- [x] `patchlife.tech` DNS steps done by the owner (#57): the domain serves through GitHub Pages, behind Cloudflare.
- [x] EZVIZ, the fourth brand: 193 records (168 camera, 19 doorbell, 4 other, 2 smart-lock) from EZVIZ's EOL list, with its "expected" and "subject to change" wording as conditions, audited twice (#51).
- [x] GL.iNet: 23 router and hub records from the nightly task's first run, audited (#49); Velica left out for a decision.
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
- H6 (M2) P2 is GitHub Pages (D28): Pages source set to GitHub Actions (done 21 Oct; preview live, #47). Custom domain `patchlife.tech` set up by the owner (done 21 Oct, #57); the build switch is #67.
- H7 (M2 launch, not M4; done 22 Oct, #77) Google Search Console Domain property for `patchlife.tech` (DNS TXT record), then submit the sitemap. Indexing needs weeks before M4 can start.
- H8 Optional: `@claude` in issues. Run `/install-github-app` in Claude Code, or add a `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` Actions secret. Not planned (#6).
- H9 Legal, in three stages (checklists in docs/PLAN.md): H9a (done 21 Oct 2026, #52, all items approved) before the site moves to `patchlife.tech` (disclaimer next to dates, privacy policy, quote and brand use, UK GDPR); H9b before the M4 waitlist collects emails (collection notice, provider DPA, Spam Act unsubscribe, retention); H9c before charging (ABN, GST, terms and refunds, Stripe, data licence, overseas tax). Crawler contact URL done (#10).
- H10 (M5 to M7) Stripe, browser store developer accounts, email provider.
- H11 Usage: watch claude.ai/settings/usage and decide whether to allow usage credits. Done (#7): usage credits off, so runs stop when usage runs out until the window resets.
- H12 (before accepting outside contributions) A contributor licence agreement, so the owner keeps the right to relicense.
- G1 Done 21 Oct 2026 (owner; auto-delete of head branches confirmed by the API). GitHub settings the agent cannot change (the proxy blocks settings writes): turn on Settings > General > Automatically delete head branches, and turn on emails about your own activity at https://github.com/settings/notifications (agents act as you, so you are not emailed about their issues and PRs otherwise).
- G2 Decisions P1 to P8 in docs/PLAN.md.
- G3 Done 21 Oct 2026 (owner; secret scanning and push protection confirmed by the API, Dependabot alerts not visible to the agent). Security settings: turn on Dependabot alerts and secret scanning with push protection (Settings > Code security), and auto-renew plus two-factor sign-in at the domain registrar for `patchlife.tech`.
