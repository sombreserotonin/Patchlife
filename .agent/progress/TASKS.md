# Tasks

## Active: M1
The plan and the reasons for this order are in `docs/PLAN.md`. Data tasks need a `Crawl` session (D17), which only the owner or a coordinating session can start until decision P1 is made, so they are marked waiting.

Rules for the daily build:
- Never start a task under **Waiting**: those need a `Crawl` session or the owner.
- When every task under **Next** is done, do housekeeping only and end the run with `WAITING: no Default task; waiting on #23 and a Crawl session`.
- Never mark M1 done or write M2 tasks. Only the `Crawl` session that runs the M1 exit check may do that, and only if it passes.

Next for the daily build (`Default`), in order:
- [ ] Verifier: when the final URL after redirects has a different origin or path from the cited URL, report `error (redirected to <final url>)` instead of checking the quote, so a homepage redirect is not read as "quote not found". Ignore a trailing slash and any change to the query string. Test both cases with the fake fetcher in `tests/verify-evidence.test.mjs`, and add the outcome to the RUNBOOKS A1 table.
- [ ] Update `data/sources/seed.yaml` with the research leads from 21 Oct 2026 (leads, not evidence):
  - Google: add `https://support.google.com/product-documentation/answer/10231940?hl=en` (the URL the Google records cite) and change the entry's kind to `per_model_dates`.
  - TP-Link: add `https://www.tp-link.com/au/landing/au-cyber-compliance/` to the existing entry and change its kind to `per_model_dates`. In its note, say the UK pages give 3 years after end of life, with the UK per-model periods only in a PDF.
  - Arlo: in its note, say kb.arlo.com's robots.txt disallows all bots and www.arlo.com serves a bot challenge (D18), so it can't be used.
  - EZVIZ: add an entry for `https://support.ezviz.com/faq/article/EZVIZ-EOL-Product-List` (kind `eol_list`; hosts waiting on #23).
  - Aqara and Reolink: add entries for `https://www.aqara.com/en/security-certifications/` and `https://reolink.com/product-compliance-psti/` (kind `unknown`, note "PDF only; hosts not allowlisted").
- [ ] Verifier: add `--due <days>` and `--limit <n>` options that select records whose `checked` is empty or older than that many days, oldest first, with tests. This is for the nightly re-verify.

Waiting:
- [ ] Google Nest Australian statements of compliance for 6 of the merged models, linked from `https://support.google.com/chromecast/answer/10367042`, per RUNBOOKS A2 with region `AU` and model-number aliases, then an A8 audit (found by the #21 audit; needs a `Crawl` session).
- [ ] EZVIZ camera records per RUNBOOKS A2, then an A8 audit by a second session: the fourth brand (waiting on #23, then the owner starting `Crawl` sessions, O1).
- [ ] M1 exit check (waiting on the EZVIZ task, then a `Crawl` session): run a full `npm run verify:evidence`. Mark M1 done in ROADMAP.md and write the M2 tasks only if at least 50 records are `verified` across at least four brands. With fewer brands, leave M1 open and say why in the PR.

Moved to M3 if decision P3 is approved: PDF text (needs a `package.json` dependency PR) and archive snapshots (test in `Crawl`).

Done:
- [x] Status computation as in SPEC 2 (`scripts/status.mjs`), tested at the 12-month boundary and for relative rules without anchors.
- [x] Evidence verifier core as in SPEC 3 for HTML (`scripts/verify-evidence.mjs`), with offline fixture tests.
- [x] Crawler contact page `docs/CRAWLER.md` (#10).
- [x] Polite fetcher (`scripts/polite-fetch.mjs`) and the verifier CLI (`verifyDevices`), reviewed by a multi-agent workflow with 13 confirmed defects fixed (#17).
- [x] `npm run verify:evidence` wired into `package.json` and CLAUDE.md (#16).
- [x] First real verifier run in `Crawl`: both Ring seed records verified (#19).
- [x] `npm run validate` checks that quotes state each record's dates and years (#20).
- [x] Source registry format, validated by `npm run validate` (#26).
- [x] Data, audited per RUNBOOKS A8: Ring 48 (#24), Google Nest 12 (#21), TP-Link Tapo 60 (#22). 120 verified records from three brands on `main`.
- [x] `node scripts/data-report.mjs` prints counts by brand, category, status and verification state, plus the oldest `checked` date; the Measures table in docs/PLAN.md cites it.
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
- H5 `Crawl` cloud environment with the Custom allowlist in ARCHITECTURE.md (done, #9), plus a nightly scheduled task with prompt `Follow .agent/prompts/data-refresh.md` (decision P1 in docs/PLAN.md; steps in RUNBOOKS O6). EZVIZ hosts: #23.
- H6 (M2) If decision P2 is GitHub Pages: set Settings > Pages > Source to GitHub Actions, then verify `patchlife.tech`, set its DNS records and tick Enforce HTTPS (no account, token or secret). Steps in docs/PLAN.md M2.
- H7 (M2 launch, not M4) Google Search Console Domain property for `patchlife.tech` (DNS TXT record), then submit the sitemap. Indexing needs weeks before M4 can start.
- H8 Optional: `@claude` in issues. Run `/install-github-app` in Claude Code, or add a `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` Actions secret. Not planned (#6).
- H9 Legal, in three stages (checklists in docs/PLAN.md): H9a before the site moves to `patchlife.tech` (disclaimer next to dates, privacy policy, quote and brand use, UK GDPR); H9b before the M4 waitlist collects emails (collection notice, provider DPA, Spam Act unsubscribe, retention); H9c before charging (ABN, GST, terms and refunds, Stripe, data licence, overseas tax). Crawler contact URL done (#10).
- H10 (M5 to M7) Stripe, browser store developer accounts, email provider.
- H11 Usage: watch claude.ai/settings/usage and decide whether to allow usage credits. Done (#7): usage credits off, so runs stop when usage runs out until the window resets.
- H12 (before accepting outside contributions) A contributor licence agreement, so the owner keeps the right to relicense.
- G1 GitHub settings the agent cannot change (the proxy blocks settings writes): turn on Settings > General > Automatically delete head branches, and turn on emails about your own activity at https://github.com/settings/notifications (agents act as you, so you are not emailed about their issues and PRs otherwise).
- G2 Decisions P1 to P8 in docs/PLAN.md.
- G3 Security settings: turn on Dependabot alerts and secret scanning with push protection (Settings > Code security), and auto-renew plus two-factor sign-in at the domain registrar for `patchlife.tech`.
