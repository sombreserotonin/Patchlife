# 2026-10-27 daily build: re-verify run failed at npm test

- Found: run 40557942897 failed at `npm test` because `tests/withdraw-record.test.mjs` expected a clean `data/` tree, but the archive step had linked captures into 54 ASUS records first.
- Changed: the test compares `git status --porcelain -- data` before and after the CLI calls.
- Checked: `npm test` 301 pass with a dirtied record; `npm run validate` 0 errors.
- Open: #144 needs the owner's `audited` label (data-gate failed as designed); B2 to B4 (#135, #142, #143) wait on the owner. Tonight's archive links are lost; the rotation retries them.
