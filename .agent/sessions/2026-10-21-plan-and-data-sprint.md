# 2026-10-21 Plan and data sprint (coordinating session)

The owner asked for a forward plan, an action plan and better documentation, and said to work in parallel without worrying about token use.

## What happened
- **Data:** four `Crawl` sessions ran at once, one brand each.
  - Ring (#24): 46 records.
  - Google Nest (#21): 12 records.
  - TP-Link (#22): 58 records, from an Australian statement in HTML.
  - Arlo: none. Its robots.txt disallows all bots and www.arlo.com serves a bot challenge, so it is out (D18).
  - Every session reported its own `verify:evidence` output, and I read it from their transcripts.
  - A six-agent audit then checked the three PRs against independent reads of the source pages (RUNBOOKS A8). See the LOG line that records the merges.
- **Guard:** `npm run validate` now rejects a record whose dates or years aren't written in its quotes (#20).
- **Mistake:** #20 also committed a `node_modules` symlink, which three sessions reported. It was fixed in #25, with `.gitignore` corrected (D22).
- **Source registry:** schema and validation (#26), written by a background agent in a worktree.
- **Research:** four agents covered data coverage, M2 site tech, operations and docs, and demand. Main findings:
  - `Default` can't read manufacturer pages by any route, so D12 was wrong (now D17).
  - The daily build would have looped on the PDF task, which needs a protected `package.json` PR.
  - GitHub Pages plus a plain Node build script meets M2 with no account or secret.
  - Arlo, Aqara and Reolink are blocked or PDF-only, so EZVIZ is the fourth brand (#23).
  - M4 needs a fixed decision rule (gates A to C) agreed before day 0.

## Documents
- `docs/PLAN.md`: summary, current state, how the work runs, decisions P1 to P8, milestones with targets, the legal checklist, risks, measures, and a 14-day action plan.
- `docs/RUNBOOKS.md`: owner runbooks O1 to O7 and agent runbooks A1 to A8.
- Updated ARCHITECTURE, ROADMAP, TASKS, DATA-POLICY, BRIEF, README, decisions (D17 to D22) and context.

## Next
- **Me:** merge the audited data PRs, open the decisions issue and the protected prompt-fix PR.
- **Owner:** #23, P1 to P4, the G1 settings.
- **Then:** the EZVIZ batch, the M1 exit check in `Crawl`, and the M2 build.
