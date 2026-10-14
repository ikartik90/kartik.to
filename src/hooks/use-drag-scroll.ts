"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

// Travel in px before a press becomes a drag; less stays a click. From `PREPARE_PX`, snapping goes off ahead of it.
const SLOP = 10;
const PREPARE_PX = 3;
// The strip shows where the pointer was `LAG_MS` before each frame, so moves that arrive late or in bursts still
// draw an even path. Past the last move it carries on at the pointer's speed for up to `PREDICT_MS` and holds there;
// only once no event has arrived for `HOLD_MS` does it ease back onto the pointer. Arrival, not the event's own time,
// says the input has stopped: browsers deliver events late (Safari ~20ms, a busy Chromium ~100ms).
const LAG_MS = 20;
const PREDICT_MS = 24;
const PREDICT_SPAN_MS = 8;
const HOLD_MS = 80;
const RETURN_MS = 100;
// A timestamp further than this from now isn't on `performance.now()`'s clock.
const STAMP_RANGE_MS = 1000;
// The release's speed is measured over this much of the last travel, and is none this long after the last move.
const SPEED_WINDOW_MS = 100;
const STILL_MS = 80;
// A flick's glide sets off at about the release's speed and eases out, within these; a drag let go still settles in
// `SETTLE_MS`, plus a little for each px it has to go.
const FLICK_SPEED = 0.3;
const GLIDE_MIN_MS = 250;
const GLIDE_MAX_MS = 900;
const SETTLE_MS = 300;
const SETTLE_MS_PER_PX = 0.3;
// A scroll this far from where the glide put it was someone else's.
const DRIFT_PX = 1;
// How long after a drag its click may still arrive; the next press ends the wait.
const CLICK_GRACE_MS = 400;

export interface DragScrollOptions {
  enabled?: boolean;
  /** Where the scroll comes to rest after a drag let go with it moving `velocity` px/ms. */
  landing: (velocity: number) => number;
}

interface Sample {
  time: number;
  x: number;
}

/** A drag's pointer positions from `since`; `shown`, where it was last drawn. */
interface Track {
  samples: Sample[];
  since: number;
  shown?: number;
  /** When its last sample reached the page. */
  arrived?: number;
}

interface Press extends Track {
  id: number;
  x: number;
  left: number;
  panning: boolean;
  /** The scroll's reach, measured as the drag begins. */
  max: number;
}

// On the window: the click lands on whatever holds both ends of the drag, such as a sheet's dialog when it is let go
// over the backdrop.
function swallowNextClick() {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    disarm();
  };
  const disarm = () => {
    clearTimeout(timer);
    window.removeEventListener("click", swallow, true);
    window.removeEventListener("pointerdown", disarm, true);
  };
  window.addEventListener("click", swallow, true);
  window.addEventListener("pointerdown", disarm, true);
  const timer = setTimeout(disarm, CLICK_GRACE_MS);
}

// When the pointer was where the event says: the platform's time where the browser gives it, else now.
function stamp(event: Pick<PointerEvent, "timeStamp">) {
  const now = performance.now();
  return Math.abs(now - event.timeStamp) < STAMP_RANGE_MS
    ? Math.min(event.timeStamp, now)
    : now;
}

// In time order, which a sample arriving after a later one would otherwise break.
function addSample(track: Track, time: number, x: number) {
  const newest = Math.max(time, track.samples.at(-1)?.time ?? time);
  const kept = track.samples.filter((sample) => newest - sample.time <= SPEED_WINDOW_MS);
  const at = kept.findIndex((sample) => sample.time > time);
  kept.splice(at < 0 ? kept.length : at, 0, { time, x });
  track.samples = kept;
  track.arrived = performance.now();
}

const idleFor = ({ arrived }: Track, now: number) => now - (arrived ?? now);

// How fast the track was moving at its last sample, in px/ms, and not at all once no sample has come for a moment.
function speedOf(track: Track) {
  const first = track.samples[0];
  const last = track.samples.at(-1);
  if (!first || !last || last.time === first.time) return 0;
  if (idleFor(track, performance.now()) > STILL_MS) return 0;
  return (last.x - first.x) / (last.time - first.time) || 0;
}

// Where the track was `LAG_MS` before `now`, never before it began; carried on past its last sample if `predict`.
function pointerAt(track: Track, now: number, predict = true) {
  const { samples, since } = track;
  const time = Math.max(now - LAG_MS, since);
  const next = samples.findIndex((sample) => sample.time > time);
  if (next > 0) {
    const a = samples[next - 1];
    const b = samples[next];
    return a.x + ((b.x - a.x) * (time - a.time)) / (b.time - a.time);
  }
  const last = samples[samples.length - 1];
  if (next === 0 || !last) return samples[0]?.x ?? 0;
  if (!predict) return last.x;
  const before = samples.findLast(
    (sample) => sample.time >= since && last.time - sample.time >= PREDICT_SPAN_MS,
  );
  if (!before) return last.x;
  const idle = idleFor(track, now);
  const carry =
    Math.min(time - last.time, PREDICT_MS) *
    (idle <= HOLD_MS ? 1 : Math.max(1 - (idle - HOLD_MS) / RETURN_MS, 0));
  return last.x + ((last.x - before.x) / (last.time - before.time)) * carry;
}

// While samples keep coming, never back against the way the track heads: only a late one, correcting the guess
// carried on past the last, would make it, and it reads as the strip bouncing.
function trackAt(track: Track, now: number) {
  const target = pointerAt(track, now);
  const [before, last] = track.samples.slice(-2);
  const heading = before && last ? Math.sign(last.x - before.x) : 0;
  const fresh = idleFor(track, now) <= HOLD_MS;
  if (fresh && heading && track.shown !== undefined && (target - track.shown) * heading < 0) {
    return track.shown;
  }
  track.shown = target;
  return target;
}

// Ease-out cubic sets off at 3 × distance / duration.
function glideMs(distance: number, velocity: number) {
  const toward = velocity * Math.sign(distance);
  if (toward < FLICK_SPEED) {
    return SETTLE_MS + Math.abs(distance) * SETTLE_MS_PER_PX;
  }
  return Math.min(
    Math.max((3 * Math.abs(distance)) / toward, GLIDE_MIN_MS),
    GLIDE_MAX_MS,
  );
}

const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * Drags `ref`'s inline scroll with a mouse and glides it to `landing` on release, carrying a flick on like a kinetic
 * scroll; touch, pen and trackpad swipes keep the browser's own scrolling. `data-panning` is "pressed" once a press
 * moves, "held" for the drag and "gliding" after it, for CSS to turn snapping off and cover the slides. Nothing else is
 * restyled while the strip moves: in Safari, restyling a page this size stalls a frame.
 */
export function useDragScroll(
  ref: RefObject<HTMLElement | null>,
  { enabled = true, landing }: DragScrollOptions,
) {
  const land = useEffectEvent((velocity: number) => landing(velocity));

  useEffect(() => {
    const scroller = ref.current;
    if (!scroller || !enabled) return;

    let press: Press | null = null;
    let frame = 0;

    const reach = () => Math.max(scroller.scrollWidth - scroller.clientWidth, 0);

    // Only once nothing moves: turning snapping back on stalls Safari for a few frames.
    const restoreSnap = () => {
      if (!frame && !press) scroller.removeAttribute("data-panning");
    };

    const stopGlide = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    // A card still lighting up or fading from the last drag would play on the thread that moves the strip; loops
    // play on.
    const settleTransitions = () => {
      if (typeof CSSTransition === "undefined") return;
      for (const animation of scroller.getAnimations?.({ subtree: true }) ?? []) {
        if (animation instanceof CSSTransition) animation.finish();
      }
    };

    const glide = (to: number, velocity: number) => {
      const from = scroller.scrollLeft;
      const distance = to - from;
      if (reducedMotion() || Math.abs(distance) < DRIFT_PX) {
        scroller.scrollLeft = to;
        stopGlide();
        return restoreSnap();
      }
      const duration = glideMs(distance, velocity);
      const start = performance.now();
      let placed = from;
      const step = () => {
        const drifted = Math.abs(scroller.scrollLeft - placed) > DRIFT_PX;
        const progress = Math.min((performance.now() - start) / duration, 1);
        if (!drifted) {
          placed = from + distance * (1 - (1 - progress) ** 3);
          scroller.scrollLeft = placed;
        }
        if (!drifted && progress < 1) {
          frame = requestAnimationFrame(step);
          return;
        }
        frame = 0;
        restoreSnap();
      };
      frame = requestAnimationFrame(step);
    };

    // Past an end the strip stays there, and turning back scrolls it in at once. The drag's start moves with the
    // pointer past the end, not with the guess carried on past its last move, which would creep back in as it fades.
    const track = () => {
      const current = press;
      if (!current?.panning) {
        frame = 0;
        return;
      }
      const now = performance.now();
      const clamp = (left: number) => Math.min(Math.max(left, 0), current.max);
      const reached = current.left - (pointerAt(current, now, false) - current.x);
      current.left += clamp(reached) - reached;
      scroller.scrollLeft = clamp(current.left - (trackAt(current, now) - current.x));
      frame = requestAnimationFrame(track);
    };

    const beginPan = (current: Press, x: number, time: number) => {
      if (!scroller.dataset.panning) settleTransitions();
      current.max = reach();
      current.panning = true;
      current.x = x;
      current.left = scroller.scrollLeft;
      current.since = time;
      scroller.dataset.panning = "held";
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(track);
    };

    const follow = (current: Press, x: number, time: number) => {
      addSample(current, time, x);
      if (current.panning) return;
      const travel = Math.abs(x - current.x);
      if (travel > SLOP) beginPan(current, x, time);
      else if (travel >= PREPARE_PX && !scroller.dataset.panning) {
        settleTransitions();
        scroller.dataset.panning = "pressed";
      }
    };

    // A flick's last moves can arrive folded into its release, and Safari can end one with a move that finds the
    // button already up, so either counts the release's own position.
    const release = (event: PointerEvent) => {
      const current = press;
      if (!current || event.pointerId !== current.id) return;
      press = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      const cancelled = event.type === "pointercancel";
      if (!cancelled) follow(current, event.clientX, stamp(event));
      stopGlide();
      if (!current.panning) return restoreSnap();
      // Before anything is restyled, so it measures a laid-out page. The scroll's speed is the pointer's, reversed.
      const velocity = -speedOf(current) || 0;
      const to = land(velocity);
      if (!cancelled) swallowNextClick();
      scroller.dataset.panning = "gliding";
      glide(to, velocity);
    };

    function onPointerMove(event: PointerEvent) {
      const current = press;
      if (!current || event.pointerId !== current.id) return;
      if (!(event.buttons & 1)) return release(event);
      // Safari and Chrome fold the moves since the last event into it.
      const moves = event.getCoalescedEvents?.() ?? [];
      for (const move of moves.length ? moves : [event]) {
        follow(current, move.clientX, stamp(move));
      }
    }

    // Catching a glide holds the strip where it is, as a drag already under way.
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || press) return;
      const caught = frame !== 0;
      stopGlide();
      const time = stamp(event);
      press = {
        id: event.pointerId,
        x: event.clientX,
        left: scroller.scrollLeft,
        since: time,
        panning: false,
        samples: [{ time, x: event.clientX }],
        max: 0,
      };
      if (caught) beginPan(press, event.clientX, time);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", release);
    };

    // A mouse press would otherwise select the text it starts on and drag the selection along.
    const onSelectStart = (event: Event) => {
      if (press) event.preventDefault();
    };

    // A picture or link would otherwise be dragged out instead.
    const onDragStart = (event: DragEvent) => event.preventDefault();

    scroller.addEventListener("pointerdown", onPointerDown);
    scroller.addEventListener("selectstart", onSelectStart);
    scroller.addEventListener("dragstart", onDragStart);

    return () => {
      press = null;
      stopGlide();
      scroller.removeAttribute("data-panning");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      scroller.removeEventListener("pointerdown", onPointerDown);
      scroller.removeEventListener("selectstart", onSelectStart);
      scroller.removeEventListener("dragstart", onDragStart);
    };
  }, [ref, enabled]);
}
