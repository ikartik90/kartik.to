// @vitest-environment jsdom
import { useEffect, useRef } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useLightboxGestures,
  type LightboxGestures,
} from "../use-lightbox-gestures";
import type { GestureFrame } from "../use-gesture-input";

const handle: { current: LightboxGestures | null } = { current: null };
const gestures = () => handle.current!;

function Harness({
  shown = 0,
  onStep,
  onClose,
  source,
}: {
  shown?: number;
  onStep: (step: 1 | -1, enterFrom: DOMRect) => void;
  onClose: () => void;
  source: HTMLElement | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const api = useLightboxGestures({
    dialogRef,
    shown,
    count: 3,
    naturalWidth: 2400,
    band: 0,
    source: () => source,
    onStep,
    onClose,
    closing: () => false,
  });
  const { frameRef, zoomRef } = api;
  useEffect(() => {
    handle.current = api;
  });
  return (
    <dialog ref={dialogRef} open>
      <div ref={frameRef} data-frame="">
        <div ref={zoomRef} data-zoom="" />
      </div>
    </dialog>
  );
}

const dialog = () => document.querySelector("dialog")!;
const frame = () => document.querySelector<HTMLElement>("[data-frame]")!;
const zoom = () => document.querySelector<HTMLElement>("[data-zoom]")!;

// The frame rests at 800 × 500; its slide on the page is half that.
const REST = new DOMRect(100, 100, 800, 500);
const SLIDE = new DOMRect(200, 200, 400, 250);

function wheel(init: WheelEventInit) {
  dialog().dispatchEvent(
    new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 500,
      clientY: 350,
      ...init,
    }),
  );
}

const quiet = () => act(() => vi.advanceTimersByTime(1000));

function setup(shown = 0) {
  const onStep = vi.fn();
  const onClose = vi.fn();
  const source = document.createElement("div");
  source.getBoundingClientRect = () => SLIDE;
  const view = render(
    <Harness shown={shown} onStep={onStep} onClose={onClose} source={source} />,
  );
  frame().getBoundingClientRect = () => REST;
  return { onStep, onClose, source, view };
}

const handedOver = (scale: number): GestureFrame => ({
  kind: "touch",
  pinch: true,
  scale,
  start: { x: 400, y: 325 },
  center: { x: 400, y: 325 },
  velocity: { x: 0, y: 0 },
});

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useLightboxGestures", () => {
  it("zooms the picture when pinched out", () => {
    setup();
    wheel({ ctrlKey: true, deltaY: -50 });
    wheel({ ctrlKey: true, deltaY: -50 });
    expect(zoom().style.transform).toMatch(/scale\(2\.71/);
  });

  it("pans a zoomed picture instead of changing item", () => {
    const { onStep } = setup();
    wheel({ ctrlKey: true, deltaY: -100 });
    quiet();

    wheel({ deltaX: 300 });
    quiet();
    expect(onStep).not.toHaveBeenCalled();
    expect(zoom().style.transform).toMatch(/^translate\(-300px, 0px\)/);
  });

  it("moves on once a swipe travels a quarter of the frame", () => {
    const { onStep } = setup();
    wheel({ deltaX: 250 });
    expect(onStep).toHaveBeenCalledWith(1, expect.any(DOMRect));
  });

  it("springs back from a short swipe", () => {
    const { onStep } = setup();
    wheel({ deltaX: 100 });
    expect(frame().style.translate).toBe("-100px 0px");
    quiet();
    expect(onStep).not.toHaveBeenCalled();
    expect(frame().style.translate).toBe("");
  });

  it("closes when pinched in towards its slide", () => {
    const { onClose } = setup();
    wheel({ ctrlKey: true, deltaY: 30 });
    quiet();
    expect(onClose).toHaveBeenCalled();
  });

  it("settles back to fitted from a slight pinch in", () => {
    const { onClose } = setup();
    wheel({ ctrlKey: true, deltaY: 5 });
    expect(frame().style.width).not.toBe("");
    quiet();
    expect(onClose).not.toHaveBeenCalled();
    expect(frame().style.width).toBe("");
  });

  it("opens fully when a pinch handed over from the slide keeps growing", () => {
    const { onClose } = setup();
    act(() => {
      gestures().adopt(handedOver(1.05));
      gestures().move(handedOver(1.6));
      gestures().end(handedOver(1.6));
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(frame().style.width).toBe("");
  });

  it("falls back into the slide when a handed-over pinch barely grows", () => {
    const { onClose } = setup();
    act(() => {
      gestures().adopt(handedOver(1.05));
      gestures().end(handedOver(1.05));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("stops an opening pinch at the fitted size; zooming takes a second pinch", () => {
    setup();
    act(() => {
      gestures().adopt(handedOver(1.05));
      gestures().move(handedOver(5));
    });
    expect(frame().style.width).toBe("");
    expect(zoom().style.transform).toBe("");
  });

  it("stops a pinch in from a zoom at the fitted size; closing takes a second pinch", () => {
    const { onClose } = setup();
    wheel({ ctrlKey: true, deltaY: -50 });
    quiet();

    wheel({ ctrlKey: true, deltaY: 150 });
    expect(frame().style.width).toBe("");
    quiet();
    expect(onClose).not.toHaveBeenCalled();
    expect(zoom().style.transform).toBe("");
  });

  it("starts each item unzoomed", () => {
    const { onStep, onClose, source, view } = setup();
    wheel({ ctrlKey: true, deltaY: -50 });
    quiet();
    view.rerender(
      <Harness shown={1} onStep={onStep} onClose={onClose} source={source} />,
    );
    expect(zoom().style.transform).toBe("");
  });
});
