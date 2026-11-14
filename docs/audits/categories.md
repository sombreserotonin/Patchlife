# Audit categories

The categories a sweep verifies in Patchlife, and how each is covered today. A new pattern lands under an existing
category. When the text and a guard test disagree, the guard is right: it runs, the text describes.

| Category | Covered by | Enforced mechanically? |
|---|---|---|
| Merge gate integrity | `data-gate` on `pull_request_target` runs `main`'s copy of `scripts/verification-only.mjs` over the PR's commit; the owner's `audited` label is recorded as a commit status for one commit (D48); the ruleset requires `test` and `data-gate` | Yes: `tests/verification-only.test.mjs`, the ruleset |
| Bot privilege | `scripts/merge-bot.mjs` merges only `patchlife-bot`'s own `claude/reverify-*` and `claude/measures-*` PRs with green checks from this repository's own runs (D47); the App has no Workflows permission | Yes: `tests/merge-bot.test.mjs` |
| Workflow injection and token scope | inputs reach shells through `env`; least-privilege `permissions`; actions pinned to commits; the PR's tree is read, never run, under `pull_request_target` | Partly: CodeQL's `actions` queries; the rest is review |
| Log and annotation injection | text from outside is printed through D62's cleaning (`::` and `##[` broken up) | No: workflow text only |
| Record validation | `data/schema/*.json` and `scripts/validate-data.mjs`: layout, symbolic links, control and bidirectional characters, credential URLs, evidence on a registry site, size limits, rules R1 to R8 | Yes: `tests/validate-data.test.mjs` and its fixtures |
| No invented dates | DATA-POLICY "Accuracy": every date stated by a quote; the validator checks that the quote states the date and its order; parsers skip what they can't read | Partly: validator rules and parser tests |
| Output encoding on the site | the `html` tag escapes every value; links only for https addresses without credentials; JSON-LD escapes `<`, `>`, `&` and the line separators; search writes text with `textContent` | Yes: `tests/build-site.test.mjs` (the hostile record) |
| Privacy | no cookies, no third-party loads, the search sends nothing | Partly: build-site tests |
| Outbound fetching | `scripts/polite-fetch.mjs`: user agent, robots.txt, one request per second per host, timeouts; pages read only on runners or the owner's machine (D18, D50) | Yes: `tests/polite-fetch.test.mjs` |
| Status and calendar | `scripts/status.mjs` from the build date (UTC); month-only dates (D38); "at least" wording (D23, D34) | Yes: `tests/status.test.mjs`, build-site tests |
| Labels that match their predicate | status words, the watchdog's "All clear", the summary's counts | Partly: watchdog and build-site tests |
| Supply chain | lockfile, `npm ci`, `--ignore-scripts` in the gate, licence check (D9, D30), Dependabot, pinned actions | Partly: `check-licences.mjs` in CI |
| Secrets | the App's private key only in the jobs that push or merge | No: review |
| Spec and inventory drift | CONTRIBUTING's protected-path list against the gate's pattern, docs against code | No: review |
