# 2026-10-22 Archive links on GitHub's runners (D43)

- `Crawl` can't reach archive.org, so archiving runs on Actions. Experiments used the read-only `Probe hosts` workflow on `claude/archive-probe` (never merge; agents can't delete branches).
- Save Page Now, anonymous, from a runner: `GET https://web.archive.org/save/<url>` returns 302 to `/web/<14 digits>/<url>` after about 45 s (`x-location: save-sync`). The capture is in the CDX index and replayable at once. `/web/<ts>id_/<url>` serves the raw page.
- web.archive.org/robots.txt is 404 (all allowed); archive.org disallows only /control/ and /report/.
- `scripts/archive-evidence.mjs` links an item only when the raw capture holds its quote; `isCaptureOf` (validate-data) checks the link shape. 937 of 937 items on three live pages linked.
- Waiting on the owner: the protected PR with the nightly step (`--limit 5`, `continue-on-error`), the gate change in `verification-only.mjs` (fills of empty links count as verification) and CLAUDE.md's merge-rule wording. The daily-build prompt still looks for `Only verification changed`, which the gate keeps printing.
