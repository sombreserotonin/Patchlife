# 2026-10-21 M1 exit check

Session started by the coordinating session, in `Crawl`, branch `claude/m1-exit-check` from `main` at 6b2da74.

- `npm run validate`: 338 record(s) and 16 source(s) checked, 0 error(s).
- `npm test`: 137 tests, 137 pass.
- `npm run verify:evidence` (full, no ids or options): 338 record(s) checked, 0 problem(s). Every record printed `verified`. Changes: `text_sha256` only, on 21 GL.iNet and 12 Google records (page text changed, quotes still present). No date or quote edited.
- Verified camera and doorbell records by brand: EZVIZ 187 (168 cameras, 19 doorbells), TP-Link 60 (57, 3), Ring 50 (28, 22), Google 12 (8, 4). Total 309 from four brands. Not counted: 29 other verified records (GL.iNet 23, EZVIZ 6).
- Result: M1 exit holds. M1 and M2 marked done in ROADMAP.md; TASKS.md says M3 is next. The coordinating session writes the M3 tasks.
- Left for the coordinating session: the TASKS.md Waiting items for EZVIZ (#51) and GL.iNet (#49) look already done on `main`; not changed here.
