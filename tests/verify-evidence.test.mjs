import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { htmlToText, normalise, pageReport, pageText, pdfToText, quoteMatches, selectRecords, verifyDevices, verifyRecord } from "../scripts/verify-evidence.mjs";
import { validateDevices } from "../scripts/validate-data.mjs";

const html = readFileSync(new URL("./fixtures/evidence/ring-policy.html", import.meta.url), "utf8");
const page = htmlToText(html);
// A one-page PDF in Helvetica 12 pt that draws each [x, y, text] in the order given.
function makePdf(cells) {
  const esc = (s) => s.replace(/[\\()]/g, "\\$&");
  const stream = cells.map(([x, y, text]) => `BT /F1 12 Tf ${x} ${y} Td (${esc(text)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((body, i) => {
    const at = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((at) => `${String(at).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
// Three lines of text. pdf.js detaches the bytes it reads, so each use builds a fresh copy.
const pdf = () => makePdf([[72, 720, "Acme end-of-life dates"], [72, 700, "Router 2 End of Life 31 March 2025"], [72, 680, "Models <with> notes & more"]]);
const TODAY = "2026-10-21";
const record = (quote = "Ring Video Doorbell 3 31 December 2027") => ({
  support: { rule: "fixed_date" },
  evidence: [{ url: "https://example.test/policy", quote }],
  verification: { status: "unverified", checked: null, text_sha256: null },
});

test("normalise applies NFKC, collapses whitespace and ignores case", () => {
  assert.equal(normalise("  Ｒing  Video\n\tDoorbell "), "ring video doorbell");
});

test("htmlToText drops scripts and styles and joins table cells with single spaces", () => {
  const text = normalise(htmlToText(html));
  assert.ok(text.includes("ring video doorbell 3 31 december 2027"));
  assert.ok(!text.includes("color:red"));
  assert.ok(!text.includes("var a"));
});

test("htmlToText decodes entities", () => {
  assert.ok(normalise(htmlToText(html)).includes("ring’s policy"));
});

test("htmlToText drops comments and inline tags without adding spaces", () => {
  assert.equal(normalise(htmlToText("Doorbell <!-- -->3<!-- -->.")), "doorbell 3.");
  assert.equal(normalise(htmlToText("until <strong>31 December 2027</strong>.")), "until 31 december 2027.");
  assert.equal(normalise(htmlToText("31<sup>st</sup> December")), "31st december");
  assert.equal(normalise(htmlToText("<td>Ring</td><td>31 Dec</td><abbr>EOL</abbr><br>x")), "ring 31 dec eol x");
});

test("htmlToText decodes Latin-1 and typographic entities, and normalise drops invisible characters", () => {
  assert.equal(normalise(htmlToText("Ring&reg; Cam&trade; &Eacute;t&eacute; &frac12;&hellip;")), "ring® camtm été 1⁄2...");
  assert.equal(normalise("Door\u00adbell\u200b 3\ufeff"), "doorbell 3");
});

test("a quote matches regardless of case and spacing", () => {
  assert.ok(quoteMatches("RING video  doorbell 3 31 December 2027", htmlToText(html)));
});

test("a changed date does not match", () => {
  assert.equal(quoteMatches("Ring Video Doorbell 3 31 December 2028", htmlToText(html)), false);
});

test("a matching quote marks the record verified with the hash of the normalised text", () => {
  const result = verifyRecord(record(), [page], TODAY);
  assert.equal(result.ok, true);
  assert.deepEqual(result.verification, {
    status: "verified",
    checked: TODAY,
    text_sha256: createHash("sha256").update(normalise(htmlToText(html))).digest("hex"),
  });
});

test("a missing quote fails and leaves verification untouched", () => {
  const result = verifyRecord(record("Ring Video Doorbell 3 31 December 2028"), [page], TODAY);
  assert.equal(result.ok, false);
  assert.match(result.reason, /quote not found/);
  assert.equal(result.verification, undefined);
});

test("every evidence item must match", () => {
  const rec = record();
  rec.evidence.push({ url: "https://example.test/other", quote: "not on this page" });
  assert.equal(verifyRecord(rec, [page, page], TODAY).ok, false);
});

test("none_published has no quote to check and is not verified here", () => {
  const rec = { ...record(), support: { rule: "none_published" } };
  rec.evidence = [{ url: "https://example.test/policy" }];
  const result = verifyRecord(rec, [page], TODAY);
  assert.equal(result.ok, false);
  assert.match(result.reason, /none_published/);
});

test("a missing page text fails", () => {
  const result = verifyRecord(record(), [null], TODAY);
  assert.equal(result.ok, false);
  assert.match(result.reason, /no text/);
});

// verifyDevices runs against a temporary copy of the valid fixtures with a fake fetcher.
const PAGES = {
  "https://example.com/acme/security": "<p>Acme Cam 1 31 December 2029</p>",
  "https://example.com/acme/leap-5": "<p>Acme Leap 5 gets security updates for at least 3 years from launch on 29 February 2024.</p>",
  "https://example.com/acme/psti": "<p>The defined support period will end 3 years after the product's end-of-life date.</p><p>This statement covers Acme Plug 3.</p>",
  "https://example.com/acme/eol": "<table><tr><td>Router 2</td><td>End of Life</td><td>31 March 2025</td></tr></table>",
};

// The page hash file sits next to the devices folder, as data/sources/page-hashes.json sits next to data/devices.
function setupDevices(pages = PAGES) {
  const root = mkdtempSync(join(tmpdir(), "patchlife-"));
  const dir = join(root, "devices");
  cpSync(new URL("./fixtures/valid", import.meta.url), dir, { recursive: true });
  const fetched = [];
  const get = async (url) => {
    fetched.push(url);
    if (!(url in pages)) throw Object.assign(new Error(`HTTP 404 for ${url}`), { status: 404, url });
    return { url, contentType: "text/html", text: pages[url] };
  };
  const file = (id) => join(dir, "acme", `${id}.yaml`);
  const read = (id) => readFileSync(file(id), "utf8");
  return { dir, get, fetched, file, read, hashFile: join(root, "page-hashes.json") };
}

const outcomes = (results) => Object.fromEntries(results.map((r) => [r.id, r.outcome]));
const beforeVerification = (yaml) => yaml.slice(0, yaml.indexOf("verification:"));

test("verifyDevices writes verified, marks a changed quote stale and skips none_published", async () => {
  const { dir, get, fetched, read } = setupDevices();
  const before = read("acme-router-2");
  const { results } = await verifyDevices(dir, { get, today: TODAY });
  assert.deepEqual(outcomes(results), {
    "acme-cam-1": "stale",
    "acme-hub-4": "skipped",
    "acme-leap-5": "verified",
    "acme-plug-3": "verified",
    "acme-router-2": "verified",
  });
  assert.match(read("acme-leap-5"), /status: verified\n  checked: "2026-10-21"\n  text_sha256: [a-f0-9]{64}\n/);
  assert.match(read("acme-cam-1"), /status: stale\n  checked: "2026-10-02"/);
  assert.equal(beforeVerification(read("acme-router-2")), beforeVerification(before));
  assert.equal(fetched.filter((u) => u === "https://example.com/acme/psti").length, 1);
  assert.deepEqual(validateDevices(dir, { today: TODAY }).errors, []);
});

test("verifyDevices leaves an unverified record unchanged when its quote is missing", async () => {
  const { dir, get, read } = setupDevices({ ...PAGES, "https://example.com/acme/leap-5": "<p>Nothing here</p>" });
  const before = read("acme-leap-5");
  const { results } = await verifyDevices(dir, { get, today: TODAY, ids: ["acme-leap-5"] });
  assert.deepEqual(results, [{ id: "acme-leap-5", outcome: "failed", reason: "quote not found at https://example.com/acme/leap-5" }]);
  assert.equal(read("acme-leap-5"), before);
});

test("verifyDevices leaves files unchanged when a page cannot be fetched or is not text", async () => {
  const pages = { ...PAGES };
  delete pages["https://example.com/acme/leap-5"];
  const { dir, get, read } = setupDevices(pages);
  const image = async (url) => (url.endsWith("/eol") ? { url, contentType: "image/png", bytes: new Uint8Array([137, 80, 78, 71]) } : get(url));
  const before = { leap: read("acme-leap-5"), router: read("acme-router-2") };
  const { results } = await verifyDevices(dir, { get: image, today: TODAY, ids: ["acme-leap-5", "acme-router-2"] });
  assert.deepEqual(outcomes(results), { "acme-leap-5": "error", "acme-router-2": "error" });
  assert.match(results.find((r) => r.id === "acme-router-2").reason, /unsupported content type "image\/png"/);
  assert.deepEqual({ leap: read("acme-leap-5"), router: read("acme-router-2") }, before);
});

test("pdfToText returns a PDF's text as written, and throws on bytes that are not a PDF", async () => {
  assert.equal(await pdfToText(pdf()), "Acme end-of-life dates\nRouter 2 End of Life 31 March 2025\nModels <with> notes & more");
  await assert.rejects(pdfToText(new TextEncoder().encode("<p>not a pdf</p>")), /Invalid PDF structure/);
});

test("pdfToText reads a table row by row whatever order the cells are drawn in", async () => {
  // Each row's date is drawn before its model, so drawing order would give "31 March 2025Router 2".
  const dateFirst = makePdf([[400, 720, "31 March 2025"], [72, 720, "Router 2"], [400, 700, "30 June 2026"], [72, 700, "Camera 4"]]);
  assert.equal(await pdfToText(dateFirst), "Router 2 31 March 2025\nCamera 4 30 June 2026");
  // A whole column at a time: drawing order would put "Router 2" next to Router 1's date.
  const byColumn = makePdf([[72, 720, "Router 1"], [72, 700, "Router 2"], [400, 720, "30 June 2024"], [400, 700, "31 March 2025"]]);
  assert.equal(await pdfToText(byColumn), "Router 1 30 June 2024\nRouter 2 31 March 2025");
});

test("pdfToText joins pieces of a word without a space and keeps a raised suffix on its line", async () => {
  // "Rou" is 22.008 pt wide in 12 pt Helvetica; "Router" is 37.356 pt and a space 3.336 pt.
  assert.equal(await pdfToText(makePdf([[72, 720, "Rou"], [94.008, 720, "ter 2"]])), "Router 2");
  assert.equal(await pdfToText(makePdf([[72, 720, "Router"], [112.692, 720, "2"]])), "Router 2");
  assert.equal(await pdfToText(makePdf([[72, 720, "31"], [85.4, 724, "st"], [97, 720, "December 2027"]])), "31st December 2027");
});

test("verifyDevices checks quotes in a PDF and hashes its text", async () => {
  const pages = { ...PAGES };
  delete pages["https://example.com/acme/eol"];
  const { dir, get, read, hashFile } = setupDevices(pages);
  const withPdf = async (url) => (url.endsWith("/eol") ? { url, contentType: "application/pdf", bytes: pdf() } : get(url));
  const { results, pages: read_ } = await verifyDevices(dir, { get: withPdf, today: TODAY, ids: ["acme-router-2"], hashFile });
  assert.deepEqual(results, [{ id: "acme-router-2", outcome: "verified" }]);
  const pdfText = normalise(await pdfToText(pdf()));
  const psti = normalise(htmlToText(PAGES["https://example.com/acme/psti"]));
  assert.match(read("acme-router-2"), new RegExp(`text_sha256: ${createHash("sha256").update(`${psti}\n${pdfText}`).digest("hex")}`));
  assert.deepEqual(read_.map((p) => p.url), ["https://example.com/acme/psti", "https://example.com/acme/eol"]);
  assert.equal(JSON.parse(readFileSync(hashFile, "utf8"))["https://example.com/acme/eol"], createHash("sha256").update(pdfText).digest("hex"));
});

test("pageText reports a PDF with no text, such as a scanned one, instead of an empty page", async () => {
  await assert.rejects(
    pageText({ url: "https://example.com/acme/scan.pdf", contentType: "application/pdf", bytes: makePdf([]) }),
    { message: "no text in PDF at https://example.com/acme/scan.pdf (scanned, or fonts pdf.js can't read)" },
  );
  assert.equal(await pageText({ url: "x", contentType: "text/html", text: "<p>a</p><p>b</p>" }), " a  b ");
});

test("verifyDevices reports an unreadable PDF as an error and changes nothing", async () => {
  const { dir, get, read } = setupDevices();
  const broken = async (url) => (url.endsWith("/eol") ? { url, contentType: "application/pdf", bytes: new TextEncoder().encode("%PDF-1.4 cut short") } : get(url));
  const before = read("acme-router-2");
  const { results } = await verifyDevices(dir, { get: broken, today: TODAY, ids: ["acme-router-2"] });
  assert.equal(results[0].outcome, "error");
  assert.match(results[0].reason, /^unreadable PDF at https:\/\/example\.com\/acme\/eol \(.+\)$/);
  assert.equal(read("acme-router-2"), before);
});

test("verifyDevices marks a verified record stale when its page is gone, but not on other errors", async () => {
  const gone = { ...PAGES };
  delete gone["https://example.com/acme/security"];
  const removed = setupDevices(gone);
  const { results } = await verifyDevices(removed.dir, { get: removed.get, today: TODAY, ids: ["acme-cam-1"] });
  assert.deepEqual(results, [{ id: "acme-cam-1", outcome: "stale", reason: "HTTP 404 for https://example.com/acme/security" }]);
  assert.match(removed.read("acme-cam-1"), /status: stale/);

  const down = setupDevices();
  const before = down.read("acme-cam-1");
  const failing = async () => { throw Object.assign(new Error("HTTP 500 for https://example.com/acme/security"), { status: 500 }); };
  assert.deepEqual(outcomes((await verifyDevices(down.dir, { get: failing, today: TODAY, ids: ["acme-cam-1"] })).results), { "acme-cam-1": "error" });
  assert.equal(down.read("acme-cam-1"), before);
});

// acme-cam-1 is verified and its quote is not on the page, so reading the redirected page would mark it stale.
test("verifyDevices reports a redirect to another origin or path as an error and leaves the record unchanged", async () => {
  const others = ["https://example.com/", "https://www.example.com/acme/security", "http://example.com/acme/security", "https://example.com:8443/acme/security"];
  for (const to of others) {
    const { dir, get, read } = setupDevices();
    const moved = async (url) => ({ ...(await get(url)), url: to });
    const before = read("acme-cam-1");
    const { results } = await verifyDevices(dir, { get: moved, today: TODAY, ids: ["acme-cam-1"] });
    assert.deepEqual(results, [{ id: "acme-cam-1", outcome: "error", reason: `redirected to ${to}` }]);
    assert.equal(read("acme-cam-1"), before);
  }
});

// The cited page itself was not removed, so a 404 or 410 after a redirect must not mark the record stale.
test("verifyDevices reports a redirect that ends in 404 or 410 as an error and leaves a verified record unchanged", async () => {
  for (const [to, status] of [["https://example.com/en-au/acme/security", 404], ["https://www.example.com/acme/security", 410]]) {
    const { dir, read } = setupDevices();
    const gone = async () => { throw Object.assign(new Error(`HTTP ${status} for ${to}`), { status, url: to }); };
    const before = read("acme-cam-1");
    const { results } = await verifyDevices(dir, { get: gone, today: TODAY, ids: ["acme-cam-1"] });
    assert.deepEqual(results, [{ id: "acme-cam-1", outcome: "error", reason: `redirected to ${to}, HTTP ${status}` }]);
    assert.equal(read("acme-cam-1"), before);
  }
});

test("verifyDevices still verifies after a redirect that changes only a trailing slash, query string or fragment", async () => {
  for (const suffix of ["/", "?hl=en", "#top", "/?ref=home"]) {
    const { dir, get } = setupDevices();
    const moved = async (url) => ({ ...(await get(url)), url: url + suffix });
    const { results } = await verifyDevices(dir, { get: moved, today: TODAY, ids: ["acme-leap-5"] });
    assert.deepEqual(results, [{ id: "acme-leap-5", outcome: "verified" }]);
  }
  // The other way round: the cited URL ends in a slash and the final URL drops it.
  const slash = setupDevices({ ...PAGES, "https://example.com/acme/leap-5/": PAGES["https://example.com/acme/leap-5"] });
  writeFileSync(slash.file("acme-leap-5"), slash.read("acme-leap-5").replace("acme/leap-5", "acme/leap-5/"));
  const dropped = async (url) => ({ ...(await slash.get(url)), url: url.replace(/\/$/, "") });
  assert.deepEqual((await verifyDevices(slash.dir, { get: dropped, today: TODAY, ids: ["acme-leap-5"] })).results, [{ id: "acme-leap-5", outcome: "verified" }]);
});

test("verifyDevices skips disputed records and reports unknown ids", async () => {
  const { dir, get, file, read } = setupDevices();
  writeFileSync(file("acme-cam-1"), read("acme-cam-1").replace("status: verified", "status: disputed"));
  const before = read("acme-cam-1");
  const { results } = await verifyDevices(dir, { get, today: TODAY, ids: ["acme-cam-1", "acme-nope"] });
  assert.deepEqual(results, [
    { id: "acme-cam-1", outcome: "skipped", reason: "disputed" },
    { id: "acme-nope", outcome: "error", reason: "no record with this id" },
  ]);
  assert.equal(read("acme-cam-1"), before);
});

// selectRecords is given records in file order. TODAY is 2026-10-21, so 30 days before it is 2026-09-21. c is verified
// with no date, which the schema forbids, so it counts as the oldest.
const due = (id, checked, status = "verified") => ({ id, support: { rule: "fixed_date" }, verification: { status, checked } });
const DUE = [
  due("a", "2026-09-21"),
  due("b", "2026-09-20"),
  due("c", null),
  due("d", "2026-01-01"),
  due("e", "2026-10-20"),
  due("u", null, "unverified"),
  due("s", "2025-01-01", "stale"),
];

test("selectRecords picks verified records checked more than due days ago, oldest first", () => {
  assert.deepEqual(selectRecords(DUE, { due: 30, today: TODAY }), ["c", "d", "b"]);
});

test("selectRecords counts a record checked exactly due days ago as not due, in UTC dates", () => {
  assert.deepEqual(selectRecords([due("a", "2026-09-21"), due("b", "2026-09-20")], { due: 30, today: TODAY }), ["b"]);
  assert.deepEqual(selectRecords([due("a", "2026-10-21"), due("b", "2026-10-20")], { due: 0, today: TODAY }), ["b"]);
  assert.deepEqual(selectRecords([due("a", "2024-02-29"), due("b", "2024-02-28")], { due: 1, today: "2024-03-01" }), ["b"]);
});

test("selectRecords applies the limit after sorting, and on its own takes the oldest verified records", () => {
  assert.deepEqual(selectRecords(DUE, { due: 30, limit: 2, today: TODAY }), ["c", "d"]);
  assert.deepEqual(selectRecords(DUE, { limit: 4, today: TODAY }), ["c", "d", "b", "a"]);
  assert.deepEqual(selectRecords(DUE, { limit: 0, today: TODAY }), []);
});

test("selectRecords narrows named ids, and with due or limit leaves out unverified and always skipped records", () => {
  const all = [...DUE, { ...due("n", null), support: { rule: "none_published" } }, due("x", "2026-01-01", "disputed")];
  const ids = ["x", "n", "s", "u", "e", "b"];
  assert.deepEqual(selectRecords(all, { today: TODAY }), ["a", "b", "c", "d", "e", "u", "s", "n", "x"]);
  assert.deepEqual(selectRecords(all, { ids, today: TODAY }), ["b", "e", "u", "s", "n", "x"]);
  assert.deepEqual(selectRecords(all, { ids, due: 30, today: TODAY }), ["b"]);
  assert.deepEqual(selectRecords(all, { limit: 9, today: TODAY }), ["c", "d", "b", "a", "e"]);
});

// Marks fixture records verified on the given dates, so that they can be due.
const verifiedOn = ({ file, read }, dates) => {
  for (const [id, checked] of Object.entries(dates)) {
    writeFileSync(file(id), read(id).replace("status: unverified", `status: verified\n  checked: "${checked}"`));
  }
};

// acme-cam-1 was checked 19 days ago and its quote is not on the page, so checking it would show up as stale.
test("verifyDevices with due and limit checks exactly the oldest due records, and nothing when none is due", async () => {
  const setup = setupDevices();
  verifiedOn(setup, { "acme-leap-5": "2026-03-01", "acme-plug-3": "2026-01-01", "acme-router-2": "2026-02-01" });
  const { dir, get, fetched } = setup;
  assert.deepEqual((await verifyDevices(dir, { get, today: TODAY, due: 30, limit: 2 })).results, [
    { id: "acme-plug-3", outcome: "verified" },
    { id: "acme-router-2", outcome: "verified" },
  ]);
  assert.deepEqual((await verifyDevices(dir, { get, today: TODAY, due: 30 })).results, [{ id: "acme-leap-5", outcome: "verified" }]);
  const fetches = fetched.length;
  assert.deepEqual((await verifyDevices(dir, { get, today: TODAY, due: 30 })).results, []);
  assert.equal(fetched.length, fetches);
});

// acme-cam-1 is not due and acme-leap-5 is unverified, so neither is checked, and neither is an unknown id.
test("verifyDevices with ids and due checks only the named records that are due, and reports an unknown id once", async () => {
  const setup = setupDevices();
  verifiedOn(setup, { "acme-router-2": "2026-02-01" });
  const ids = ["acme-cam-1", "acme-leap-5", "acme-router-2", "acme-nope", "acme-nope"];
  assert.deepEqual((await verifyDevices(setup.dir, { get: setup.get, today: TODAY, due: 30, ids })).results, [
    { id: "acme-router-2", outcome: "verified" },
    { id: "acme-nope", outcome: "error", reason: "no record with this id" },
  ]);
});

// Each page is hashed once, from the same normalised text the quotes are matched against.
const pageSha = (html) => createHash("sha256").update(normalise(htmlToText(html))).digest("hex");
const hashesOf = (pages) => Object.fromEntries(Object.keys(pages).sort().map((url) => [url, pageSha(pages[url])]));
const serve = (pages) => async (url) => ({ url, contentType: "text/html", text: pages[url] });

test("verifyDevices stores one hash per page, sorted by URL, and reports each page as not seen before on the first run", async () => {
  const { dir, get, read, hashFile } = setupDevices();
  const { pages } = await verifyDevices(dir, { get, today: TODAY, hashFile });
  assert.deepEqual(pages, [
    { url: "https://example.com/acme/security", change: "new" },
    { url: "https://example.com/acme/leap-5", change: "new" },
    { url: "https://example.com/acme/psti", change: "new" },
    { url: "https://example.com/acme/eol", change: "new" },
  ]);
  assert.equal(readFileSync(hashFile, "utf8"), `${JSON.stringify(hashesOf(PAGES), null, 2)}\n`);
  // For a record with one page, the page hash is the record's text_sha256.
  assert.match(read("acme-leap-5"), new RegExp(`text_sha256: ${pageSha(PAGES["https://example.com/acme/leap-5"])}\n`));
});

// Markup, spacing and case are not part of the normalised text, so changing them does not change the page.
test("verifyDevices reports a page as changed only when its normalised text changed, and updates only that hash", async () => {
  const { dir, get, hashFile } = setupDevices();
  await verifyDevices(dir, { get, today: TODAY, hashFile });
  const later = {
    ...PAGES,
    "https://example.com/acme/security": "<div>ACME  Cam 1\n31 December <b>2029</b></div>",
    "https://example.com/acme/eol": "<table><tr><td>Router 2</td><td>End of Life</td><td>30 April 2025</td></tr></table>",
  };
  const { pages } = await verifyDevices(dir, { get: serve(later), today: TODAY, hashFile });
  assert.deepEqual(pages, [
    { url: "https://example.com/acme/security", change: "unchanged" },
    { url: "https://example.com/acme/leap-5", change: "unchanged" },
    { url: "https://example.com/acme/psti", change: "unchanged" },
    { url: "https://example.com/acme/eol", change: "changed" },
  ]);
  assert.deepEqual(JSON.parse(readFileSync(hashFile, "utf8")), { ...hashesOf(PAGES), "https://example.com/acme/eol": pageSha(later["https://example.com/acme/eol"]) });
});

// acme-hub-4 is none_published, so its page is cited but never read. A page that redirects elsewhere or is not text
// is not read either.
test("verifyDevices keeps the stored hash of a page it could not read and drops hashes of pages no record cites", async () => {
  const { dir, get, hashFile } = setupDevices();
  writeFileSync(hashFile, JSON.stringify({
    "https://example.com/acme/hub-4": "c".repeat(64),
    "https://example.com/acme/moved": "b".repeat(64),
    "https://example.com/acme/security": "a".repeat(64),
  }));
  const failing = async (url) => {
    if (url.endsWith("/security")) throw Object.assign(new Error(`HTTP 500 for ${url}`), { status: 500 });
    if (url.endsWith("/leap-5")) return { ...(await get(url)), url: "https://example.com/" };
    if (url.endsWith("/eol")) return { ...(await get(url)), contentType: "image/png" };
    return get(url);
  };
  const { results, pages } = await verifyDevices(dir, { get: failing, today: TODAY, hashFile });
  assert.deepEqual(outcomes(results), {
    "acme-cam-1": "error",
    "acme-hub-4": "skipped",
    "acme-leap-5": "error",
    "acme-plug-3": "verified",
    "acme-router-2": "error",
  });
  assert.deepEqual(pages, [{ url: "https://example.com/acme/psti", change: "new" }]);
  assert.deepEqual(JSON.parse(readFileSync(hashFile, "utf8")), {
    "https://example.com/acme/hub-4": "c".repeat(64),
    "https://example.com/acme/psti": pageSha(PAGES["https://example.com/acme/psti"]),
    "https://example.com/acme/security": "a".repeat(64),
  });
});

test("verifyDevices creates no hash file when it reads no page", async () => {
  const { dir, get, hashFile } = setupDevices();
  assert.deepEqual(await verifyDevices(dir, { get, today: TODAY, due: 30, hashFile }), { results: [], pages: [] });
  assert.equal(existsSync(hashFile), false);
});

// A merge conflict left in the file must not silently reset every page to "not seen before".
test("verifyDevices stops before reading any page when the hash file is not a JSON object", async () => {
  for (const content of ["{\n<<<<<<< HEAD\n", "[]\n", "null\n"]) {
    const { dir, get, fetched, read, hashFile } = setupDevices();
    writeFileSync(hashFile, content);
    const before = read("acme-leap-5");
    await assert.rejects(verifyDevices(dir, { get, today: TODAY, hashFile }), { message: /^.*page-hashes\.json: / });
    assert.deepEqual(fetched, []);
    assert.equal(read("acme-leap-5"), before);
    assert.equal(readFileSync(hashFile, "utf8"), content);
  }
});

test("pageReport prints one line per page and a count of each kind", () => {
  const pages = [
    { url: "https://example.com/a", change: "changed" },
    { url: "https://example.com/b", change: "unchanged" },
    { url: "https://example.com/c", change: "new" },
    { url: "https://example.com/d", change: "unchanged" },
  ];
  assert.deepEqual(pageReport(pages), [
    "https://example.com/a: page changed",
    "https://example.com/b: page unchanged",
    "https://example.com/c: page not seen before",
    "https://example.com/d: page unchanged",
    "4 page(s) read: 1 changed, 2 unchanged, 1 not seen before",
  ]);
  assert.deepEqual(pageReport([]), ["0 page(s) read: 0 changed, 0 unchanged, 0 not seen before"]);
});

// `--limit 0` keeps the run offline if a bad value were ever accepted.
test("the CLI rejects a missing or too large option value with one line and exit code 2", () => {
  const script = fileURLToPath(new URL("../scripts/verify-evidence.mjs", import.meta.url));
  for (const args of [["--due"], ["--due", "123456", "--limit", "0"]]) {
    const run = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
    assert.equal(run.status, 2, run.stderr);
    assert.match(run.stderr, /^[^\n]*--due[^\n]*\n$/);
  }
});
