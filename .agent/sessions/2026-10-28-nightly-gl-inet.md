# 2026-10-28 nightly data: GL.iNet revisit

- No open data PRs; no stale or unchecked records; latest re-verify run failed at `npm test` (fixed in #145), no "Records not checked" annotation.
- Samsung: robots.txt timed out again, kept `last_checked: null`. NETGEAR, Aqara, Reolink wait on issues; Grandstream is a distributor lead.
- Revisit path on GL.iNet: `unquoted-dates.mjs` found GL-B1300 and GL-AP1300 rows (Maintenance, supported until 10 June 2027). Added two GLOBAL records, verified. Categories (router, access-point) come from the model names; the page states none, so the audit should check them.
- validate and tests pass.
