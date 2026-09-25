// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { openInNewTab } from "../open-in-new-tab";

describe("openInNewTab", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("navigates via a transient anchor pointing at the url with target=_blank", () => {
    const clicks: { href: string; target: string; rel: string; attached: boolean }[] =
      [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      // Captured at click time: some engines only navigate from an attached anchor.
      clicks.push({
        href: this.getAttribute("href") ?? "",
        target: this.target,
        rel: this.rel,
        attached: document.body.contains(this),
      });
    });

    openInNewTab("/edit/new?category=ARTICLE");

    expect(clicks).toHaveLength(1);
    expect(clicks[0]).toMatchObject({
      href: "/edit/new?category=ARTICLE",
      target: "_blank",
      attached: true,
    });
    expect(clicks[0].rel).toContain("noopener");
  });

  it("does not use window.open, which the browser silently popup-blocks", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    openInNewTab("/edit/new?category=WORK");

    expect(openSpy).not.toHaveBeenCalled();
  });

  it("leaves no anchor behind in the DOM", () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    openInNewTab("/edit/new?category=ARTICLE");

    expect(document.querySelector("a")).toBeNull();
  });
});
