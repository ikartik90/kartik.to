// @vitest-environment jsdom
import { useRef } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDragScroll } from "../use-drag-scroll";

function Strip({
  landing,
  enabled,
  onOpen,
}: {
  landing: (velocity: number) => number;
  enabled?: boolean;
  onOpen?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDragScroll(ref, { enabled, landing });
  return (
    <div ref={ref} data-testid="strip">
      <button type="button" onClick={onOpen}>
        Slide
      </button>
    </div>
  );
}

const strip = () => document.querySelector<HTMLElement>("[data-testid]")!;
const slide = () => strip().querySelector("button")!;

function pointer(
  type: string,
  x: number,
  {
    pointerType = "mouse",
    button = 0,
    buttons = type === "pointerup" ? 0 : 1,
    target = slide() as Element,
    at,
  }: {
    pointerType?: string;
    button?: number;
    buttons?: number;
    target?: Element;
    /** When the pointer was there, on `performance.now()`'s clock, if not when the event arrives. */
    at?: number;
  } = {},
) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType,
    button,
    buttons,
    clientX: x,
    clientY: 100,
  });
  if (at !== undefined) Object.defineProperty(event, "timeStamp", { value: at });
  act(() => {
    target.dispatchEvent(event);
  });
}

function click() {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  act(() => {
    slide().dispatchEvent(event);
  });
  return event;
}

/** Presses at 500, crosses the slop at 480, then moves through `xs`, `stepMs` apart. */
function drag(xs: number[], { stepMs = 16, release = true } = {}) {
  pointer("pointerdown", 500);
  pointer("pointermove", 480);
  for (const x of xs) {
    vi.advanceTimersByTime(stepMs);
    pointer("pointermove", x);
  }
  if (release) pointer("pointerup", xs.at(-1) ?? 480);
}

const frames = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

function wheel(deltaX: number) {
  const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX });
  act(() => {
    slide().dispatchEvent(event);
  });
  return event;
}

let reduced = false;

beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  window.matchMedia = vi.fn((query: string) => ({
    matches: reduced && query.includes("reduce"),
  })) as unknown as typeof window.matchMedia;
  // A strip showing 1000px of 3000: it scrolls from 0 to 2000.
  const strips = (width: number) => ({
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.testid ? width : 0;
    },
  });
  Object.defineProperties(HTMLElement.prototype, {
    clientWidth: strips(1000),
    scrollWidth: strips(3000),
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
  Reflect.deleteProperty(HTMLElement.prototype, "scrollWidth");
});

describe("useDragScroll", () => {
  it("scrolls the strip with a mouse drag, once it moves past the slop", () => {
    render(<Strip landing={() => 0} />);
    drag([440, 380], { release: false });
    frames(300);
    expect(strip().scrollLeft).toBe(100);
    pointer("pointermove", 460);
    frames(300);
    expect(strip().scrollLeft).toBe(20);
  });

  it("moves the strip on frames only, however many moves arrive between them", () => {
    render(<Strip landing={() => 0} />);
    drag([], { release: false });
    frames(100);
    pointer("pointermove", 460);
    pointer("pointermove", 440);
    pointer("pointermove", 420);
    expect(strip().scrollLeft).toBe(0);
    frames(300);
    expect(strip().scrollLeft).toBe(60);
  });

  it("shows the pointer's path at an even pace when its moves arrive unevenly", () => {
    const shown: number[] = [];
    const nextFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) =>
      nextFrame((time) => {
        callback(time);
        shown.push(strip().scrollLeft);
      });
    render(<Strip landing={() => 0} />);
    const start = performance.now();
    pointer("pointerdown", 500, { at: start });
    // The pointer moves 1px a ms, sampled every 16ms; the samples arrive late and in bursts.
    const arrivals = new Map([
      [0, [0]],
      [16, [16]],
      [50, [32, 48]],
      [66, [64]],
      [100, [80, 96]],
      [114, [112]],
      [150, [128, 144]],
      [162, [160]],
      [200, [176, 192]],
    ]);
    for (let ms = 0; ms <= 200; ms++) {
      for (const sampled of arrivals.get(ms) ?? []) {
        pointer("pointermove", 480 - sampled, { at: start + sampled });
      }
      frames(1);
    }
    window.requestAnimationFrame = nextFrame;
    const steps = shown.slice(3).map((left, i) => left - shown[i + 2]);
    expect(steps.length).toBeGreaterThan(5);
    for (const step of steps) expect(step).toBeCloseTo(16, 0);
  });

  it("keeps an even pace when a move arrives after the one that followed it", () => {
    const shown: number[] = [];
    const nextFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) =>
      nextFrame((time) => {
        callback(time);
        shown.push(strip().scrollLeft);
      });
    render(<Strip landing={() => 0} />);
    const start = performance.now();
    pointer("pointerdown", 500, { at: start });
    // 1px a ms, sampled every 16ms; the sample from 32 arrives after the one from 48.
    const arrivals = new Map([
      [0, [0]],
      [16, [16]],
      [48, [48]],
      [50, [32]],
      [64, [64]],
      [80, [80]],
      [96, [96]],
      [112, [112]],
      [128, [128]],
      [144, [144]],
    ]);
    for (let ms = 0; ms <= 150; ms++) {
      for (const sampled of arrivals.get(ms) ?? []) {
        pointer("pointermove", 480 - sampled, { at: start + sampled });
      }
      frames(1);
    }
    window.requestAnimationFrame = nextFrame;
    const steps = shown.slice(3).map((left, i) => left - shown[i + 2]);
    for (const step of steps) expect(step).toBeCloseTo(16, 0);
  });

  it("never steps back while a move is late, and settles under a pointer that has stopped", () => {
    const shown: number[] = [];
    const nextFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) =>
      nextFrame((time) => {
        callback(time);
        shown.push(strip().scrollLeft);
      });
    render(<Strip landing={() => 0} />);
    const start = performance.now();
    pointer("pointerdown", 500, { at: start });
    // Moving 1px a ms; the moves sampled at 48 to 80 arrive together, 40ms late, and the pointer stops at 96.
    const arrivals = new Map([
      [0, [0]],
      [16, [16]],
      [32, [32]],
      [88, [48, 64, 80]],
      [96, [96]],
    ]);
    for (let ms = 0; ms <= 400; ms++) {
      for (const sampled of arrivals.get(ms) ?? []) {
        pointer("pointermove", 480 - sampled, { at: start + sampled });
      }
      frames(1);
    }
    window.requestAnimationFrame = nextFrame;
    const moving = shown.slice(0, shown.indexOf(Math.max(...shown)) + 1);
    moving.slice(1).forEach((left, i) => expect(left).toBeGreaterThanOrEqual(moving[i]));
    expect(shown.at(-1)).toBe(96);
  });

  it("reads the moves a browser folds into one event", () => {
    const landing = vi.fn(() => 0);
    render(<Strip landing={landing} />);
    drag([], { release: false });
    frames(200);
    const event = new PointerEvent("pointermove", {
      bubbles: true,
      pointerId: 1,
      pointerType: "mouse",
      buttons: 1,
      clientX: 430,
    });
    const folded = [470, 450, 430].map((clientX, i) => ({
      clientX,
      timeStamp: performance.now() - 20 + i * 10,
    }));
    Object.defineProperty(event, "getCoalescedEvents", { value: () => folded });
    act(() => {
      slide().dispatchEvent(event);
    });
    pointer("pointerup", 430);
    expect(landing).toHaveBeenCalledWith(2);
  });

  it("turns snapping off once a press starts to move, before the strip does", () => {
    const onOpen = vi.fn();
    render(<Strip landing={() => 0} onOpen={onOpen} />);
    pointer("pointerdown", 500);
    expect(strip().hasAttribute("data-panning")).toBe(false);
    pointer("pointermove", 496);
    expect(strip().dataset.panning).toBe("pressed");
    frames(100);
    expect(strip().scrollLeft).toBe(0);
    pointer("pointerup", 496);
    expect(strip().hasAttribute("data-panning")).toBe(false);
    click();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("keeps a mouse press in the strip from selecting text", () => {
    render(<Strip landing={() => 0} />);
    const select = () => {
      const event = new Event("selectstart", { bubbles: true, cancelable: true });
      slide().dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(select()).toBe(false);
    pointer("pointerdown", 500);
    expect(select()).toBe(true);
    pointer("pointerup", 500);
    pointer("pointerdown", 500, { pointerType: "touch" });
    expect(select()).toBe(false);
  });

  it("leaves a press that hardly moves as a click", () => {
    const onOpen = vi.fn();
    render(<Strip landing={() => 0} onOpen={onOpen} />);
    pointer("pointerdown", 500);
    pointer("pointermove", 495);
    pointer("pointerup", 495);
    expect(strip().scrollLeft).toBe(0);
    expect(click().defaultPrevented).toBe(false);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("keeps the click that ends a drag from opening the slide, and only that one", () => {
    const onOpen = vi.fn();
    render(<Strip landing={() => 0} onOpen={onOpen} />);
    drag([400]);
    expect(click().defaultPrevented).toBe(true);
    expect(onOpen).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    pointer("pointerdown", 500);
    pointer("pointerup", 500);
    click();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("keeps a click that comes a moment after the release, until the next press", () => {
    const onOpen = vi.fn();
    render(<Strip landing={() => 0} onOpen={onOpen} />);
    drag([400]);
    vi.advanceTimersByTime(50);
    expect(click().defaultPrevented).toBe(true);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("keeps the click when the move that ends a drag finds the button already up", () => {
    const onOpen = vi.fn();
    const landing = vi.fn(() => 0);
    render(<Strip landing={landing} onOpen={onOpen} />);
    drag([440, 400], { release: false });
    pointer("pointermove", 380, { buttons: 0 });
    pointer("pointerup", 380);
    expect(landing).toHaveBeenCalledTimes(1);
    expect(click().defaultPrevented).toBe(true);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("takes a flick whose moves the browser folded into its release as a drag", () => {
    const onOpen = vi.fn();
    const landing = vi.fn(() => 0);
    render(<Strip landing={landing} onOpen={onOpen} />);
    pointer("pointerdown", 500);
    vi.advanceTimersByTime(20);
    pointer("pointerup", 380);
    expect(landing).toHaveBeenCalledWith(6);
    expect(click().defaultPrevented).toBe(true);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("keeps the click that ends a drag let go off the strip from reaching what it lands on", () => {
    const onBackdrop = vi.fn();
    render(<Strip landing={() => 0} />);
    document.body.addEventListener("click", onBackdrop);
    drag([400]);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    document.body.removeEventListener("click", onBackdrop);
    expect(event.defaultPrevented).toBe(true);
    expect(onBackdrop).not.toHaveBeenCalled();
  });

  it("leaves touch, pen and a mouse's other buttons to the browser", () => {
    render(<Strip landing={() => 0} />);
    for (const options of [
      { pointerType: "touch" },
      { pointerType: "pen" },
      { button: 2 },
    ]) {
      pointer("pointerdown", 500, options);
      pointer("pointermove", 300, options);
      expect(strip().scrollLeft).toBe(0);
      expect(strip().hasAttribute("data-panning")).toBe(false);
      pointer("pointerup", 300, options);
    }
  });

  it("leaves a trackpad's swipes to the browser, at either end and between", () => {
    render(<Strip landing={() => 0} />);
    for (const [left, deltaX] of [[0, -30], [0, 30], [1000, 30], [2000, 30], [2000, -30]]) {
      strip().scrollLeft = left;
      expect(wheel(deltaX).defaultPrevented).toBe(false);
      frames(100);
      expect(strip().scrollLeft).toBe(left);
    }
  });

  it("does nothing while disabled", () => {
    render(<Strip landing={() => 0} enabled={false} />);
    drag([300], { release: false });
    expect(strip().scrollLeft).toBe(0);
  });

  it("ends the strip's transitions once a press starts to move, and leaves its other animations playing", () => {
    class CSSTransition {
      finish = vi.fn();
    }
    vi.stubGlobal("CSSTransition", CSSTransition);
    const lighting = new CSSTransition();
    const looping = { finish: vi.fn() };
    render(<Strip landing={() => 0} />);
    const getAnimations = vi.fn(() => [lighting, looping]);
    Object.assign(strip(), { getAnimations });
    pointer("pointerdown", 500);
    expect(lighting.finish).not.toHaveBeenCalled();
    pointer("pointermove", 496);
    expect(getAnimations).toHaveBeenCalledWith({ subtree: true });
    expect(lighting.finish).toHaveBeenCalledTimes(1);
    expect(looping.finish).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("keeps snapping off for the drag without restyling the page", () => {
    render(<Strip landing={() => 0} />);
    drag([400], { release: false });
    expect(strip().dataset.panning).toBe("held");
    expect(strip().getAttribute("style")).toBeNull();
    expect(document.documentElement.attributes.length).toBe(0);
  });

  it("asks where to land with the speed the pointer was let go at", () => {
    const landing = vi.fn(() => 0);
    render(<Strip landing={landing} />);
    drag([440, 400]);
    expect(landing).toHaveBeenCalledWith(3.125);
  });

  it("measures a flick from when its moves were made, however late they arrive", () => {
    const landing = vi.fn(() => 0);
    render(<Strip landing={landing} />);
    const start = performance.now();
    pointer("pointerdown", 500, { at: start });
    vi.advanceTimersByTime(150);
    for (const [ms, x] of [[0, 480], [16, 440], [32, 400], [48, 380]]) {
      pointer("pointermove", x, { at: start + ms });
    }
    pointer("pointerup", 380, { at: start + 48 });
    expect(landing).toHaveBeenCalledWith(2.5);
  });

  it("lands without speed after the pointer has held still", () => {
    const landing = vi.fn(() => 0);
    render(<Strip landing={landing} />);
    drag([440, 400], { release: false });
    vi.advanceTimersByTime(200);
    pointer("pointerup", 400);
    expect(landing).toHaveBeenCalledWith(0);
  });

  it("glides to the landing, snapping back on once it is there", () => {
    render(<Strip landing={() => 300} />);
    drag([440, 400]);
    expect(strip().dataset.panning).toBe("gliding");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(strip().scrollLeft).toBe(300);
    expect(strip().hasAttribute("data-panning")).toBe(false);
  });

  it("jumps to the landing under reduced motion", () => {
    reduced = true;
    render(<Strip landing={() => 300} />);
    drag([440, 400]);
    expect(strip().scrollLeft).toBe(300);
    expect(strip().hasAttribute("data-panning")).toBe(false);
  });

  it("gives the glide up to anything else that scrolls the strip", () => {
    render(<Strip landing={() => 300} />);
    drag([440, 400]);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    strip().scrollLeft = 1000;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(strip().scrollLeft).toBe(1000);
    expect(strip().hasAttribute("data-panning")).toBe(false);
  });

  it("holds a gliding strip where a press catches it, without opening the slide", () => {
    const onOpen = vi.fn();
    const landing = vi.fn(() => 300);
    render(<Strip landing={landing} onOpen={onOpen} />);
    drag([440, 400]);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    const caughtAt = strip().scrollLeft;
    pointer("pointerdown", 500);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(strip().scrollLeft).toBe(caughtAt);
    expect(strip().dataset.panning).toBe("held");
    pointer("pointerup", 500);
    expect(click().defaultPrevented).toBe(true);
    expect(onOpen).not.toHaveBeenCalled();
    expect(landing).toHaveBeenLastCalledWith(0);
  });

  describe("at its ends", () => {
    /** Presses at 500 and drags right, past the start, to `x`. */
    const pullPastStart = (x: number) => {
      pointer("pointerdown", 500);
      pointer("pointermove", 520);
      pointer("pointermove", x);
      frames(300);
    };

    it("stops at the start, however far a drag goes past it", () => {
      render(<Strip landing={() => 0} />);
      pullPastStart(800);
      expect(strip().scrollLeft).toBe(0);
    });

    it("scrolls back in as soon as a drag past the start turns around", () => {
      render(<Strip landing={() => 0} />);
      pullPastStart(800);
      pointer("pointermove", 700);
      frames(300);
      expect(strip().scrollLeft).toBe(100);
    });

    it("scrolls back in as soon as a drag past the end turns around", () => {
      render(<Strip landing={() => 2000} />);
      strip().scrollLeft = 2000;
      pointer("pointerdown", 500);
      pointer("pointermove", 480);
      pointer("pointermove", 100);
      frames(300);
      expect(strip().scrollLeft).toBe(2000);
      pointer("pointermove", 200);
      frames(300);
      expect(strip().scrollLeft).toBe(1900);
    });

    it("never creeps back in once a fast drag past an end stops", () => {
      const shown: number[] = [];
      const nextFrame = window.requestAnimationFrame;
      window.requestAnimationFrame = (callback) =>
        nextFrame((time) => {
          callback(time);
          shown.push(strip().scrollLeft);
        });
      render(<Strip landing={() => 0} />);
      const start = performance.now();
      pointer("pointerdown", 500, { at: start });
      // 2px a ms past the start for 160ms, then still.
      for (let ms = 0; ms <= 600; ms++) {
        if (ms % 16 === 0 && ms <= 160) pointer("pointermove", 520 + ms * 2, { at: start + ms });
        frames(1);
      }
      window.requestAnimationFrame = nextFrame;
      expect(Math.max(...shown)).toBe(0);
    });
  });

  it("keeps a picture or link from being dragged out of the strip", () => {
    render(<Strip landing={() => 0} />);
    const event = new Event("dragstart", { bubbles: true, cancelable: true });
    slide().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
