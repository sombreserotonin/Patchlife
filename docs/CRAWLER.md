# PatchlifeBot

PatchlifeBot reads manufacturers' public security support pages so Patchlife can show how long smart devices get security updates, quoting the manufacturer as evidence.

User agent: `PatchlifeBot/0.1 (+https://github.com/sombreserotonin/Patchlife/blob/main/docs/CRAWLER.md)`

## What it fetches
- Only pages listed in `data/sources/` or cited by a device record: statements of compliance, security support pages and end-of-life lists.
- It keeps a short quote and a hash of the page text, never the whole page.

## How it behaves
- Honours `robots.txt`.
- At most one request per second per host, and backs off on 429 and 503 responses.
- No logins, paywalls or CAPTCHAs, and no retailer prices.

## Opting out
Add this to your `robots.txt`:

```
User-agent: PatchlifeBot
Disallow: /
```

## Contact
Open an issue at https://github.com/sombreserotonin/Patchlife/issues/new/choose.
