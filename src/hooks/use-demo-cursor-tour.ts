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

// ---------------------------------------------------------------------------
// A demo that performs itself once. Given a stage to measure against and a
// plan of stops, this walks a stand-in cursor from one to the next and OPERATES
// each — the real element, the real handler, so what you watch is the demo
// working rather than a recording of it having worked. A stop need not be
// inside the stage; a popover the tour opened portals itself elsewhere, and
// the cursor still has to be able to point at what is in it.
//
// Most stops are a click. A stop with two ends (`DemoCursorSweep`) is a drag
// instead, and that one is dispatched rather than invoked: a marquee lives in
// pointer geometry, not in a handler you can call, so the tour presses, streams
// positions across the gap, and releases — see `sweepTo`.
//
// It is a performance, so it behaves like one: it plays to the room it is in.
// `active` is a live gate — the frame is properly on screen — so the tour runs
// when it opens, is called off where it stands when it closes, and is given
// again from the top the next time it opens. It never starts for a visitor who
// asked for less motion, and it leaves the stage the instant a real pointer or
// key arrives — the visitor's hand always outranks the show. Whatever it had
// already committed then stays committed, because it committed those through
// the same path a person would.
//
// A run called off by the GATE is different: nobody was watching, and what
// happens next is a fresh run, so `onRewind` puts the demo back to the state
// that run has to start from. A run called off by the VISITOR keeps its work.
//
// `replay()` is the one thing that overrides all of that, because a press on a
// Replay control is not an ambient guess about what someone wants — it is a
// direct request, and it deserves to be honoured whether or not the demo is on
// screen and whether or not the visitor generally prefers less motion.
//
// The hook owns only the cursor's STATE — where it is, how long the move in
// flight should take, whether it is mid-press. Drawing that (and easing the
// travel) is `DemoCursor`'s job, so the animation runs on CSS transitions
// rather than a per-frame render loop here.
// ---------------------------------------------------------------------------

export interface DemoCursorPoint {
  /** Stage-relative px, at the cursor's TIP — the hotspot, not the box. */
  x: number;
  y: number;
}

export interface DemoCursorTourState {
  /** Where the tip is (or is heading), or null before the cursor has arrived. */
  point: DemoCursorPoint | null;
  /** How long the move currently in flight should take, in ms. */
  moveMs: number;
  /** Is the cursor mid-press? */
  pressed: boolean;
  /** Clicks made so far — re-keys the tap ring so each one replays it. */
  taps: number;
  /** Is the cursor on the stage at all? */
  visible: boolean;
}

export interface DemoCursorTour extends DemoCursorTourState {
  /**
   * Is a run in flight — from the opening beat right through to the hand-over?
   *
   * The cursor's own `visible` is NOT that answer, and the difference is what
   * this exists for: the arrow is off stage through the opening beat and again
   * for the whole withdrawal, while the run still holds every click it has
   * made. Anything the frame offers on the strength of "nothing is performing"
   * would flash on in those gaps.
   */
  running: boolean;
  /** Play it again from the top, cancelling any run in flight. */
  replay: () => void;
  /** Call the run off where it stands, leaving its work committed. */
  stop: () => void;
}

/**
 * One stop, resolved at the moment the cursor sets off for it rather than when
 * the tour is planned — because a walkthrough that OPENS things is forever
 * clicking elements its previous click brought into existence: a chip inside a
 * section that was still collapsed, a day cell inside a popover that was still
 * shut. Late resolution also means every stop is measured against the layout it
 * will actually be clicked in.
 *
 * Return null to skip the stop. That is the honest answer when the DOM did not
 * produce what the plan expected, and it costs the rest of the tour nothing.
 */
export type DemoCursorStop = () => HTMLElement | null;

/**
 * A press on one element, a drag to a second, and a release — a marquee, as
 * opposed to a click. It is a gesture rather than an event: a band is geometry
 * over the POINTER, so what commits it is the stream of positions between the
 * two corners, and the tour has to walk that stream itself.
 *
 * Both ends resolve TOGETHER, at the moment the gesture begins, because the two
 * corners of a rectangle belong to the same layout. A far end the DOM never
 * produced does not make a shorter band; it makes no gesture at all.
 */
export interface DemoCursorSweep {
  /** Where the press lands — one corner of the band. */
  from: DemoCursorStop;
  /** Where the release lands — the opposite corner. */
  to: DemoCursorStop;
}

/** One entry in a plan: a click (a bare stop), or a sweep between two of them. */
export type DemoCursorAction = DemoCursorStop | DemoCursorSweep;

/**
 * A pointer event at a viewport point, as close to a real one as the DOM allows
 * — and MARKED, because a sweep has to fire the exact event the tour otherwise
 * reads as "a real hand just arrived". Without the mark the walkthrough would
 * abort on its own press, and every other listener in the app that watches for
 * the visitor's pointer would take the stand-in cursor for theirs.
 */
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
      : // No PointerEvent here, so a MouseEvent stands in: it carries every
        // field a drag handler reads except `pointerType`, whose absence reads
        // as "not touch" — which is the answer that matters.
        new MouseEvent(type, init);
  return markSyntheticPointer(event);
}

/**
 * An action's two ends, resolved: `[press, release]`, the second null for a
 * plain click. Both come back together because a sweep's corners belong to one
 * layout — see `DemoCursorSweep`.
 */
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

/** A beat after the stage settles, before the cursor turns up. */
const OPENING_MS = 500;
/** The fade-in. Matches `DemoCursor`'s opacity transition. */
const ENTER_MS = 260;
/** Arriving and pressing in one motion reads as a twitch — stop, then press. */
const SETTLE_MS = 140;
/** The dip. The click commits at the bottom of it, as a real one does. */
const PRESS_MS = 130;
/** Time to READ what the click just did before moving on. */
const HOLD_MS = 340;
/** The fade-out, waited through so `onComplete` lands on an empty stage. */
const EXIT_MS = 260;

/** How long a marquee takes end to end. Slower than a move — you are painting. */
const SWEEP_MS = 900;
/** How often it reports where the pointer is. Short enough to read as continuous. */
const SWEEP_STEP_MS = 32;

/** Smoothstep — a hand accelerates into a drag and eases out of it. */
const easeInOut = (t: number) => t * t * (3 - 2 * t);

/** Where the cursor fades in, relative to the first stop: below and left of it. */
const ENTRY_OFFSET = { x: -64, y: 72 };

// Travel is timed by DISTANCE, so the cursor keeps one speed instead of taking
// as long to cross two cells as it does to cross the form. The floor keeps a
// short hop from reading as a teleport; the ceiling keeps a long one from
// stalling the tour.
const TRAVEL_BASE_MS = 120;
const TRAVEL_MS_PER_PX = 1.8;
const MIN_TRAVEL_MS = 260;
const MAX_TRAVEL_MS = 640;

/** How long the cursor should take to cross `distance` px. */
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
  /** The positioning parent every point is measured against. */
  stageRef: RefObject<HTMLElement | null>;
  /**
   * Is the demo properly on screen? A live gate, not a trigger: false calls a
   * run off where it stands, and true starts one — including a second time,
   * once the frame has been away and come back.
   */
  active: boolean;
  /**
   * The plan, in visiting order, drawn up once as the tour opens — though each
   * stop in it resolves late (see `DemoCursorStop`). Return an empty list to
   * call the whole thing off, which is how a demo declines to perform over a
   * visitor's own work.
   */
  stops: () => DemoCursorAction[];
  /**
   * A beat to hold after the last click, before the cursor withdraws — the time
   * it takes to READ what the walkthrough just built. Worth spending when the
   * result is a sentence rather than a highlighted cell, and worth nothing when
   * the last click speaks for itself.
   */
  finaleMs?: number;
  /**
   * The tour played all the way through and the cursor has left — the demo's
   * cue to hand back the most USABLE state. Never called for a run that was cut
   * short.
   */
  onComplete?: () => void;
  /**
   * The gate closed on a run that had already committed something: the frame
   * left the screen, so nobody saw it stop. Put the demo back to the state a
   * fresh run STARTS from — the same rewind `replay` needs, which is not always
   * the state `onComplete` hands back (v1 finishes with its repeat switch on,
   * and the tour needs it off to have something to flip).
   *
   * Not called when the VISITOR cut the run short. Their work is theirs.
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
  // Kept apart from the cursor's own state rather than folded into it: that
  // object IS `DemoCursor`'s props, and where the arrow is has nothing to say
  // about whether a run is on.
  const [running, setRunning] = useState(false);
  // Read through refs so a consumer can close over fresh state (e.g. "has the
  // visitor already selected something?") without re-triggering this effect.
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
  // Bumped by `replay`, which is what re-arms the effect below.
  const [request, setRequest] = useState(0);
  // The highest request already honoured. A replay is a ONE-SHOT override, not
  // a standing exemption: without this the effect would re-read `request > 0`
  // on every later gate change and start runs the gates had refused.
  const served = useRef(0);
  // The live run's off switch, so `stop` can reach a tour this render didn't
  // start. Null whenever nothing is in flight.
  const abortRef = useRef<(() => void) | null>(null);

  const replay = useCallback(() => setRequest((count) => count + 1), []);

  const stop = useCallback(() => abortRef.current?.(), []);

  useEffect(() => {
    const stage = stageRef.current;
    // An explicit replay outranks both gates the automatic run defers to: it
    // plays off screen, and it plays for a reduced-motion visitor who went
    // looking for the button.
    const asked = request > served.current;
    served.current = request;
    if (!asked && (!active || prefersReducedMotion())) return;
    if (!stage) return;
    const targets = stopsRef.current();
    if (!targets.length) return;

    // Past every guard, so this IS a run — announced before the opening beat
    // rather than at the walk-on, since the beat is already part of it.
    setRunning(true);

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      });

    // A sweep holds a press between two events, so anything that calls the run
    // off has to let go of it first. Walk away mid-drag and the grid is left
    // with the button still down: its listeners stay live, and every move the
    // visitor makes goes on redrawing a band the tour abandoned.
    let holding: DemoCursorPoint | null = null;
    const release = () => {
      if (!holding) return;
      const at = holding;
      holding = null;
      dispatch(window, "pointerup", at);
    };

    // Has this run put work on the demo that the demo is not in a state to be
    // run over again? Set at the first commit — NOT at the walk-on, since a
    // rewind before anything happened would undo the very setup the tour needs
    // (v1 opens with its repeat switch off precisely so it has one to flip).
    // Left true after a normal finish, because what `onComplete` hands back is
    // the usable state, not the runnable one.
    let dirty = false;

    // The visitor took over. Everything already committed stays; the cursor
    // bows out rather than fighting a real one for the same grid. Its own
    // gestures are exempt — a sweep fires this very event.
    const yieldStage = (event?: Event) => {
      if (event && isSyntheticPointer(event)) return;
      if (cancelled) return;
      cancelled = true;
      // Whatever is on the demo now belongs to whoever reached in for it.
      dirty = false;
      clearTimeout(timer);
      release();
      setRunning(false);
      setState((current) => ({ ...current, pressed: false, visible: false }));
    };
    abortRef.current = yieldStage;
    stage.addEventListener("pointerdown", yieldStage);
    stage.addEventListener("keydown", yieldStage);

    // Measured per stop rather than up front: the frame is a container query
    // away from re-laying the demo out mid-tour, and a stale rect would put
    // the cursor somewhere the dates no longer are.
    const centreOf = (element: HTMLElement): DemoCursorPoint => {
      const box = element.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    };

    // Two frames of reference, and both are needed: the cursor is drawn against
    // the stage, while a pointer event is only believed in viewport pixels.
    const toStage = (at: DemoCursorPoint): DemoCursorPoint => {
      const stageBox = stage.getBoundingClientRect();
      return { x: at.x - stageBox.left, y: at.y - stageBox.top };
    };

    const tipOf = (element: HTMLElement) => toStage(centreOf(element));

    /**
     * Press, draw, release. This is the one leg of the tour that steps its own
     * positions instead of handing the move to a CSS transition: a marquee is
     * defined by where the pointer IS, frame after frame, so a single jump to
     * the far corner would hand the grid a finished rectangle while the arrow
     * was still halfway across it. Cursor and events come off the same
     * interpolation, so the two can't drift apart.
     */
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
      // A cancelled run never gets here — its `wait` is left unresolved — but it
      // has already been let go of by whoever called it off.
      release();
      return toStage(finish);
    };

    void (async () => {
      await wait(OPENING_MS);
      if (cancelled) return;

      // Null until the first stop that actually resolves — which is also the
      // one the cursor walks on beside, so the entry can't be staged before
      // there is somewhere to enter towards.
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
        // A sweep commits through the drag itself, so it is never also clicked
        // — the grid swallows a marquee's own trailing click for the same
        // reason, and firing one here would flip its first corner back off.
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
      // Never came on stage: not one stop resolved, so there is nothing to
      // withdraw from and nothing for the demo to put back — but the run is
      // over all the same, and has to say so.
      if (!at) {
        setRunning(false);
        return;
      }
      await wait(finaleRef.current);

      if (cancelled) return;
      setState((current) => ({ ...current, visible: false }));
      // Report back only once the stage is genuinely clear, so whatever the
      // demo does next (putting itself back, inviting the visitor in) doesn't
      // happen underneath a cursor still fading out.
      await wait(EXIT_MS);
      if (cancelled) return;
      abortRef.current = null;
      // Down before the hand-over, not after: `onComplete` is where the demo
      // puts itself back, and it should land in one render with the news that
      // the show is over.
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
      // The gate closed (or a replay is taking over). Take the cursor off the
      // stage outright rather than fading it — a frozen arrow parked mid-tour
      // is the first thing you would meet on the way back in — and rewind the
      // demo, because the next thing that happens is a run from the top.
      setState(IDLE);
      setRunning(false);
      if (dirty) rewindRef.current?.();
    };
  }, [active, stageRef, request]);

  return { ...state, running, replay, stop };
}
