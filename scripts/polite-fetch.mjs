// Fetches pages the way docs/CRAWLER.md promises: robots.txt honoured, at most one request per second per host,
// back-off on 429 and 503. Run under `node --use-env-proxy` where the network needs an HTTP proxy (D16).
export const USER_AGENT = "PatchlifeBot/0.1 (+https://github.com/sombreserotonin/Patchlife/blob/main/docs/CRAWLER.md)";
const TOKEN = "patchlifebot";
const MIN_GAP_MS = 1000;
const MAX_ATTEMPTS = 3;
const MAX_WAIT_S = 60;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 30_000;
// A body larger than this is refused rather than held in memory: a page that inflates without end (a compressed bomb)
// must not stop the runner. Real support pages and statements are well under it.
export const MAX_BODY_BYTES = 32 * 1024 * 1024;

// RFC 9309: "*" matches any run of characters, a final "$" anchors the end, and otherwise a rule matches a prefix of
// the path. A walk that backtracks only to the last "*" instead of a regular expression, so a robots.txt rule with many
// "*" (a maker's own file) costs at most path length times rule length, where ".*" groups could run for minutes.
export function ruleMatches(rule, path) {
  const anchored = rule.endsWith("$");
  const pattern = anchored ? rule.slice(0, -1) : `${rule}*`;
  let p = 0;
  let s = 0;
  let star = -1;
  let mark = 0;
  while (s < path.length) {
    if (p < pattern.length && pattern[p] === "*") {
      star = p++;
      mark = s;
    } else if (p < pattern.length && pattern[p] === path[s]) {
      p++;
      s++;
    } else if (star !== -1) {
      p = star + 1;
      s = ++mark;
    } else return false;
  }
  while (p < pattern.length && pattern[p] === "*") p++;
  return p === pattern.length;
}

// RFC 9309: groups naming PatchlifeBot replace the "*" groups; the longest matching rule wins, Allow on a tie.
// User-agent values are cut to their product token, so "PatchlifeBot/0.1" matches too.
export function robotsAllows(robotsTxt, path) {
  const groups = [];
  let group = null;
  let inAgentLines = false;
  for (const raw of robotsTxt.split(/\r\n|\r|\n/)) {
    const match = raw.replace(/#.*/, "").match(/^\s*([a-z-]+)\s*:\s*(.*?)\s*$/i);
    if (!match) continue;
    const key = match[1].toLowerCase();
    if (key === "user-agent") {
      if (!inAgentLines) groups.push((group = { agents: [], rules: [] }));
      group.agents.push(match[2].toLowerCase().match(/^(\*|[a-z_-]*)/)[1]);
      inAgentLines = true;
    } else if ((key === "allow" || key === "disallow") && group) {
      // URL paths arrive percent-encoded, so encode non-ASCII in rules the same way before comparing.
      const pattern = match[2].replace(/[^\x00-\x7f]+/gu, encodeURIComponent);
      if (pattern) group.rules.push({ allow: key === "allow", length: pattern.length, pattern });
      inAgentLines = false;
    }
  }
  const ours = groups.filter((g) => g.agents.includes(TOKEN));
  const rules = (ours.length ? ours : groups.filter((g) => g.agents.includes("*"))).flatMap((g) => g.rules);
  let best = null;
  for (const rule of rules) {
    if (!ruleMatches(rule.pattern, path)) continue;
    if (!best || rule.length > best.length || (rule.length === best.length && rule.allow)) best = rule;
  }
  return best ? best.allow : true;
}

// Returns get(url) -> { url, contentType, text }, with bytes in place of text for a PDF, or throws with the reason (and `status` and the final `url` for HTTP errors).
// State (robots cache, per-host timing, hosts that asked us to back off) lasts for the fetcher's lifetime.
// timeoutMs bounds each request; Save Page Now needs longer than a page (scripts/archive-evidence.mjs).
export function createFetcher({ fetch = globalThis.fetch, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), timeoutMs = TIMEOUT_MS, maxBodyBytes = MAX_BODY_BYTES } = {}) {
  const lastRequest = new Map();
  const turns = new Map();
  const robots = new Map();
  const backedOff = new Set();

  // Retry-After is either delta seconds or an HTTP date.
  function retrySeconds(res, attempt) {
    const header = (res.headers.get("retry-after") ?? "").trim();
    const seconds = /^\d+$/.test(header) ? Number(header) : (Date.parse(header) - now()) / 1000;
    return seconds > 0 ? seconds : 5 * attempt;
  }

  // Every request goes through here, so robots.txt, retries and redirect hops are all spaced per host.
  async function request(url) {
    const host = new URL(url).host;
    if (backedOff.has(host)) throw new Error(`${host} asked us to back off`);
    for (let attempt = 1; ; attempt++) {
      // Requests to one host take turns: each waits until the one before it is sent, then a second from then, so
      // calls made at once are spaced as calls made one after another (audit 2026-11-14, fetchers L1).
      const previous = turns.get(host);
      let sent;
      turns.set(host, new Promise((resolve) => (sent = resolve)));
      try {
        await previous;
        const wait = (lastRequest.get(host) ?? -Infinity) + MIN_GAP_MS - now();
        if (wait > 0) await sleep(wait);
        lastRequest.set(host, now());
      } finally {
        sent();
      }
      const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
      if (res.status !== 429 && res.status !== 503) return res;
      const seconds = retrySeconds(res, attempt);
      if (attempt === MAX_ATTEMPTS || seconds > MAX_WAIT_S) {
        backedOff.add(host);
        return res;
      }
      await res.body?.cancel();
      await sleep(seconds * 1000);
    }
  }

  // Follows redirects by hand so each hop is spaced; more than MAX_REDIRECTS hops throws.
  async function follow(url, beforeHop = async () => {}) {
    for (let hops = 0; ; hops++) {
      await beforeHop(url);
      const res = await request(url);
      const location = res.headers.get("location");
      if (res.status < 300 || res.status >= 400 || !location) return { url, res };
      await res.body?.cancel();
      if (hops === MAX_REDIRECTS) throw new Error(`more than ${MAX_REDIRECTS} redirects from ${url}`);
      url = new URL(location, url).href;
    }
  }

  // 4xx means no robots.txt, so everything is allowed; 429, 5xx, too many redirects or a network failure means
  // assume everything is disallowed (RFC 9309). Throws with the reason when a URL may not be fetched.
  async function checkRobots(url) {
    const { origin, pathname, search } = new URL(url);
    if (!robots.has(origin)) {
      let entry = { txt: "" };
      try {
        const { res } = await follow(`${origin}/robots.txt`);
        // Read with the same cap as a page, so a robots.txt that inflates without end is refused (and so disallows).
        if (res.ok) entry = { txt: new TextDecoder().decode(await readBody(res, `${origin}/robots.txt`)) };
        else {
          await res.body?.cancel();
          if (res.status === 429 || res.status >= 500) entry = { unreachable: `HTTP ${res.status}` };
        }
      } catch (err) {
        entry = { unreachable: err.cause?.message || err.message || "network error" };
      }
      robots.set(origin, entry);
    }
    const entry = robots.get(origin);
    if (entry.unreachable) throw new Error(`robots.txt unreachable (${entry.unreachable}) for ${origin}`);
    if (!robotsAllows(entry.txt, pathname + search)) throw new Error(`robots.txt disallows ${url}`);
  }

  // The body's bytes, up to maxBodyBytes as fetch hands them over (decompressed); past that the read stops.
  async function readBody(res, url) {
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body ?? []) {
      size += chunk.byteLength;
      if (size > maxBodyBytes) throw new Error(`the page at ${url} is over ${maxBodyBytes} bytes`);
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  // Only a 200 is the page: other 2xx codes include bot challenges such as a 202 from a web application firewall.
  return async function get(url) {
    const { url: finalUrl, res } = await follow(url, checkRobots);
    if (res.status !== 200) {
      await res.body?.cancel();
      throw Object.assign(new Error(`HTTP ${res.status} for ${finalUrl}`), { status: res.status, url: finalUrl });
    }
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const body = await readBody(res, finalUrl);
    if (contentType === "application/pdf") return { url: finalUrl, contentType, bytes: new Uint8Array(body) };
    return { url: finalUrl, contentType, text: new TextDecoder().decode(body) };
  };
}
