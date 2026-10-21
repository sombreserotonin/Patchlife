# Brief

## Problem
Smart devices stop receiving security updates long before they stop working, and buyers can't easily find out when. Makers now have to publish this in Australia (devices manufactured from 4 March 2026) and the UK (since 29 April 2024), but the information sits in thousands of separate support pages and PDFs, often as a rule ("3 years after end of life") rather than a date.

## Evidence (checked 21 October 2026)
- Australia: the Cyber Security (Security Standards for Smart Devices) Rules 2025 commenced on 4 March 2026 for most household smart devices manufactured from that date. Makers must publish how long a device gets security updates, including an end date, and suppliers must supply in-scope products with a statement of compliance. https://www.homeaffairs.gov.au/about-us/our-portfolios/cyber-security/security-standards-for-smart-devices
- The Rules set no minimum support length. https://www.minterellison.com/articles/cyber-security-standards-for-consumer-smart-devices
- UK: the PSTI regulations took effect on 29 April 2024, and distributors must not supply products without a statement of compliance. https://www.cooley.com/services/practice/european-tech-regulation/products/uk-product-security-and-telecommunications-infrastructure-act
- US FTC staff (2024): 163 of 184 smart products (88.6%) gave no support duration or end date on the product page. https://www.ftc.gov/system/files/ftc_gov/pdf/smart-device-makers-failure-to-provide-software-updates-may-leave-you-smarting.pdf
- SANS ISC (2024) found no database of PSTI statements, only individual vendor pages. https://isc.sans.edu/diary/30992
- 2026 buying guides still tell people to search model numbers by hand. https://secureiot.house/smart-device-security-support-window-buying-guide-2026/
- endoflife.date covers phones; searches found no equivalent for smart-home gear. https://www.engadget.com/2277410/android-phone-how-to-check-security-updates/
- Rules vary by maker: TP-Link 3 years after a model's end of life, GL.iNet 2 years after end of life, Ring per-model dates, Kyocera per-model dates, Arlo an end-of-life list plus one year of critical security updates. Sources are in `data/sources/seed.yaml`.

## Users and jobs
1. Buyers: "Will this still get security updates in three years?"
2. Owners: "Warn me before my device goes unsupported."
3. MSPs and IT teams: "Which devices across my clients are unsupported or ending soon?" Unsupported-asset findings are routine in security audits.
4. Suppliers and retailers: "Which of my SKUs have a published statement and support period?"

## Value
One answer per model: the end date (or the rule in plain words), time left from today, and the quoted source with the date it was checked.

## Revenue, in order of expected value
1. Paid feed or API and CSV reports for MSPs and IT teams.
2. Supplier SKU checks.
3. Affiliate links to longer-supported alternatives on consumer pages and in the extension. This is the traffic engine, not the business.

Prove B2B demand (M4) before investing in the extension.

## Non-goals
- No reviews, ratings or "worst brand" rankings without a published methodology.
- No legal advice and no compliance certification.
- No scraping of retailer prices or reviews.

## Risks
- Wrong dates: mitigated by quotes, automated verification and a visible corrections path.
- Source pages move or change: nightly re-checks and a 90-day stale rule.
- A larger player builds the same thing: the moat is coverage, freshness and evidence quality, kept up by agents.
