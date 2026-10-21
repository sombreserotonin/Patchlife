# Plan

_As at Wednesday 21 October 2026. Review this at every milestone close and at least monthly. Milestone exit checks are in [`ROADMAP.md`](../.agent/progress/ROADMAP.md), the next tasks are in [`TASKS.md`](../.agent/progress/TASKS.md), and the procedures are in [`RUNBOOKS.md`](RUNBOOKS.md)._

## Summary
- **Where we are.** M0 is done. M1 is close: the evidence engine is built, and about 118 verified camera and doorbell records from three brands are written. Of those, 2 are on `main` and 116 are in review.
- **The strategy.**
  1. Collect evidence-backed data.
  2. Publish it as a fast static site.
  3. Keep it fresh without supervision.
  4. Run a four-week demand test.
  5. Build whatever the test supports: business features first if businesses want them, the browser extension if consumers do.
- **Next 30 days.**
  - Close M1 (a fourth brand plus the exit check).
  - Settle the decisions below.
  - Fix the automation's known traps.
  - Ship the M2 preview site on GitHub Pages.
  - Start the nightly `Crawl` data run.
- **What we need from you.** Decisions P1 to P4, the EZVIZ allowlist ([#23](https://github.com/sombreserotonin/Patchlife/issues/23)), two GitHub settings, and one protected PR. That's about an hour this week, then a 10-minute check each week.

## Where we are

| Area | State |
| --- | --- |
| Data | 2 verified Ring records on `main`. In review: Ring 46 (#24), Google Nest 12 (#21), TP-Link Tapo 58 (#22). Arlo: none (its pages block bots, D18). |
| Evidence engine | Status computation, polite fetcher, verifier CLI (`npm run verify:evidence`), and the check that each quote states the record's dates and years. HTML only. |
| Source registry | Schema-checked by `npm run validate` (#26). |
| Automation | Daily build at 06:08 Sydney in `Default`. `Crawl` environment for data. No nightly data run yet. |
| Repo | Public. Ruleset on `main`. CI labels protected paths. Agents merge only PRs whose head branch is in this repo. |
| Site | Not built. Domain `patchlife.tech` bought, no DNS. |
| Money | No spending. Usage credits are off. |

## How the work runs

| Loop | Where | Does | Pace |
| --- | --- | --- | --- |
| Daily build (scheduled) | `Default` | Code, tests and docs: one TASKS.md item per run, plus merging green agent PRs | About 5 tasks a week |
| Data work | `Crawl` | Adds, corrects and re-verifies records, one source per PR | One source takes about 5 to 20 minutes in a session |
| Coordinating session | `Default` | Runs several `Crawl` sessions at once, audits data PRs (RUNBOOKS A8), runs workflows like this plan | When the owner starts one |
| Owner | GitHub and claude.ai | Decisions, gates, protected merges, weekly check (O5) | About 1 hour this week, then 10 minutes a week |

Facts that shape every plan below:
- **`Default` can't read manufacturer pages at all (D17).** So data work can't happen in the daily build.
- **Merges:** the daily build merges green agent PRs within 24 hours. A coordinating session merges sooner only with your approval in that session (D15).
- **Protected files** (`.github/`, `.claude/`, `.agent/prompts/`, `CLAUDE.md`, `package.json`) always wait for you, so each batch of them goes in one PR.
- **Usage limits:** usage credits are off, so a heavy day of sessions can push the scheduled runs past their limit until the usage window resets.

## Decisions needed from you
Comment on the decisions issue (opened with this plan) with your choice for each. Until you decide, agents follow the recommendation where it changes nothing outside the repo.

| # | Decision | Recommendation | Why |
| --- | --- | --- | --- |
| P1 | Where data work runs unattended | **B:** a nightly `Crawl` scheduled task (O6) running a fixed `data-refresh.md`, one source per run. The other option, **A**, is to switch the daily build to `Crawl`. | B keeps code work and page reading in separate runs and doubles throughput. A is a one-minute change but mixes both in one run. |
| P2 | M2 site stack | **Plain Node build script plus GitHub Pages**, a hand-written search, and Lighthouse for the exit checks | No new framework: Astro brings 260 packages and had two major releases in 2026. No hosting account and no secrets, because Pages deploys through GitHub's own login. Free for a public repo. The alternatives are Astro or Eleventy, and Cloudflare Pages or Netlify. |
| P3 | Move PDF text and archive snapshots from M1 to M3 | **Yes** | Every camera and doorbell source in M1 is HTML. PDF support needs a dependency (a protected PR), and the Wayback "save" API couldn't be verified from here. |
| P4 | Amend D9 to allow MPL-2.0 files | **Yes**, for axe-core (inside Lighthouse) | Every accessibility checker uses axe-core. GNU lists MPL-2.0 as compatible with GPL and AGPL. |
| P5 | M4 decision rule (gates A to C below), with the M5 and M6 order depending on the result | **Approve before M4 starts**, adjusting the thresholds if you like | Fixing the rule before the data arrives stops the result moving the goalposts. |
| P6 | What `disputed` means | Set it when a correction cites a primary source that conflicts with ours and the conflict can't be settled. The site shows "Under review" next to the date, and the status is cleared when settled. | The status exists in the schema but nothing says how to use it. |
| P7 | A model whose date differs by region (for example Ring Video Doorbell 4: 2027 in the UK and AU, 2029 in the US) | One record per region-date, with the region in the id (`ring-video-doorbell-4-us`) | Needs no schema change, and each record keeps its own evidence. |
| P8 | Copy for an "at least" date that has passed while the maker still ships updates (Google's table says "Yes" for 8 such cameras) | Show "Minimum support period ended on <date>. <Brand> may still provide updates." rather than a bare "ended" | Accurate without claiming more than the source says. This is site copy, so it's part of your H9 legal read. |

## Milestones
Targets are estimates. Each milestone closes only when its exit checks in ROADMAP.md pass.

### M1 Evidence engine and first 50 records
**Target:** Friday 31 October 2026.
- **Done:**
  - status computation;
  - the evidence checker (HTML), polite fetcher and verifier CLI;
  - the check that quotes state each record's dates and years;
  - the source registry format;
  - 2 verified Ring records.
- **To do:**
  1. Audit and merge the Ring, Google and TP-Link PRs (#24, #21, #22), fixing blocking problems first (RUNBOOKS A8). That gives about 118 verified records from three brands.
  2. Fourth brand: EZVIZ once you add its hosts (#23), then one `Crawl` session (O1, A2). No other camera brand has an HTML statement on a reachable, bot-friendly host. Arlo's robots.txt disallows all bots, and Aqara and Reolink publish PDFs.
  3. Update `data/sources/seed.yaml` with what the research found: Google's per-model table, TP-Link's Australian statement, EZVIZ, Arlo's robots block, and the PDF-only brands.
  4. Exit check: a `Crawl` session runs a full `npm run verify:evidence`, then ROADMAP is updated.
- **If EZVIZ fails:** the fourth brand waits for PDF support (Aqara, Reolink or TP-Link's UK PDF), which pulls P3 back into M1.

### M2 Public site, search only
**Target:** preview by Friday 20 November 2026; on `patchlife.tech` after your legal read.
- **Build (agent PRs):**
  - a site generator that writes the home, model, brand, category, methodology, corrections and about pages, the JSON feed, sitemap, robots.txt and structured data, escaping all manufacturer text;
  - a search index and search box with no framework;
  - a Lighthouse check script.
- **Protected PR (you merge):**
  - the `package.json` scripts and the `lighthouse` dev dependency;
  - a Pages workflow that rebuilds on every merge and daily just after 00:00 UTC, so status stays current (D7);
  - the CLAUDE.md commands.
- **Your steps, in order:**
  1. Decide P2 and P4.
  2. Set Settings > Pages > Source to **GitHub Actions**.
  3. Merge the protected PR. The preview goes live at `sombreserotonin.github.io/Patchlife`.
  4. H9a legal read.
  5. Verify the domain and set the DNS records.
  6. Enforce HTTPS.
  7. Search Console (H7). It moves here from M4 so indexing builds up before the demand test.
- **Exit:** the live preview URL; accessibility passes on the home page and one model page; Lighthouse performance, accessibility and SEO at 90 or above on a model page.

### M3 Unattended data
**Target:** December 2026.
- **Fixes:** the prompt fixes (protected PR, see the action plan), then the nightly `Crawl` task (P1, O6).
- **Re-verifying:**
  - re-verify any record checked more than 60 days ago, passing ids so a quiet night ends with nothing to change;
  - report dead sources;
  - mark `stale` records and repair them (A4).
- **PDF and archive (if P3):** PDF text through one dependency (protected PR); archive snapshots tested in `Crawl`; then the PDF-only brands (Aqara, Reolink, TP-Link UK, GoPro).
- **Coverage for M4:** at least 150 verified records, at least 40 of them in small-office categories (routers, printers, NVRs). Seed sources: TP-Link, GL.iNet, Kyocera, ASUS, NETGEAR.
- **Exit:**
  - three consecutive nightly runs each end in a correct PR or a correct "nothing to do";
  - a deliberately broken fixture source is caught.

### M4 Demand check (four weeks)
**Start only when all of these hold** (estimates):
- the site is on `patchlife.tech`;
- M3 is done;
- there are 150 or more verified records, with at least 40 small-office ones and at least 60% with a computable status;
- the sitemap is submitted and at least 70% of its URLs are indexed;
- the business page and waitlist are live, with a privacy collection notice (H9b);
- the gates below are approved (P5);
- you commit to two posts in MSP communities in week 1.

**Weekly numbers:** every Monday you paste the Search Console totals and the waitlist counts into a pinned `M4 weekly numbers` issue, and an agent copies them into LOG.md. No Search Console credential is stored.

**Waitlist:** a hosted Tally form linked from `/business`, so no third-party script runs on our pages. Its free plan stores data in the EU (source: [tally.so](https://tally.so/help/tally-a-free-typeform-alternative)). The fallback is a `mailto:` address through email forwarding.

**Gates** (all estimates; approve or adjust before day 0):
- **A, business (decides M6):**
  - **Go:** 10 or more qualified sign-ups, 5 or more of them choosing A$25 a month or more (at least 1 at A$100 or more), and 3 or more calls held.
  - **Extend once:** 4 to 9 qualified sign-ups.
  - **No-go:** 3 or fewer.
- **B, consumer search (decides M5):**
  - **Pass:** 10 or more impressions per indexed page per week, and 50 or more clicks a week, in week 4.
  - **Fail:** fewer than 2 impressions per indexed page.
- **C, quality (overrides A and B):** stop and fix if upheld corrections exceed 2% of records, or if any shown date isn't supported by its quote.

**What happens next:**
- A goes: M6 (business) before M5.
- A fails but B passes: M5 (extension) and affiliate links.
- Both fail: maintenance mode (nightly refresh only), and re-test in 3 months.

**Price anchors:** EOSL.ai charges US$12 to US$49 a month for alerts and gives its data away ([pricing](https://eosl.ai/pricing/)). ScalePad Lifecycle Manager starts at US$250 a month ([pricing](https://www.scalepad.com/lifecycle-manager/pricing)). Our data stays free under ODbL, so a paid tier sells alerts, fleet matching, change history and reliability, not access.

### M5 Browser extension and M6 Business features
Order set by M4. Scope as in SPEC 5 and 6.
- **Before charging money (H9c, H10):** ABN, GST once turnover reaches A$75,000, Stripe, terms and refund policy reviewed for unfair contract terms, and a data licence.
- **GitHub Pages:** its terms bar sites built mainly for commercial transactions, so paid features run on edge compute (SPEC 6), possibly on a subdomain.

### M7 Growth
Monthly report and alerts as in SPEC 7, once there's an audience.

## Legal checklist (H9, split by when it's needed)
- **H9a, before the site is on `patchlife.tech`:**
  - disclaimer next to the dates, not only in the footer (ACCC: fine print rarely fixes a misleading impression);
  - privacy policy;
  - use of short manufacturer quotes and brand names;
  - whether UK GDPR applies.
- **H9b, before the waitlist collects emails:**
  - collection notice;
  - the provider's data processing agreement;
  - Spam Act unsubscribe within 5 working days;
  - a retention limit.
- **H9c, before charging:** ABN, GST, terms and refunds, Stripe, a data licence, overseas tax.

## Risks

| Risk | Signal | Response |
| --- | --- | --- |
| A wrong date is published | A correction is upheld; an audit finds a mismatch | Quote-date check (#20), audit before merge (A8), gate C stops M4 |
| Source pages move or rename models | `stale` records; quote not found | Nightly re-verify (M3), A4. Ring's page says "last updated 2 months ago", so expect renames |
| Bot walls and robots.txt blocks | `robots.txt disallows`, 403 challenges | Don't use the source (D18). Ask the maker only through you (contacting people is a gate) |
| The automation loops or stalls | Duplicate PRs; no OK line for 2 days | Prompt fixes in the protected PR; weekly check O5 |
| Usage limits stop runs | Rejected runs | One coordinating session at a time; usage credits stay off unless you change them |
| Agents act as you on GitHub | You don't get emailed about "your own" activity | Turn on own-activity emails; fork PRs are never merged (CLAUDE.md) |
| Others publish the same data | From 11 December 2027 the EU Cyber Resilience Act is expected to require support end dates at purchase (secondary sources) | Compete on coverage, freshness and fleet tools, not scarcity |
| Hosting terms at M4 and M6 | Commercial pages on GitHub Pages | Static site stays on Pages; paid features move to edge compute |

## Measures

| Measure | Now | M1 | M3 | M4 start |
| --- | --- | --- | --- | --- |
| Verified records | 2 (118 in review) | 50 or more | 150 or more | 150 or more |
| Brands with verified records | 1 | 4 | 6 or more | 6 or more |
| Share with a computable status | 100% | n/a | 60% or more | 60% or more |
| Stale records | 0 | 0 | under 2% | under 2% |
| Daily build runs ending "OK" | n/a | n/a | 5 or more a week | 5 or more a week |
| Oldest open `needs-human` item | 0 days | under 7 days | under 7 days | under 7 days |

## Action plan: next 14 days
Who: **A** = agent (daily build or a coordinating session), **O** = owner.

| # | By | Action | Who | Where | Done when |
| --- | --- | --- | --- | --- | --- |
| 1 | Wed 22 Oct | Audit and merge data PRs #24, #21, #22, fixing blocking problems first | A | Default plus Crawl | Merged; full verify green in Crawl |
| 2 | Wed 22 Oct | Merge this plan (TASKS reordered before the 06:08 run so the daily build can't loop) | A | Default | On `main` |
| 3 | Wed 22 Oct | Open the decisions issue (P1 to P8) and the protected PR: prompt fixes, skill, CLAUDE.md read order, Node engine | A | Default | Issue and PR open |
| 4 | Fri 24 Oct | Add the EZVIZ hosts (#23); decide P1 to P4; merge the protected PR (O2) | O | claude.ai, GitHub | Issues closed, PR merged |
| 5 | Fri 24 Oct | GitHub settings: turn on **Automatically delete head branches** (repo Settings > General) and emails about your own activity (github.com/settings/notifications) | O | GitHub | Both on |
| 6 | Mon 27 Oct | EZVIZ records (O1, A2); update `seed.yaml` with the research | A | Crawl, Default | Fourth brand merged |
| 7 | Tue 28 Oct | M1 exit check: full `npm run verify:evidence` in Crawl; close M1 in ROADMAP; write the M2 tasks | A | Crawl | M1 marked done |
| 8 | Mon 27 Oct | Weekly check (O5) | O | GitHub, claude.ai | Done |
| 9 | Fri 31 Oct | Create the nightly `Crawl` task (O6), if P1 is B | O | claude.ai | First run reported |
| 10 | Mon 3 Nov | M2: site generator PR, then search PR (agent-mergeable) | A | Default | Merged with tests |
| 11 | Wed 4 Nov | M2 protected PR (scripts, Lighthouse, Pages workflow, CLAUDE.md); set Pages source to GitHub Actions | A, then O | GitHub | Preview live |

After 4 November: finish M2 (target preview 20 November), then H9a, DNS and Search Console, then M3. Re-plan at the M1 close.
