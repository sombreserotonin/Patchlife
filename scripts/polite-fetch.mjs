// Fetches pages the way docs/CRAWLER.md promises: robots.txt honoured, at most one request per second per host,
// back-off on 429 and 503. Run under `node --use-env-proxy` so cloud sessions route fetch through their proxy.
export const USER_AGENT = "PatchlifeBot/0.1 (+https://github.com/sombreserotonin/Patchlife/blob/main/docs/CRAWLER.md)";
const TOKEN = "patchlifebot";
const MIN_GAP_MS = 1000;
const MAX_ATTEMPTS = 3;
const MAX_WAIT_S = 60;
const MAX_REDIRECTS = 5;

function ruleRegExp(pattern) {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

// RFC 9309: groups naming PatchlifeBot replace the "*" groups; the longest matching rule wins, Allow on a tie.
export function robotsAllows(robotsTxt, path) {
  const groups = [];
  let group = null;
  let inAgentLines = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const match = raw.replace(/#.*/, "").match(/^\s*([a-z-]+)\s*:\s*(.*?)\s*$/i);
    if (!match) continue;
    const key = match[1].toLowerCase();
    if (key === "user-agent") {
      if (!inAgentLines) groups.push((group = { agents: [], rules: [] }));
      group.agents.push(match[2].toLowerCase());
      inAgentLines = true;
    } else if ((key === "allow" || key === "disallow") && group) {
      if (match[2]) group.rules.push({ allow: key === "allow", length: match[2].length, re: ruleRegExp(match[2]) });
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

// Returns get(url) -> { url, contentType, text }, or throws with the reason. State (robots cache, per-host timing) is per fetcher.
export function createFetcher({ fetch = globalThis.fetch, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const lastRequest = new Map();
  const robots = new Map();

  async function request(url, redirect) {
    const host = new URL(url).host;
    for (let attempt = 1; ; attempt++) {
      const wait = (lastRequest.get(host) ?? -Infinity) + MIN_GAP_MS - now();
      if (wait > 0) await sleep(wait);
      lastRequest.set(host, now());
      const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, redirect });
      if ((res.status !== 429 && res.status !== 503) || attempt === MAX_ATTEMPTS) return res;
      const retryAfter = Number(res.headers.get("retry-after"));
      const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 5 * attempt;
      if (seconds > MAX_WAIT_S) return res;
      await res.body?.cancel();
      await sleep(seconds * 1000);
    }
  }

  // 4xx means no robots.txt, so everything is allowed; 429, 5xx or a network failure means assume everything is
  // disallowed (RFC 9309). Throws with the reason when a URL may not be fetched.
  async function checkRobots(url) {
    const { origin, pathname, search } = new URL(url);
    if (!robots.has(origin)) {
      let entry = { txt: "" };
      try {
        const res = await request(`${origin}/robots.txt`, "follow");
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

  return async function get(url) {
    for (let hops = 0; hops <= MAX_REDIRECTS; hops++) {
      await checkRobots(url);
      const res = await request(url, "manual");
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel();
        url = new URL(location, url).href;
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel();
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return { url, contentType: (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase(), text: await res.text() };
    }
    throw new Error(`more than ${MAX_REDIRECTS} redirects from ${url}`);
  };
}
