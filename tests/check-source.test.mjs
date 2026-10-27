import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { checkSource, report } from "../scripts/check-source.mjs";
import { createFetcher } from "../scripts/polite-fetch.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/check-source.mjs", import.meta.url));
// Runs the CLI without blocking the event loop, so a server in this process can answer it.
const runAsync = (...args) => new Promise((done) => {
  const child = spawn(process.execPath, [SCRIPT, ...args]);
  const out = { stdout: "", stderr: "" };
  child.stdout.setEncoding("utf8").on("data", (data) => { out.stdout += data; });
  child.stderr.setEncoding("utf8").on("data", (data) => { out.stderr += data; });
  child.on("close", (status) => done({ ...out, status }));
});
const reply = (body, status = 200, headers = {}) => () => new Response(body, { status, headers: { "content-type": "text/html", ...headers } });
const robots = (txt) => reply(txt, 200, { "content-type": "text/plain" });
const ALLOW = { "https://a.test/robots.txt": robots("User-agent: *\nDisallow: /private") };
const ROWS = "<h1>Security updates</h1><table><tr><td>Acme Cam 1</td><td>30 June 2029</td></tr></table>";

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
const check = (routes, url = "https://a.test/p") => checkSource(url, setup(routes).get);

test("a page robots.txt allows, with dates in its text, can be used, and the report shows the counts and a row", async () => {
  const { get, requested } = setup({ ...ALLOW, "https://a.test/p": reply(ROWS) });
  const result = await checkSource("https://a.test/p", get);
  assert.deepEqual(requested, ["https://a.test/robots.txt", "https://a.test/p"]);
  assert.deepEqual(report(result), [
    "robots.txt: allows",
    "status: HTTP 200, text/html",
    "dates in the raw response: yes",
    "dates in the page text: 1",
    "  security updates acme cam 1 30 june 2029",
    "usable: yes",
  ]);
});

test("the sample rows are spread over the page, at most five", async () => {
  const rows = Array.from({ length: 12 }, (_, i) => `<tr><td>Cam ${i + 1}</td><td>2030-01-${String(i + 1).padStart(2, "0")}</td></tr>`).join("");
  const result = await check({ ...ALLOW, "https://a.test/p": reply(`<table>${rows}</table>`) });
  assert.equal(result.textDates, 12);
  assert.equal(result.samples.length, 5);
  for (const [i, day] of ["01", "03", "05", "08", "10"].entries()) assert.ok(result.samples[i].includes(`cam ${Number(day)} 2030-01-${day}`), result.samples[i]);
});

test("a page with no date at all can still be used, such as a policy that counts years from end of life", async () => {
  const result = await check({ ...ALLOW, "https://a.test/p": reply("<p>The support period ends three years after the end-of-life date.</p>") });
  assert.equal(result.usable, true);
  assert.deepEqual(report(result).slice(2), ["dates in the raw response: no", "dates in the page text: 0", "usable: yes"]);
});

test("dates only inside scripts are added by JavaScript, so the page can't be used", async () => {
  const result = await check({ ...ALLOW, "https://a.test/p": reply('<script>var rows = [["Acme Cam 1", "30 June 2029"]];</script><div id="app">Loading</div>') });
  assert.equal(result.usable, false);
  assert.deepEqual(report(result).slice(2), [
    "dates in the raw response: yes",
    "dates in the page text: 0",
    "not usable: the dates are only inside scripts, so JavaScript adds them and the verifier can't see them",
  ]);
});

test("a page robots.txt disallows is not fetched, and an unreachable robots.txt counts the same", async () => {
  const { get, requested } = setup({ "https://a.test/robots.txt": robots("User-agent: PatchlifeBot\nDisallow: /") });
  const result = await checkSource("https://a.test/p", get);
  assert.deepEqual(requested, ["https://a.test/robots.txt"]);
  assert.deepEqual(report(result), ["robots.txt: disallows", "status: not fetched", "not usable: robots.txt disallows https://a.test/p"]);
  const down = await check({ "https://a.test/robots.txt": [reply("", 500)] });
  assert.deepEqual(report(down), ["robots.txt: unreachable (HTTP 500)", "status: not fetched", "not usable: robots.txt unreachable (HTTP 500) for https://a.test"]);
});

test("a status other than 200 can't be used: a bot wall, a challenge answered with 202, a missing page or a network error", async () => {
  const wall = await check({ ...ALLOW, "https://a.test/p": reply("blocked", 403) });
  assert.deepEqual(report(wall), ["robots.txt: allows", "status: HTTP 403", "not usable: HTTP 403 for https://a.test/p (bot wall)"]);
  const challenge = await check({ ...ALLOW, "https://a.test/p": reply("<p>checking</p>", 202) });
  assert.deepEqual(report(challenge).slice(1), ["status: HTTP 202", "not usable: HTTP 202 for https://a.test/p (not the page: a bot challenge answers this way)"]);
  const gone = await check(ALLOW);
  assert.deepEqual(report(gone).slice(1), ["status: HTTP 404", "not usable: HTTP 404 for https://a.test/p"]);
  const reset = new TypeError("fetch failed", { cause: new Error("read ECONNRESET") });
  const failed = await check({ ...ALLOW, "https://a.test/p": reset });
  assert.deepEqual(report(failed).slice(1), ["status: error (read ECONNRESET)", "not usable: read ECONNRESET"]);
});

test("a 200 that is a bot challenge page can't be used", async () => {
  const result = await check({ ...ALLOW, "https://a.test/p": reply("<title>Just a moment...</title><p>Enable JavaScript and cookies to continue</p>") });
  assert.equal(result.usable, false);
  assert.equal(report(result).at(-1), 'not usable: bot challenge (the page says "just a moment")');
});

test("a redirect to another page names the final URL to cite instead; a trailing slash is still the page", async () => {
  const moved = await check({ ...ALLOW, "https://a.test/p": reply("", 301, { location: "/home" }), "https://a.test/home": reply(ROWS) });
  assert.deepEqual(report(moved), [
    "robots.txt: allows",
    "status: HTTP 200, text/html",
    "final URL: https://a.test/home",
    "dates in the raw response: yes",
    "dates in the page text: 1",
    "  security updates acme cam 1 30 june 2029",
    "not usable: redirected to https://a.test/home, so cite that URL instead",
  ]);
  const slash = await check({ ...ALLOW, "https://a.test/p": reply("", 301, { location: "/p/" }), "https://a.test/p/": reply(ROWS) });
  assert.equal(slash.usable, true);
  assert.equal(slash.final, "https://a.test/p/");
  // A redirect that ends in an error, or on a host whose robots.txt refuses, names where it ended.
  const gone = await check({ ...ALLOW, "https://a.test/p": reply("", 302, { location: "https://a.test/gone" }) });
  assert.deepEqual(report(gone).slice(1), ["status: HTTP 404", "final URL: https://a.test/gone", "not usable: HTTP 404 for https://a.test/gone"]);
  const refused = await check({ ...ALLOW, "https://a.test/p": reply("", 301, { location: "https://b.test/x" }), "https://b.test/robots.txt": robots("User-agent: *\nDisallow: /") });
  assert.deepEqual(report(refused), ["robots.txt: disallows", "status: not fetched", "final URL: https://b.test/x", "not usable: robots.txt disallows https://b.test/x"]);
});

test("content the verifier can't read can't be used, and a PDF has no raw text to report", async () => {
  const image = await check({ ...ALLOW, "https://a.test/p": reply(new Uint8Array([137, 80]), 200, { "content-type": "image/png" }) });
  assert.deepEqual(report(image), ["robots.txt: allows", "status: HTTP 200, image/png", 'not usable: unsupported content type "image/png" at https://a.test/p']);
  const pdf = { url: "https://a.test/p.pdf", robots: "allows", status: "HTTP 200, application/pdf", read: true, rawDates: null, textDates: 2, samples: ["router 2 end of life 31 march 2025"], usable: true, reason: "" };
  assert.deepEqual(report(pdf).slice(2), ["dates in the raw response: n/a (PDF)", "dates in the page text: 2", "  router 2 end of life 31 march 2025", "usable: yes"]);
});

// Port 1 is one fetch refuses to connect to, so this makes no network request.
test("the CLI exits 2 with a usage line on bad arguments and 1 with the reason when the page can't be used", () => {
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
  for (const args of [[], ["a"], ["https://a.test/p", "https://a.test/q"]]) {
    const { status, stderr } = run(...args);
    assert.equal(status, 2, args.join(" "));
    assert.match(stderr, /Usage: node --use-env-proxy scripts\/check-source\.mjs <url>/);
  }
  const { status, stdout } = run("http://127.0.0.1:1/p");
  assert.equal(status, 1);
  assert.match(stdout, /^robots\.txt: unreachable \(.+\)\nstatus: not fetched\nnot usable: robots\.txt unreachable \(.+\) for http:\/\/127\.0\.0\.1:1\n$/);
});

// A local server with no robots.txt stands in for the maker's site; the polite fetcher's one-second gap makes the run take about a second.
test("the CLI exits 0 and prints the report for a page that can be used", async (t) => {
  const server = createServer((req, res) => {
    res.writeHead(req.url === "/p" ? 200 : 404, { "content-type": "text/html" });
    res.end(req.url === "/p" ? ROWS : "");
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const { status, stdout, stderr } = await runAsync(`http://127.0.0.1:${server.address().port}/p`);
  assert.equal(status, 0, stderr);
  assert.equal(stdout, "robots.txt: allows\nstatus: HTTP 200, text/html\ndates in the raw response: yes\ndates in the page text: 1\n  security updates acme cam 1 30 june 2029\nusable: yes\n");
});
