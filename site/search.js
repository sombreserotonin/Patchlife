// Client-side search for the home page (SPEC 4), plus the wording the site generator shares with it.
// matchDevices is pure, so the same file runs in the browser and in node:test. attachSearch is the only part that touches the DOM.

export const STATUS_LABELS = { supported: "Supported", ending_soon: "Ending soon", ended: "Ended", unknown: "Unknown" };

const LONG_DATE = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// "2027-12-31" becomes "31 December 2027".
export const longDate = (isoDate) => LONG_DATE.format(new Date(`${isoDate}T00:00:00Z`));

const fold = (text) => String(text).normalize("NFKC").toLowerCase();
const squash = (text) => text.replace(/[^\p{L}\p{N}]+/gu, "");

// "Ring" + "Video Doorbell 3" becomes "Ring Video Doorbell 3"; a model that already starts with the brand is left alone.
export function displayName(brand, model) {
  return fold(model).startsWith(`${fold(brand)} `) ? model : `${brand} ${model}`;
}

// One line about the end date, for lists and search results.
export function supportSummary({ status, end_date: end, at_least: atLeast, rule }) {
  if (rule === "none_published") return "No support period published";
  if (!end) return "No end date published";
  if (status === "ended") return atLeast ? `Minimum support period ended on ${longDate(end)}` : `Security updates ended on ${longDate(end)}`;
  return `Security updates until ${atLeast ? "at least " : ""}${longDate(end)}`;
}

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
        item.append(link, `: ${STATUS_LABELS[device.status] ?? device.status}. ${supportSummary(device)}.`);
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
