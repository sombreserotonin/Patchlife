# 2026-10-21 M1 polite fetcher and verifier CLI

Built the networked half of SPEC 3. Run it as `node --use-env-proxy scripts/verify-evidence.mjs [id ...]`, or `npm run verify:evidence` once #16 merges.

- `scripts/polite-fetch.mjs` keeps the CRAWLER.md promises:
  - robots.txt follows RFC 9309, with the product token matched even when a line says `PatchlifeBot/0.1`.
  - At most one request per second per host, counting robots.txt, retries and every redirect hop.
  - 429 and 503 are retried up to three times. `Retry-After` is honoured in seconds or as a date. A wait over a minute stops all requests to that host for the rest of the run.
  - Only a 200 counts as the page, and each request times out after 30 seconds.
- `verifyDevices`:
  - **Quote matches:** writes `verified`, the checked date and the hash.
  - **Quote gone, or page returns 404 or 410, on a verified record:** writes `stale`.
  - **Any other failure:** leaves the file alone.
  - **Skips:** `none_published` and `disputed` records.
  - Untouched YAML stays byte-identical, using `flowCollectionPadding: false, lineWidth: 0`.
- Text extraction now drops comments and inline tags without adding spaces, decodes Latin-1 and typographic entities, and ignores invisible characters.

Review: four reviewers (robots, HTTP, verifier, hostile input), each followed by an adversarial verifier that reproduced findings in a scratch copy. 13 confirmed defects were fixed. These were judged real but not worth the code: non-UTF-8 pages, attribute values containing `>`, a body size cap, regex backtracking on robots patterns, redirects to other schemes or hosts, percent-encoded rules with lowercase hex, and raw UTF-8 in a redirect `Location`.

Not built: PDF text and archive snapshots. No official documentation for the Wayback "save" API could be found or reached from Default.

Next: the owner merges #16. Then a `Crawl` session runs the verifier on the two Ring records, then the records work starts.
