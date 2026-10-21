# 2026-10-21 Verifier --due and --limit

Subagent of the coordinating session, in a worktree. PR #37 on `claude/verifier-due-limit`, branched from `main` independently of #33.

- `selectRecords(records, { ids, due, limit, today })` is pure and exported; `verifyDevices` reads every record, then checks only the selected ids. Ids, `--due` and `--limit` each narrow the set, in that order. "More than N days" is strict, so a record checked exactly N days ago is not due, matching PLAN's "checked more than 60 days ago".
- With `--due` or `--limit`, `none_published` and `disputed` records are left out, because their empty `checked` would otherwise sort first and use up the limit.
- The unknown-id check now looks at all records, so a named id that isn't due isn't reported as unknown.
- Open: `checked` changes only on `verified`, so records that keep failing stay first and could take every slot of a small limit. Not a problem while all 120 records are verified. The protected `data-refresh.md` prompt could use `--due 90` in a follow-up.
