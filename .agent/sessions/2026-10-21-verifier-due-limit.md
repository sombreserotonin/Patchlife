# 2026-10-21 Verifier --due and --limit

Subagent of the coordinating session, in a worktree. PR #37 on `claude/verifier-due-limit`, branched from `main` independently of #33.

- `selectRecords(records, { ids, due, limit, today })` is pure and exported. `verifyDevices` reads every record, then checks only the selected ids, in file order. Ids, `--due` and `--limit` each narrow the set, in that order. "More than N days" is strict, so a record checked exactly N days ago is not due, matching PLAN's "checked more than 60 days ago".
- After review, `--due` and `--limit` choose only `verified` records (and never `none_published`). Unverified, stale and disputed records need A4 or A5 repair, not a nightly re-check, and with an empty or old `checked` they would otherwise take every slot.
- A verified record whose fetch keeps erroring keeps its old `checked`, so it stays at the front; RUNBOOKS A1 says to follow A4 or A5 after repeated errors.
- The unknown-id check looks at all records, so a named id that isn't due isn't reported as unknown, and ids are deduplicated so an unknown id is reported once, as before.
- CLI: a `parseArgs` error or a bad value prints one line and exits 2; values are capped at five digits so a huge `--due` can't make `Date` throw.
- Follow-up for the protected `data-refresh.md` prompt (#29): `npm run verify:evidence -- --due 60 --limit 40`, matching PLAN and ROADMAP M3 (DATA-POLICY wants a re-verify at least every 90 days).
