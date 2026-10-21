// Builds the static site (SPEC 4): HTML pages, the JSON feed, the search index, sitemap.xml and robots.txt.
// Usage: node scripts/build-site.mjs [outDir] [devicesDir]
// outDir defaults to _site/; an empty or blank argument counts as absent. The CLI empties what is inside outDir before
// writing, and refuses one that is the cwd, the repository, a parent of either, holds the device records, is a symlink
// to nothing, or is a non-empty folder that is not an earlier build (only paths the build writes, and its feed's shape).
// Env: BASE_PATH (default ""), SITE_URL (an origin, default https://patchlife.tech), BUILD_DATE (YYYY-MM-DD, default
// today in UTC), NOINDEX (1 or true: noindex on every page, no sitemap.xml, for the preview).
// Status is computed against BUILD_DATE (D7). Run `npm run validate` first: this script trusts the data's shape but not
// its text, which comes from crawled pages.
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { computeStatus } from "./status.mjs";
import { listYamlFiles } from "./validate-data.mjs";
import {
  answerText,
  conditionsExtend,
  displayName,
  isMonthOnly,
  listWords,
  longDate,
  plural,
  regionText,
  ruleWords,
  shortDate,
  statusKey,
  statusLabel,
  summaryText,
  underReview,
} from "../site/search.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_URL = "https://github.com/sombreserotonin/Patchlife";
const CORRECTION_URL = `${REPO_URL}/issues/new/choose`;
const CRAWLER_URL = `${REPO_URL}/blob/main/docs/CRAWLER.md`;
const NOTICE_URL = `${REPO_URL}/blob/main/data/NOTICE.md`;
const AGPL_URL = `${REPO_URL}/blob/main/LICENSE`;
const ODBL_URL = "https://opendatacommons.org/licenses/odbl/1-0/";
const HOME_AFFAIRS_URL = "https://www.homeaffairs.gov.au/about-us/our-portfolios/cyber-security/security-standards-for-smart-devices";
const PSTI_URL = "https://www.cooley.com/services/practice/european-tech-regulation/products/uk-product-security-and-telecommunications-infrastructure-act";
const DEFAULT_SITE_URL = "https://patchlife.tech";
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const CATEGORY_LABELS = {
  camera: "Cameras",
  doorbell: "Doorbells",
  router: "Routers",
  "mesh-wifi": "Mesh Wi-Fi systems",
  "access-point": "Access points",
  "network-switch": "Network switches",
  "smart-plug": "Smart plugs",
  "smart-bulb": "Smart bulbs",
  "smart-switch": "Smart switches",
  "smart-lock": "Smart locks",
  "smart-speaker": "Smart speakers",
  "smart-display": "Smart displays",
  tv: "TVs",
  "streaming-device": "Streaming devices",
  printer: "Printers",
  nas: "Network storage (NAS)",
  nvr: "Network video recorders",
  "robot-vacuum": "Robot vacuums",
  "baby-monitor": "Baby monitors",
  thermostat: "Thermostats",
  hub: "Smart home hubs",
  sensor: "Sensors",
  wearable: "Wearables",
  appliance: "Appliances",
  other: "Other devices",
};
const REGIME_LABELS = {
  au_smart_device_rules: "Statement under Australia's smart device rules",
  uk_psti: "UK PSTI statement of compliance",
  us_cyber_trust_mark: "US Cyber Trust Mark registry",
  vendor_policy: "Manufacturer's support policy",
};
const DISCLAIMER = "Support information is as published by each manufacturer. It may change and is not advice.";

// ---------- HTML escaping ----------
// Every value reaches the page through the html tag below, which escapes it unless it is already an Html fragment.
// Only static template text, jsonLd() and nested html`` results are trusted.
class Html {
  constructor(text) {
    this.text = text;
  }
  toString() {
    return this.text;
  }
}

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

function renderValue(value) {
  if (value instanceof Html) return value.text;
  if (Array.isArray(value)) return value.map(renderValue).join("");
  if (value === null || value === undefined || value === false) return "";
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += renderValue(values[i]) + strings[i + 1];
  return new Html(out);
}

// JSON-LD block. <, >, & and the two Unicode line separators become backslash-u escapes, which keeps "</script>" and
// "<!--" out of the script element while the JSON stays valid.
const JSON_LD_UNSAFE = new RegExp(`[<>&${String.fromCharCode(0x2028, 0x2029)}]`, "g");
function jsonLd(value) {
  const json = JSON.stringify(value).replace(JSON_LD_UNSAFE, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return new Html(`<script type="application/ld+json">${json}</script>`);
}

// The URL when it parses as https, otherwise null. Only these become hrefs.
export function httpsUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

// ---------- Dates ----------
const longTime = (isoDate) => html`<time datetime="${isoDate}">${longDate(isoDate)}</time>`;
const shortTime = (isoDate) => html`<time datetime="${isoDate}">${shortDate(isoDate)}</time>`;
const latestRetrieved = (record) => record.evidence.map((ev) => ev.retrieved).sort().at(-1);

// True for a YYYY-MM-DD string naming a day that exists (2027-02-31 does not).
export function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addMonths(isoDate, months) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const day = Math.min(d, new Date(Date.UTC(year, month, 0)).getUTCDate());
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Whole years, months and days from today to the end date, for example "1 year, 2 months and 10 days". Null on the end date itself.
export function timeLeft(today, end) {
  const [ty, tm] = today.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  let months = (ey - ty) * 12 + (em - tm);
  if (addMonths(today, months) > end) months -= 1;
  const days = Math.round((Date.parse(end) - Date.parse(addMonths(today, months))) / 86_400_000);
  const parts = [
    [Math.floor(months / 12), "year"],
    [months % 12, "month"],
    [days, "day"],
  ];
  const words = parts.filter(([n]) => n > 0).map(([n, unit]) => plural(n, unit));
  return words.length ? listWords(words) : null;
}

// ---------- Record wording ----------
// What the site, lists and search know about a record. Null fields are left out to keep the search index small.
function indexEntry(record, status) {
  const { support, verification } = record;
  const entry = {
    id: record.id,
    brand: record.brand,
    model: record.model,
    aliases: record.aliases?.length ? record.aliases : null,
    category: record.category,
    status,
    rule: support.rule,
    years: support.years,
    anchor_date: support.anchor_date,
    end_date: support.end_date,
    at_least: support.at_least,
    regions: record.regions,
    checked: verification.checked,
    retrieved: latestRetrieved(record),
    verification: verification.status,
    conditions_extend: conditionsExtend(support.conditions) || null,
  };
  return Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== null && value !== undefined));
}

// For an "at least" date the status describes the guaranteed minimum, not when updates stop (D23). When a condition can
// extend the period (conditionsExtend), the published date is only the minimum for some buyers, so the notes say so.
const SOME_LONGER = "Some buyers get longer: see Conditions.";
function statusNote({ status, at_least: atLeast, conditions_extend: extend }) {
  if (status === "supported") return atLeast ? "More than 12 months of the guaranteed minimum left." : "More than 12 months of security updates left.";
  if (status === "ending_soon" && atLeast) {
    return extend ? `12 months or less until the published minimum date. ${SOME_LONGER}` : "12 months or less of the guaranteed minimum left.";
  }
  if (status === "ending_soon") return "12 months or less of security updates left.";
  if (status === "ended" && atLeast) return extend ? `The published minimum date has passed. ${SOME_LONGER}` : "The guaranteed minimum period has passed.";
  if (status === "ended") return "The end date has passed.";
  return "No end date can be worked out from what the manufacturer has published.";
}

function supportPeriod(record, entry) {
  const { rule, end_date: end, at_least: atLeast } = record.support;
  if (rule === "none_published") return "No published period found";
  if (rule === "fixed_date") return html`${atLeast ? "At least until" : "Until"} ${longTime(end)}`;
  return `${atLeast ? "At least " : ""}${ruleWords(entry)}`;
}

// "At least <time left>" stays true for every buyer when a condition extends the period, since the published date is a floor.
function timeLeftText(record, entry, today) {
  const { rule, end_date: end, at_least: atLeast } = record.support;
  const extend = entry.conditions_extend;
  if (rule === "years_after_purchase") return "Depends on when you bought the device";
  if (rule === "years_after_manufacture") return "Depends on when the device was made";
  if (!end) return rule === "none_published" ? "Not known" : html`Not known until ${record.brand} publishes the date`;
  if (entry.status === "ended" && atLeast) return extend ? SOME_LONGER : "None guaranteed. The minimum period has ended.";
  if (entry.status === "ended") return "None. Security updates have ended.";
  if (isMonthOnly(end)) return `${atLeast ? "At least until" : "Until"} ${longDate(end)}. ${record.brand} gives the month, not the day.`;
  const left = timeLeft(today, end);
  if (!left && atLeast) return extend ? `Today is the published minimum date. ${SOME_LONGER}` : "Today is the last guaranteed day";
  if (!left) return "Today is the last day";
  return atLeast ? `At least ${left}` : left;
}

function evidenceCheck(record) {
  const { status, checked } = record.verification;
  if (status === "verified") return html`Quote found on the source page by an automated check on ${shortTime(checked)}.`;
  if (status === "stale") return "At the latest automated check the quote was no longer on the source page. This record is being reviewed.";
  if (status === "disputed") return "This record has been disputed and is being reviewed.";
  return html`Not yet checked automatically. Quote retrieved on ${shortTime(latestRetrieved(record))}.`;
}

function sourceLink(url) {
  const safe = httpsUrl(url);
  return safe ? html`<a class="url" href="${safe}">${safe}</a>` : html`<span class="url">${url} (not linked: not an https address)</span>`;
}

const reviewFlag = (entry) => (underReview(entry) ? html` <strong>Under review.</strong>` : "");
const statusBadge = (entry) => html`<span class="status ${statusKey(entry)}">${statusLabel(entry)}</span>`;
// "Cameras" becomes "cameras" inside a sentence; "TVs" stays as it is.
const inSentence = (label) => (/^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label);

// ---------- Layout ----------
const CSS = html`<style>
:root{color:#1b1b1b;background:#fff;font:1rem/1.55 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
body{max-width:46rem;margin:0 auto;padding:0 1rem}
a{color:#0b57d0}
a:focus-visible,input:focus-visible{outline:3px solid #1b1b1b;outline-offset:2px}
.skip{position:absolute;left:-10000px}
.skip:focus{position:static}
header{padding:.75rem 0;border-bottom:1px solid #c4c4c4}
.site-name{font-weight:700;font-size:1.15rem;text-decoration:none}
h1{font-size:1.75rem;line-height:1.25;margin:1.25rem 0 .75rem}
h2{font-size:1.25rem;margin:1.75rem 0 .5rem}
.crumbs{list-style:none;padding:0;margin:1rem 0 0;font-size:.9rem}
.crumbs li{display:inline}
.crumbs li+li::before{content:" / ";color:#555}
.answer{font-size:1.2rem;margin-bottom:.25rem}
.regions{margin-top:0}
.disclaimer{font-size:.9rem;color:#444}
.status{display:inline-block;padding:0 .45em;border-radius:.25em;font-weight:600}
.supported{background:#e3f2e6;color:#0b4f1f}
.ending_soon{background:#fdf0db;color:#6a3700}
.minimum_passed{background:#ece6f5;color:#46297d}
.ended{background:#fbe5e3;color:#8a1c17}
.unknown{background:#eceff1;color:#36454f}
dt{font-weight:600}
dd{margin:0 0 .75rem}
blockquote{margin:0;padding:.5rem 1rem;border-left:4px solid #6b6b6b;background:#f5f5f5}
blockquote p{margin:0}
figure{margin:0 0 1.25rem}
figcaption{font-size:.9rem;margin-top:.35rem}
.url{overflow-wrap:anywhere}
.devices li{margin-bottom:.6rem}
.muted{color:#555}
input[type=search]{font:inherit;box-sizing:border-box;width:100%;max-width:32rem;padding:.5rem;border:1px solid #6b6b6b;border-radius:.25rem}
label{display:block;font-weight:600;margin-bottom:.25rem}
footer{margin-top:3rem;padding:1rem 0 2rem;border-top:1px solid #c4c4c4;font-size:.9rem;color:#444}
footer ul{padding:0;list-style:none}
footer li{display:inline;margin-right:1rem}
</style>`;

// Loads search.js and the index only once the search box is used, so the home page stays light.
const SEARCH_LOADER = html`<script type="module">
const form = document.getElementById("search");
const input = document.getElementById("q");
const count = document.getElementById("search-count");
const base = form.dataset.base;
let started = false;
function start() {
  if (started) return;
  started = true;
  Promise.all([
    import(base + "/search.js"),
    fetch(base + "/search-index.json").then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }),
  ])
    .then(([search, data]) => search.attachSearch({ input, count, list: document.getElementById("search-results"), devices: data.devices, base }))
    .catch(() => {
      started = false;
      count.textContent = "Search could not load. You can still browse by brand or category below.";
    });
}
input.addEventListener("focus", start);
input.addEventListener("input", start);
form.addEventListener("submit", (event) => event.preventDefault());
</script>`;

const link = (ctx, path) => `${ctx.base}${path}`;
const absolute = (ctx, path) => `${ctx.siteUrl}${ctx.base}${path}`;
const disclaimerNote = (ctx) => html`<p class="disclaimer">${DISCLAIMER} <a href="${link(ctx, "/methodology/")}">How the dates are checked</a>.</p>`;

function footer(ctx) {
  return html`<footer>
<p>Status as at ${shortTime(ctx.today)}.</p>
<p>${DISCLAIMER}</p>
<p><a href="${REPO_URL}">Source code on GitHub</a> under the <a href="${AGPL_URL}">AGPL-3.0-or-later</a> licence. Data licence: <a href="${ODBL_URL}">ODbL 1.0</a>. ${ctx.attribution} Quoted manufacturer statements remain the property of their owners.</p>
<nav aria-label="Site"><ul>
<li><a href="${link(ctx, "/methodology/")}">Methodology</a></li>
<li><a href="${link(ctx, "/corrections/")}">Corrections</a></li>
<li><a href="${link(ctx, "/about/")}">About</a></li>
<li><a href="${link(ctx, "/api/v1/devices.json")}">Data feed (JSON)</a></li>
</ul></nav>
</footer>`;
}

function layout(ctx, { path, title, description, body, head }) {
  return html`<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
${ctx.noindex ? html`<meta name="robots" content="noindex">` : ""}
<link rel="canonical" href="${absolute(ctx, path)}">
<link rel="icon" href="data:,">
${CSS}
${head}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header><a class="site-name" href="${link(ctx, "/")}">Patchlife</a></header>
<main id="main">
${body}
</main>
${footer(ctx)}
</body>
</html>
`;
}

function breadcrumbs(ctx, trail) {
  return html`<nav aria-label="Breadcrumb"><ol class="crumbs">${trail.map(([name, path], i) =>
    i === trail.length - 1 ? html`<li aria-current="page">${name}</li>` : html`<li><a href="${link(ctx, path)}">${name}</a></li>`,
  )}</ol></nav>`;
}

// Each row gives the answer with "as published by <brand>" and the checked date, the regions and any review flag, and
// links to the model page, which shows the quote and the source link (DATA-POLICY Display).
function deviceList(ctx, items) {
  return html`<ul class="devices">${items.map(
    ({ record, entry }) => html`<li><a href="${link(ctx, `/devices/${record.id}/`)}">${displayName(record.brand, record.model)}</a><br>
${statusBadge(entry)} ${answerText(entry)} <span class="muted">${regionText(entry)}.</span>${reviewFlag(entry)}</li>`,
  )}</ul>`;
}

// ---------- Pages ----------
function modelPage(ctx, { record, entry }) {
  const name = displayName(record.brand, record.model);
  const path = `/devices/${record.id}/`;
  const brandPath = `/brands/${record.brand_slug}/`;
  const aliases = (record.aliases ?? []).filter((alias) => alias.normalize("NFKC").toLowerCase() !== name.normalize("NFKC").toLowerCase());
  const conditions = record.support.conditions;
  const description = summaryText(entry);
  const structured = jsonLd({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": absolute(ctx, path),
    url: absolute(ctx, path),
    name: `${name} security updates`,
    description,
    inLanguage: "en-AU",
    ...(record.verification.checked ? { dateModified: record.verification.checked } : {}),
    about: { "@type": "Thing", name, ...(aliases.length ? { alternateName: aliases } : {}) },
    mentions: { "@type": "Organization", name: record.brand },
    citation: record.evidence.map((ev) => ({
      "@type": "CreativeWork",
      ...(httpsUrl(ev.url) ? { url: httpsUrl(ev.url) } : {}),
      ...(ev.quote ? { text: ev.quote } : {}),
    })),
    license: ODBL_URL,
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absolute(ctx, "/") },
        { "@type": "ListItem", position: 2, name: record.brand, item: absolute(ctx, brandPath) },
        { "@type": "ListItem", position: 3, name, item: absolute(ctx, path) },
      ],
    },
  });
  const quoted = record.evidence.filter((ev) => ev.quote);
  const searched = record.evidence.filter((ev) => !ev.quote);
  const body = html`${breadcrumbs(ctx, [["Home", "/"], [record.brand, brandPath], [name, path]])}
<h1>${name}</h1>
<p class="answer">${answerText(entry)}</p>
<p class="regions">${regionText(entry)}.${reviewFlag(entry)}</p>
${disclaimerNote(ctx)}
<dl>
<dt>Status</dt>
<dd>${statusBadge(entry)} Status as at ${shortTime(ctx.today)}. ${statusNote(entry)}</dd>
<dt>Time left</dt>
<dd>${timeLeftText(record, entry, ctx.today)}</dd>
<dt>Support period</dt>
<dd>${supportPeriod(record, entry)}</dd>
${conditions ? html`<dt>Conditions</dt>
<dd>${conditions}</dd>` : ""}
${aliases.length ? html`<dt>Also known as</dt>
<dd>${aliases.join(", ")}</dd>` : ""}
<dt>Category</dt>
<dd><a href="${link(ctx, `/categories/${record.category}/`)}">${CATEGORY_LABELS[record.category]}</a></dd>
${record.support.rule === "none_published" ? "" : html`<dt>Evidence check</dt>
<dd>${evidenceCheck(record)}</dd>`}
</dl>
<h2>Evidence</h2>
${quoted.map(
  (ev) => html`<figure>
<blockquote${httpsUrl(ev.url) ? html` cite="${httpsUrl(ev.url)}"` : ""}><p>${ev.quote}</p></blockquote>
<figcaption>${REGIME_LABELS[ev.regime] ?? ev.regime}, retrieved ${shortTime(ev.retrieved)}. Source: ${sourceLink(ev.url)}${ev.archive_url ? html`. Archived copy: ${sourceLink(ev.archive_url)}` : ""}</figcaption>
</figure>`,
)}
${searched.length ? html`<p>Pages searched:</p>
<ul>${searched.map((ev) => html`<li>${sourceLink(ev.url)}, ${shortTime(ev.retrieved)}</li>`)}</ul>` : ""}
<h2>Something wrong?</h2>
<p><a href="${CORRECTION_URL}">Report a correction</a> and link the manufacturer's own page. Dates only change when a primary source supports the change.</p>`;
  return layout(ctx, { path, title: `${name} security updates | Patchlife`, description, head: structured, body });
}

function listPage(ctx, { path, title, heading, intro, trail, items }) {
  return layout(ctx, {
    path,
    title: `${title} | Patchlife`,
    description: `${heading}: when each model stops getting security updates, as published by the manufacturer.`,
    body: html`${breadcrumbs(ctx, trail)}
<h1>${heading}</h1>
<p>${intro} Status as at ${shortTime(ctx.today)}.</p>
${disclaimerNote(ctx)}
${deviceList(ctx, items)}`,
  });
}

function homePage(ctx, { items, brands, categories, coverage }) {
  return layout(ctx, {
    path: "/",
    title: "Patchlife: when smart devices stop getting security updates",
    description: "Look up when a smart device stops getting security updates, with the manufacturer's own words as evidence.",
    body: html`<h1>When does your smart device stop getting security updates?</h1>
<p>Patchlife looks up when smart devices stop getting security updates, and quotes the manufacturer's own words as evidence. So far it covers ${plural(items.length, "device")}: ${coverage}.</p>
<form id="search" role="search" data-base="${ctx.base}">
<label for="q">Search by brand, model or model number</label>
<input id="q" name="q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search">
</form>
<noscript><p>Search needs JavaScript. You can browse by brand or category below.</p></noscript>
${disclaimerNote(ctx)}
<p id="search-count" aria-live="polite"></p>
<ul id="search-results"></ul>
<h2>Browse by brand</h2>
<ul>${brands.map((b) => html`<li><a href="${link(ctx, `/brands/${b.slug}/`)}">${b.name}</a> (${plural(b.items.length, "model")})</li>`)}</ul>
<h2>Browse by category</h2>
<ul>${categories.map((c) => html`<li><a href="${link(ctx, `/categories/${c.slug}/`)}">${CATEGORY_LABELS[c.slug]}</a> (${plural(c.items.length, "model")})</li>`)}</ul>
<h2>How it works</h2>
<p>Every date quotes the manufacturer's statement and links to it. Nothing is estimated: when a manufacturer gives a rule such as "3 years after end of life" without the date, the page says so. <a href="${link(ctx, "/methodology/")}">Read the methodology</a>.</p>
${SEARCH_LOADER}`,
  });
}

function methodologyPage(ctx) {
  return layout(ctx, {
    path: "/methodology/",
    title: "Methodology | Patchlife",
    description: "Where Patchlife's security update dates come from, how quotes are checked and how status is worked out.",
    body: html`<h1>Methodology</h1>
<p>Patchlife records when a manufacturer says a device will stop getting security updates, and quotes the manufacturer's own words as evidence.</p>
<h2>Where the dates come from</h2>
<p>Each record uses the highest-ranked source available:</p>
<ol>
<li>The manufacturer's statement of compliance (under Australia's smart device rules or the UK PSTI regulations) or its security support page.</li>
<li>The manufacturer's end-of-life or lifecycle page, for dates such as when a model reached end of life.</li>
<li>A regulator registry, such as the US Cyber Trust Mark registry.</li>
</ol>
<p>News, forums, retailers, distributors and AI answers are only leads. They are never used as evidence.</p>
<h2>Quotes</h2>
<ul>
<li>Each record that gives a date or rule quotes, word for word, the shortest part of the source that states the date or rule for that model, up to 300 characters.</li>
<li>When the source is a table, the quote is the row's cell texts joined by single spaces, for example "Ring Video Doorbell 3 31 December 2027".</li>
<li>The quotes must state what the record states: the end date, any anchor date such as an end-of-life date, and the number of years in a rule.</li>
<li>Only quotes and facts are stored, never whole pages or images.</li>
</ul>
<h2>No estimated dates</h2>
<p>Dates are never inferred, estimated or rounded. When a manufacturer gives a rule such as "3 years after end of life" but has not published the end-of-life date, the page shows the rule in words and the status is unknown until the date is published. "At least" appears when the source says "at least" or "minimum". If a search finds no published support period, the page says so.</p>
<h2>Regions</h2>
<p>Each record lists the regions its statement covers, labelled for example "UK statement" or "Australian statement". When a manufacturer's policy names no region, the page says so. A statement for one region may not apply to the same model sold elsewhere.</p>
<h2>Status</h2>
<p>Status is worked out from the dates each time the site is built, and each page shows the date it applies to. An end date is the last day of the stated period. When the source says "at least", the date is the minimum the manufacturer publishes: updates may continue after it, and some manufacturers give some buyers longer. When the source gives only a month and year, the page shows the month, and the period counts as ended only after that month's last day.</p>
<dl>
<dt>Supported</dt><dd>More than 12 months of the stated period left.</dd>
<dt>Ending soon</dt><dd>12 months or less of the stated period left, up to and including the end date. For a month-only date, from 12 months before the month starts.</dd>
<dt>Minimum passed</dt><dd>The source gave a minimum period and its end date has passed. The manufacturer may still provide updates.</dd>
<dt>Ended</dt><dd>The end date has passed, and the source gave no minimum.</dd>
<dt>Unknown</dt><dd>No end date can be worked out, for example when a rule's anchor date has not been published.</dd>
</dl>
<h2>Checking quotes</h2>
<p>An automated check fetches each source page, normalises the text (Unicode NFKC, collapsed spaces, ignoring case) and confirms the quote is still there. When the quote is found, the record shows the date of that check. When a quote disappears, the record is marked "Under review" until new evidence is found. The policy is to re-check every record at least every 90 days.</p>
<h2>Disclaimer</h2>
<p>${DISCLAIMER}</p>`,
  });
}

function correctionsPage(ctx) {
  return layout(ctx, {
    path: "/corrections/",
    title: "Corrections | Patchlife",
    description: "How to report a wrong, outdated or missing security update date on Patchlife.",
    body: html`<h1>Corrections</h1>
<p>If a date on Patchlife is wrong, outdated or missing, please report it.</p>
<h2>How to report a correction</h2>
<ol>
<li>Open the <a href="${CORRECTION_URL}">report forms on GitHub</a> and choose "Wrong or outdated date". You need a free GitHub account.</li>
<li>Name the device as it appears on Patchlife.</li>
<li>Link the manufacturer's own page or statement of compliance.</li>
</ol>
<p>To suggest a device Patchlife doesn't cover yet, choose "Add a device" on the same page.</p>
<h2>How corrections are made</h2>
<p>A fix always comes from a primary source: the manufacturer's statement of compliance or security support page, its end-of-life page, or a regulator registry. Retailer pages, forums, news and AI answers can't be used as evidence, and a report on its own never changes a date. Every change to the data is public in the <a href="${REPO_URL}/commits/main/data/devices">repository history</a>.</p>
<h2>For site owners</h2>
<p>PatchlifeBot fetches manufacturers' public pages to check quotes. <a href="${CRAWLER_URL}">How PatchlifeBot works and how to opt out</a>.</p>`,
  });
}

function aboutPage(ctx, { coverage }) {
  return layout(ctx, {
    path: "/about/",
    title: "About | Patchlife",
    description: "What Patchlife is, why it exists, and how its code and data are licensed.",
    body: html`<h1>About Patchlife</h1>
<p>Smart devices stop getting security updates long before they stop working, and buyers rarely know when. Patchlife looks up when a smart device stops getting security updates, and quotes the manufacturer's own words as evidence. So far it covers ${coverage}.</p>
<h2>Why</h2>
<p>Australia's smart device rules apply to most household smart devices made from 4 March 2026, and makers must publish how long a device gets security updates (<a href="${HOME_AFFAIRS_URL}">Department of Home Affairs</a>). The UK has required a statement of compliance since 29 April 2024 under its PSTI regulations (<a href="${PSTI_URL}">Cooley</a>). These statements are spread across many support pages and PDFs, often as a rule such as "3 years after end of life" rather than a date. Patchlife collects them in one place, with a quote and a link for every date.</p>
<h2>What Patchlife doesn't do</h2>
<p>Patchlife doesn't publish reviews, ratings or brand rankings without a published methodology, give legal advice, certify compliance, or collect retailer prices or reviews.</p>
<h2>Open code and data</h2>
<ul>
<li>The code is free software under the <a href="${AGPL_URL}">GNU Affero General Public License v3.0 or later</a>: <a href="${REPO_URL}">source code on GitHub</a>.</li>
<li>The data is available under the <a href="${ODBL_URL}">Open Database License v1.0</a>. Attribute it as: "${ctx.attribution}" Quoted manufacturer statements remain the property of their owners and are included only as evidence. <a href="${NOTICE_URL}">Data licence details</a>.</li>
<li>Every record as JSON: <a href="${link(ctx, "/api/v1/devices.json")}">${link(ctx, "/api/v1/devices.json")}</a>. One record: ${link(ctx, "/api/v1/devices/")}&lt;id&gt;.json.</li>
</ul>
<h2>Who runs it</h2>
<p>Claude Code, an AI coding tool, builds and runs Patchlife. A human owner makes the decisions that need a person, such as money, accounts, legal text and publishing.</p>
<h2>Disclaimer</h2>
<p>${DISCLAIMER}</p>`,
  });
}

// ---------- Build ----------
export function readAttribution(noticePath = join(ROOT, "data/NOTICE.md")) {
  const match = readFileSync(noticePath, "utf8").match(/Attribute it as: "([^"]+)"/);
  if (!match) throw new Error(`no attribution line found in ${noticePath}`);
  return match[1];
}

// Every record under devicesDir. A file that does not parse to a mapping is reported with its path.
export function loadRecords(devicesDir) {
  if (!existsSync(devicesDir)) throw new Error(`devices directory not found: ${devicesDir}`);
  return listYamlFiles(devicesDir).map((file) => {
    let record;
    try {
      record = YAML.parse(readFileSync(file, "utf8"));
    } catch (err) {
      throw new Error(`${file}: ${err.message.split("\n")[0]}`);
    }
    if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`${file}: not a device record`);
    return record;
  });
}

export function normaliseBasePath(value = "") {
  const trimmed = value.trim().replace(/\/+$/, "");
  const base = trimmed && !trimmed.startsWith("/") ? `/${trimmed}` : trimmed;
  const segments = base.split("/").slice(1);
  if (!/^(\/[A-Za-z0-9._~-]+)*$/.test(base) || segments.some((s) => s === "." || s === "..")) {
    throw new Error(`BASE_PATH ${JSON.stringify(value)} may only hold path segments of letters, digits, ".", "_", "~" and "-", and no "." or ".." segment`);
  }
  return base;
}

// An http or https origin such as https://patchlife.tech, with no path, query, fragment, credentials or spaces. Links use
// BASE_PATH and absolute URLs use SITE_URL plus BASE_PATH, so a path here would put the two out of step.
export function normaliseSiteUrl(value) {
  const trimmed = String(value).trim();
  let url = null;
  try {
    url = new URL(trimmed);
  } catch {
    // reported below
  }
  const web = url && ["http:", "https:"].includes(url.protocol) && !url.search && !url.hash && !url.username && !url.password;
  if (!web) throw new Error(`SITE_URL ${JSON.stringify(trimmed)} must be a plain http or https origin with no spaces, query or fragment`);
  if (url.pathname !== "/") throw new Error(`SITE_URL ${JSON.stringify(trimmed)} must be an origin such as https://patchlife.tech: put the path in BASE_PATH`);
  return url.origin;
}

export function optionsFromEnv(env = process.env) {
  const today = (env.BUILD_DATE ?? "").trim() || new Date().toISOString().slice(0, 10);
  if (!isRealDate(today)) throw new Error(`BUILD_DATE ${JSON.stringify(today)} must be a real date in YYYY-MM-DD form`);
  return {
    basePath: normaliseBasePath(env.BASE_PATH ?? ""),
    siteUrl: normaliseSiteUrl(env.SITE_URL || DEFAULT_SITE_URL),
    today,
    noindex: !["", "0", "false"].includes(String(env.NOINDEX ?? "").trim().toLowerCase()),
  };
}

// A missing, empty or blank argument means the default.
const given = (arg, fallback) => resolve(arg?.trim() ? arg : fallback);
export const resolveOutDir = (arg) => given(arg, join(ROOT, "_site"));

const realPath = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};
// True when path is dir or inside it.
const within = (dir, path) => {
  const rel = relative(dir, path);
  return !(rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel));
};

// Every path buildSite writes, relative to the output folder: its files, and the folders that hold them.
const BUILD_FILE =
  /^(?:index\.html|robots\.txt|sitemap\.xml|search-index\.json|search\.js|(?:about|methodology|corrections)\/index\.html|(?:devices|brands|categories)\/[a-z0-9]+(?:-[a-z0-9]+)*\/index\.html|api\/v1\/devices\.json|api\/v1\/devices\/[a-z0-9]+(?:-[a-z0-9]+)*\.json)$/;
const BUILD_FOLDER = /^(?:about|methodology|corrections|devices|brands|categories|api|api\/v1|api\/v1\/devices|(?:devices|brands|categories)\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;

// True when everything under dir is a file or folder buildSite writes (so no symlinks, dotfiles, .git, CNAME or notes)
// and api/v1/devices.json has the shape of this build's feed.
function isEarlierBuild(dir) {
  const onlyBuildOutput = (rel) =>
    readdirSync(join(dir, rel), { withFileTypes: true }).every((entry) => {
      const path = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) return BUILD_FOLDER.test(path) && onlyBuildOutput(path);
      return entry.isFile() && BUILD_FILE.test(path);
    });
  if (!onlyBuildOutput("")) return false;
  try {
    const feed = JSON.parse(readFileSync(join(dir, "api", "v1", "devices.json"), "utf8"));
    const named = (value) => typeof value === "string" && value !== "";
    return (
      feed?.license === "ODbL-1.0" &&
      named(feed.license_url) &&
      named(feed.attribution) &&
      named(feed.notice_url) &&
      isRealDate(feed.build_date) &&
      Array.isArray(feed.devices) &&
      feed.count === feed.devices.length
    );
  } catch {
    return false;
  }
}

const isSymlink = (path) => {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
};

// Why the CLI must not empty outDir, or null when it may.
export function unsafeOutDirReason(outDir, { cwd = process.cwd(), root = ROOT, devicesDir = join(ROOT, "data/devices") } = {}) {
  const out = realPath(outDir);
  if (within(out, realPath(cwd))) return "it is the current directory or one of its parents";
  if (within(out, realPath(root))) return "it is the repository or one of its parents";
  if (within(out, realPath(devicesDir))) return "it holds the device records";
  if (!existsSync(out)) return isSymlink(outDir) ? "it is a symlink whose target is missing" : null;
  if (!statSync(out).isDirectory()) return "it is a file";
  if (readdirSync(out).length && !isEarlierBuild(out)) return "it is not empty and is not an earlier site build";
  return null;
}

// Removes what is inside dir, keeping dir itself, so a symlinked or mounted output folder stays in place. A missing dir
// is left for buildSite to create.
function emptyDir(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) rmSync(join(dir, name), { recursive: true, force: true });
}

const byName = (a, b) =>
  displayName(a.record.brand, a.record.model).localeCompare(displayName(b.record.brand, b.record.model), "en-AU", { numeric: true, sensitivity: "base" }) ||
  a.record.id.localeCompare(b.record.id);

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const slug = key(item);
    if (!groups.has(slug)) groups.set(slug, []);
    groups.get(slug).push(item);
  }
  return [...groups].map(([slug, members]) => ({ slug, items: members })).sort((a, b) => a.slug.localeCompare(b.slug));
}

// Writes the site into outDir and returns { records, pages }. Paths come from ids and slugs, which must be plain slugs.
export function buildSite({ records, outDir, basePath = "", siteUrl = DEFAULT_SITE_URL, today, noindex = false, attribution = readAttribution() }) {
  if (!isRealDate(today)) throw new Error(`BUILD_DATE ${JSON.stringify(today)} must be a real date in YYYY-MM-DD form`);
  const ctx = { base: normaliseBasePath(basePath), siteUrl: normaliseSiteUrl(siteUrl), today, noindex, attribution };
  for (const record of records) {
    if (!SLUG.test(record.id ?? "") || !SLUG.test(record.brand_slug ?? "")) throw new Error(`record "${record.id}" needs a slug id and brand_slug`);
    if (!Object.hasOwn(CATEGORY_LABELS, record.category ?? "")) throw new Error(`${record.id}: no label for category "${record.category}"`);
  }

  const items = records
    .map((record) => {
      const status = computeStatus(record, today);
      return { record, status, entry: indexEntry(record, status) };
    })
    .sort(byName);
  const brands = groupBy(items, (item) => item.record.brand_slug).map((group) => ({ ...group, name: group.items[0].record.brand }));
  const categories = groupBy(items, (item) => item.record.category);
  const coverage = listWords(categories.map((c) => inSentence(CATEGORY_LABELS[c.slug])));
  const pages = [];
  const write = (path, content) => {
    const file = join(outDir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, String(content));
  };
  const writePage = (path, content) => {
    write(`${path}index.html`, content);
    pages.push(path);
  };

  writePage("/", homePage(ctx, { items, brands, categories, coverage }));
  for (const item of items) writePage(`/devices/${item.record.id}/`, modelPage(ctx, item));
  for (const brand of brands) {
    writePage(`/brands/${brand.slug}/`, listPage(ctx, {
      path: `/brands/${brand.slug}/`,
      title: `${brand.name} security updates`,
      heading: `${brand.name} security updates`,
      intro: `${plural(brand.items.length, "model")} from ${brand.name}.`,
      trail: [["Home", "/"], [brand.name, `/brands/${brand.slug}/`]],
      items: brand.items,
    }));
  }
  for (const category of categories) {
    const label = CATEGORY_LABELS[category.slug];
    writePage(`/categories/${category.slug}/`, listPage(ctx, {
      path: `/categories/${category.slug}/`,
      title: `${label}: security update end dates`,
      heading: label,
      intro: `${plural(category.items.length, "model")} in this category.`,
      trail: [["Home", "/"], [label, `/categories/${category.slug}/`]],
      items: category.items,
    }));
  }
  writePage("/methodology/", methodologyPage(ctx));
  writePage("/corrections/", correctionsPage(ctx));
  writePage("/about/", aboutPage(ctx, { coverage }));

  // JSON feed (SPEC 4): every response carries the licence, the attribution line and the build date.
  const licence = { license: "ODbL-1.0", license_url: ODBL_URL, attribution, notice_url: NOTICE_URL, build_date: today };
  const feedDevice = ({ record, status }) => ({ ...record, status, url: absolute(ctx, `/devices/${record.id}/`) });
  write("/api/v1/devices.json", JSON.stringify({ ...licence, count: items.length, devices: items.map(feedDevice) }));
  for (const item of items) write(`/api/v1/devices/${item.record.id}.json`, JSON.stringify({ ...licence, device: feedDevice(item) }));

  write("/search-index.json", JSON.stringify({ license: "ODbL-1.0", attribution, build_date: today, devices: items.map((item) => item.entry) }));
  copyFileSync(join(ROOT, "site/search.js"), join(outDir, "search.js"));

  // With noindex, pages stay crawlable so search engines can see the tag, but there is no sitemap to offer them.
  if (ctx.noindex) {
    write("/robots.txt", "User-agent: *\nAllow: /\n");
  } else {
    const urls = pages.map((path) => `  <url><loc>${escapeHtml(absolute(ctx, path))}</loc></url>`).join("\n");
    write("/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
    write("/robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${absolute(ctx, "/sitemap.xml")}\n`);
  }

  return { records: items.length, pages: pages.length };
}

// import.meta.main (Node 22.18 and later) is true only for the entry point, so importing this module never runs the CLI,
// and a run through a symlinked path still does.
if (import.meta.main) {
  try {
    const outDir = resolveOutDir(process.argv[2]);
    const devicesDir = given(process.argv[3], join(ROOT, "data/devices"));
    const records = loadRecords(devicesDir);
    if (!records.length) throw new Error(`no device records found in ${devicesDir}`);
    const options = optionsFromEnv();
    const reason = unsafeOutDirReason(outDir, { devicesDir });
    if (reason) throw new Error(`refusing to empty ${outDir}: ${reason}`);
    emptyDir(outDir);
    const result = buildSite({ records, outDir, ...options });
    console.log(`${result.pages} page(s) for ${result.records} record(s) written to ${relative(process.cwd(), outDir) || "."}`);
  } catch (err) {
    console.error(`build-site: ${err.message}`);
    process.exit(1);
  }
}
