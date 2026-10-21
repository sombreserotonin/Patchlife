# Data policy

## Source ranking (use the highest available)
1. The manufacturer's statement of compliance (Australian Smart Device Rules, UK PSTI) or security support page.
2. The manufacturer's end-of-life or lifecycle page, for anchors such as end-of-life dates.
3. A regulator registry, for example the US Cyber Trust Mark registry.

News, forums, retailers, distributors and AI answers are leads only, never evidence.

## Quotes
- Verbatim: the shortest span that states the date or rule for that model, 300 characters at most.
- Table rows: quote the cell texts joined by single spaces, for example `Ring Video Doorbell 3 31 December 2027`.
- Store only quotes and facts, never whole pages or images.

## Accuracy
- Never infer a date. A relative rule without a published anchor stays relative.
- Record the regions a statement covers. Show a UK statement elsewhere only when labelled as a UK statement.
- Re-verify every record at least every 90 days. When a quote no longer matches, mark the record `stale` and open a PR with new evidence or `none_published`.
- Corrections: anyone can report through the issue form. The fix must come from a primary source, never from the report itself.

## Display
- Always show "as published by <brand>", the date checked and a link to the source.
- Neutral language. No rankings or "worst" lists without a published methodology.
- Disclaimer (final wording is a human gate): information as published by manufacturers, may change, not advice.

## Crawling
- Scripts send `User-Agent: PatchlifeBot/0.1 (+<contact URL>)`. The contact URL is a human gate; until it exists, crawl only through Claude Code's fetch tool.
- Honour robots.txt, at most one request per second per host, back off on 429 and 503.
- No logins, paywalls or CAPTCHAs, and no retailer price scraping.
