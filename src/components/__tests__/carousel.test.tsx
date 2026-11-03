import { cleanup, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Carousel } from "../carousel";

// A strip 400 wide holding two 400-wide slides, the second 500 in: wider than its view, so it scrolls.
beforeEach(() => {
  const get = (name: "scrollWidth" | "clientWidth" | "offsetWidth" | "offsetLeft", value: (el: HTMLElement) => number) =>
    vi.spyOn(HTMLElement.prototype, name, "get").mockImplementation(function (this: HTMLElement) {
      return value(this);
    });
  get("scrollWidth", () => 900);
  get("clientWidth", () => 400);
  get("offsetWidth", () => 400);
  get("offsetLeft", (el) => (el.textContent === "Two" ? 500 : 0));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Strip({ controls }: { controls?: boolean }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  return (
    <Carousel scrollerRef={scrollerRef} controls={controls}>
      <div data-carousel-slide="">One</div>
      <div data-carousel-slide="">Two</div>
    </Carousel>
  );
}

describe("Carousel", () => {
  it("offers its arrows by default", () => {
    render(<Strip />);
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("leaves its arrows out when told to, for a strip moved only by dragging", () => {
    render(<Strip controls={false} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
