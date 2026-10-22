# Plan

_As at Wednesday 21 October 2026. Dates are Sydney dates unless they say UTC. Review this at every milestone close and at least monthly. Milestone exit checks are in [`ROADMAP.md`](../.agent/progress/ROADMAP.md), the next tasks are in [`TASKS.md`](../.agent/progress/TASKS.md), and the procedures are in [`RUNBOOKS.md`](RUNBOOKS.md)._

## Summary
- **Where we are.** M0, M1 and M2 are done (21 Oct 2026): 338 audited, verified records from five brands, and a preview site at https://sombreserotonin.github.io/Patchlife/. M3, unattended data, is next.
- **Costs.** How to move off subscription AI later, and what the RX 9070 XT can take over: [`COSTS.md`](COSTS.md).
- **The strategy.**
  1. Collect evidence-backed data.
  2. Publish it as a fast static site.
  3. Keep it fresh without supervision.
  4. Run a four-week demand test.
  5. Build whatever the test supports: business features first if businesses want them, the browser extension if consumers do.
- **Next 30 days.**
  - Close M1 (a fourth brand plus the exit check).
  - Settle the decisions below.
  - Ship the M2 preview site on GitHub Pages.
  - Start the nightly `Crawl` data run.
- **What we need from you.**
  - **This week:** the EZVIZ allowlist ([#23](https://github.com/sombreserotonin/Patchlife/issues/23)); the GitHub settings in G1 and G3 (TASKS.md); starting three `Crawl` sessions (O1): EZVIZ records, their audit, and the M1 exit check. The prompt fixes are merged (#29).
  - **Then:** a 10-minute check each week (O5).

## Where we are

| Area | State |
| --- | --- |
| Data | 120 verified records on `main`, all audited: Ring 48 (#24), Google Nest 12 (#21), TP-Link Tapo 60 (#22). Arlo: none, because its pages block bots (D18). |
| Evidence engine | Status computation, polite fetcher, verifier CLI (`npm run verify:evidence`), and the check that each quote states the record's dates and years. HTML only. |
| Source registry | Schema-checked by `npm run validate` (#26). |
| Automation | Daily build at 06:08 Sydney (19:08 UTC the day before) in `Default`. `Crawl` environment for data. No nightly data run yet. Heartbeat issue [#27](https://github.com/sombreserotonin/Patchlife/issues/27). |
| Repo | Public. Ruleset on `main`. CI labels protected paths. Agents merge only PRs whose head branch is in this repo. |
| Site | Not built. Domain `patchlife.tech` bought, no DNS. |
| Money | No spending beyond the domain (#2). Usage credits are off. |

## How the work runs

| Loop | Where | Does | Pace |
| --- | --- | --- | --- |
| Daily build (scheduled) | `Default` | Code, tests and docs: one TASKS.md item per run, plus merging green agent PRs | About 5 tasks a week |
| Data work | `Crawl` | Adds and corrects records, one source per PR (D19), and re-checks what the nightly Actions re-verify could not (D42) | One source takes about 5 to 20 minutes in a session |
| Audits | `Crawl`, a different session from the author | Checks each data PR against the source (RUNBOOKS A8), then adds the `audited` label | One per data PR |
| Coordinating session | `Default` | Starts and steers `Crawl` sessions, merges audited PRs with your approval (D15), runs workflows like this plan | When you start one |
| Owner | GitHub and claude.ai | Decisions, gates, protected merges, starting `Crawl` sessions until the nightly task exists, weekly check (O5) | About 90 minutes this week, then 10 minutes a week |

Facts that shape every plan below:
- **`Default`'s network can't reach manufacturer pages,** and connectors that can (such as Firecrawl) must not be used for them (D17). So data work and audits can't happen in the daily build.
- **Merges:** the daily build merges a green agent PR without `needs-human-merge`, but a data PR only with the `audited` label or when it changes only `verification:` fields (D20, #29).
- **Protected files** (`.github/`, `.claude/`, `.agent/prompts/`, `CLAUDE.md`, `package.json`, `package-lock.json`) always wait for you, so each batch of them goes in one PR.
- **Usage limits:** usage credits are off, so a heavy day of sessions can push the scheduled runs past their limit until the usage window resets. Avoid long sessions between 17:00 and 19:30 UTC.

## Decisions (settled 21 Oct 2026)
Settled in [#30](https://github.com/sombreserotonin/Patchlife/issues/30): the owner chose P1 B and approved P2 to P4, and delegated P5 to P8, which follow the recommendation. Each is now a rule in `decisions.md` (D27 to D34). P8 is still draft copy for the H9a legal read.

| # | Decision | Recommendation | Why |
| --- | --- | --- | --- |
| P1 | Where data work runs unattended | **B:** a nightly `Crawl` scheduled task (O6) running the fixed `data-refresh.md`, one source per run. The other option, **A**, is to switch the daily build to `Crawl`. | B keeps code work and page reading in separate runs and doubles throughput. A is a one-minute change but mixes both in one run. |
| P2 | M2 site stack | **Plain Node build script plus GitHub Pages**, a hand-written search, and Lighthouse for the exit checks | The build script needs no new packages. Astro brings 260 and had two major releases in 2026; Eleventy brings 114. Lighthouse adds 114 packages, but only in CI. No hosting account and no secrets: Pages deploys through GitHub's own login, free for a public repo. |
| P3 | Move PDF text and archive snapshots from M1 to M3 | **Yes** | Every camera and doorbell source used in M1 is HTML. PDF support needs a dependency (a protected PR), and the Wayback "save" API couldn't be verified from here. |
| P4 | Confirm that D9 allows MPL-2.0 | **Yes**, for axe-core (inside Lighthouse) | The M2 exit check uses Lighthouse, and axe-core (MPL-2.0) is the only package in its tree outside D9's example list. GNU lists MPL-2.0 as compatible with GPLv3 and AGPLv3, which D9 allows. The alternative is an Apache-2.0 or BSD checker and no Lighthouse, which changes the M2 exit check. |
| P5 | M4 decision rule (gates A to C below), with the M5 and M6 order depending on the result | **Approve before M4 starts**, adjusting the thresholds if you like | Fixing the rule before the data arrives stops the result moving the goalposts. |
| P6 | What `disputed` means | Set it when a correction cites a primary source that conflicts with ours and the conflict can't be settled. The site shows "Under review" next to the date, and the status is cleared when settled. | The status exists in the schema but nothing says how to use it. |
| P7 | A model whose date differs by region (for example Ring Video Doorbell 4: 2027 in the UK and AU, 2029 in the US) | One record per region-date, with the region in the id (`ring-video-doorbell-4-us`) | Needs no schema change, and each record keeps its own evidence. |
| P8 | Copy for an "at least" date that has passed while the maker still ships updates (Google's table says "Yes" for 8 such devices: 6 cameras and 2 doorbells) | "Minimum support period ended on <date>. <Brand> may still provide updates." rather than a bare "ended" | Accurate without claiming more than the source says (D23). This is site copy, so it's part of your H9a legal read. |

## Milestones
Targets are estimates. Each milestone closes only when its exit checks in ROADMAP.md pass.

### M1 Evidence engine and first 50 records
**Target:** Friday 30 October 2026.
- **Done:**
  - status computation;
  - the evidence checker (HTML), polite fetcher and verifier CLI;
  - the check that quotes state each record's dates and years;
  - the source registry format;
  - 120 verified records from three brands, each audited and fixed before merge: Ring 48 (#24), Google Nest 12 (#21), TP-Link Tapo 60 (#22).
- **To do:**
  1. Fourth brand: EZVIZ once you add its hosts (#23). Then a `Crawl` session adds the records (O1, A2) and a second one audits them (A8). None of the other camera brands checked so far has an HTML statement on a reachable, bot-friendly host: Arlo's robots.txt disallows all bots, and Aqara, Reolink and GoPro publish PDFs.
  2. Exit check (a `Crawl` session): a full `npm run verify:evidence`, with at least 50 verified records from at least four brands. Then ROADMAP is updated.
- **If EZVIZ fails:** the fourth brand waits for PDF support (Aqara, Reolink or GoPro), which pulls P3 back into M1. TP-Link's UK PDF adds UK records, not a new brand.

### M2 Public site, search only
**Target:** preview by Friday 20 November 2026; on `patchlife.tech` after your legal read.
- **Build (agent PRs):**
  - a site generator that writes the home, model, brand, category, methodology, corrections and about pages, the JSON feed, sitemap, robots.txt and structured data, escaping all manufacturer text;
  - a search index and search box with no framework.

  It takes a base path (`/Patchlife/` on the preview, `/` on the custom domain). A first version is already in progress, held for P2.
- **Protected PR (you merge):**
  - the `package.json` scripts and the `lighthouse` dev dependency;
  - a Pages workflow that rebuilds on every merge to `main` and daily at 00:17 UTC, so status stays current (D7);
  - a Lighthouse job that runs in GitHub Actions against the built site (cloud sessions have no Chrome);
  - the CLAUDE.md commands.
- **Your steps, in order:**
  1. Decide P2 and P4.
  2. Set Settings > Pages > Source to **GitHub Actions**.
  3. Merge the protected PR. The preview goes live at `sombreserotonin.github.io/Patchlife`, with `noindex` on every page until it moves to `patchlife.tech`.
  4. H9a legal read.
  5. Verify the domain at github.com/settings/pages, then set the DNS records.
  6. Enter `patchlife.tech` under Settings > Pages > Custom domain, and tick Enforce HTTPS once it's offered.
  7. Search Console (H7). It moves here from M4 so indexing builds up before the demand test.
- **Exit:** the live preview URL; accessibility passes on the home page and one model page; Lighthouse performance, accessibility and SEO at 90 or above on a model page.

### M3 Unattended data
**Target:** December 2026.
- **Nightly task:** the nightly `Crawl` task (P1, O6), which the prompt fixes (#29) made safe to run.
- **Re-verifying:**
  - re-verify verified records checked more than 60 days ago with `npm run verify:evidence -- --due 60 --limit 40`, so a quiet night ends with nothing to change. From #80 this runs on GitHub Actions (`Re-verify evidence`, D42), and the daily build merges it (RUNBOOKS A9);
  - report dead sources;
  - mark `stale` records and repair them (A4).
- **PDF and archive (P3, D29):** PDF text through one dependency (protected PR); archive snapshots tested in `Crawl`; then the PDF-only brands (Aqara, Reolink, TP-Link UK, GoPro).
- **Decisions to make:** how to store month-only dates, which A2 currently skips. The EU Cyber Resilience Act will make many statements month and year only.
- **Coverage for M4:** at least 150 verified records, at least 40 of them in small-office categories (routers, printers, NVRs). Seed sources: TP-Link, GL.iNet, Kyocera, ASUS, NETGEAR. Also the follow-ups found in the audits: Google's Australian statements, AU and US evidence for the Ring seed records, TP-Link's TC and TD rows.
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
- the gates below are approved (P5, D31; adjust thresholds before day 0 only);
- you commit to two posts in MSP communities in week 1, and about 2 hours of calls in weeks 2 to 4 (contacting people is a gate).

**Weekly numbers:** every Monday you paste the Search Console totals and the waitlist counts into an `M4 weekly numbers` issue, and an agent copies them into LOG.md. No Search Console credential is stored.

**Waitlist:** a hosted Tally form linked from `/business`, so no third-party script runs on our pages. Tally stores all form data in Europe on every plan, including the free one ([tally.so/help/gdpr](https://tally.so/help/gdpr)). The fallback is a `mailto:` address through email forwarding.

**Gates** (all estimates; approve or adjust before day 0):
- **A, business (decides M6):**
  - **Go:** 10 or more qualified sign-ups, 5 or more of them choosing A$25 a month or more (at least 1 at A$100 or more), and 3 or more calls held.
  - **Extend once:** anything short of Go with 4 or more qualified sign-ups.
  - **No-go:** 3 or fewer.
- **B, consumer search (decides M5):**
  - **Pass:** 10 or more impressions per indexed page per week, and 50 or more clicks a week, in week 4.
  - **Fail:** anything short of Pass.
- **C, quality (overrides A and B):** stop and fix if upheld corrections exceed 2% of records, or if any shown date isn't supported by its quote.

**What happens next:**
- A goes: M6 (business) before M5.
- A fails but B passes: M5 (extension) and affiliate links.
- Both fail: maintenance mode (nightly refresh only), and re-test in 3 months.

**Price context:**
- **EOSL.ai** lists email-alert plans at US$12 and US$49 a month. As at 21 October 2026 they are not on sale, alerts are in a closed test, and its database is free under CC BY 4.0 ([pricing](https://eosl.ai/pricing/)).
- **ScalePad Lifecycle Manager**, a broader MSP platform, has a free plan for one client. Its paid plans start at $250 a month on a 12-month term ([pricing](https://www.scalepad.com/lifecycle-manager/pricing)).
- **Neither** shows that anyone pays for lifecycle data alone.
- **Our offer:** the data stays free under ODbL, so a paid tier would sell alerts, fleet matching, change history and reliability, not access.

### M5 Browser extension and M6 Business features
Order set by M4. Scope as in SPEC 5 and 6.
- **Before charging money (H9c, H10):** ABN, GST once turnover reaches A$75,000, Stripe, terms and refund policy reviewed for unfair contract terms, a data licence, overseas tax.
- **Matching:** search and the extension must prefer the longest exact match. The audits found old models whose names are prefixes of new ones (for example "Nest Cam Indoor" from 2015 inside "Nest Cam Indoor (wired, 3rd gen)").
- **Hosting (D40):** GitHub Pages bars sites built mainly for commercial transactions or SaaS, so the paid feed, API keys and reports run elsewhere, on a subdomain. First choice: the owner's Unraid server published through the owner's Pangolin VPS (WireGuard tunnel, no open ports at home), which costs nothing extra; edge compute (SPEC 6) is the fallback if uptime needs it. The public site stays on GitHub Pages: free, served from a CDN and no maintenance. Self-hosting it would trade uptime and speed for features it doesn't need yet.
- **Repository stays public (D40).** Making it private on a free account would unpublish the Pages site, stop the `main` ruleset and secret scanning, put Actions on a 2,000-minute monthly allowance, and break public links (corrections, the crawler contact page in PatchlifeBot's user agent).

### M7 Growth
Monthly report and alerts as in SPEC 7, once there's an audience.

## Running it unattended (next 30 days)
1. **Heartbeat.**
   - Every daily build run comments its one-line result on [#27](https://github.com/sombreserotonin/Patchlife/issues/27) (from 22 Oct, #29).
   - With own-activity emails on (G1), each comment reaches your inbox.
   - No comment for two days means O4.
2. **Security settings (G3):**
   - Dependabot alerts;
   - secret scanning with push protection (Settings > Code security);
   - auto-renew and two-factor sign-in at your domain registrar for `patchlife.tech`.
3. **Pulling a wrong date fast:** RUNBOOKS O8. It works once the site is live.
4. **Usage:** one coordinating session at a time, and none during the daily build window.

## Legal checklist (H9, split by when it's needed)
- **H9a, before the site is on `patchlife.tech`:**
  - disclaimer next to the dates, not only in the footer (ACCC: fine print rarely fixes a misleading impression);
  - privacy policy;
  - use of short manufacturer quotes and brand names;
  - whether UK GDPR applies;
  - the P8 wording.
- **H9b, before the waitlist collects emails:**
  - collection notice;
  - the provider's data processing agreement;
  - Spam Act unsubscribe within 5 working days;
  - a retention limit.
- **H9c, before charging:** ABN, GST, terms and refunds, Stripe, a data licence, overseas tax.

## Risks

| Risk | Signal | Response |
| --- | --- | --- |
| A wrong date is published | A correction is upheld; an audit finds a mismatch | Quote-date check (#20), audit before merge (A8, `audited` label), O8 to pull it, gate C stops M4 |
| Source pages move or rename models | `stale` records; quote not found | Nightly re-verify (M3), A4. Ring's page says "last updated 2 months ago", so expect renames |
| Bot walls and robots.txt blocks | `robots.txt disallows`, 403 challenges | Don't use the source (D18). Ask the maker only through you (contacting people is a gate) |
| The automation loops or stalls | Duplicate PRs; no heartbeat comment for 2 days | Prompt fixes in the protected PR; weekly check O5 |
| Usage limits stop runs | Rejected runs | One coordinating session at a time; usage credits stay off unless you change them |
| Agents act as you on GitHub | You aren't emailed about "your own" activity | Turn on own-activity emails (G1); fork PRs are never merged (CLAUDE.md) |
| Others publish the same data | From 11 December 2027 the EU Cyber Resilience Act (Regulation (EU) 2024/2847, Article 13(19)) requires the support end date, at least month and year, at purchase ([Commission summary](https://digital-strategy.ec.europa.eu/en/policies/cra-summary)) | Compete on coverage, freshness and fleet tools, not scarcity. Decide how to store month-only dates before M3 |
| Hosting terms at M4 and M6 | Commercial pages on GitHub Pages | Static site stays on Pages; paid features move to edge compute |

## Measures

| Measure | Now | M1 | M3 | M4 start |
| --- | --- | --- | --- | --- |
| Verified records on `main` | 338 | 50 or more | 150 or more | 150 or more |
| Brands with verified records | 5 | 4 | 6 or more | 6 or more |
| Share with a computable status | 100% | n/a | 60% or more | 60% or more |
| Stale records | 0 | 0 | under 2% | under 2% |
| Daily build heartbeats reporting OK (counted from 22 Oct) | n/a | n/a | 5 or more a week | 5 or more a week |
| Oldest open `needs-human` item | under 1 day | under 7 days | under 7 days | under 7 days |

The first four rows of **Now** are the first four lines of `node scripts/data-report.mjs`, run on 21 Oct 2026 (UTC).

## Action plan: next 14 days
Who: **A** = agent (daily build or coordinating session), **O** = owner.

| # | By | Action | Who | Where | Done when |
| --- | --- | --- | --- | --- | --- |
| 1 | Wed 21 Oct, before 19:08 UTC | Merge #21 and #22 after their audit fixes (the authoring `Crawl` sessions re-verify; the coordinating session checks and merges under your standing approval). If not done in time, pause the daily build (O4). | A | Crawl, Default | Both merged, or the daily build paused |
| 2 | Wed 21 Oct, before 19:08 UTC | Merge this plan, so `main`'s TASKS.md no longer starts with the PDF task (which would loop on a protected PR) | A | Default | On `main` |
| 3 | Thu 22 Oct | Open the decisions issue (P1 to P8) and the prompt-fix PR (see the list below) | A | Default | Done 21 Oct (#30, #29) |
| 4 | Fri 23 Oct | Add the EZVIZ hosts (#23); decide P1 to P4; review and merge the prompt-fix PR (O2) | O | claude.ai, GitHub | PR merged and P1 to P4 decided 21 Oct; #23 open |
| 5 | Fri 23 Oct | GitHub settings G1 and G3, and pin #27 | O | GitHub | All on |
| 6 | Mon 26 Oct | EZVIZ records: you start a `Crawl` session (O1, A2), then a second one for the audit (A8) | O starts, then A | Crawl | Fourth brand merged |
| 7 | Mon 26 Oct | Weekly check (O5) | O | GitHub, claude.ai | Done |
| 8 | Tue 27 Oct | M1 exit check: you start a `Crawl` session for a full `npm run verify:evidence`, then M1 is closed in ROADMAP and the M2 tasks written | O starts, then A | Crawl | M1 marked done |
| 9 | Fri 30 Oct | Create the nightly `Crawl` task (O6); P1 is B (D27) | O | claude.ai | First run reported |
| 10 | Mon 2 Nov | M2: site generator and search PRs (held until P2) | A | Default | Merged with tests |
| 11 | Wed 4 Nov | M2 protected PR (scripts, Lighthouse, Pages workflow, CLAUDE.md); set Pages source to GitHub Actions | A, then O | GitHub | PR open; Pages source set (preview target 20 Nov) |

**What the prompt-fix PR contains (action 3; merged 21 Oct as #29):**
- **`.agent/prompts/daily-build.md`:**
  - the real environment name;
  - merge a data PR only with the `audited` label, or if it's a re-verification that changes only `verification:` fields;
  - after two failed repairs, label a PR `needs-human` and stop touching it;
  - never start a task marked waiting or needing `Crawl`, or one that already has an open PR;
  - close a milestone only after its exit checks have passed;
  - end every run with one `OK:`, `WAITING:`, `BLOCKED:` or `STUCK:` line, also posted on #27.
- **`.agent/prompts/data-refresh.md`:**
  - `Crawl`;
  - one source per run;
  - re-check the records the nightly `Re-verify evidence` run on Actions could not check (D42), and repair stale ones;
  - quotes only from the polite fetcher's text;
  - skip robots-blocked and bot-walled sources;
  - never merge its own PR;
  - update `last_checked`.
- **The `add-device-record` skill:**
  - runs in `Crawl` with the page-text command;
  - two evidence items for group tables;
  - footnotes in `conditions`;
  - a mandatory verify step.
- **`CLAUDE.md`:** PLAN and RUNBOOKS in the read order, and data PRs merge only after an A8 audit.
- **`package.json`:** engines `>=22.21`.

After 4 November: finish M2 (target preview 20 November), then H9a, DNS and Search Console, then M3. Re-plan at the M1 close.
