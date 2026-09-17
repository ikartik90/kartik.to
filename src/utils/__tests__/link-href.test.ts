import { describe, expect, it } from "vitest";
import { normalizeLinkHref } from "../link-href";

describe("normalizeLinkHref", () => {
  it("prepends https:// to a bare host", () => {
    expect(normalizeLinkHref("google.com")).toBe("https://google.com");
    expect(normalizeLinkHref("sub.example.co.uk/path")).toBe(
      "https://sub.example.co.uk/path",
    );
  });

  it("prepends https:// to a bare host:port (dotted prefix is not a scheme)", () => {
    expect(normalizeLinkHref("google.com:8080")).toBe(
      "https://google.com:8080",
    );
  });

  it("leaves an explicit scheme untouched", () => {
    for (const url of [
      "http://google.com",
      "https://google.com",
      "mailto:a@b.com",
      "tel:+15551234",
      "ftp://host/file",
    ]) {
      expect(normalizeLinkHref(url)).toBe(url);
    }
  });

  it("leaves relative paths, fragments, queries and protocol-relative URLs untouched", () => {
    for (const url of ["/writing/x", "#section", "?q=1", "//cdn.example.com"]) {
      expect(normalizeLinkHref(url)).toBe(url);
    }
  });

  it("trims surrounding whitespace before normalising", () => {
    expect(normalizeLinkHref("  google.com  ")).toBe("https://google.com");
  });
});
