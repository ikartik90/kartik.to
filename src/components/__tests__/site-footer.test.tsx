// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SiteFooter } from "../site-footer";

describe("SiteFooter", () => {
  afterEach(cleanup);

  it("is the page's footer, with the skyline in it as a named picture", () => {
    render(<SiteFooter />);
    const footer = screen.getByRole("contentinfo");
    const picture = screen.getByRole("img", { name: "Toronto skyline" });
    expect(footer.contains(picture)).toBe(true);
  });

  it("lets the drawing crop itself, bottom-anchored and centred on the tower", () => {
    render(<SiteFooter />);
    const svg = screen.getByRole("img", { name: "Toronto skyline" });
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 4000 600");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMax slice");
  });

  it("keeps every line a hairline whatever height the footer is drawn at", () => {
    render(<SiteFooter />);
    const svg = screen.getByRole("img", { name: "Toronto skyline" });
    const shapes = svg.querySelectorAll("path, circle");
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      expect(shape.getAttribute("vector-effect")).toBe("non-scaling-stroke");
    }
  });
});
