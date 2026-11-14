# Verified security sweep: public-site, 2026-11-14

## Context
Scope:
- `scripts/build-site.mjs`, the site generator: pages, the Atom feeds, the JSON API, the sitemap, robots.txt and the build folder guard;
- `site/search.js`, the search the browser runs;
- `scripts/status.mjs` and `scripts/data-report.mjs`.

Trigger: the owner's request of 14 Nov 2026 to audit the whole codebase. Earlier that day the site was redesigned (#222), so this zone holds the newest code. This is the first sweep of the zone recorded in `docs/audits/`. The closed-earlier list from the shared brief applied, including #198's output-encoding fixes.

Commit read: e484c80.

## Delegation
One fresh reviewer read the zone: a general-purpose agent, read-only, with no network, given the shared brief described in `docs/audits/2026-11-14-merge-gate.md`. It ran in the first wave and wrote every build and test only to its scratch folder.

I verified every finding on its cited lines. I then built the whole site from `main` and from the fix branch, both on 14 Nov 2026, and compared the two.

## Verification
| Finding | Zone | Verdict | Claimed | Verified | Reservations | Proof |
|---|---|---|---|---|---|---|
| L1 one model's "ending soon" and "ended" events share an Atom id | public-site | VERIFIED REAL | Low | Low | the fix shows entries that have already ended once more in readers | `tests/build-site.test.mjs` "a model's ending-soon and ended events are separate entries in its brand feed (RFC 4287)", ran, fails as expected on `main`, passes after #231 |
| L2 a month-only end date says "12 months or less of security updates left" a month early | public-site | VERIFIED REAL | Low | Low | no record is month-only today | `tests/build-site.test.mjs` "a month-only end date does not say 12 months or less are left before its quote supports it (D38)", ran, fails as expected, passes after #231 |
| L3 "Today is the last day" is relative to a UTC build date | public-site | VERIFIED REAL | Low | Low | | `tests/build-site.test.mjs` "at-least wording never overstates the minimum" (now expecting the named date), ran, fails as expected, passes after #231 |
| L4 /stats/ calls a stale record's last passed check "Oldest automated check" | public-site | VERIFIED REAL | Low | Low | | `tests/build-site.test.mjs` "the stats page counts records by status, brand, category and verification state as at the build date (M7, D46)", ran, fails as expected, passes after #231 |
| L5 a local build stopped part-way leaves a folder later builds refuse to empty | public-site | VERIFIED REAL | Low | Low | local only; the refusal deletes nothing | `tests/build-site.test.mjs` "a build stopped part-way can be rebuilt over", ran, fails as expected, passes after #231 |
| C1 a record or page value reaches HTML, JSON-LD, Atom or the sitemap unescaped | public-site | FALSE POSITIVE | - | - | lens: existing mitigation | see the refused section |
| C2 `?q=` writes into the page | public-site | FALSE POSITIVE | - | - | lens: existing mitigation | see the refused section |
| C3 the build can be pointed at a folder that is not a build and empty it | public-site | FALSE POSITIVE | - | - | lens: existing mitigation | see the refused section |
| C4 a status word or date disagrees with the decisions | public-site | FALSE POSITIVE | - | - | lens: claim correctness | see the refused section |

## Confirmed defects
- **L1, `scripts/build-site.mjs:727`, feeds.** `<id>${entry.url}</id>` gave one id to two events. Fix (#231): the ending-soon event keeps the page's address, and the later event gets `#ended`, so current ending-soon entries keep their ids.
- **L2, `scripts/build-site.mjs:204`, published wording.** A month-only date (D38) is ending soon from the month's first day. Fix (#231): its note says the published month starts within 12 months, and the ending-soon feed's subtitle says how such entries are dated.
- **L3, `scripts/build-site.mjs:229`, calendar day.** "Today" meant the build's UTC day, which a reader in Australia sees the next morning. Fix (#231): the sentence names the date.
- **L4, `scripts/build-site.mjs:779`, published wording.** Fix (#231): the label reads "Oldest passed automated check", which is what the value is.
- **L5, `scripts/build-site.mjs:1000`, build safety.** The API feed that marks a build was written last. Fix (#231): it is written before the pages.

A full build on 14 Nov 2026 from `main` and from #231 differs in exactly nine files: the eight Atom feeds and `stats/index.html`.

## Refused or unconfirmed candidates
- C1, unescaped output: refused, lens existing mitigation. Every path goes through the `html` tag or `JSON.stringify`, and #198's fixes hold. That covers #222's new mark, icon, stylesheet and search-row status element.
- C2, the search query writing into the page: refused, lens existing mitigation. `site/search.js` builds nodes with text content only.
- C3, emptying a folder that is not a build: refused, lens existing mitigation. `unsafeOutDirReason` refuses anything that is not an earlier build, and no argument or environment value got past it.
- C4, status words and dates: refused, lens claim correctness. They were brute-forced against D13, D23, D34, D36 and D38 with no disagreement, apart from L2's wording.
- The search loader's broad catch: refused as a defect, lens claim correctness. Its message is broader than needed, but it shows nothing wrong.

## Coverage
- Read in full: the files in scope.
- Run: builds of the fixtures and a full site, every badge and sentence checked against the decisions, and the date arithmetic brute-forced.
- Lenses: exploitability, claim correctness and existing mitigation.

Code quality, from the reviewer: seven notes on wording and on duplicated helpers. None changes behaviour, and they are left.

## Hand-off
- `site/search.js` could fold names through the same invisible-character strip as `normalise` (from the data-integrity sweep), so a name with a soft hyphen is found by its visible spelling. Not done (14 Nov 2026): none of the 1,322 records has an invisible character in its model or aliases.
- Once #231 merges, `docs/SPEC.md` may name the new Atom id scheme beside D51's dating rule.
