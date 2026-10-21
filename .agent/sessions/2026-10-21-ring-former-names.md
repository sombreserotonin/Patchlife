# 2026-10-21 Ring former names from the name-change article

Task from the coordinating session: check whether Ring's name-change article (linked from every ri2p1 page) maps older Ring records to the newer names on other regions' pages, then add the article's former names as aliases.

Article: `https://ring.com/support/articles/538eg/ring-product-name-changes`, with AU (`/au/en/support/...`) and UK (`/gb/en/support/...`) copies. Read only with the A2 step 3 fetcher; robots.txt allowed all three. It maps only generation-labelled names to resolution names (for example "Battery Doorbell (2nd Gen)" to "Battery Doorbell 2K"). The AU and UK copies write the six Battery and Wired doorbell rows with "Video" ("Battery Video Doorbell (2nd Gen)") and leave out the US-only Car Alarm row.

Changed: 14 records (the 2K, 4K and 4K Elite doorbells and cameras). Each gained its former names as aliases, verbatim, and one evidence item per region copy quoting the mapping row. No dates or regions changed. Verifier: 14 verified, 0 problems.

Not settled, so unchanged: ring-battery-video-doorbell, -plus and -pro against the US "Battery Doorbell", "Battery Doorbell Plus" and "Battery Doorbell Pro" rows; ring-floodlight-cam-wired-plus and -wired-pro against the US "Floodlight Cam Plus" and "Floodlight Cam Pro" rows; ring-video-doorbell-1st-generation against the AU "Ring Video Doorbell" row. The article maps none of these.

Gaps noticed: there is no record for "Outdoor Cam 2K" (former "Outdoor Cam (2nd Gen)") or for the US "Car Tracker and Alarm" (former "Car Alarm"), so the article's rows for them went unused.

Inefficient: the local `origin/main` was stale at session start, and the first branch was cut from it. Fetch `origin main` before branching.
