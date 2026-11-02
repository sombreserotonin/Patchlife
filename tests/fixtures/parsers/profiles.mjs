// The profiles and pages the parser tests run on: the real source registry, with each parsed page's min_rows lowered
// to the synthetic fixtures' size (the live values are set for the real pages), the made-up names the fixtures write
// added to the renames tables, and Google's Australian statements replaced by the two fixture statements.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as glInet from "../../../scripts/parsers/gl-inet.mjs";
import * as google from "../../../scripts/parsers/google.mjs";
import * as asus from "../../../scripts/parsers/asus.mjs";
import * as ezviz from "../../../scripts/parsers/ezviz-eol.mjs";
import * as kyocera from "../../../scripts/parsers/kyocera.mjs";
import * as tpLink from "../../../scripts/parsers/tp-link-au.mjs";

export const FIXTURES = fileURLToPath(new URL(".", import.meta.url));
export const RING = {
  GB: "https://ring.com/gb/en/support/articles/ri2p1/Information-on-Ring-Devices-Software-Security-Updates",
  AU: "https://ring.com/au/en/support/articles/ri2p1/Information-on-Ring-Devices-Software-Security-Updates",
  US: "https://ring.com/support/articles/ri2p1/Information-on-Ring-Devices-Software-Security-Updates",
  RENAMES_US: "https://ring.com/support/articles/538eg/ring-product-name-changes",
  RENAMES_GB: "https://ring.com/gb/en/support/articles/538eg/ring-product-name-changes",
  RENAMES_AU: "https://ring.com/au/en/support/articles/538eg/ring-product-name-changes",
};
export const GOOGLE_AU = { ULTRA: "https://support.google.com/product-documentation/answer/99000001?hl=en", DOORBELL: "https://support.google.com/product-documentation/answer/99000002?hl=en" };
export const EZVIZ_POLICY = "https://www.ezviz.com/inter/trust-center/security/upgrade-policy";

const fixture = (name) => readFileSync(join(FIXTURES, name), "utf8");

// Every page the parsers and the candidates tests fetch, by URL.
export const PAGES = {
  [tpLink.PAGE]: fixture("tp-link-au.html"),
  [ezviz.PAGE]: fixture("ezviz-eol.html"),
  [EZVIZ_POLICY]: "<p>The updates policies and the EOL product list are subject to change and will be reviewed on a regular basis.</p>",
  [RING.GB]: fixture("ring-gb.html"),
  [RING.AU]: fixture("ring-au.html"),
  [RING.US]: fixture("ring-us.html"),
  [RING.RENAMES_US]: fixture("ring-renames.html"),
  [RING.RENAMES_GB]: fixture("ring-renames.html"),
  [RING.RENAMES_AU]: fixture("ring-renames.html"),
  [google.TABLE]: fixture("google-table.html"),
  [google.UK]: fixture("google-uk.html"),
  [GOOGLE_AU.ULTRA]: fixture("google-au-ultra.html"),
  [GOOGLE_AU.DOORBELL]: fixture("google-au-doorbell.html"),
  [google.INDEX]: fixture("google-index.html"),
  [glInet.PSTI]: fixture("gl-inet-psti.html"),
  [glInet.ENDED]: fixture("gl-inet-ended.html"),
  [kyocera.PAGE]: fixture("kyocera.html"),
  [asus.PAGE]: fixture("asus.html"),
};

const MIN_ROWS = { "tp-link": 5, ezviz: 5 };

export function fixtureSources(real) {
  return real.map((s) => {
    if (!s.min_rows) return s;
    const profile = { ...s, min_rows: Object.fromEntries(Object.keys(s.min_rows).map((url) => [url, MIN_ROWS[s.brand_slug] ?? 1])) };
    if (s.brand_slug === "ring") {
      profile.renames = [
        ...s.renames,
        { from: "Chime Z Pro (2nd Generation)", to: "Chime Z Pro (2nd Gen)", urls: [RING.GB, RING.AU] },
        { from: "Outdoor Cam Z , Plug-In", to: "Outdoor Cam Z", urls: [RING.US] },
        { from: "Outdoor Cam Z , Solar", to: "Outdoor Cam Z", urls: [RING.US] },
        { from: "Video Doorbell 9 Plus (2027 release)", to: "Video Doorbell 9 Plus", urls: [RING.GB, RING.US] },
        { from: "Indoor Cam Z Plus", to: "Indoor Cam ZK", urls: [RING.RENAMES_US, RING.RENAMES_GB, RING.RENAMES_AU] },
      ];
    }
    if (s.brand_slug === "google") {
      const keep = (o) => Object.fromEntries(Object.entries(o).filter(([url]) => !/answer\/16\d+/.test(url)));
      const auNote = s.notes["https://support.google.com/product-documentation/answer/16888142?hl=en"];
      profile.regions_by_url = { ...keep(s.regions_by_url), [GOOGLE_AU.ULTRA]: ["AU"], [GOOGLE_AU.DOORBELL]: ["AU"] };
      profile.min_rows = { ...keep(profile.min_rows), [GOOGLE_AU.ULTRA]: 1, [GOOGLE_AU.DOORBELL]: 1 };
      profile.notes = { ...keep(s.notes), [GOOGLE_AU.ULTRA]: auNote, [GOOGLE_AU.DOORBELL]: auNote };
      profile.renames = [
        { from: "Nest Cam ultra (GZ9Z9)", to: "Nest Cam (ultra)", urls: [google.UK, GOOGLE_AU.ULTRA] },
        { from: "Nest Doorbell ultra 2nd gen (GZ8Z8)", to: "Nest Doorbell (ultra, 2nd gen)", urls: [google.UK] },
        { from: "Google Nest Doorbell (ultra, 2nd generation)(GZ8Z8)", to: "Nest Doorbell (ultra, 2nd gen)", urls: [GOOGLE_AU.DOORBELL] },
        { from: "Nest Thermostat Z (A0909, A0910)", to: "Nest Thermostat Z", urls: [google.UK] },
      ];
    }
    return profile;
  });
}
