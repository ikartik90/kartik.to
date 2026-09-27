// @vitest-environment jsdom
import { useRef } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useGestureInput,
  type GestureFrame,
  type GestureHandlers,
} from "../use-gesture-input";

function Target({ handlers }: { handlers: GestureHandlers }) {
  const ref = useRef<HTMLDivElement>(null);
  useGestureInput(ref, handlers);
  return <div ref={ref} data-testid="target" />;
}

const target = () => document.querySelector<HTMLElement>("[data-testid]")!;

function touch(type: string, points: [number, number][]) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: points.map(([clientX, clientY], identifier) => ({
      identifier,
      clientX,
      clientY,
    })),
  });
  target().dispatchEvent(event);
  return event;
}

function gesture(type: string, scale: number, x = 100, y = 100) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { scale, clientX: x, clientY: y });
  target().dispatchEvent(event);
  return event;
}

function wheel(init: WheelEventInit) {
  const event = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    clientX: 100,
    clientY: 100,
    ...init,
  });
  target().dispatchEvent(event);
  return event;
}

function spy(accept = true) {
  const frames: { phase: string; frame: GestureFrame }[] = [];
  const handlers: GestureHandlers = {
    start: vi.fn((frame) => {
      frames.push({ phase: "start", frame });
      return accept;
    }),
    move: vi.fn((frame) => frames.push({ phase: "move", frame })),
    end: vi.fn((frame) => frames.push({ phase: "end", frame })),
  };
  return { handlers, frames };
}

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useGestureInput", () => {
  it("reads two fingers as a pinch about their midpoint", () => {
    const { handlers, frames } = spy();
    render(<Target handlers={handlers} />);

    touch("touchstart", [[100, 100], [200, 100]]);
    const moved = touch("touchmove", [[50, 120], [250, 120]]);
    touch("touchend", []);

    expect(moved.defaultPrevented).toBe(true);
    expect(frames.map((f) => f.phase)).toEqual(["start", "move", "end"]);
    expect(frames[1].frame).toMatchObject({
      kind: "touch",
      pinch: true,
      scale: 2,
      start: { x: 150, y: 100 },
      center: { x: 150, y: 120 },
    });
  });

  it("reads one finger as a drag", () => {
    const { handlers, frames } = spy();
    render(<Target handlers={handlers} />);

    touch("touchstart", [[100, 100]]);
    touch("touchmove", [[60, 110]]);
    touch("touchend", []);

    expect(frames[1].frame).toMatchObject({
      pinch: false,
      scale: 1,
      center: { x: 60, y: 110 },
    });
  });

  it("leaves a gesture it was not given to the browser", () => {
    const { handlers, frames } = spy(false);
    render(<Target handlers={handlers} />);

    touch("touchstart", [[100, 100]]);
    const moved = touch("touchmove", [[60, 110]]);

    expect(moved.defaultPrevented).toBe(false);
    expect(frames.map((f) => f.phase)).toEqual(["start"]);
  });

  it("starts afresh when a finger lands mid-drag, so a pinch measures from its own start", () => {
    const { handlers, frames } = spy();
    render(<Target handlers={handlers} />);

    touch("touchstart", [[100, 100]]);
    touch("touchmove", [[90, 100]]);
    touch("touchstart", [[90, 100], [190, 100]]);
    touch("touchmove", [[40, 100], [240, 100]]);

    expect(frames.map((f) => f.phase)).toEqual([
      "start",
      "move",
      "end",
      "start",
      "move",
    ]);
    expect(frames.at(-1)!.frame.scale).toBe(2);
  });

  it("reads Safari's gesture events as a pinch", () => {
    const { handlers, frames } = spy();
    render(<Target handlers={handlers} />);

    expect(gesture("gesturestart", 1).defaultPrevented).toBe(true);
    gesture("gesturechange", 1.5, 120, 90);
    gesture("gestureend", 1.5, 120, 90);

    expect(frames.map((f) => f.phase)).toEqual(["start", "move", "end"]);
    expect(frames[1].frame).toMatchObject({
      kind: "trackpad",
      pinch: true,
      scale: 1.5,
      center: { x: 120, y: 90 },
    });
  });

  it("reads a ctrl-wheel stream as a trackpad pinch that ends when it goes quiet", () => {
    const { handlers, frames } = spy();
    render(<Target handlers={handlers} />);

    expect(wheel({ ctrlKey: true, deltaY: -10 }).defaultPrevented).toBe(true);
    wheel({ ctrlKey: true, deltaY: -10 });
    expect(frames.at(-1)!.frame.scale).toBeCloseTo(Math.exp(0.2), 10);
    expect(frames.at(-1)!.frame.pinch).toBe(true);

    act(() => vi.advanceTimersByTime(1000));
    expect(frames.at(-1)!.phase).toBe("end");
  });

  it("reads a plain wheel stream as a drag that follows the fingers", () => {
    const { handlers, frames } = spy();
    render(<Target handlers={handlers} />);

    wheel({ deltaX: 30 });
    wheel({ deltaX: 20, deltaY: 5 });

    expect(frames.at(-1)!.frame).toMatchObject({
      kind: "trackpad",
      pinch: false,
      start: { x: 100, y: 100 },
      center: { x: 50, y: 95 },
    });
  });

  it("lets the browser scroll a wheel it was not given", () => {
    const { handlers } = spy(false);
    render(<Target handlers={handlers} />);
    expect(wheel({ deltaX: 30 }).defaultPrevented).toBe(false);
  });
});
