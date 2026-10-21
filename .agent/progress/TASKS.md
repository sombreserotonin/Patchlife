# Tasks

## Active: M1
- [x] Status computation as in SPEC 2 (`scripts/status.mjs`), tested at the 12-month boundary and for relative rules without anchors.
- [x] Evidence verifier core as in SPEC 3 for HTML (`scripts/verify-evidence.mjs`: text extraction, normalise, match, hash), with offline fixture tests.
- [x] Crawler contact page `docs/CRAWLER.md` (owner chose option A in #10). Contact URL: `https://github.com/sombreserotonin/Patchlife/blob/main/docs/CRAWLER.md`.
- [ ] Verifier remainder: fetch with the `PatchlifeBot/0.1` user agent and the contact URL above, PDF to text (needs a dependency, so a `package.json` PR with a human merge), archive snapshot, CLI that writes `verification` back to the YAML. Real fetches run only in the `Crawl` environment (D12); the daily build runs in Default, so build and test offline there.
- [ ] Wire `npm run verify:evidence` into `package.json` and CLAUDE.md. Protected paths: its own PR, human merge.
- [x] Open `needs-human` issues for the network the verifier needs: the `crawl` environment (H5, pulled forward from M3) #9 and the crawler contact URL (from H9) #10. Cloud sessions in the Default environment cannot reach manufacturer sites from the shell.
- [ ] Formalise the source registry format in `data/sources/*.yaml` and validate it.
- [ ] 50 verified camera and doorbell records from at least four brands, starting from `data/sources/seed.yaml`.

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
- H5 (M3) `crawl` cloud environment with the Custom allowlist in ARCHITECTURE.md, plus a nightly scheduled task with prompt `Follow .agent/prompts/data-refresh.md`. Environment done (#9, named `Crawl`); the nightly task waits for M3.
- H6 (M2) Hosting account and a deploy token as an Actions secret.
- H7 (M2) Google Search Console for the site.
- H8 Optional: `@claude` in issues. Run `/install-github-app` in Claude Code, or add a `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` Actions secret. Not planned (#6).
- H9 (before launch) Legal read of the disclaimer, privacy policy and licence choice; crawler contact URL. Contact URL done (#10): a page in this repo. The legal read is still open.
- H10 (M5 to M7) Stripe, browser store developer accounts, email provider.
- H11 Usage: watch claude.ai/settings/usage and decide whether to allow usage credits. Done (#7): usage credits off, so runs stop when usage runs out until the window resets.
- H12 (before accepting outside contributions) A contributor licence agreement, so the owner keeps the right to relicense.
