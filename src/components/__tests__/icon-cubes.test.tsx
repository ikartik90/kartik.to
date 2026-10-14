// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IconCubes } from "../icon-cubes";
import type { CoverIcon } from "@/domain/icon";
import { readIconSvg } from "@/utils/icon-svg";

const ICONS: CoverIcon[] = Array.from({ length: 150 }, (_, i) => ({
  key: `icon-${i}`,
  svg: readIconSvg(`<svg viewBox="0 0 20 20"><path d="M${i} 10L16 10" stroke="#000"/></svg>`)!,
}));

let reduced = false;
beforeEach(() => {
  reduced = false;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce") && reduced,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const inCard = () => render(<a href="/playground/icons"><IconCubes icons={ICONS} /></a>);
const shown = (nodes: NodeListOf<Element>) => [...nodes].filter((node) => (node as HTMLElement).style.display !== "none");

describe("IconCubes", () => {
  it("rests as 25 cubes square on, each front's icon drawn over it and the rest out of sight", () => {
    const { container } = inCard();
    const [cubes, icons] = container.querySelectorAll("[data-icon-cubes] > div");
    expect(cubes.children).toHaveLength(25);
    expect(shown(cubes.querySelectorAll(":scope > span > span > span"))).toHaveLength(25);
    expect(icons.querySelectorAll("svg")).toHaveLength(125);
    expect(shown(icons.querySelectorAll(":scope > span > span"))).toHaveLength(25);
  });

  it("starts with a different icon on every face", () => {
    const { container } = inCard();
    const drawings = [...container.querySelectorAll("[data-icon-cubes] > div:last-child svg")].map((node) => node.outerHTML);
    expect(new Set(drawings).size).toBe(125);
  });

  it("plays once on the card, following the cursor and the finger without holding up a scroll", () => {
    const listen = vi.spyOn(HTMLAnchorElement.prototype, "addEventListener");
    inCard();
    expect(requestAnimationFrame).toHaveBeenCalled();
    const types = listen.mock.calls.map(([type]) => type);
    expect(types).toEqual(expect.arrayContaining(["pointermove", "touchstart", "touchmove", "touchend"]));
    for (const [type, , options] of listen.mock.calls) {
      if (String(type).startsWith("touch")) expect(options).toMatchObject({ passive: true });
    }
  });

  it("stays still, at rest, for a reader who asks for less motion", () => {
    reduced = true;
    const { container } = inCard();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(shown(container.querySelectorAll("[data-icon-cubes] > div:last-child > span > span"))).toHaveLength(25);
  });
});
