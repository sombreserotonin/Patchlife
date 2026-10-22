// Throwaway experiment (never merged): runs scripts/archive-evidence.mjs on three live pages from a runner.
import { execFileSync } from "node:child_process";
const urls = [
  "https://support.google.com/product-documentation/answer/16888142?hl=en",
  "https://www.gl-inet.com/en-us/pages/firmware-versions/?status=ended",
  "https://support.ezviz.com/faq/article/EZVIZ-EOL-Product-List",
];
execFileSync("node", ["scripts/archive-evidence.mjs", ...urls], { stdio: "inherit" });
console.log(execFileSync("git", ["diff", "--stat"], { encoding: "utf8" }).split("\n").slice(-3).join("\n"));
console.log(execFileSync("git", ["diff", "-U1", "--", "data"], { encoding: "utf8" }).split("\n").slice(0, 30).join("\n"));
console.log(execFileSync("git", ["diff", "--", "data"], { encoding: "utf8" }).match(/^\+.*archive_url.*$/gm)?.length, "archive_url lines added");
execFileSync("npm", ["run", "validate"], { stdio: "inherit" });
execFileSync("node", ["scripts/verification-only.mjs"], { stdio: "inherit" });
