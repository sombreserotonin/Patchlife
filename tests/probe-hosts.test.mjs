import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createFetcher } from "../scripts/polite-fetch.mjs";
import { firstUrls, probe } from "../scripts/probe-hosts.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/probe-hosts.mjs", import.meta.url));
const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));
const reply = (body, status = 200, headers = {}) => () => new Response(body, { status, headers: { "content-type": "text/html", ...headers } });
const robots = (txt) => reply(txt, 200, { "content-type": "text/plain" });

// The real polite fetcher over a fake fetch. routes: url -> reply, Error, or an array used in order; others get a 404.
function setup(routes) {
  let t = 0;
  const requested = [];
  const fetch = async (url) => {
    requested.push(url);
    const route = Array.isArray(routes[url]) ? routes[url].shift() : routes[url];
    if (route instanceof Error) throw route;
    return route ? route() : new Response("", { status: 404 });
  };
  return { get: createFetcher({ fetch, now: () => t, sleep: async (ms) => { t += ms; } }), requested };
}

test("firstUrls keeps the first evidence URL on each host, in record order", () => {
  const records = [
    { evidence: [{ url: "https://a.test/1" }, { url: "https://b.test/1" }, { url: "https://a.test/2" }] },
    { evidence: [{ url: "https://b.test/2" }, { url: "https://c.test:8443/1" }, { url: "https://c.test/1" }] },
  ];
  assert.deepEqual([...firstUrls(records)], [
    ["a.test", "https://a.test/1"],
    ["b.test", "https://b.test/1"],
    ["c.test:8443", "https://c.test:8443/1"],
    ["c.test", "https://c.test/1"],
  ]);
});

test("a page robots.txt allows reports its HTTP status", async () => {
  const { get, requested } = setup({ "https://a.test/robots.txt": robots("User-agent: *\nDisallow: /private"), "https://a.test/p": reply("ok") });
  assert.deepEqual(await probe("https://a.test/p", get), { robots: "allows", result: "HTTP 200" });
  assert.deepEqual(requested, ["https://a.test/robots.txt", "https://a.test/p"]);
});

test("an HTTP error on the page is its status, not an error", async () => {
  const { get } = setup({ "https://a.test/p": reply("blocked", 403) });
  assert.deepEqual(await probe("https://a.test/p", get), { robots: "allows", result: "HTTP 403" });
});

test("a page robots.txt disallows is not fetched", async () => {
  const { get, requested } = setup({ "https://a.test/robots.txt": robots("User-agent: PatchlifeBot\nDisallow: /") });
  assert.deepEqual(await probe("https://a.test/p", get), { robots: "disallows", result: "not fetched" });
  assert.deepEqual(requested, ["https://a.test/robots.txt"]);
});

test("an unreachable robots.txt gives its reason and the page is not fetched", async () => {
  const { get, requested } = setup({ "https://a.test/robots.txt": [reply("", 500)], "https://b.test/robots.txt": new Error("ECONNRESET") });
  assert.deepEqual(await probe("https://a.test/p", get), { robots: "unreachable (HTTP 500)", result: "not fetched" });
  assert.deepEqual(await probe("https://b.test/p", get), { robots: "unreachable (ECONNRESET)", result: "not fetched" });
  assert.deepEqual(requested, ["https://a.test/robots.txt", "https://b.test/robots.txt"]);
});

test("a network failure on the page is an error with its cause", async () => {
  const reset = new TypeError("fetch failed", { cause: new Error("read ECONNRESET") });
  const { get } = setup({ "https://a.test/p": reset, "https://b.test/p": new Error("timed out") });
  assert.deepEqual(await probe("https://a.test/p", get), { robots: "allows", result: "error (read ECONNRESET)" });
  assert.deepEqual(await probe("https://b.test/p", get), { robots: "allows", result: "error (timed out)" });
});

test("a redirect is reported with where it ended", async () => {
  const { get } = setup({
    "https://a.test/p": reply("", 301, { location: "/home" }),
    "https://a.test/home": reply("home"),
    "https://a.test/q": reply("", 302, { location: "https://a.test/gone" }),
  });
  assert.deepEqual(await probe("https://a.test/p", get), { robots: "allows", result: "HTTP 200 (redirected to https://a.test/home)" });
  assert.deepEqual(await probe("https://a.test/q", get), { robots: "allows", result: "HTTP 404 (redirected to https://a.test/gone)" });
});

test("a robots.txt refusal after a redirect to another host is an error, not this host's robots result", async () => {
  const { get } = setup({
    "https://a.test/p": reply("", 301, { location: "https://b.test/x" }),
    "https://b.test/robots.txt": robots("User-agent: *\nDisallow: /"),
    "https://a.test/q": reply("", 301, { location: "https://c.test/x" }),
    "https://c.test/robots.txt": [reply("", 503, { "retry-after": "120" })],
  });
  assert.deepEqual(await probe("https://a.test/p", get), { robots: "allows", result: "error (robots.txt disallows https://b.test/x)" });
  assert.deepEqual(await probe("https://a.test/q", get), { robots: "allows", result: "error (robots.txt unreachable (HTTP 503) for https://c.test)" });
});

// Port 1 is one fetch refuses to connect to, so this makes no network request.
test("the CLI prints one line per host and exits 0 when every host fails", () => {
  const run = spawnSync(process.execPath, [SCRIPT, `${FIXTURES}probe`], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^127\.0\.0\.1:1\trobots\.txt unreachable \(.+\)\tnot fetched\n$/);
});
