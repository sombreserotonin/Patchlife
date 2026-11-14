# Verified security sweep: record-writers, 2026-11-14

## Context
Scope: `scripts/candidates.mjs`, `scripts/table-rows.mjs` and the parsers:
- `scripts/parsers/common.mjs`
- `scripts/parsers/asus.mjs`
- `scripts/parsers/ezviz-eol.mjs`
- `scripts/parsers/gl-inet.mjs`
- `scripts/parsers/google.mjs`
- `scripts/parsers/grandstream.mjs`
- `scripts/parsers/kyocera.mjs`
- `scripts/parsers/ring.mjs`
- `scripts/parsers/tp-link-au.mjs`

Trigger: the owner's request of 14 Nov 2026 to audit the whole codebase. This is the first sweep of the zone recorded in `docs/audits/`.

Commit read: e484c80.

## Delegation
One fresh reviewer read the zone: a general-purpose agent, read-only, with no network. It used the shared brief described in `docs/audits/2026-11-14-merge-gate.md` and ran in the second wave, beside `fetchers` and `ops-scripts`.

I verified every finding on its cited lines and re-ran the reviewer's reproductions. All seven failed as described.

A second fresh reviewer checked #225 before merge, asking only what the fix broke. Its verdict was RISK, low.
- No legitimate case got worse.
- On all 1,322 real records and every fixture, the run gives the same result as `main`:
  - 1,318 records carry the id and model their parser derives, and the other 4 are parser exceptions;
  - with every year moved on by one, both trees rewrite the same 1,296 records, byte for byte.

It raised four points, all fixed before the merge:
- `stripHidden` hid the rest of a page after `<!-->` or a custom element such as `<template-row>`;
- the ASUS check was a substring test ("1th December" inside "31th December");
- renamed and exception rows got a misleading flag;
- two of the new checks were half-tested.

While #225 was in review, CodeQL flagged the first form of `stripHidden`: the same multi-character sanitisation rule the owner dismissed on `htmlToText`, now reported at a new place. In response:
- `htmlToText` went back to its exact form on `main`, so every page's text and hash are unchanged;
- `stripHidden`, which only the parsers use, became a single left-to-right scan.

## Verification
| Finding | Zone | Verdict | Claimed | Verified | Reservations | Proof |
|---|---|---|---|---|---|---|
| F1 a changed-row proposal is written without the page check a new row gets | record-writers | VERIFIED REAL | Medium | Medium | the owner's review and the verifier's "failed" line were the remaining control | `tests/candidates.test.mjs` "a changed row whose parser quotes are no longer on the page fails the gate, as a new row does, and nothing is written", ran, fails as expected on e484c80, passes after #225 |
| F2 a rename is written keeping the old model and id, which the next week's gate refuses | record-writers | VERIFIED REAL | Medium | Medium | | `tests/candidates.test.mjs` "a row that names a record under another model is left to a person, so no write fails the next run's gate", ran, fails as expected, passes after #225 |
| F3 the row reader reads rows inside comments and script or template content, which the verifier strips | record-writers | VERIFIED REAL | Medium | Medium | | `tests/candidates.test.mjs` "a row in an HTML comment or a script is not read, as the verifier does not read it, so it fails no run", ran, fails as expected, passes after #225 |
| F4 the ASUS note always says the page writes "31th December <year>" | record-writers | VERIFIED REAL | Medium | Low | every one of the 56 ASUS rows today is that form, so no published note is wrong yet | `tests/parsers.test.mjs` "ASUS: a row that writes another day or month than the profile's note describes is skipped, not given that note", ran, fails as expected, passes after #225 |
| F5 Grandstream accepts "2027-6-30", which the validator cannot find in the quote, so one row undoes every brand's run | record-writers | VERIFIED REAL | Medium | Medium | | `tests/parsers.test.mjs` "Grandstream: only the date forms the validator finds in a quote are read", ran, fails as expected, passes after #225 |
| L1 a parser exception kept only for its notes silences later conflict flags for its model | record-writers | VERIFIED REAL | Low | Low | | `tests/candidates.test.mjs` "a later row with another date is flagged even for a model whose record is an exception for its notes alone", ran, fails on `main` before #234, passes after it |
| L2 a rewrite can drop a region, and the PR's change table does not show regions | record-writers | VERIFIED REAL | Low | Low | | `tests/candidates.test.mjs` "a rewrite that drops a region the record had is flagged for a person", ran, fails on `main` before #234, passes after it |
| L4 the row expression is quadratic on unclosed rows | record-writers | VERIFIED REAL | Low | Low | only a hostile page; it turns a fast failure into a slow one | `tests/table-rows.test.mjs` "a page of unclosed rows, cells or footnotes is read in linear time", ran, fails on `main` before #234 (28 s for unclosed rows), passes after it |
| C1 a parser swaps day and month, or reads a two-digit year | record-writers | FALSE POSITIVE | - | - | lens: claim correctness | see the refused section |
| C2 a date is taken from another cell, or a range or trailing text is read as a date | record-writers | FALSE POSITIVE | - | - | lens: existing mitigation | see the refused section |
| C3 a write leaves `data/devices/<brand>/` or overwrites another brand's record | record-writers | FALSE POSITIVE | - | - | lens: claim correctness | see the refused section |
| C4 the YAML a parser writes reads back as something else | record-writers | FALSE POSITIVE | - | - | lens: existing mitigation | see the refused section |

## Confirmed defects

### F1, `scripts/candidates.mjs:129`, gate integrity
1. A changed-row proposal was queued without checking that the candidate's quotes are on the page; line 166 makes that check for new rows only.
2. The parsers' fixed sentences, and a cell read without its `<sup>` marker, went into the rewritten record.
3. Nothing downstream stopped it: the validator does not read pages, the workflow accepts the verifier's exit 1, and the nightly run picks only verified records.

Scenario: Kyocera deletes its "no reduction" sentence, and all 41 Kyocera records are rewritten as "at least" on a sentence the page no longer has.

Fix (#225): a replacement, or a notes-only proposal, must have every quote on its page; otherwise it is `unquotable` and the gate fails, as for a new row.

### F2, `scripts/candidates.mjs:124`, gate integrity
`naming()` took any candidate sharing the record's id or a name, and `rewritten()` kept the old model and id. GL.iNet renaming "Velox (GL-Z200)" made a record the next run refused on `model`, stopping every brand.

Fix (#225): only a candidate with the record's own id and model replaces it. A renamed row becomes one flag for a person that names the new model and id. A parser exception keeps its flag from `main`.

### F3, `scripts/table-rows.mjs:32`, input validation
Rows were split on the raw page, comments and script content included, while `htmlToText` strips both. One commented-out row stopped every brand's refresh.

Fix (#225): `candidates.mjs` gives the parsers each page through `stripHidden` (`scripts/verify-evidence.mjs`), a single left-to-right scan.
- It removes comments and script, style, noscript and template elements.
- As in a browser, an unclosed one runs to the end of the page.
- `<!-->`, `<!--->` and custom elements such as `<template-row>` hide nothing.
- Every fixture page reads the same through it.

### F4, `scripts/parsers/asus.mjs:57`, published data
The note filled in only the year. Fix (#225): a row whose date does not stand whole in the profile's note is skipped, with the reason. All 56 ASUS records still parse.

### F5, `scripts/parsers/grandstream.mjs:22`, legitimate path blocked
Fix (#225): only `YYYY-MM-DD` and `YYYY/M/D` are read. All 80 Grandstream records use one of the two.

### L1, L2, L4: fixed in #234
Fixed on the owner's instruction of 14 Nov 2026 to settle the open items.
- **L1, `scripts/candidates.mjs:88`:** `exceptionModels` dropped every conflict flag for a model with any exception record, and five of Ring's nine exceptions are kept for notes, not splits. A conflict flag now carries each page's row (`sides`). Every row each page gives the model is a side. The flag is dropped only when exception records quote every side, as the recorded splits do: Video Doorbell 4, Spotlight Cam 4K Pro, Velica (GL-B2200), and Beryl (GL-MT1300), whose one record quotes both pages' rows.
- **L2, `scripts/candidates.mjs:238`:** `row()` keeps neither regions nor model, so the change table can't show a region the rewrite drops. A rewrite that loses a region is now flagged for a person, as it is written; a row the parser skipped counts as none.
- **L4, `scripts/table-rows.mjs:9`:** `ROW` rescanned to the end of the page from every unclosed `<tr`, and the cell and `<sup>` expressions did the same. One scan now finds the same elements. A test compares it with the three expressions on every fixture page and on 5,000 random inputs, and the independent check found no difference on 4.5 million more. Left, both needing a hostile page and bounded by the 32 MiB body cap and the job's timeout:
  - each cell's text still goes through `htmlToText`, which stays quadratic on tags that never end (fetchers F2);
  - the parsers' own element expressions have the same shape: Grandstream's tables and buttons, Kyocera's blocks and items.

## Refused or unconfirmed candidates
- C1, day and month swapped, two-digit years: refused, lens claim correctness.
  - TP-Link reads day/month/year and Google reads month/day/year, matching their profiles' `date_order`.
  - EZVIZ and Grandstream are year first.
  - Every year needs four digits.
- C2, a date from another cell, a range, or trailing text: refused, lens existing mitigation. Every date pattern is anchored, text after the date must be the profile's phrase or the row is skipped, and Google cross-checks release plus five years.
- C3, writes outside `data/devices/<brand>/` or over another record: refused, lens claim correctness. Ids are `[a-z0-9-]`, the folder comes from the profile, and a new row is written only when no record has its id or names it.
- C4, the YAML round trip: refused, lens existing mitigation. The reviewer wrote 44 hostile strings through `recordYaml`, and every one parsed back unchanged, with no R8 problem.
- GL.iNet's month lookup reading `Object.prototype`: refused, lens exploitability. A hostile page can already fail the run.
- Page text in the weekly PR body's flags (reviewer's L3): out of zone, `workflows`. It is the same defect as workflows M1, fixed in #224.

## Coverage
- Read in full: the eleven files in scope.
- Read as context: `tests/candidates.test.mjs`, `tests/parsers.test.mjs`, `tests/table-rows.test.mjs`, `tests/fixtures/parsers/profiles.mjs`, `seed.yaml`, `validate-data.mjs`, `verify-evidence.mjs`, `data-refresh.yml` and DATA-POLICY.
- Lenses: exploitability, claim correctness and existing mitigation.

Code quality, from the reviewer:
- The comment on `<sup>` rows now says what happens to them (#225).
- The `recordYaml` comment covers rewritten records (#225).
- The "changed rows" label names everything it counts (#225).

The duplicated `collapse` and name-splitting helpers became `textOf` and `cellNames` in `scripts/parsers/common.mjs` (#236). Left as they are:
- `monthDate`'s ordinal strip, which no caller needs but which costs nothing;
- Google's own month-name lookup, which matches capitalised names only, so merging it with `monthDate` would change what the parser accepts.

## Hand-off
- L1, L2 and L4: fixed in #234. L1 settles a conflict by the rows exception records quote, not by regions and dates, since Beryl's one record covers two regions with one date.
- The shared helpers: done in #236.
