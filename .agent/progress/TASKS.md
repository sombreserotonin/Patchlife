# Tasks

## Active: M1
The plan and the reasons for this order are in `docs/PLAN.md`. Data tasks need a `Crawl` session (D17), which only the owner or a coordinating session can start until decision P1 is made, so they are marked waiting.

Next for the daily build (`Default`), in order:
- [ ] Verifier: when the final URL after redirects is a different page from the cited URL, report `error (redirected to <final url>)` instead of checking the quote, so a homepage redirect or soft 404 is not read as "quote not found". Test it with the fake fetcher in `tests/verify-evidence.test.mjs`.
- [ ] Update `data/sources/seed.yaml` with the research leads from 21 Oct 2026 (leads, not evidence):
  - Google: add `https://support.google.com/product-documentation/answer/10231940?hl=en-GB` (per-model Nest table, kind `per_model_dates`).
  - TP-Link: add `https://www.tp-link.com/au/landing/au-cyber-compliance/` (Australian statement, per-model dates). Note that the UK per-model periods are only in a PDF.
  - Arlo: note that kb.arlo.com's robots.txt disallows all bots and www.arlo.com serves a bot challenge (D18), so it can't be used.
  - EZVIZ: add `https://support.ezviz.com/faq/article/EZVIZ-EOL-Product-List` (kind `eol_list`, hosts waiting on #23).
  - Aqara, Reolink: add `https://www.aqara.com/en/security-certifications/` and `https://reolink.com/product-compliance-psti/` (PDF statements; hosts not allowlisted).

Waiting:
- [ ] Audit and merge the data PRs #24 (Ring, 46), #21 (Google, 12) and #22 (TP-Link, 58) per RUNBOOKS A8 (waiting on the coordinating session of 21 Oct 2026).
- [ ] EZVIZ camera records per RUNBOOKS A2, the fourth brand (waiting on #23, then a `Crawl` session, RUNBOOKS O1).
- [ ] M1 exit check: a full `npm run verify:evidence` in a `Crawl` session; then mark M1 done in ROADMAP.md and write the M2 tasks here (waiting on a `Crawl` session).

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
- H9 Legal, in three stages (checklists in docs/PLAN.md): H9a before the site moves to `patchlife.tech` (disclaimer next to dates, privacy policy, quote and brand use, UK GDPR); H9b before the M4 waitlist collects emails (collection notice, provider DPA, Spam Act unsubscribe, retention); H9c before charging (ABN, GST, terms, Stripe, data licence). Crawler contact URL done (#10).
- H10 (M5 to M7) Stripe, browser store developer accounts, email provider.
- H11 Usage: watch claude.ai/settings/usage and decide whether to allow usage credits. Done (#7): usage credits off, so runs stop when usage runs out until the window resets.
- H12 (before accepting outside contributions) A contributor licence agreement, so the owner keeps the right to relicense.
- G1 GitHub settings the agent cannot change (the proxy blocks settings writes): turn on Settings > General > Automatically delete head branches, and turn on emails about your own activity at https://github.com/settings/notifications (agents act as you, so you are not emailed about their issues and PRs otherwise).
- G2 Decisions P1 to P8 in docs/PLAN.md.
