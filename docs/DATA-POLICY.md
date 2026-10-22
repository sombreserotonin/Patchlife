# Data policy

## Source ranking (use the highest available)
1. The manufacturer's statement of compliance (Australian Smart Device Rules, UK PSTI) or security support page.
2. The manufacturer's end-of-life or lifecycle page, for anchors such as end-of-life dates.
3. A regulator registry, for example the US Cyber Trust Mark registry.

News, forums, retailers, distributors and AI answers are leads only, never evidence.

## Quotes
- Verbatim: the shortest span that states the date or rule for that model, 300 characters at most.
- Table rows: quote the cell texts joined by single spaces, for example `Ring Video Doorbell 3 31 December 2027`.
- PDFs: the page text is rebuilt line by line (text on one baseline, left to right), whatever order the file draws it in, so a table row reads as it looks. A page with two text columns side by side can put both columns on one line, so check a PDF quote's model and date against the row as the PDF shows it.
- The quotes must state what the record states: a `fixed_date` record's end date, any anchor date, and the number of years in a relative rule. `npm run validate` rejects a record whose dates or years are not written in any of its quotes.
- A `fixed_date` source that gives a month and year but no day is stored as `end_date: "YYYY-MM"` (D38), never with a chosen day. `npm run validate` rejects it when no quote states that month and year, or when a quote states a day in that month.
- A numeric date such as 3/4/2027 is read in the order the source registry gives for its URL (`date_order`). Where no entry with a `date_order` covers the URL, `npm run validate` rejects a numeric date whose day and month are both 12 or under and differ. Year-first dates (2029/12/31) and month names are never ambiguous.
- At least one quote must name the model, as its `model` or one of its `aliases` (ignoring case and spacing, as the evidence checker does). `none_published` records are exempt.
- Within a brand, a model name or alias belongs to one record, except region-date splits of one model (D33): records with the same `model` and no region in common.
- Store only quotes and facts, never whole pages or images.
- When a table states the rule in one place and lists the models in another (a group table), use two evidence items from the same URL: the rule and the model's entry.

## Accuracy
- Never infer a date. A relative rule without a published anchor stays relative.
- Record the regions a statement covers. Show a UK statement elsewhere only when labelled as a UK statement.
- When a maker gives different dates for the same model in different regions, write one record per region-date (D33).
- Mark a record `disputed` only when a correction cites a primary source that conflicts with ours and the conflict can't be settled from primary sources; the site shows "Under review" until it is settled (D32).
- Re-verify every record at least every 90 days. When a quote no longer matches, mark the record `stale` and open a PR with new evidence or `none_published`.
- Corrections: anyone can report through the issue form. The fix must come from a primary source, never from the report itself.

## Display
- Always show "as published by <brand>", the date checked and a link to the source.
- Lists and search results show "as published by <brand>" and the date checked, and link to the model page, which shows the quote and the source link.
- Neutral language. No rankings or "worst" lists without a published methodology.
- Disclaimer (final wording is a human gate): information as published by manufacturers, may change, not advice.

## Crawling
- Scripts send `User-Agent: PatchlifeBot/0.1 (+https://github.com/sombreserotonin/Patchlife/blob/main/docs/CRAWLER.md)`.
- Copy quotes from the page text the polite fetcher extracts (RUNBOOKS A2), never from Claude Code's fetch tool, Firecrawl or any other connector. Those summarise pages or fetch them without identifying as PatchlifeBot (D17).
- A source whose robots.txt disallows PatchlifeBot, or that needs a login or passes a bot challenge, is not used. It could never be re-verified (D18).
- Honour robots.txt, at most one request per second per host, back off on 429 and 503.
- No logins, paywalls or CAPTCHAs, and no retailer price scraping.
- Dates in records and logs are UTC (`date -u +%F`).
