"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";
import { wheelZoomFactor, type Point } from "@/utils/lightbox-gesture";

export type GestureKind = "touch" | "trackpad" | "mouse";

/** One moment of a gesture; offsets are `center - start`. */
export interface GestureFrame {
  kind: GestureKind;
  /** Two fingers moving apart or together, rather than a drag. */
  pinch: boolean;
  /** Since the gesture began; 1 for a drag. */
  scale: number;
  start: Point;
  center: Point;
  /** px/ms of the centre, over the last moves. */
  velocity: Point;
}

export interface GestureHandlers {
  /** Return true to take the gesture: the browser's own scroll or zoom is then prevented. */
  start: (frame: GestureFrame) => boolean;
  move: (frame: GestureFrame) => void;
  end: (frame: GestureFrame) => void;
}

// A wheel stream (a trackpad's swipe or pinch) has no end event; this much quiet ends it.
const WHEEL_QUIET_MS = 140;

// A release this long after the last move has no speed left.
const STILL_MS = 80;

// Beyond this travel a touch or mouse gesture swallows the click it would end in.
const CLICK_SLOP = 10;

const CLICK_GRACE_MS = 400;

type Source = "touch" | "gesture" | "wheel" | "mouse";

interface Live {
  source: Source;
  frame: GestureFrame;
  lastTime: number;
  ids: number[];
  distance: number;
  pointerId: number;
  quiet?: ReturnType<typeof setTimeout>;
}

interface TouchPoint extends Point {
  id: number;
}

const touchesOf = (event: TouchEvent): TouchPoint[] =>
  Array.from(event.touches, (touch) => ({
    id: touch.identifier,
    x: touch.clientX,
    y: touch.clientY,
  }));

const midpoint = (points: Point[]): Point => ({
  x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
  y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
});

const spread = ([a, b]: Point[]) => Math.hypot(a.x - b.x, a.y - b.y);

/** Safari's own pinch events; not in the DOM typings. */
interface GestureEventLike extends Event {
  scale: number;
  clientX: number;
  clientY: number;
}

function wheelDelta(event: WheelEvent): Point {
  const unit =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? window.innerHeight
        : 1;
  return { x: event.deltaX * unit, y: event.deltaY * unit };
}

export interface GestureInputOptions {
  enabled?: boolean;
  /**
   * The caller takes only pinches. Where a trackpad pinch arrives as Safari's gesture events, no
   * wheel listener is added: a blocking one breaks Safari's scroll snapping on a swipe that could
   * go back in history.
   */
  pinchOnly?: boolean;
}

/**
 * Turns touch, Safari's gesture events, trackpad wheels and mouse drags on `ref` into one stream
 * of frames. A gesture keeps reporting after it begins wherever its events land, so it can outlive
 * what it started on (a pinch that opens a dialog over it).
 */
export function useGestureInput(
  ref: RefObject<HTMLElement | null>,
  handlers: GestureHandlers,
  { enabled = true, pinchOnly = false }: GestureInputOptions = {},
) {
  const onStart = useEffectEvent((frame: GestureFrame) =>
    handlers.start(frame),
  );
  const onMove = useEffectEvent((frame: GestureFrame) => handlers.move(frame));
  const onEnd = useEffectEvent((frame: GestureFrame) => handlers.end(frame));

  useEffect(() => {
    const target = ref.current;
    if (!target || !enabled) return;

    let live: Live | null = null;
    let moved = false;
    let swallowClicksUntil = 0;
    let lastWheel: WheelEvent | null = null;

    const begin = (
      source: Source,
      kind: GestureKind,
      pinch: boolean,
      center: Point,
    ): Live | null => {
      const frame: GestureFrame = {
        kind,
        pinch,
        scale: 1,
        start: center,
        center,
        velocity: { x: 0, y: 0 },
      };
      if (!onStart(frame)) return null;
      moved = false;
      live = {
        source,
        frame,
        lastTime: performance.now(),
        ids: [],
        distance: 0,
        pointerId: -1,
      };
      if (source === "gesture") {
        window.addEventListener("gesturechange", onGestureChange, {
          passive: false,
        });
        window.addEventListener("gestureend", onGestureEnd, { passive: false });
      }
      if (source === "wheel") {
        window.addEventListener("wheel", onWheel, { passive: false });
      }
      return live;
    };

    const update = (center: Point, scale: number) => {
      if (!live) return;
      const time = performance.now();
      const elapsed = Math.max(time - live.lastTime, 1);
      const previous = live.frame;
      const blend = (now: number, before: number, was: number) =>
        ((now - before) / elapsed) * 0.7 + was * 0.3;
      live.frame = {
        ...previous,
        center,
        scale,
        velocity: {
          x: blend(center.x, previous.center.x, previous.velocity.x),
          y: blend(center.y, previous.center.y, previous.velocity.y),
        },
      };
      live.lastTime = time;
      if (
        Math.hypot(center.x - previous.start.x, center.y - previous.start.y) >
        CLICK_SLOP
      ) {
        moved = true;
      }
      onMove(live.frame);
    };

    const finish = () => {
      const done = live;
      if (!done) return;
      live = null;
      clearTimeout(done.quiet);
      window.removeEventListener("gesturechange", onGestureChange);
      window.removeEventListener("gestureend", onGestureEnd);
      window.removeEventListener("wheel", onWheel);
      if (moved && (done.source === "touch" || done.source === "mouse")) {
        swallowClicksUntil = performance.now() + CLICK_GRACE_MS;
      }
      // A wheel stream only ends once it has gone quiet, so it has no speed left either.
      const still =
        done.source === "wheel" ||
        performance.now() - done.lastTime > STILL_MS;
      onEnd(still ? { ...done.frame, velocity: { x: 0, y: 0 } } : done.frame);
    };

    const beginTouch = (points: TouchPoint[]) => {
      if (points.length === 0 || points.length > 2) return;
      const pinch = points.length === 2;
      const started = begin("touch", "touch", pinch, midpoint(points));
      if (!started) return;
      started.ids = points.map((point) => point.id);
      started.distance = pinch ? spread(points) : 0;
    };

    // A finger landing or lifting starts the gesture afresh, so a pinch measures from its own start.
    const onTouchStart = (event: TouchEvent) => {
      if (live && live.source !== "touch") return;
      finish();
      beginTouch(touchesOf(event));
    };

    const onTouchMove = (event: TouchEvent) => {
      const current = live;
      if (current?.source !== "touch") return;
      const points = touchesOf(event).filter((point) =>
        current.ids.includes(point.id),
      );
      if (points.length !== current.ids.length) return;
      // Uncancellable: the browser already scrolls or zooms, so it keeps the gesture.
      if (!event.cancelable) return finish();
      event.preventDefault();
      update(
        midpoint(points),
        current.distance ? spread(points) / current.distance : 1,
      );
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (live?.source !== "touch") return;
      finish();
      beginTouch(touchesOf(event));
    };

    // On iOS a pinch also arrives as touches, which carry it; these only keep the page from zooming.
    const onGestureStart = (event: Event) => {
      const gesture = event as GestureEventLike;
      if (live) {
        if (live.source === "touch") event.preventDefault();
        return;
      }
      const started = begin("gesture", "trackpad", true, {
        x: gesture.clientX,
        y: gesture.clientY,
      });
      if (started) event.preventDefault();
    };

    function onGestureChange(event: Event) {
      if (live?.source !== "gesture") return;
      const gesture = event as GestureEventLike;
      event.preventDefault();
      update({ x: gesture.clientX, y: gesture.clientY }, gesture.scale);
    }

    function onGestureEnd(event: Event) {
      if (live?.source !== "gesture") return;
      event.preventDefault();
      finish();
    }

    // Listened for on the target, and on the window while a stream runs; each event counts once.
    function onWheel(event: WheelEvent) {
      if (event === lastWheel) return;
      lastWheel = event;
      if (live && live.source !== "wheel") return;
      const pinch = event.ctrlKey;
      if (live && live.frame.pinch !== pinch) finish();
      const current =
        live ??
        begin("wheel", "trackpad", pinch, {
          x: event.clientX,
          y: event.clientY,
        });
      if (!current) return;
      event.preventDefault();
      const delta = wheelDelta(event);
      if (pinch) {
        update(
          { x: event.clientX, y: event.clientY },
          current.frame.scale * wheelZoomFactor(delta.y),
        );
      } else {
        update(
          {
            x: current.frame.center.x - delta.x,
            y: current.frame.center.y - delta.y,
          },
          1,
        );
      }
      clearTimeout(current.quiet);
      current.quiet = setTimeout(finish, WHEEL_QUIET_MS);
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || live) return;
      const started = begin("mouse", "mouse", false, {
        x: event.clientX,
        y: event.clientY,
      });
      if (!started) return;
      started.pointerId = event.pointerId;
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Only a live pointer can be captured; a synthetic one still drags.
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (live?.source !== "mouse" || event.pointerId !== live.pointerId) {
        return;
      }
      update({ x: event.clientX, y: event.clientY }, 1);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (live?.source !== "mouse" || event.pointerId !== live.pointerId) {
        return;
      }
      finish();
    };

    const onClickCapture = (event: MouseEvent) => {
      if (performance.now() > swallowClicksUntil) return;
      swallowClicksUntil = 0;
      event.preventDefault();
      event.stopPropagation();
    };

    const blocking = { passive: false } as const;
    target.addEventListener("touchstart", onTouchStart, blocking);
    target.addEventListener("touchmove", onTouchMove, blocking);
    target.addEventListener("touchend", onTouchEnd);
    target.addEventListener("touchcancel", onTouchEnd);
    target.addEventListener("gesturestart", onGestureStart, blocking);
    if (!(pinchOnly && "GestureEvent" in window)) {
      target.addEventListener("wheel", onWheel, blocking);
    }
    target.addEventListener("pointerdown", onPointerDown);
    target.addEventListener("pointermove", onPointerMove);
    target.addEventListener("pointerup", onPointerUp);
    target.addEventListener("pointercancel", onPointerUp);
    target.addEventListener("click", onClickCapture, true);

    return () => {
      finish();
      target.removeEventListener("touchstart", onTouchStart);
      target.removeEventListener("touchmove", onTouchMove);
      target.removeEventListener("touchend", onTouchEnd);
      target.removeEventListener("touchcancel", onTouchEnd);
      target.removeEventListener("gesturestart", onGestureStart);
      target.removeEventListener("wheel", onWheel);
      target.removeEventListener("pointerdown", onPointerDown);
      target.removeEventListener("pointermove", onPointerMove);
      target.removeEventListener("pointerup", onPointerUp);
      target.removeEventListener("pointercancel", onPointerUp);
      target.removeEventListener("click", onClickCapture, true);
    };
  }, [ref, enabled, pinchOnly]);
}
