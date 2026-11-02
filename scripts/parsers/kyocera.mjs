// Parses Kyocera's UK product security page (MIGRATION B4), which is not a table: each model is a bold paragraph
// followed by a list, "Date of first availability in the UK: Jan-23" and "End of support date: 31st December 2026".
// The quote is the model and the list items joined by single spaces, as the records write it; a second item quotes
// the page's review and no-reduction sentences, which make the date a minimum.
import { htmlToText } from "../verify-evidence.mjs";
import { categoryFor, evidenceItem, fixedDate, monthDate, recordId } from "./common.mjs";

export const PAGE = "https://www.kyoceradocumentsolutions.co.uk/en/support/product-security.html";
const REGIME = "uk_psti";
const SENTENCES = "These support periods are reviewed on a continual basis and extended where it is deemed prudent to do so, for the benefit of the consumer. At no point shall the support periods advertised on this webpage be reduced";
// The bold tag sometimes carries a style attribute, and a model name may hold a no-break space.
const BLOCK = /<p>\s*<b\b[^>]*>([^<]+)<\/b>\s*<\/p>\s*<ul>([\s\S]*?)<\/ul>/gi;
const ITEM = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
const END = /^End of support date:\s*(\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]+) (\d{4})$/;

const collapse = (html) => htmlToText(html).replace(/\s+/g, " ").trim();

// Candidate records for the blocks that read without guessing, and the blocks skipped with the reason.
export function parse({ html, url = PAGE, profile, today = new Date().toISOString().slice(0, 10) }) {
  const candidates = [];
  const skipped = [];
  const [conditions] = profile.conditions[url];
  const notes = profile.notes[url].join(" ");
  for (const [, heading, list] of html.matchAll(BLOCK)) {
    const model = collapse(heading);
    const items = [...list.matchAll(ITEM)].map(([, item]) => collapse(item));
    const quote = [model, ...items].join(" ");
    const end = items.map((item) => item.match(END)).find(Boolean);
    if (!end) {
      skipped.push({ quote, reason: "no \"End of support date\" item with a day, month and year" });
      continue;
    }
    const endDate = monthDate(end[1], end[2], end[3]);
    if (!endDate) {
      skipped.push({ quote, reason: `"${end[0]}" is not a calendar date` });
      continue;
    }
    const id = recordId(profile.brand_slug, model);
    const category = categoryFor(profile, { id, model, quote });
    if (!category) {
      skipped.push({ quote, reason: `no category_map entry matches "${model}"` });
      continue;
    }
    candidates.push({
      id,
      brand: profile.brand,
      brand_slug: profile.brand_slug,
      model,
      aliases: [],
      category,
      regions: profile.regions_by_url[url],
      support: fixedDate(endDate, { atLeast: true, conditions }),
      evidence: [evidenceItem(url, quote, today, REGIME), evidenceItem(url, SENTENCES, today, REGIME)],
      verification: { status: "unverified" },
      notes,
    });
  }
  return { candidates, skipped };
}
