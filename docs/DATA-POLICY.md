# Data policy

## Source ranking (use the highest available)
1. The manufacturer's statement of compliance (Australian Smart Device Rules, UK PSTI) or security support page.
2. The manufacturer's end-of-life or lifecycle page, for anchors such as end-of-life dates.
3. A regulator registry, for example the US Cyber Trust Mark registry.

News, forums, retailers, distributors and AI answers are leads only, never evidence.

## Quotes
- Verbatim: the shortest span that states the date or rule for that model, 300 characters at most.
- Table rows: quote the cell texts joined by single spaces, for example `Ring Video Doorbell 3 31 December 2027`.
- The quotes must state what the record states: a `fixed_date` record's end date, any anchor date, and the number of years in a relative rule. `npm run validate` rejects a record whose dates or years are not written in any of its quotes.
- Store only quotes and facts, never whole pages or images.
- When a table states the rule in one place and lists the models in another (a group table), use two evidence items from the same URL: the rule and the model's entry.

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
- Scripts send `User-Agent: PatchlifeBot/0.1 (+https://github.com/sombreserotonin/Patchlife/blob/main/docs/CRAWLER.md)`.
- Copy quotes from the page text the polite fetcher extracts (RUNBOOKS A2), never from Claude Code's fetch tool, Firecrawl or any other connector. Those summarise pages or fetch them without identifying as PatchlifeBot (D17).
- A source whose robots.txt disallows PatchlifeBot, or that needs a login or passes a bot challenge, is not used. It could never be re-verified (D18).
- Honour robots.txt, at most one request per second per host, back off on 429 and 503.
- No logins, paywalls or CAPTCHAs, and no retailer price scraping.
- Dates in records and logs are UTC (`date -u +%F`).
