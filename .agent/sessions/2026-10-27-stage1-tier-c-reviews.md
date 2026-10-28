# 2026-10-27 Stage 1: Tier C, the B2 and A2 reviews, B3 started

- Merged in order: B5 (#133), C4 (#132), C1 (#134), C2 (#136), A2 part 1 (#137). Each green on every check; squash merges under the standing approval.
- B2 (#135): reviewed the schema, rules R1 to R8, the seven profiles and the fixtures. Pushed ecdadc7 (B5's repoint test passes the valid registry) and ab01392 (R1 leaves a `none_published` record's aliases alone, with a fixture). `data-gate` needs the owner's `audited` label because the PR changes `data/sources/seed.yaml` and `data/schema/`; comment on #135 says what to read.
- B3: `Crawl` session session_015vL5JfA32UMmvCoAGtWE1S, branch `claude/b3-parsers` from `claude/b2-profiles-rules`, PR base B2's branch. After B2 merges: `git rebase --onto origin/main origin/claude/b2-profiles-rules claude/b3-parsers` and retarget the PR to `main`.
- #138: `scripts/withdraw-record.mjs` for P3's `withdraw` action; merge when green.
- Owner items now: label #135 `audited` (MIGRATION action 3); CodeQL default setup and Dependabot security updates (action 4, still off per the API, #137); Actions failure emails (action 5 of #128); paste https://patchlife.tech/feeds/ending-soon.xml into https://validator.w3.org/feed/ once (the session can't reach either host).
- Next: review B3, spawn B4 (Ring, Google, GL.iNet parsers, notes templates, changed-row proposals, 90% gate), then P3 (`data-refresh.yml`, `owner-tools.yml`, protected-paths regex, CLAUDE.md lines), A2 part 2, C5.
