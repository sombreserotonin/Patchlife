# 2026-10-21 Ring US region-date records (D33)

Read Ring's US, UK and AU security update pages with the A2 step 3 command and checked all 48 existing Ring records against them. Every listed region gives its record's date, except where noted already. Two models have a US date that differs from the existing record:

- Video Doorbell 4 (2021 release): US 31 December 2029, UK and AU 31 December 2027. Added `ring-video-doorbell-4-us`.
- Spotlight Cam 4K Pro: US and AU 31 December 2030, UK 31 December 2031. Added `ring-spotlight-cam-4k-pro-au-us` (regions AU and US, evidence from both pages).

Updated the notes on `ring-video-doorbell-4` and `ring-spotlight-cam-4k-pro` to name the new records. The US page states the same purchase-channel rule, so `conditions` is unchanged.

Verified: A1 on the four ids (4 verified, 0 problems), `npm run validate` (0 errors), `npm test` (86 pass).

The first version used `ring-spotlight-cam-4k-pro-us` (US only). The coordinating session ruled that regions sharing a date share one record under D33, so it became `ring-spotlight-cam-4k-pro-au-us` with the AU evidence added; A1 re-run (2 verified, 0 problems), validate and test passed again.

Inefficient: the repo has `yaml`, not `js-yaml`, so a quick summary script failed once; grep was enough.
