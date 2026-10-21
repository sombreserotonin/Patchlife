// Client-side search for the home page (SPEC 4), plus the wording the site generator shares with it, so model pages,
// lists and search results say the same thing. matchDevices is pure, so this file runs in the browser and in node:test.
// attachSearch is the only part that touches the DOM. A "device" here is a search-index entry (see indexEntry in build-site.mjs).

export const STATUS_LABELS = { supported: "Supported", ending_soon: "Ending soon", ended: "Ended", unknown: "Unknown" };

// An "at least" date that has passed is a minimum that has passed, not the end of updates (D23, P8).
export const isMinimumPassed = ({ status, at_least: atLeast }) => status === "ended" && atLeast === true;
export const statusKey = (device) => (isMinimumPassed(device) ? "minimum_passed" : device.status);
export const statusLabel = (device) => (isMinimumPassed(device) ? "Minimum passed" : (STATUS_LABELS[device.status] ?? device.status));

const LONG_DATE = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const SHORT_DATE = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
// "2027-12-31" becomes "31 December 2027" (long) or "31 Dec 2027" (short).
export const longDate = (isoDate) => LONG_DATE.format(new Date(`${isoDate}T00:00:00Z`));
export const shortDate = (isoDate) => SHORT_DATE.format(new Date(`${isoDate}T00:00:00Z`));
export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
export const listWords = (items) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : (items[0] ?? ""));

const fold = (text) => String(text).normalize("NFKC").toLowerCase();
const squash = (text) => text.replace(/[^\p{L}\p{N}]+/gu, "");

// "Ring" + "Video Doorbell 3" becomes "Ring Video Doorbell 3"; a model that already starts with the brand is left alone.
export function displayName(brand, model) {
  return fold(model).startsWith(`${fold(brand)} `) ? model : `${brand} ${model}`;
}

// DATA-POLICY: a statement is shown with the regions it covers. GLOBAL means the maker's policy names no region (D24).
const REGION_ADJECTIVES = { AU: "Australian", UK: "UK", US: "US", EU: "EU" };
const REGION_NAMES = { AU: "Australia", UK: "UK", US: "US", EU: "EU", GLOBAL: "any region" };

// "UK statement", "Australian and UK statements", "Policy that names no region". With nothing found, the regions searched.
export function regionText({ regions = [], rule }) {
  if (rule === "none_published") {
    return `Regions searched: ${listWords(Object.keys(REGION_NAMES).filter((r) => regions.includes(r)).map((r) => REGION_NAMES[r]))}`;
  }
  const named = Object.keys(REGION_ADJECTIVES).filter((r) => regions.includes(r)).map((r) => REGION_ADJECTIVES[r]);
  const parts = named.length ? [`${listWords(named)} ${named.length === 1 ? "statement" : "statements"}`] : [];
  if (regions.includes("GLOBAL")) parts.push(parts.length ? "and a policy that names no region" : "Policy that names no region");
  return parts.join(", ");
}

// A condition can extend the period only when it sets another date that wins if later, as Ring's purchase rule does
// ("at least four years from purchase or this date, whichever is later"). Scope conditions (Google: "Covers critical
// issues…") and hardware versions (TP-Link: "Hardware version V5 only.") do not, so those records keep the plain D23 wording.
export const conditionsExtend = (conditions) => /\bwhichever is later\b/i.test(conditions ?? "");

// P6 and D32: a stale or disputed record is flagged next to its date until it is settled.
export const underReview = ({ verification }) => verification === "stale" || verification === "disputed";

// The date shown after "as published by": the last automated check, else the latest date the evidence was retrieved.
function checkedPhrase({ rule, checked, retrieved }) {
  const word = rule === "none_published" ? "searched" : checked ? "checked" : "retrieved";
  return `${word} ${shortDate(checked ?? retrieved)}`;
}

// A relative rule in words. An anchor is "the date <brand> gives", because sources word it differently (SPEC 1 and 2).
export function ruleWords({ rule, years, anchor_date: anchor, brand }) {
  const span = plural(years, "year");
  if (rule === "years_after_eol") {
    return anchor
      ? `${span} after the end-of-sale or end-of-life date ${brand} gives for this model, ${longDate(anchor)}`
      : `${span} after ${brand} ends sales of this model (date not yet published)`;
  }
  if (rule === "years_after_launch") {
    return anchor
      ? `${span} after the launch or first-sale date ${brand} gives for this model, ${longDate(anchor)}`
      : `${span} after this model's launch or first sale (date not yet published)`;
  }
  if (rule === "years_after_manufacture") return `${span} after the device was made (the date varies from unit to unit)`;
  if (rule === "years_after_purchase") return `${span} after you buy the device`;
  return null;
}

// The answer: SPEC 4's copy pattern, or once an "at least" date has passed, the P8 wording (D34), or for a condition that
// can extend the period, a hedge that says some buyers get longer.
// Draft wording: both need the owner's legal read (gate H9a). The generator marks them in the HTML; search results,
// the meta description and the JSON-LD description carry them unmarked.
export function answerText(device) {
  const { brand, status, end_date: end, at_least: atLeast, rule } = device;
  const source = `as published by ${brand} (${checkedPhrase(device)})`;
  if (rule === "none_published") return `No security update period published by ${brand} was found for this model (${checkedPhrase(device)}).`;
  if (!end) return `Security updates for ${atLeast ? "at least " : ""}${ruleWords(device)}, ${source}.`;
  if (isMinimumPassed(device) && device.conditions_extend) {
    return `The published minimum date, ${longDate(end)}, has passed. Some buyers get longer: see Conditions. ${brand} may still provide updates. Date ${source}.`;
  }
  if (isMinimumPassed(device)) return `Minimum support period ended on ${longDate(end)}. ${brand} may still provide updates. Date ${source}.`;
  if (status === "ended") return `Security updates ended on ${longDate(end)}, ${source}.`;
  return `Security updates until ${atLeast ? "at least " : ""}${longDate(end)}, ${source}.`;
}

// The answer with its regions and any review flag: the line used in lists, search results and page descriptions.
export const summaryText = (device) => `${answerText(device)} ${regionText(device)}.${underReview(device) ? " Under review." : ""}`;

// Devices whose brand, model, aliases or id contain every term of the query, after NFKC and lower-casing.
// A term also matches with spaces and punctuation ignored, so "ac1" finds the model number "AC-1".
export function matchDevices(index, query) {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return index.filter((device) => {
    const fields = [device.brand, device.model, device.id, ...(device.aliases ?? [])].map(fold);
    const squashed = fields.map(squash);
    return terms.every((term) => {
      const bare = squash(term);
      return fields.some((field) => field.includes(term)) || (bare !== "" && squashed.some((field) => field.includes(bare)));
    });
  });
}

const MAX_RESULTS = 50;

// Shows results for the input's current value now and on every change. Text is set with textContent, never as HTML.
export function attachSearch({ input, count, list, devices, base }) {
  const update = () => {
    const results = matchDevices(devices, input.value);
    const shown = results.slice(0, MAX_RESULTS);
    list.replaceChildren(
      ...shown.map((device) => {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = `${base}/devices/${encodeURIComponent(device.id)}/`;
        link.textContent = displayName(device.brand, device.model);
        item.append(link, `: ${statusLabel(device)}. ${summaryText(device)}`);
        return item;
      }),
    );
    if (!input.value.trim()) count.textContent = "";
    else if (!results.length) count.textContent = "No devices found. Try the model number, or browse by brand or category below.";
    else {
      const more = results.length > shown.length ? `, showing the first ${shown.length}` : "";
      count.textContent = `${results.length} ${results.length === 1 ? "device" : "devices"} found${more}.`;
    }
  };
  input.addEventListener("input", update);
  update();
}
