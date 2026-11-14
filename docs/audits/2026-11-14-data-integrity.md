# Verified security sweep: data-integrity, 2026-11-14

## Context
Scope: `scripts/validate-data.mjs`, `data/schema/device.schema.json`, `data/schema/source.schema.json`, `scripts/withdraw-record.mjs` and `scripts/repoint-source.mjs`.

Trigger: the owner's request of 14 Nov 2026 to audit the whole codebase. This is the first sweep of the zone recorded in `docs/audits/`. The closed-earlier list from the shared brief applied (#198 and #205 for this zone).

Commit read: e484c80.

## Delegation
One fresh reviewer read the zone. It was a general-purpose agent, read-only, with no network, given the shared brief described in `docs/audits/2026-11-14-merge-gate.md`. It ran in the first wave.

I verified every finding on its cited lines and re-ran the reviewer's reproductions.

A second fresh reviewer then checked #223, asking only what the fix broke. It found:
- a test that read two live records on a fixed date, which would have stopped the nightly run once either record was re-verified;
- R7 dropped for withdrawn records even where no row is needed;
- name blanking that could create a day ("Cam 31 December 2027" read as 1 December for Cam 3);
- a footnote marker or ™ after a name hiding the name.

All four were repaired, with the reviewer's guards, before #223 merged. A sweep that withdraws all 1,322 records then validates with 0 errors.

## Verification
| Finding | Zone | Verdict | Claimed | Verified | Reservations | Proof |
|---|---|---|---|---|---|---|
| F1 a withdrawn TP-Link or EZVIZ record can never validate, so O8 cannot pull 964 of the 1,322 dates | data-integrity | VERIFIED REAL | Medium | Medium | | `tests/withdraw-record.test.mjs` "a withdrawn record of a brand whose categories come from its rows still validates (O8 on TP-Link and EZVIZ)", ran, fails as expected on e484c80, passes after #223 |
| F2 a model's number next to a month is read as the day | data-integrity | VERIFIED REAL | Medium | Medium | latent: no month-only record exists today | `tests/validate-data.test.mjs` "a model's own number or a footnote marker is never read as part of a date", ran, fails as expected, passes after #223 |
| F3 a quote for "Cam 10" names "Cam 1" | data-integrity | VERIFIED REAL | Medium | Medium | | `tests/validate-data.test.mjs` "a quote names a model or an alias only as a whole name, so a Cam 10 row does not vouch for Cam 1", ran, fails as expected, passes after #223 |
| F4 nothing checks a record's `brand` against its registry entry | data-integrity | VERIFIED REAL | Medium | Medium | | `tests/validate-data.test.mjs` "a record's brand is the name its registry entry gives, which the site prints as the publisher", ran, fails as expected, passes after #223 |
| F5 `repoint` leaves a moved record verified, with the old page's check, when the new page could not be read | data-integrity | VERIFIED REAL | Medium | Medium | | `tests/repoint-source.test.mjs` "a moved record whose new page could not be read is set to unverified, not left with the old page's check", ran, fails as expected, passes after #227 |
| F6 `withdraw` writes `retrieved` dates unquoted | data-integrity | VERIFIED REAL | Low | Low | every consumer parses YAML 1.2, where the value stays a string | `tests/withdraw-record.test.mjs` "a withdrawn record keeps its pages' retrieval dates as quoted strings, as records write dates", ran, fails as expected, passes after #227 |
| F7 an evidence URL the schema accepts but `new URL` refuses crashes the validator | data-integrity | VERIFIED REAL | Low | Low | fails closed | `tests/validate-data.test.mjs` "an evidence URL the schema accepts but no browser can open is reported, not thrown", ran, fails as expected, passes after #223 |
| F8 a numeric date's order comes from the first registry URL that is a prefix, whatever its brand | data-integrity | VERIFIED REAL | Low | Low | latent: no two entries share a host | `tests/validate-data.test.mjs` "only the record's own brand entry says how its pages write numeric dates", ran, fails as expected, passes after #223 |
| F9 `repoint` cannot produce a valid record for any profiled source, and that only shows after it has fetched | data-integrity | VERIFIED REAL | Low | Low | | `tests/repoint-source.test.mjs` "the CLI stops before fetching when the registry keys a profile setting by the old URL", ran, fails as expected, passes after #227 |
| C1 duplicate keys, alias bombs, merge keys, custom tags or multi-document files get past the parser | data-integrity | FALSE POSITIVE | - | - | lens: existing mitigation | see the refused section |
| C2 `at_least: false` beside the profile's at-least wording passes | data-integrity | FALSE POSITIVE | - | - | lens: claim correctness | see the refused section |
| C3 R2 lets an extra item add a region | data-integrity | FALSE POSITIVE | - | - | lens: claim correctness | see the refused section |
| C4 an invisible character inside a date changes its reading | data-integrity | FALSE POSITIVE | - | - | lens: exploitability | see the refused section |

## Confirmed defects

### F1, `scripts/validate-data.mjs:371`, legitimate path blocked
1. R7 ran on `none_published` records.
2. TP-Link's and EZVIZ's `category_map` entries match the quoted row, which a withdrawal removes.
3. R4 and R6 already skipped such records; R7 did not.

Scenario: the owner withdraws a wrong TP-Link date with RUNBOOKS O8, and the run fails at validation, so the date stays published.

Fix (#223): R7 reads only what needs no row for a withdrawn record, namely a listed exception or a model pattern.

### F2, `scripts/validate-data.mjs:246`, date reading
`mentionsDate` read the quote as written, so for the row "Cam 3 | December 2027" the model's number became the day, and NFKC turned a superscript marker after the year into a digit.

Fix (#223): dates are read with the record's own names (whole names only) and footnote markers blanked out.

### F3, `scripts/validate-data.mjs:267`, evidence matching
Names matched as substrings. Fix (#223): a name counts only whole, and a footnote marker or a sign such as ™ right after it is ignored.

### F4, `scripts/validate-data.mjs:230`, attribution
No rule compared `brand` with the registry, while the site prints it as the publisher. Fix (#223): it must equal the brand entry's `brand`.

### F5, `scripts/repoint-source.mjs:40`, verification state
On a fetch error, `verifyDevices` leaves the file, so the moved record kept `verified` with the old page's check date. Fix (#227): such a record is set to `unverified`. A disputed record keeps its status.

### F6 to F9
- **F6, `scripts/withdraw-record.mjs:42`:** each page's `retrieved` is written as a double-quoted scalar (#227).
- **F7, `scripts/validate-data.mjs:287`:** `URL.canParse` first, reported as an error (#223).
- **F8, `scripts/validate-data.mjs:167`:** the order comes from the record's own brand entry only (#223).
- **F9, `scripts/repoint-source.mjs:51`:** the CLI stops with exit 2 before writing or fetching when the registry keys `regions_by_url`, `conditions`, `notes` or `min_rows` by the old URL, and RUNBOOKS O8 step 3 says to move those keys first (#227).

## Refused or unconfirmed candidates
- C1, duplicate keys, alias bombs, merge keys, custom tags, multi-document files: refused, lens existing mitigation.
  - `YAML.parse` throws on duplicate keys and on more than 100 aliases.
  - Merge keys and custom tags give values the schema refuses.
  - A multi-document file is a parse error.
  - `withdraw` and `repoint` cannot write a document with errors.
- C2, `at_least: false` with the profile's at-least wording: refused, lens claim correctness. The one real case, `gl-inet-gl-mt1300`, is a deliberate D39 judgement.
- C3, R2 adding a region through an extra item: refused, lens claim correctness. R2 checks what the cited pages cover together, by design (DATA-POLICY, the group-table rule).
- C4, an invisible character inside a date: refused, lens exploitability. No quote of the 1,322 holds one. A page would need one inside a day number, and since #223 dates are read through `normalise`, which drops them.
- Homoglyph models or aliases: refused, lens exploitability. The name must be in a quote, and the quote on the maker's page.
- Characters outside `normalise`'s list, and bidi marks: refused, lens exploitability. No realistic actor.
- `mentionsYears` reading "1.5 years" as 5: refused, lens exploitability. No realistic source.
- The site's search folding without the invisible-character strip: out of zone, proposed for `public-site`. It is a findability point, with no wrong data.

## Coverage
- Read in full: the five files in scope.
- Read as context: the validator, withdraw and repoint tests and fixtures; DATA-POLICY; `status.mjs`; `verify-evidence.mjs`; `verification-only.mjs`; `parsers/common.mjs`; `seed.yaml`. Scripted scans covered all 1,322 records.
- Lenses: exploitability, claim correctness and existing mitigation.

Code quality, from the reviewer:
- `writesToken`'s copy of the invisible-character class now shares `normalise`'s constant (#223).
- The validator's header names R1's rename table (#223).
- `hasCredentials` and `loadValidator` are exported but unused outside the module. They are left, since removing exports is not needed for any fix.
- The repoint CLI catches errors (#227).

## Hand-off
- The two unused exports in `scripts/validate-data.mjs` (`hasCredentials`, `loadValidator`) can lose `export` in a later change with no behaviour change.
- The site's search could fold names through the same invisible-character strip as `normalise`; this is proposed for the next `public-site` sweep.
