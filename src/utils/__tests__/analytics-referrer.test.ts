// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  UNKNOWN_REFERRER,
  fallbackReferrer,
  fillMissingReferrer,
} from "../analytics-referrer";

afterEach(() => {
  Reflect.deleteProperty(document, "referrer");
});

describe("fallbackReferrer", () => {
  it("keeps the referrer the browser sent", () => {
    expect(fallbackReferrer("https://news.ycombinator.com/", "")).toBeNull();
  });

  it("keeps the browser's referrer over a tag", () => {
    expect(
      fallbackReferrer("https://example.com/post", "?ref=discord"),
    ).toBeNull();
  });

  it("credits Discord for a link tagged ?ref=discord", () => {
    expect(fallbackReferrer("", "?ref=discord")).toBe("https://discord.com/");
  });

  it("reads the tag in any case", () => {
    expect(fallbackReferrer("", "?ref=Discord")).toBe("https://discord.com/");
  });

  it("reads the tag among other parameters", () => {
    expect(fallbackReferrer("", "?tab=work&ref=discord")).toBe(
      "https://discord.com/",
    );
  });

  it("reports an untagged visit with no referrer as unknown", () => {
    expect(fallbackReferrer("", "")).toBe(UNKNOWN_REFERRER);
  });

  it("reports a tag it doesn't know as unknown", () => {
    expect(fallbackReferrer("", "?ref=somewhere")).toBe(UNKNOWN_REFERRER);
    expect(fallbackReferrer("", "?ref=constructor")).toBe(UNKNOWN_REFERRER);
  });

  it("names unknown with a hostname Vercel can group by", () => {
    expect(new URL(UNKNOWN_REFERRER).hostname).toMatch(/^unknown\./);
  });
});

describe("fillMissingReferrer", () => {
  it("gives the page the fallback when the browser sent no referrer", () => {
    expect(document.referrer).toBe("");

    fillMissingReferrer();

    expect(document.referrer).toBe(UNKNOWN_REFERRER);
  });

  it("leaves a referrer the browser sent alone", () => {
    Object.defineProperty(document, "referrer", {
      value: "https://github.com/",
      configurable: true,
    });

    fillMissingReferrer();

    expect(document.referrer).toBe("https://github.com/");
  });
});
