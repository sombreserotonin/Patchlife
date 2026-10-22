import { test } from "node:test";
import assert from "node:assert/strict";
import { USER_AGENT, createFetcher, robotsAllows } from "../scripts/polite-fetch.mjs";

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
