import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_BODY_BYTES, USER_AGENT, createFetcher, robotsAllows, ruleMatches } from "../scripts/polite-fetch.mjs";

const reply = (body, status = 200, headers = {}) => () => new Response(body, { status, headers: { "content-type": "text/html", ...headers } });

// routes: url -> reply, Error, or an array of them used in order. Unknown URLs get a 404.
function setup(routes) {
  let t = 0;
  const calls = [];
  const sleeps = [];
  const fetch = async (url, init) => {
    calls.push({ url, at: t, ua: init.headers["user-agent"], redirect: init.redirect, signal: init.signal });
    const route = Array.isArray(routes[url]) ? routes[url].shift() : routes[url];
    if (route instanceof Error) throw route;
    return route ? route() : new Response("", { status: 404 });
  };
  const get = createFetcher({ fetch, now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms; } });
  return { get, calls, sleeps, urls: () => calls.map((c) => c.url) };
}

test("robots: a PatchlifeBot group replaces the * group", () => {
  const txt = "User-agent: *\nDisallow: /\n\nUser-agent: PatchlifeBot\nDisallow: /private";
  assert.equal(robotsAllows(txt, "/support"), true);
  assert.equal(robotsAllows(txt, "/private/a"), false);
});

test("robots: the * group applies when no group names PatchlifeBot", () => {
  const txt = "User-agent: OtherBot\nDisallow: /\n\nUser-agent: *\nDisallow: /support # comment";
  assert.equal(robotsAllows(txt, "/support/a"), false);
  assert.equal(robotsAllows(txt, "/"), true);
});

test("robots: grouped user-agent lines share rules and match case-insensitively", () => {
  assert.equal(robotsAllows("User-agent: a\nuser-agent: patchlifebot\nDisallow: /", "/x"), false);
});

test("robots: the longest match wins and Allow wins a tie", () => {
  const txt = "User-agent: *\nDisallow: /a\nAllow: /a/b\nDisallow: /x\nAllow: /x";
  assert.equal(robotsAllows(txt, "/a/b/c"), true);
  assert.equal(robotsAllows(txt, "/a/c"), false);
  assert.equal(robotsAllows(txt, "/x"), true);
});

test("robots: a user-agent line with a version or the full user agent still names PatchlifeBot", () => {
  assert.equal(robotsAllows("User-agent: *\nAllow: /\n\nUser-agent: PatchlifeBot/0.1\nDisallow: /", "/x"), false);
  assert.equal(robotsAllows(`User-agent: *\nAllow: /\n\nUser-agent: ${USER_AGENT}\nDisallow: /`, "/x"), false);
});

test("robots: CR-only line endings", () => {
  assert.equal(robotsAllows("User-agent: *\rDisallow: /support\r", "/support/a"), false);
});

test("robots: non-ASCII rules match the percent-encoded URL path", () => {
  assert.equal(robotsAllows("User-agent: *\nDisallow: /de/über-uns", new URL("https://a.test/de/über-uns").pathname), false);
});

test("robots: * wildcards, $ anchors and empty Disallow", () => {
  const txt = "User-agent: *\nDisallow: /*.pdf$\nDisallow:";
  assert.equal(robotsAllows(txt, "/doc.pdf"), false);
  assert.equal(robotsAllows(txt, "/doc.pdf?x=1"), true);
  assert.equal(robotsAllows(txt, "/doc.html"), true);
  assert.equal(robotsAllows("", "/anything"), true);
});

test("sends the PatchlifeBot user agent with a timeout and returns the page", async () => {
  const { get, calls } = setup({ "https://a.test/p": reply("<p>hi</p>", 200, { "content-type": "text/HTML; charset=utf-8" }) });
  assert.deepEqual(await get("https://a.test/p"), { url: "https://a.test/p", contentType: "text/html", text: "<p>hi</p>" });
  assert.ok(calls.every((c) => c.ua === USER_AGENT && c.redirect === "manual" && c.signal instanceof AbortSignal));
});

test("timeoutMs bounds each request", async () => {
  // A slow server: the late reply keeps the event loop alive, since AbortSignal.timeout's own timer doesn't.
  const fetch = (url, init) => new Promise((resolve, reject) => {
    const late = setTimeout(resolve, 5000, new Response(""));
    init.signal.addEventListener("abort", () => (clearTimeout(late), reject(init.signal.reason)));
  });
  await assert.rejects(createFetcher({ fetch, timeoutMs: 20 })("https://a.test/p"), /^Error: robots\.txt unreachable \(.*timeout\) for https:\/\/a\.test$/);
});

test("a PDF comes back as bytes, not text", async () => {
  const bytes = new Uint8Array([37, 80, 68, 70, 0, 255]);
  const { get } = setup({ "https://a.test/p.pdf": reply(bytes, 200, { "content-type": "application/pdf" }) });
  assert.deepEqual(await get("https://a.test/p.pdf"), { url: "https://a.test/p.pdf", contentType: "application/pdf", bytes });
});

test("a page robots.txt disallows is never requested", async () => {
  const { get, urls } = setup({ "https://a.test/robots.txt": reply("User-agent: *\nDisallow: /p", 200, { "content-type": "text/plain" }) });
  await assert.rejects(get("https://a.test/p"), /robots.txt disallows/);
  assert.deepEqual(urls(), ["https://a.test/robots.txt"]);
});

test("robots.txt that fails with 5xx or a network error disallows everything", async () => {
  // Undici's shape for a request the proxy refuses: a cause whose code is 0.
  const refused = new TypeError("fetch failed", { cause: Object.assign(new Error("Request was cancelled."), { code: 0 }) });
  const down = setup({
    "https://a.test/robots.txt": [reply("", 500)],
    "https://b.test/robots.txt": new Error("ECONNRESET"),
    "https://c.test/robots.txt": refused,
  });
  await assert.rejects(down.get("https://a.test/p"), /robots.txt unreachable \(HTTP 500\) for https:\/\/a.test/);
  await assert.rejects(down.get("https://b.test/p"), /robots.txt unreachable \(ECONNRESET\) for https:\/\/b.test/);
  await assert.rejects(down.get("https://c.test/p"), /robots.txt unreachable \(Request was cancelled.\) for https:\/\/c.test/);
  assert.deepEqual(down.urls(), ["https://a.test/robots.txt", "https://b.test/robots.txt", "https://c.test/robots.txt"]);
});

test("robots.txt is fetched once per origin and requests to one host are a second apart", async () => {
  const { get, calls } = setup({ "https://a.test/1": reply("1"), "https://a.test/2": reply("2"), "https://b.test/3": reply("3") });
  await get("https://a.test/1");
  await get("https://a.test/2");
  await get("https://b.test/3");
  assert.deepEqual(calls.map((c) => `${c.url}@${c.at}`), [
    "https://a.test/robots.txt@0",
    "https://a.test/1@1000",
    "https://a.test/2@2000",
    "https://b.test/robots.txt@2000",
    "https://b.test/3@3000",
  ]);
});

test("429 and 503 are retried after Retry-After, or 5 then 10 seconds", async () => {
  const { get, sleeps } = setup({
    "https://a.test/p": [reply("", 429, { "retry-after": "2" }), reply("", 503), reply("ok")],
  });
  assert.equal((await get("https://a.test/p")).text, "ok");
  assert.deepEqual(sleeps, [1000, 2000, 10000]);
});

test("a Retry-After over a minute is not waited out", async () => {
  const { get, sleeps } = setup({ "https://a.test/p": [reply("", 429, { "retry-after": "120" })] });
  await assert.rejects(get("https://a.test/p"), /HTTP 429/);
  assert.deepEqual(sleeps, [1000]);
});

test("robots.txt redirects are followed one hop at a time, a second apart", async () => {
  const { get, calls } = setup({
    "https://a.test/robots.txt": reply("", 301, { location: "/robots-new.txt" }),
    "https://a.test/robots-new.txt": reply("User-agent: *\nDisallow: /private", 200, { "content-type": "text/plain" }),
    "https://a.test/p": reply("ok"),
  });
  await assert.rejects(get("https://a.test/private/x"), /robots.txt disallows/);
  assert.equal((await get("https://a.test/p")).text, "ok");
  assert.deepEqual(calls.map((c) => `${c.url}@${c.at}`), ["https://a.test/robots.txt@0", "https://a.test/robots-new.txt@1000", "https://a.test/p@2000"]);
});

test("more than five robots.txt redirects counts as unreachable", async () => {
  const { get, calls } = setup({ "https://a.test/robots.txt": () => new Response("", { status: 302, headers: { location: "/robots.txt" } }) });
  await assert.rejects(get("https://a.test/p"), /robots.txt unreachable \(more than 5 redirects/);
  assert.equal(calls.length, 6);
});

test("a host that asks for a long back-off gets no more requests in this run", async () => {
  const { get, urls } = setup({ "https://a.test/1": [reply("", 429, { "retry-after": "120" })], "https://a.test/2": reply("2") });
  await assert.rejects(get("https://a.test/1"), /HTTP 429/);
  await assert.rejects(get("https://a.test/2"), /a.test asked us to back off/);
  assert.deepEqual(urls(), ["https://a.test/robots.txt", "https://a.test/1"]);
});

test("Retry-After as an HTTP date is honoured", async () => {
  const soon = setup({ "https://a.test/p": [reply("", 503, { "retry-after": "Thu, 01 Jan 1970 00:00:03 GMT" }), reply("ok")] });
  assert.equal((await soon.get("https://a.test/p")).text, "ok");
  assert.deepEqual(soon.sleeps, [1000, 2000]);
  const later = setup({ "https://a.test/p": [reply("", 503, { "retry-after": "Thu, 01 Jan 1970 00:05:00 GMT" })] });
  await assert.rejects(later.get("https://a.test/p"), /HTTP 503/);
  assert.deepEqual(later.sleeps, [1000]);
});

test("only a 200 counts as the page", async () => {
  const { get } = setup({ "https://a.test/p": reply("<p>checking your browser</p>", 202) });
  await assert.rejects(get("https://a.test/p"), (err) => err.status === 202 && /HTTP 202/.test(err.message));
});

test("redirects are followed with robots.txt checked on the new host", async () => {
  const { get, urls } = setup({
    "https://a.test/old": reply("", 301, { location: "https://b.test/new" }),
    "https://b.test/robots.txt": reply("User-agent: *\nDisallow: /new", 200, { "content-type": "text/plain" }),
  });
  await assert.rejects(get("https://a.test/old"), /robots.txt disallows https:\/\/b.test\/new/);
  assert.deepEqual(urls(), ["https://a.test/robots.txt", "https://a.test/old", "https://b.test/robots.txt"]);
});

test("a relative redirect resolves against the current URL", async () => {
  const { get } = setup({ "https://a.test/old": reply("", 302, { location: "/new" }), "https://a.test/new": reply("moved") });
  assert.deepEqual(await get("https://a.test/old"), { url: "https://a.test/new", contentType: "text/html", text: "moved" });
});

test("an error status throws with the status", async () => {
  const { get } = setup({});
  await assert.rejects(get("https://a.test/missing"), (err) => err.status === 404 && /HTTP 404 for https:\/\/a.test\/missing/.test(err.message));
});

test("an error status after a redirect throws with the final URL", async () => {
  const { get } = setup({ "https://a.test/old": reply("", 301, { location: "/gone" }) });
  await assert.rejects(get("https://a.test/old"), (err) => err.status === 404 && err.url === "https://a.test/gone" && err.message === "HTTP 404 for https://a.test/gone");
});

test("robots: a rule with many wildcards is matched at once, as RFC 9309 reads it", () => {
  const path = "/en/support/product-security-and-end-of-life-statement/" + "a".repeat(40);
  const started = Date.now();
  assert.equal(robotsAllows("User-agent: *\nDisallow: /*******X\n", path), true);
  assert.equal(robotsAllows(`User-agent: *\nDisallow: /${"*a".repeat(60)}X\n`, path), true);
  assert.ok(Date.now() - started < 1000, `${Date.now() - started} ms`);
  for (const [rule, yes, no] of [["/a*b", "/axxb/c", "/ac"], ["/a*b$", "/axxb", "/axxbc"], ["*.pdf$", "/x/y.pdf", "/x/y.pdf?z"], ["/a$b", "/a$b", "/ab"], ["/", "/anything", ""]]) {
    assert.equal(ruleMatches(rule, yes), true, `${rule} ${yes}`);
    assert.equal(ruleMatches(rule, no), false, `${rule} ${no}`);
  }
});

test("a body over the limit is refused, not held in memory", async () => {
  let t = 0;
  const fetch = async (url) => new Response(url.endsWith("/robots.txt") ? "" : "x".repeat(2048), { status: 200, headers: { "content-type": "text/html" } });
  const get = createFetcher({ fetch, now: () => t, sleep: async (ms) => { t += ms; }, maxBodyBytes: 1024 });
  await assert.rejects(get("https://a.test/big"), /the page at https:\/\/a\.test\/big is over 1024 bytes/);
  const small = createFetcher({ fetch, now: () => t, sleep: async (ms) => { t += ms; }, maxBodyBytes: 4096 });
  assert.equal((await small("https://a.test/big")).text.length, 2048);
});

// A fake fetch whose page body arrives in the chunks given, so a character can straddle two chunks.
function serve(chunks, contentType, robots = "") {
  let t = 0;
  const fetch = async (url) =>
    url.endsWith("/robots.txt")
      ? new Response(robots, { status: robots ? 200 : 404 })
      : new Response(new ReadableStream({ start(c) { for (const chunk of chunks) c.enqueue(chunk); c.close(); } }), { status: 200, headers: { "content-type": contentType } });
  return (options = {}) => createFetcher({ fetch, now: () => t, sleep: async (ms) => { t += ms; }, ...options });
}

test("a page's bytes are decoded as UTF-8, with one BOM dropped, whatever the chunks or the declared charset", async () => {
  const text = "Acme Caméra, 2029年12月31日 ✓";
  const bytes = new TextEncoder().encode(`\ufeff${text}`);
  const cuts = [0, 9, 14, 21, 26, bytes.length];
  const chunks = cuts.slice(1).map((end, i) => bytes.slice(cuts[i], end));
  for (const contentType of ["text/html; charset=utf-8", "text/html; charset=iso-8859-1", "text/html"]) {
    assert.equal((await serve(chunks, contentType)()("https://a.test/p")).text, text, contentType);
  }
  const bad = Uint8Array.from([0x41, 0xff, 0x42]);
  assert.equal((await serve([bad], "text/html")()("https://a.test/p")).text, await new Response(bad).text());
});

test("the default limit takes a real-sized page and refuses one byte past 32 MiB, a PDF and a robots.txt included", async () => {
  assert.equal(MAX_BODY_BYTES, 32 * 1024 * 1024);
  const mib = new Uint8Array(1024 * 1024).fill(0x61);
  assert.equal((await serve([mib, mib], "text/html")()("https://a.test/p")).text.length, 2 * 1024 * 1024);
  const full = Array.from({ length: 32 }, () => mib);
  assert.equal((await serve(full, "application/pdf")()("https://a.test/d.pdf")).bytes.length, MAX_BODY_BYTES);
  await assert.rejects(serve([...full, Uint8Array.of(0x25)], "application/pdf")()("https://a.test/d.pdf"), /is over 33554432 bytes/);
  // A robots.txt over the limit counts as unreachable, which disallows the host.
  await assert.rejects(serve([mib], "text/html", "x".repeat(2048))({ maxBodyBytes: 1024 })("https://a.test/p"), /robots\.txt unreachable .* for https:\/\/a\.test/);
});

test("robots: a literal * in the path is matched by a wildcard too", () => {
  assert.equal(ruleMatches("/*x", "/*ax"), true);
  assert.equal(ruleMatches("/a*b$", "/a*b"), true);
  assert.equal(ruleMatches("/*?q=*", "/s?q=*"), true);
});
