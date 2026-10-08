// @vitest-environment jsdom
import { useRef } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWholeSlides } from "../use-whole-slides";

// jsdom has no IntersectionObserver; the stub keeps each observer so a case can report any slide.
interface Observer {
  callback: IntersectionObserverCallback;
  targets: Element[];
  disconnected: boolean;
}

const observers: Observer[] = [];

class MockObserver {
  private own: Observer;
  constructor(callback: IntersectionObserverCallback) {
    this.own = { callback, targets: [], disconnected: false };
    observers.push(this.own);
  }
  observe(target: Element) {
    this.own.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    this.own.disconnected = true;
  }
  takeRecords() {
    return [];
  }
}

vi.stubGlobal("IntersectionObserver", MockObserver);

afterEach(() => {
  cleanup();
  observers.length = 0;
});

const live = () => observers.filter((each) => !each.disconnected);

// Slides are reported cut by the screen's top or foot: the part shown is `shown` px of `height`.
function report(
  slide: Element,
  ratio: number,
  {
    height = 400,
    rootHeight = 900,
    shown = height * ratio,
  }: { height?: number; rootHeight?: number; shown?: number } = {},
) {
  const [observer] = live();
  act(() =>
    observer.callback(
      [
        {
          target: slide,
          intersectionRatio: ratio,
          isIntersecting: ratio > 0,
          boundingClientRect: { height, width: 300 } as DOMRectReadOnly,
          intersectionRect: {
            height: shown,
            width: ratio > 0 ? 300 : 0,
          } as DOMRectReadOnly,
          rootBounds: { height: rootHeight } as DOMRectReadOnly,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    ),
  );
}

function Strip({ slides }: { slides: string[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const whole = useWholeSlides(scrollerRef, slides);
  return (
    <>
      <div ref={scrollerRef}>
        <div>
          {slides.map((name) => (
            <figure key={name} data-carousel-slide="" data-name={name} />
          ))}
        </div>
      </div>
      <output>{[...whole].sort().join(",")}</output>
    </>
  );
}

const wholeIndices = () =>
  document
    .querySelector("output")!
    .textContent!.split(",")
    .filter(Boolean)
    .map(Number);

const slide = (name: string) =>
  document.querySelector(`[data-name="${name}"]`)!;

describe("useWholeSlides", () => {
  it("watches every slide in the strip", () => {
    render(<Strip slides={["a", "b", "c"]} />);
    expect(live()[0].targets).toEqual([slide("a"), slide("b"), slide("c")]);
  });

  it("counts none whole until the screen has been measured", () => {
    render(<Strip slides={["a", "b"]} />);
    expect(wholeIndices()).toEqual([]);
  });

  it("counts a slide whole only while all of it is on screen", () => {
    render(<Strip slides={["a", "b", "c"]} />);

    report(slide("a"), 1);
    report(slide("b"), 0.4);
    expect(wholeIndices()).toEqual([0]);

    report(slide("a"), 0.95);
    report(slide("b"), 1);
    expect(wholeIndices()).toEqual([1]);
  });

  it("counts a slide taller than the screen whole once it fills the screen", () => {
    render(<Strip slides={["a"]} />);
    report(slide("a"), 450 / 500, { height: 500, rootHeight: 450 });
    expect(wholeIndices()).toEqual([0]);
  });

  it("counts a slide whole when the browser rounds the part shown to whole pixels", () => {
    render(<Strip slides={["a"]} />);
    // WebKit's report for a 358.39px slide in full view.
    report(slide("a"), 358 / 358.390625, { height: 358.390625, shown: 358 });
    expect(wholeIndices()).toEqual([0]);
  });

  it("re-reads which slide is where once they're reordered", () => {
    const { rerender } = render(<Strip slides={["a", "b"]} />);
    report(slide("a"), 1);

    rerender(<Strip slides={["b", "a"]} />);
    expect(live()).toHaveLength(1);
    expect(live()[0].targets).toEqual([slide("b"), slide("a")]);

    report(slide("a"), 1);
    report(slide("b"), 0);
    expect(wholeIndices()).toEqual([1]);
  });

  it("stops watching once the strip is gone", () => {
    const { unmount } = render(<Strip slides={["a"]} />);
    unmount();
    expect(live()).toHaveLength(0);
  });
});
