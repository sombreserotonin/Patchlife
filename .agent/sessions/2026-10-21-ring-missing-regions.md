# 2026-10-21 Ring missing regions

Follow-up to the A8 audit of #43, which found Ring records leaving out a region whose page gives the same date.

- Read the US, UK and AU `ri2p1` pages with the A2 step 3 command, 2 s apart. Each final URL matched the cited URL.
- Added regions, evidence and verbatim row names as aliases to 7 records: `ring-video-doorbell-3` (AU, US), `ring-floodlight-cam` (AU, US), `ring-spotlight-cam-pro` (US; not on the AU page), `ring-spotlight-cam`, `ring-spotlight-cam-plus`, `ring-stick-up-cam-pro`, `ring-outdoor-cam` (US each). Every added quote gives the record's existing date. `conditions` unchanged: the purchase-channel wording is the same on all three pages.
- Left unchanged: `ring-video-doorbell-1st-generation` (AU "Ring Video Doorbell" names no generation) and the possible US renames (`Battery Doorbell`, `Battery Doorbell Plus`, `Battery Doorbell Pro`, `Floodlight Cam Plus`, `Floodlight Cam Pro`). None of the three pages links the old and new names; they point to a separate "product name changes" article, which this task did not read.
- Verified: `npm run verify:evidence` 7 verified, 0 problems; `npm run validate` 0 errors; `npm test` 86 pass.
- Inefficient: the local `origin/main` was stale at start, so the first branch missed #43 until a fresh fetch.
