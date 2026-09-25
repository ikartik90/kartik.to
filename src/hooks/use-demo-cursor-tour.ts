"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  isSyntheticPointer,
  markSyntheticPointer,
} from "@/utils/synthetic-pointer";

// Plays a demo once with a stand-in cursor that operates the real elements. `active` gates
// it; a real pointer or key ends it (work kept); `replay()` overrides the gate and reduced motion.

export interface DemoCursorPoint {
  /** Stage-relative px at the cursor's tip (hotspot). */
  x: number;
  y: number;
}

export interface DemoCursorTourState {
  point: DemoCursorPoint | null;
  moveMs: number;
  pressed: boolean;
  /** Clicks so far; re-keys the tap ring. */
  taps: number;
  visible: boolean;
}

export interface DemoCursorTour extends DemoCursorTourState {
  /** A run is in flight, including the beats when the cursor itself isn't shown. */
  running: boolean;
  /** Play it again from the top, cancelling any run in flight. */
  replay: () => void;
  /** Call the run off where it stands, leaving its work committed. */
  stop: () => void;
}

/** Resolved as the cursor sets off (earlier clicks create later targets); null skips the stop. */
export type DemoCursorStop = () => HTMLElement | null;

/** Press, drag and release between two elements (a marquee); both ends resolve together, or neither runs. */
export interface DemoCursorSweep {
  from: DemoCursorStop;
  to: DemoCursorStop;
}

export type DemoCursorAction = DemoCursorStop | DemoCursorSweep;

/** A pointer event marked synthetic, so the tour and other listeners don't take it for the visitor's. */
function pointerEvent(type: string, at: DemoCursorPoint): Event {
  const init = {
    bubbles: true,
    cancelable: true,
    clientX: at.x,
    clientY: at.y,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
  };
  const event =
    typeof PointerEvent === "function"
      ? new PointerEvent(type, {
          ...init,
          pointerType: "mouse",
          isPrimary: true,
        })
      : // No PointerEvent here: a MouseEvent carries every field a drag reads.
        new MouseEvent(type, init);
  return markSyntheticPointer(event);
}

function endsOf(
  action: DemoCursorAction,
): [HTMLElement | null, HTMLElement | null] {
  return typeof action === "function"
    ? [action(), null]
    : [action.from(), action.to()];
}

const dispatch = (target: EventTarget, type: string, at: DemoCursorPoint) =>
  target.dispatchEvent(pointerEvent(type, at));

const IDLE: DemoCursorTourState = {
  point: null,
  moveMs: 0,
  pressed: false,
  taps: 0,
  visible: false,
};

const OPENING_MS = 500;
/** Matches `DemoCursor`'s opacity transition. */
const ENTER_MS = 260;
const SETTLE_MS = 140;
const PRESS_MS = 130;
const HOLD_MS = 340;
const EXIT_MS = 260;

const SWEEP_MS = 900;
const SWEEP_STEP_MS = 32;

const easeInOut = (t: number) => t * t * (3 - 2 * t);

const ENTRY_OFFSET = { x: -64, y: 72 };

const TRAVEL_BASE_MS = 120;
const TRAVEL_MS_PER_PX = 1.8;
const MIN_TRAVEL_MS = 260;
const MAX_TRAVEL_MS = 640;

export function travelDurationMs(distance: number): number {
  const scaled = TRAVEL_BASE_MS + distance * TRAVEL_MS_PER_PX;
  return Math.round(Math.min(MAX_TRAVEL_MS, Math.max(MIN_TRAVEL_MS, scaled)));
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

export interface DemoCursorTourOptions {
  stageRef: RefObject<HTMLElement | null>;
  active: boolean;
  /** Drawn up as each run opens; an empty list calls the run off. */
  stops: () => DemoCursorAction[];
  finaleMs?: number;
  /** After a full run, once the cursor has left; never for a run cut short. */
  onComplete?: () => void;
  /**
   * The gate cut off a run that changed the demo: reset to where a fresh run starts.
   * Not called when the visitor took over.
   */
  onRewind?: () => void;
}

export function useDemoCursorTour({
  stageRef,
  active,
  stops,
  finaleMs = 0,
  onComplete,
  onRewind,
}: DemoCursorTourOptions): DemoCursorTour {
  const [state, setState] = useState<DemoCursorTourState>(IDLE);
  const [running, setRunning] = useState(false);
  // Refs, so callbacks can close over fresh state without re-running the effect.
  const stopsRef = useRef(stops);
  const completeRef = useRef(onComplete);
  const rewindRef = useRef(onRewind);
  const finaleRef = useRef(finaleMs);
  useEffect(() => {
    stopsRef.current = stops;
    completeRef.current = onComplete;
    rewindRef.current = onRewind;
    finaleRef.current = finaleMs;
  });
  const [request, setRequest] = useState(0);
  // A replay is one-shot: without this, later gate changes would re-read `request > 0`.
  const served = useRef(0);
  const abortRef = useRef<(() => void) | null>(null);

  const replay = useCallback(() => setRequest((count) => count + 1), []);

  const stop = useCallback(() => abortRef.current?.(), []);

  useEffect(() => {
    const stage = stageRef.current;
    // An explicit replay overrides both gates.
    const asked = request > served.current;
    served.current = request;
    if (!asked && (!active || prefersReducedMotion())) return;
    if (!stage) return;
    const targets = stopsRef.current();
    if (!targets.length) return;

    setRunning(true);

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      });

    // A sweep holds a press; anything that calls the run off must release it first.
    let holding: DemoCursorPoint | null = null;
    const release = () => {
      if (!holding) return;
      const at = holding;
      holding = null;
      dispatch(window, "pointerup", at);
    };

    // Set at the first commit, not the walk-on: rewinding before then would undo the tour's setup.
    let dirty = false;

    // The visitor took over; the tour's own synthetic presses don't count.
    const yieldStage = (event?: Event) => {
      if (event && isSyntheticPointer(event)) return;
      if (cancelled) return;
      cancelled = true;
      dirty = false;
      clearTimeout(timer);
      release();
      setRunning(false);
      setState((current) => ({ ...current, pressed: false, visible: false }));
    };
    abortRef.current = yieldStage;
    stage.addEventListener("pointerdown", yieldStage);
    stage.addEventListener("keydown", yieldStage);

    // Measured per stop: the demo can re-lay out mid-tour.
    const centreOf = (element: HTMLElement): DemoCursorPoint => {
      const box = element.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    };

    // The cursor is drawn in stage coordinates; pointer events use viewport ones.
    const toStage = (at: DemoCursorPoint): DemoCursorPoint => {
      const stageBox = stage.getBoundingClientRect();
      return { x: at.x - stageBox.left, y: at.y - stageBox.top };
    };

    const tipOf = (element: HTMLElement) => toStage(centreOf(element));

    /** Steps its own positions: a marquee reads the pointer frame by frame, so a CSS move won't do. */
    const sweepTo = async (from: HTMLElement, to: HTMLElement) => {
      const origin = centreOf(from);
      const finish = centreOf(to);
      holding = origin;
      dispatch(from, "pointerdown", origin);

      const steps = Math.max(1, Math.round(SWEEP_MS / SWEEP_STEP_MS));
      for (let step = 1; step <= steps && !cancelled; step++) {
        const travelled = easeInOut(step / steps);
        const at = {
          x: origin.x + (finish.x - origin.x) * travelled,
          y: origin.y + (finish.y - origin.y) * travelled,
        };
        holding = at;
        dispatch(window, "pointermove", at);
        setState((current) => ({
          ...current,
          point: toStage(at),
          moveMs: SWEEP_STEP_MS,
        }));
        await wait(SWEEP_STEP_MS);
      }
      release();
      return toStage(finish);
    };

    void (async () => {
      await wait(OPENING_MS);
      if (cancelled) return;

      let at: DemoCursorPoint | null = null;

      for (const action of targets) {
        if (cancelled) return;
        const sweeping = typeof action !== "function";
        const [target, far] = endsOf(action);
        if (!target || (sweeping && !far)) continue;
        const to = tipOf(target);

        if (!at) {
          at = { x: to.x + ENTRY_OFFSET.x, y: to.y + ENTRY_OFFSET.y };
          setState({ ...IDLE, point: at, visible: true });
          await wait(ENTER_MS);
          if (cancelled) return;
        }

        const moveMs = travelDurationMs(Math.hypot(to.x - at.x, to.y - at.y));
        at = to;
        setState((current) => ({ ...current, point: to, moveMs }));
        await wait(moveMs + SETTLE_MS);

        if (cancelled) return;
        setState((current) => ({ ...current, pressed: true }));
        await wait(PRESS_MS);

        if (cancelled) return;
        dirty = true;
        // A sweep commits through the drag; a trailing click would undo its first corner.
        if (far) at = await sweepTo(target, far);
        else target.click();

        if (cancelled) return;
        setState((current) => ({
          ...current,
          pressed: false,
          taps: current.taps + 1,
        }));
        await wait(HOLD_MS);
      }

      if (cancelled) return;
      if (!at) {
        setRunning(false);
        return;
      }
      await wait(finaleRef.current);

      if (cancelled) return;
      setState((current) => ({ ...current, visible: false }));
      // Wait out the fade so `onComplete` lands on an empty stage.
      await wait(EXIT_MS);
      if (cancelled) return;
      abortRef.current = null;
      // Before onComplete, so both land in one render.
      setRunning(false);
      completeRef.current?.();
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      release();
      abortRef.current = null;
      stage.removeEventListener("pointerdown", yieldStage);
      stage.removeEventListener("keydown", yieldStage);
      // Cut rather than faded, and rewound: what comes next is a run from the top.
      setState(IDLE);
      setRunning(false);
      if (dirty) rewindRef.current?.();
    };
  }, [active, stageRef, request]);

  return { ...state, running, replay, stop };
}
