# 2026-10-21 Domain switch and privacy page

- Merged #62, #63, #64, #65 after a combined local merge on `main` (validate 340 records, 0 errors; test 165 of 165).
- patchlife.tech serves the preview build: links point at `/Patchlife/`, a 404. Protected #67 builds at the root with `SITE_URL=https://patchlife.tech` and no `NOINDEX`. Owner merges.
- patchlife.tech resolves to Cloudflare (104.21.54.125, 172.67.138.137) and every page carries Cloudflare's Web Analytics beacon. The approved privacy text says "runs no analytics" and "hosted on GitHub Pages". #68 offers: A, DNS only (recommended); B, analytics off plus a Delivery bullet; C, keep both with two changed bullets.
- Privacy page #69: #60's text plus admin@sombrexo.com and GitHub issues. Held for #68.
- Next: after #67, Search Console (H7) steps; after #68, merge #69; after #66, run the probe. Daily-build Next: month-only dates (D38), then PDF text.
