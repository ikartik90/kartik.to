"use client";

import {
  useEffectEvent,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";
import { useGestureInput, type GestureFrame } from "@/hooks/use-gesture-input";
import {
  clampPan,
  closeProgress,
  lerpRect,
  maxZoom,
  pinchRelease,
  swipeRelease,
  zoomAbout,
  type Box,
  type Zoom,
} from "@/utils/lightbox-gesture";
import {
  animate,
  boxKeyframe,
  clearBox,
  sameBox,
  settle,
} from "@/utils/lightbox-motion";

const FIT: Zoom = { scale: 1, x: 0, y: 0 };

// A swipe picks its axis after this much travel; a vertical one is left alone.
const AXIS_SLOP = 8;

// A trackpad swipe moves on as soon as it has travelled this share of the frame: its momentum
// would otherwise carry the picture off before the stream goes quiet.
const TRACKPAD_COMMIT = 0.25;

// How far past the furthest zoom a pinch may stretch before its release springs back.
const ZOOM_STRETCH = 1.25;

// With no slide on the page to shrink into, the frame shrinks about its centre towards this scale.
const UNSOURCED_SCALE = 0.5;

const EXIT_MS = 180;

export interface LightboxGestureOptions {
  dialogRef: RefObject<HTMLDialogElement | null>;
  /** The item on show; each starts unzoomed. */
  shown: number | null;
  count: number;
  /** The picture's natural width, and its inset band as a share of the frame's width. */
  naturalWidth: number | undefined;
  band: number;
  source: () => HTMLElement | null;
  /** `enterFrom` is where the next item's frame slides in from. */
  onStep: (step: 1 | -1, enterFrom: DOMRect) => void;
  /** Closes from wherever the frame stands. */
  onClose: () => void;
  closing: () => boolean;
}

export interface LightboxGestures {
  /** For the frame, which a pinch below the fitted size shrinks and a swipe moves. */
  frameRef: RefObject<HTMLDivElement | null>;
  /** For the layer inside the frame that a pinch zooms and a drag pans. */
  zoomRef: RefObject<HTMLDivElement | null>;
  /** Takes over a pinch that began on the page and opened the lightbox. */
  adopt: (frame: GestureFrame) => void;
  move: (frame: GestureFrame) => void;
  end: (frame: GestureFrame) => void;
  resetZoom: () => void;
}

interface Pinch {
  type: "pinch";
  rest: DOMRect;
  source: Box | null;
  sourceScale: number;
  from: Zoom;
  scale: number;
  opening: boolean;
}

interface Pan {
  type: "pan";
  rest: DOMRect;
  from: Zoom;
}

interface Swipe {
  type: "swipe";
  rest: DOMRect;
  axis: "x" | "y" | null;
  offset: number;
  committed: boolean;
}

type Session = Pinch | Pan | Swipe;

const centreOf = (box: Box) => ({
  x: box.left + box.width / 2,
  y: box.top + box.height / 2,
});

function scaledAbout(box: Box, scale: number): Box {
  const centre = centreOf(box);
  return {
    left: centre.x - (box.width * scale) / 2,
    top: centre.y - (box.height * scale) / 2,
    width: box.width * scale,
    height: box.height * scale,
  };
}

/**
 * The lightbox's pinch, pan and swipe. One scale runs through a pinch: above 1 it zooms the
 * picture inside the frame, below 1 it shrinks the frame towards the slide it came from.
 */
export function useLightboxGestures(
  options: LightboxGestureOptions,
): LightboxGestures {
  const frameRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  const zoom = useRef<Zoom>(FIT);
  const session = useRef<Session | null>(null);

  const reach = (rest: DOMRect) =>
    maxZoom(options.naturalWidth, rest.width * (1 - 2 * options.band));

  const paintZoom = (next: Zoom) => {
    zoom.current = next;
    const layer = zoomRef.current;
    if (!layer) return;
    const fitted = next.scale === 1 && next.x === 0 && next.y === 0;
    layer.style.transform = fitted
      ? ""
      : `translate(${next.x}px, ${next.y}px) scale(${next.scale})`;
  };

  const easeZoom = (next: Zoom) => {
    const layer = zoomRef.current;
    if (!layer) return paintZoom(next);
    const from = getComputedStyle(layer).transform;
    settle(layer);
    paintZoom(next);
    animate(layer, [
      { transform: from },
      { transform: layer.style.transform || "none" },
    ]);
  };

  const resting = (frame: HTMLElement) => {
    settle(frame);
    clearBox(frame);
    return frame.getBoundingClientRect();
  };

  const beginPinch = (opening: boolean): Pinch | null => {
    const frame = frameRef.current;
    if (!frame) return null;
    const rest = resting(frame);
    const source = options.source()?.getBoundingClientRect() ?? null;
    const sourceScale =
      source && rest.width ? source.width / rest.width : UNSOURCED_SCALE;
    const from = opening ? FIT : zoom.current;
    return {
      type: "pinch",
      rest,
      source,
      sourceScale,
      from,
      scale: opening ? sourceScale : from.scale,
      opening,
    };
  };

  const pinchMove = (pinch: Pinch, frame: GestureFrame) => {
    const element = frameRef.current;
    if (!element) return;
    const base = pinch.opening ? pinch.sourceScale : pinch.from.scale;
    // One level per pinch: opening stops at fitted, and so does leaving a zoom; only a pinch
    // from fitted goes either way.
    const scale = pinch.opening
      ? Math.min(base * frame.scale, 1)
      : base > 1
        ? Math.max(base * frame.scale, 1)
        : base * frame.scale;
    pinch.scale = scale;
    const drift = {
      x: frame.center.x - frame.start.x,
      y: frame.center.y - frame.start.y,
    };

    if (scale >= 1) {
      clearBox(element);
      const centre = centreOf(pinch.rest);
      const about = zoomAbout(
        pinch.from,
        Math.min(scale, reach(pinch.rest) * ZOOM_STRETCH),
        { x: frame.start.x - centre.x, y: frame.start.y - centre.y },
      );
      paintZoom(
        clampPan(
          { ...about, x: about.x + drift.x, y: about.y + drift.y },
          pinch.rest,
        ),
      );
      return;
    }

    paintZoom(FIT);
    const towards = pinch.source ?? scaledAbout(pinch.rest, pinch.sourceScale);
    const box = lerpRect(
      pinch.rest,
      towards,
      closeProgress(scale, pinch.sourceScale),
    );
    Object.assign(
      element.style,
      boxKeyframe(
        { ...box, left: box.left + drift.x, top: box.top + drift.y },
        pinch.rest,
      ),
    );
  };

  const pinchEnd = (pinch: Pinch) => {
    const element = frameRef.current;
    if (!element) return;
    const outcome = pinchRelease({
      scale: pinch.scale,
      sourceScale: pinch.sourceScale,
      opening: pinch.opening,
    });
    if (outcome === "close") return options.onClose();

    if (outcome === "fit") {
      const from = element.getBoundingClientRect();
      clearBox(element);
      if (!sameBox(from, pinch.rest)) {
        animate(element, [
          boxKeyframe(from, pinch.rest),
          boxKeyframe(pinch.rest, pinch.rest),
        ]);
      }
      if (zoom.current !== FIT) easeZoom(FIT);
      return;
    }

    const limit = reach(pinch.rest);
    if (zoom.current.scale > limit) {
      easeZoom(
        clampPan(zoomAbout(zoom.current, limit, { x: 0, y: 0 }), pinch.rest),
      );
    }
  };

  const commit = (swipe: Swipe, step: 1 | -1) => {
    const element = frameRef.current;
    if (!element) return;
    swipe.committed = true;
    const { rest } = swipe;
    // Fully off the screen on the side the swipe leaves by; the next item enters from the other.
    const exitX = step === 1 ? -rest.right : window.innerWidth - rest.left;
    element.style.translate = "";
    const exit = animate(
      element,
      [
        { translate: `${swipe.offset}px 0px`, opacity: 1 },
        { translate: `${exitX}px 0px`, opacity: 0 },
      ],
      { fill: "forwards", duration: EXIT_MS },
    );
    const enterFrom = new DOMRect(
      rest.left - exitX,
      rest.top,
      rest.width,
      rest.height,
    );
    const next = () => options.onStep(step, enterFrom);
    if (exit) exit.finished.then(next, () => {});
    else next();
  };

  const swipeMove = (swipe: Swipe, frame: GestureFrame) => {
    const element = frameRef.current;
    if (!element || swipe.committed) return;
    const dx = frame.center.x - frame.start.x;
    const dy = frame.center.y - frame.start.y;
    if (!swipe.axis) {
      if (Math.hypot(dx, dy) < AXIS_SLOP) return;
      swipe.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    }
    if (swipe.axis !== "x") return;
    swipe.offset = dx;
    element.style.translate = `${dx}px 0px`;
    if (
      frame.kind === "trackpad" &&
      Math.abs(dx) >= swipe.rest.width * TRACKPAD_COMMIT
    ) {
      commit(swipe, dx < 0 ? 1 : -1);
    }
  };

  const swipeEnd = (swipe: Swipe, frame: GestureFrame) => {
    const element = frameRef.current;
    if (!element || swipe.committed || swipe.axis !== "x") return;
    const step = swipeRelease({
      offset: swipe.offset,
      width: swipe.rest.width,
      speed: frame.velocity.x,
    });
    if (step) return commit(swipe, step);
    element.style.translate = "";
    animate(element, [
      { translate: `${swipe.offset}px 0px` },
      { translate: "0px 0px" },
    ]);
  };

  const move = (frame: GestureFrame) => {
    const current = session.current;
    if (current?.type === "pinch") pinchMove(current, frame);
    if (current?.type === "swipe") swipeMove(current, frame);
    if (current?.type === "pan") {
      const dx = frame.center.x - frame.start.x;
      const dy = frame.center.y - frame.start.y;
      paintZoom(
        clampPan(
          { ...current.from, x: current.from.x + dx, y: current.from.y + dy },
          current.rest,
        ),
      );
    }
  };

  const end = (frame: GestureFrame) => {
    const current = session.current;
    session.current = null;
    if (current?.type === "pinch") pinchEnd(current);
    if (current?.type === "swipe") swipeEnd(current, frame);
  };

  useGestureInput(options.dialogRef, {
    start: (frame) => {
      const element = frameRef.current;
      if (!element || options.shown === null || options.closing()) return false;
      // A pinch handed over from the page is still running.
      if (session.current) return false;
      if (frame.pinch) {
        session.current = beginPinch(false);
        return session.current !== null;
      }
      const rest = resting(element);
      if (zoom.current.scale > 1) {
        session.current = { type: "pan", rest, from: zoom.current };
        return true;
      }
      // Only a zoomed picture follows the mouse; at its fitted size a drag is left to the page.
      if (frame.kind === "mouse" || options.count < 2) return false;
      session.current = {
        type: "swipe",
        rest,
        axis: null,
        offset: 0,
        committed: false,
      };
      return true;
    },
    move,
    end,
  });

  const unzoom = useEffectEvent(() => {
    session.current = null;
    const layer = zoomRef.current;
    if (layer) settle(layer);
    paintZoom(FIT);
  });

  useLayoutEffect(() => unzoom(), [options.shown]);

  return {
    frameRef,
    zoomRef,
    adopt: (frame) => {
      const pinch = beginPinch(true);
      session.current = pinch;
      if (pinch) pinchMove(pinch, frame);
    },
    move: (frame) => {
      if (session.current?.type === "pinch" && session.current.opening) {
        move(frame);
      }
    },
    end: (frame) => {
      if (session.current?.type === "pinch" && session.current.opening) {
        end(frame);
      }
    },
    resetZoom: () => {
      if (zoom.current !== FIT) easeZoom(FIT);
    },
  };
}
