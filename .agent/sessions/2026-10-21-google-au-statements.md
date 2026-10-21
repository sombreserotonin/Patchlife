# 2026-10-21 Google Nest Australian statements

Data session started by the coordinating session. Added Google's AU Cyber Security Rules statements of compliance (linked from https://support.google.com/chromecast/answer/10367042) to six camera and doorbell records.

- All six statements read with the A2 step 3 command; all passed triage (robots.txt allowed, no bot challenge, dates in raw HTML).
- Each statement gives "At least five years from when the device first became available on the Google Store in the US, ending no earlier than <date>", the same date and kind of period as the existing record. No model had a different date.
- Added two `au_smart_device_rules` evidence items per record, `AU` to `regions`, and the model numbers G7LYP (Outdoor wired 2nd gen) and G1NRR (Indoor wired 3rd gen) as aliases, named in the AU statements.
- Notes on the four records also in the UK PSTI statement hit the 500 character limit, so the UK and AU sentences were merged into one (now exactly 500).
- Verified: `npm run verify:evidence` 6 verified, 0 problems; `npm run validate` 0 errors; `npm test` 68 pass.
- Inefficient: the page text drops links, so the statement URLs needed a separate raw HTML read through the same fetcher. The Google TV Streamer, Nest Mini and Nest Wifi Pro AU statements on the same page were out of scope (no records); the tenth AU link (answer 16904890, listed by the Nest x Yale Lock) redirected to the help centre home page.
