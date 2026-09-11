import { describe, expect, it } from "vitest";
import { DEV_SITE_URL, resolveSiteUrl } from "../site-url";

describe("resolveSiteUrl", () => {
  it("takes the site's own domain over anything the host says", () => {
    // A link shared from a preview deployment still points at the real site,
    // because the preview URL is a build artefact and the canonical URL is not.
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "https://kartik.to",
        VERCEL_PROJECT_PRODUCTION_URL: "kartik-to.vercel.app",
        VERCEL_URL: "kartik-to-abc123.vercel.app",
      }),
    ).toBe("https://kartik.to");
  });

  it("falls back to the project's production domain, scheme and all", () => {
    // Vercel reports a bare host; a `metadataBase` must be a URL.
    expect(
      resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "kartik-to.vercel.app" }),
    ).toBe("https://kartik-to.vercel.app");
  });

  it("falls back again to this deployment, so a preview describes itself", () => {
    expect(resolveSiteUrl({ VERCEL_URL: "kartik-to-abc123.vercel.app" })).toBe(
      "https://kartik-to-abc123.vercel.app",
    );
  });

  it("is localhost where there is no host to ask", () => {
    expect(resolveSiteUrl({})).toBe(DEV_SITE_URL);
  });

  it("takes a configured domain whether or not it was written as a URL", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "kartik.to" })).toBe(
      "https://kartik.to",
    );
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://kartik.to/" })).toBe(
      "https://kartik.to",
    );
  });
});
