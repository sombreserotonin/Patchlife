# 2026-11-12 nightly data: TP-Link AU batch (cameras and one switch)

- Task: `.agent/prompts/data-refresh.md`. No open `claude/data-` PR failing or conflicted; re-verify run 43090834795 (11 Nov) green with no "Records not checked" annotation; 0 stale records.
- Source queue: NETGEAR (#152) and Samsung (#176) wait on the owner; Arlo, GoPro, Lenovo, Motorola, Grandstream, Aqara and Reolink are recorded as unusable; EZVIZ, Kyocera, ASUS, Ring and GL.iNet sit in open revisit PRs (#173, #181, #183, #185, #188). Next: TP-Link (`last_checked` 30 Oct).
- `unquoted-dates.mjs`: AU page 572 unquoted dates, UK PSTI 0, UK FAQ 3562 446 (end-of-life dates, not support ends, as on 30 Oct).
- `candidates.mjs --check tp-link`: 905 rows, 277 of 279 records reproduced plus 2 parser exceptions, 0 fields differ, 36 new rows, 509 skipped (482 product lines with no `category_map` entry, mostly Deco mesh systems and business lines; 27 rows without a hardware version). Wrote the 36 with `candidates.mjs --limit 60 tp-link`: 35 cameras (Tapo and TC, KIT and pack variants as the page lists them, like the Deco pack records already on `main`) and 1 switch (TL-SG105E V5). All 36 `verified`; validate 885 records, 0 errors; 354 tests pass.
- The remaining 482 rows need `category_map` entries for their product lines in `data/sources/seed.yaml` (protected): a profile change for the owner's PR, not a nightly one.
- No LOG.md line on the branch (D55): the PR waits on the owner for `audited` and touches `seed.yaml`.
