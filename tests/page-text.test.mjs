import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { fold, grepLines, pageLines } from "../scripts/page-text.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/page-text.mjs", import.meta.url));
const USAGE = /Usage: node --use-env-proxy scripts\/page-text\.mjs \[--grep <text>\] <url>/;
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
// Runs the CLI without blocking the event loop, so a server in this process can answer it.
const runAsync = (...args) => new Promise((done) => {
  const child = spawn(process.execPath, [SCRIPT, ...args]);
  const out = { stdout: "", stderr: "" };
  child.stdout.setEncoding("utf8").on("data", (data) => { out.stdout += data; });
  child.stderr.setEncoding("utf8").on("data", (data) => { out.stderr += data; });
  child.on("close", (status) => done({ ...out, status }));
});

test("fold breaks at the last space within the width and keeps it, so the lines join back into the text", () => {
  assert.deepEqual(fold("aaa bbb ccc ddd", 10), ["aaa bbb ", "ccc ddd"]);
  assert.deepEqual(fold("abcdefghijklmno", 10), ["abcdefghij", "klmno"]);
  assert.deepEqual(fold("a".repeat(10), 10), ["a".repeat(10)]);
  assert.deepEqual(fold("a b\nc d", 10), ["a b", "c d"]);
  // A space in the first column is no break, as in `fold -s`.
  assert.deepEqual(fold(" abcdefghijkl", 10), [" abcdefghi", "jkl"]);
  const words = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
  const lines = fold(words);
  assert.ok(lines.length > 3 && lines.every((line) => line.length <= 300 && !line.startsWith(" ")));
  assert.equal(lines.join(""), words);
});

test("pageLines gives the final URL and content type, then the text with whitespace collapsed and folded", async () => {
  const page = { url: "https://a.test/p?x=1", contentType: "text/html", text: "<h1>Acme</h1>\n<table><tr><td>Cam  1</td><td>30 June\n2029</td></tr></table>" };
  assert.deepEqual(await pageLines(page), ["https://a.test/p?x=1 (text/html)", "Acme Cam 1 30 June 2029"]);
  const long = { url: "https://a.test/p", contentType: "text/plain", text: Array.from({ length: 100 }, (_, i) => `Row ${i} 30 June 2029`).join("\n") };
  const lines = await pageLines(long);
  assert.ok(lines.length > 2 && lines.slice(1).every((line) => line.length <= 300));
  assert.equal(lines.slice(1).join(""), long.text.replace(/\s+/g, " "));
  await assert.rejects(pageLines({ url: "https://a.test/i", contentType: "image/png", bytes: new Uint8Array() }), /unsupported content type/);
});

test("grepLines keeps the lines holding the text in any case, numbered from the first line given", () => {
  const lines = ["https://a.test/p (text/html)", "Acme Cam 1 30 June 2029", "Acme Cam 2 31 December 2030", "Nothing"];
  assert.deepEqual(grepLines(lines, "acme cam"), ["2:Acme Cam 1 30 June 2029", "3:Acme Cam 2 31 December 2030"]);
  assert.deepEqual(grepLines(lines.slice(1), "CAM 2", 2), ["3:Acme Cam 2 31 December 2030"]);
  assert.deepEqual(grepLines(lines, "cam 3"), []);
});

// Port 1 is one fetch refuses to connect to, so this makes no network request.
test("the CLI exits 2 with a usage line on bad arguments and 1 when the page can't be read", () => {
  for (const args of [[], ["a", "b"], ["ftp://a.test/p"], ["--grep", "", "http://127.0.0.1:1/p"]]) {
    const { status, stderr } = run(...args);
    assert.equal(status, 2, args.join(" "));
    assert.match(stderr, USAGE);
  }
  const { status, stdout, stderr } = run("http://127.0.0.1:1/p");
  assert.equal(status, 1);
  assert.equal(stdout, "");
  assert.match(stderr, /^http:\/\/127\.0\.0\.1:1\/p: error \(robots\.txt unreachable \(.+\) for http:\/\/127\.0\.0\.1:1\)\n$/);
});

// A local server with no robots.txt stands in for the maker's site; the polite fetcher's one-second gap makes each run take about a second.
test("the CLI prints the page as the verifier sees it, and with --grep only the numbered matching lines", async (t) => {
  const server = createServer((req, res) => {
    if (req.url !== "/p") {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end("<h1>Security&nbsp;updates</h1><table><tr><td>Acme Cam 1</td><td>30 June 2029</td></tr><tr><td>Acme Cam 2</td><td>31 December 2030</td></tr></table>");
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const url = `http://127.0.0.1:${server.address().port}/p`;
  const whole = await runAsync(url);
  assert.equal(whole.status, 0, whole.stderr);
  assert.equal(whole.stdout, `${url} (text/html)\nSecurity updates Acme Cam 1 30 June 2029 Acme Cam 2 31 December 2030\n`);
  const none = await runAsync("--grep", "cam 3", url);
  assert.equal(none.status, 1);
  assert.equal(none.stdout, `${url} (text/html)\n`);
});
