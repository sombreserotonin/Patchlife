// Preloaded with node --import by tests/merge-bot.test.mjs, so the CLI runs offline: fetch becomes a fake GitHub that
// answers from FAKE_GITHUB, a JSON object of "<METHOD> <url>" to [status, body]. Anything else gets a 404.
const routes = JSON.parse(process.env.FAKE_GITHUB ?? "{}");

globalThis.fetch = async (url, init = {}) => {
  const [status, body] = routes[`${init.method ?? "GET"} ${url}`] ?? [404, { message: "Not Found" }];
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
};
