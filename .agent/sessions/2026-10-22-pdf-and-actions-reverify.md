# 2026-10-21 to 22: domain live, PDF evidence, re-verification on Actions

- Owner merged #66, #67, #69, #72 to #75 and chose option C on #68. patchlife.tech serves from the root; the privacy page discloses Cloudflare (#76, D41).
- Probe hosts run 39695382968: all six evidence hosts answer a GitHub runner. H7 steps in #77 (owner).
- PDF evidence (#79): review workflow (17 agents) found that drawing order mis-paired table rows; text is now rebuilt in reading order, and a PDF with no text fails loudly.
- COSTS stage 1: #78 (gate script, A9, D42) merged; #80 (protected: `reverify.yml`, prompt changes) reviewed by 21 agents, 7 fixes, waits for the owner. Nothing is due until 21 Dec 2026.
- Lighthouse gate now uses a median of three runs (#75) after a 75 on a slow runner.
- Next: owner merges #80 and does H7. Then COSTS stage 2 (per-source table parsers) needs page fixtures from `Crawl`; M4 needs H9b before the waitlist.
