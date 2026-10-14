// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IconDrawing } from "../icon-drawing";
import { readIconSvg } from "@/utils/icon-svg";

afterEach(() => cleanup());

const CHECK = readIconSvg(
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10L9 15L16 5" stroke="white" stroke-width="1.25"/></svg>`,
)!;

describe("IconDrawing", () => {
  it("draws the icon's own geometry, in the current colour, out of the accessibility tree", () => {
    const { container } = render(<IconDrawing svg={CHECK} settings={{ size: 20, stroke: 1.25 }} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 20 20");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    const path = svg.querySelector("path")!;
    expect(path.getAttribute("d")).toBe("M4 10L9 15L16 5");
    expect(path.getAttribute("stroke")).toBe("currentColor");
  });

  it("is as big as its settings unless drawn at another size", () => {
    const settings = { size: 20, stroke: 1.25 };
    const { container, rerender } = render(<IconDrawing svg={CHECK} settings={settings} />);
    expect(container.querySelector("svg")!.getAttribute("width")).toBe("20");
    rerender(<IconDrawing svg={CHECK} settings={settings} size={40} />);
    expect(container.querySelector("svg")!.getAttribute("height")).toBe("40");
  });

  it("passes its other attributes on to the drawing", () => {
    const { container } = render(<IconDrawing svg={CHECK} settings={{ size: 20, stroke: 1.25 }} data-icon-drawing="" />);
    expect(container.querySelector("svg")!.hasAttribute("data-icon-drawing")).toBe(true);
  });
});
