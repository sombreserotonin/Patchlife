# 2026-10-21 Verifier redirect check

Subagent of the coordinating session, in a worktree. PR #33 on `claude/verifier-redirect-check`.

- `verifyDevices` compares the cited URL with the final URL the polite fetcher returns. A different origin, or a different path apart from one trailing slash, gives `error (redirected to <final url>)` before the content type check, so the quote is never read from a homepage or another page. Query string and fragment are ignored. An error never writes, so a verified record stays verified until a `Crawl` session follows A4.
- RUNBOOKS A1 has the new row.
- Open question for the first `Crawl` run after merge: do any cited URLs redirect across hosts or locales (Ring's unlocalised URL is cited by 34 records)? If so, re-cite them per A4.
