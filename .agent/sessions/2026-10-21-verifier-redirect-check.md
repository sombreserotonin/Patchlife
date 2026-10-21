# 2026-10-21 Verifier redirect check

Subagent of the coordinating session, in a worktree. PR #33 on `claude/verifier-redirect-check`.

- `verifyDevices` compares the cited URL with the final URL the polite fetcher returns. A different origin (scheme, host or port), or a different path apart from one trailing slash on either side, gives `error (redirected to <final url>)` before the content type check, so the quote is never read from a homepage or another page. Query string and fragment are ignored. An error never writes, so a verified record stays verified until a `Crawl` session follows A4.
- After review: the polite fetcher attaches the final `url` to HTTP errors (message unchanged). An HTTP error whose final URL is another page gives `error (redirected to <url>, HTTP <status>)`, so only a 404 or 410 at the cited page itself marks a record stale. This applies to every status, not only 404 and 410, because the cited page has moved whatever the new page returns.
- RUNBOOKS: A1 has the redirect row, and its robots rows say a robots.txt error on a different origin from the cited URL means the page redirected there (A4 first). A2 step 3 says the first output line is the final URL and to cite it if it differs.
- Open question for the first `Crawl` run after merge: do any cited URLs redirect across hosts or locales (Ring's unlocalised URL is cited by 34 records)? If so, re-cite them per A4. TP-Link's cited URL ends in a slash (120 citations), which the reverse trailing-slash test now covers.
