import { cleanup, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePlacement } from "../ui";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// A window 1000 square in a carousel that scrolls, its browser bar over the top 200, the app's page under it; a 475 ×
// 400 overlay that fits neither below nor above its call to action in the page.
const BOXES: Record<string, { top: number; bottom: number }> = {
  carousel: { top: 0, bottom: 1000 },
  window: { top: 0, bottom: 1000 },
  page: { top: 200, bottom: 1000 },
  cta: { top: 580, bottom: 610 },
};
const SIZES: Record<string, { width: number; height: number }> = { window: { width: 1000, height: 1000 }, overlay: { width: 475, height: 400 } };

/** `still`: the page's scroller clipped, as `stillScrollers` leaves a landing card's. */
function Probe({ still }: { still?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [cta, setCta] = useState<HTMLElement | null>(null);
  const style = usePlacement(root, cta);
  return (
    <div data-testid="carousel" style={{ overflowY: "auto" }}>
      <div data-testid="window">
        <div data-testid="page" style={{ overflowY: still ? "hidden" : "auto" }} data-still-scroll={still ? "" : undefined}>
          <button ref={setCta} data-testid="cta" />
          <div ref={root} data-testid="overlay" data-top={style?.top} data-left={style?.left} />
        </div>
      </div>
    </div>
  );
}

function lay() {
  const id = (node: Element) => (node as HTMLElement).dataset.testid ?? "";
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const { top, bottom } = BOXES[id(this)] ?? { top: 0, bottom: 0 };
    const [left, right] = id(this) === "cta" ? [880, 980] : [0, 1000];
    return { top, bottom, left, right, x: left, y: top, width: right - left, height: bottom - top, toJSON: () => ({}) };
  });
  vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockImplementation(function (this: HTMLElement) {
    return id(this) === "overlay" ? screen.getByTestId("window") : null;
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
    return SIZES[id(this)]?.width ?? 0;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    return SIZES[id(this)]?.height ?? 0;
  });
}

const placed = () => {
  const { top, left } = screen.getByTestId("overlay").dataset;
  return { top: Number(top), left: Number(left) };
};

describe("usePlacement", () => {
  it("opens to the left, clear of the page's edge, where the page has no room below or above", () => {
    lay();
    render(<Probe />);
    expect(placed()).toEqual({ top: 576, left: 401 });
  });

  it("measures the room in the page, not a scroller round its window, where a demo has stilled the page's scroller", () => {
    lay();
    render(<Probe still />);
    expect(placed()).toEqual({ top: 576, left: 401 });
  });
});
