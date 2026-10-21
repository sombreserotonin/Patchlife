// Fetches pages the way docs/CRAWLER.md promises: robots.txt honoured, at most one request per second per host,
// back-off on 429 and 503. Run under `node --use-env-proxy` so cloud sessions route fetch through their proxy.
export const USER_AGENT = "PatchlifeBot/0.1 (+https://github.com/sombreserotonin/Patchlife/blob/main/docs/CRAWLER.md)";
const TOKEN = "patchlifebot";
const MIN_GAP_MS = 1000;
const MAX_ATTEMPTS = 3;
const MAX_WAIT_S = 60;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 30_000;

function ruleRegExp(pattern) {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
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
      if (pattern) group.rules.push({ allow: key === "allow", length: pattern.length, re: ruleRegExp(pattern) });
      inAgentLines = false;
    }
  }
  const ours = groups.filter((g) => g.agents.includes(TOKEN));
  const rules = (ours.length ? ours : groups.filter((g) => g.agents.includes("*"))).flatMap((g) => g.rules);
  let best = null;
  for (const rule of rules) {
    if (!rule.re.test(path)) continue;
    if (!best || rule.length > best.length || (rule.length === best.length && rule.allow)) best = rule;
  }
  return best ? best.allow : true;
}

// Returns get(url) -> { url, contentType, text }, or throws with the reason (and `status` and the final `url` for HTTP errors).
// State (robots cache, per-host timing, hosts that asked us to back off) lasts for the fetcher's lifetime.
export function createFetcher({ fetch = globalThis.fetch, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const lastRequest = new Map();
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
      const wait = (lastRequest.get(host) ?? -Infinity) + MIN_GAP_MS - now();
      if (wait > 0) await sleep(wait);
      lastRequest.set(host, now());
      const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
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
        if (res.ok) entry = { txt: await res.text() };
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

  // Only a 200 is the page: other 2xx codes include bot challenges such as a 202 from a web application firewall.
  return async function get(url) {
    const { url: finalUrl, res } = await follow(url, checkRobots);
    if (res.status !== 200) {
      await res.body?.cancel();
      throw Object.assign(new Error(`HTTP ${res.status} for ${finalUrl}`), { status: res.status, url: finalUrl });
    }
    return { url: finalUrl, contentType: (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase(), text: await res.text() };
  };
}
