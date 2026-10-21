# Tasks

## Active: M0
- [ ] Read CLAUDE.md, `.agent/` and `docs/`; list any contradictions in the PR.
- [ ] Confirm CI is green on the first PR; fix it if not (CI files are protected, so that PR needs a human merge).
- [ ] Create the M0 labels with `gh api` (REST).
- [ ] Open `needs-human` issues for H1 to H4, H8 and H11 with exact steps. Open the rest when their milestone starts.
- [ ] End-of-task updates (LOG, TASKS, session note).

## Human gates (the agent opens an issue; a human closes it)
- H1 Name chosen: Patchlife. Check domain and trade mark availability before buying anything.
- H2 Connect GitHub to Claude Code (claude.ai/code onboarding) and install the Claude GitHub App on this repo.
- H3 Ruleset on `main`: require a pull request and the `test` status check; block force pushes and deletion.
- H4 Daily build scheduled task at claude.ai/code/routines: this repo, Default environment, daily at a few minutes past the hour, prompt `Follow .agent/prompts/daily-build.md`.
- H5 (M3) `crawl` cloud environment with the Custom allowlist in ARCHITECTURE.md, plus a nightly scheduled task with prompt `Follow .agent/prompts/data-refresh.md`.
- H6 (M2) Hosting account and a deploy token as an Actions secret.
- H7 (M2) Google Search Console for the site.
- H8 Optional: `@claude` in issues. Run `/install-github-app` in Claude Code, or add a `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` Actions secret.
- H9 (before launch) Legal read of the disclaimer, privacy policy and licence choice; crawler contact URL.
- H10 (M5 to M7) Stripe, browser store developer accounts, email provider.
- H11 Usage: watch claude.ai/settings/usage and decide whether to allow usage credits.
- H12 (before accepting outside contributions) A contributor licence agreement, so the owner keeps the right to relicense.
