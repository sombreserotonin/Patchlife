# 2026-10-21 M0 foundation

Ran the KICKOFF prompt. CI was already green on PR #1 and `main`, so no CI fix was needed. Created the missing labels and opened `needs-human` issues for H1, H2, H3, H4, H8 and H11 (#2 to #7) with exact steps checked against current Claude Code and GitHub docs.

Two findings change plans:
- H3 cannot be done as written. GitHub Free blocks rulesets and branch protection on private repos. Issue #4 gives the owner three options: go public, buy GitHub Pro, or defer.
- The Default environment blocks manufacturer sites from the shell. M1's `verify:evidence` needs network, so the `crawl` environment (H5) and the crawler contact URL (H9) are needed in M1, not M3 and launch.

Next: M1, starting with status computation (no network, no protected paths).
