// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { travelDurationMs, useDemoCursorTour } from "../use-demo-cursor-tour";

// The whole tour is a chain of timers, so every case drives the clock rather
// than waiting on it. Only the timer functions are faked — React's own
// scheduling and the microtask queue stay real, which is what lets
// `advanceTimersByTimeAsync` flush the hook's `await`s between steps.
beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

/** Long enough for the tour to finish whatever it is in the middle of. */
const WHOLE_TOUR_MS = 12_000;

const run = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

/** A stage with `count` clickable stops in it, each with a real box. */
function setupStage(count: number) {
  const stage = document.createElement("div");
  stage.getBoundingClientRect = () => new DOMRect(0, 0, 400, 200);
  document.body.appendChild(stage);

  const clicks: string[] = [];
  const stops = Array.from({ length: count }, (_, index) => {
    const stop = document.createElement("button");
    stop.dataset.stop = String(index);
    // Laid out along a row, 40px apart — jsdom measures nothing on its own.
    stop.getBoundingClientRect = () => new DOMRect(index * 40, 60, 24, 24);
    stop.addEventListener("click", () => clicks.push(String(index)));
    stage.appendChild(stop);
    return stop;
  });

  return {
    stage,
    stops,
    clicks,
    stageRef: { current: stage },
    /** The plan form: one resolver per stop, all of them already in the DOM. */
    plan: () => stops.map((stop) => () => stop),
  };
}

const POINTER_TYPES = ["pointerdown", "pointermove", "pointerup"];

/**
 * Records the pointer events a sweep dispatches. They are watched on `window`
 * because that is where a marquee's own listeners live: the press goes to the
 * element and bubbles up here, and the moves and the release are aimed here
 * directly.
 */
function recordPointer() {
  const events: { type: string; on: string; x: number; y: number }[] = [];
  const note = (event: Event) => {
    const pointer = event as MouseEvent;
    events.push({
      type: event.type,
      on: (event.target as HTMLElement | null)?.dataset?.stop ?? "window",
      x: pointer.clientX,
      y: pointer.clientY,
    });
  };
  for (const type of POINTER_TYPES) window.addEventListener(type, note);

  return {
    events,
    types: () => events.map((event) => event.type),
    count: (type: string) =>
      events.filter((event) => event.type === type).length,
    off: () => {
      for (const type of POINTER_TYPES) window.removeEventListener(type, note);
    },
  };
}

describe("travelDurationMs", () => {
  it("scales with the distance, so the cursor keeps one speed", () => {
    expect(travelDurationMs(200)).toBeGreaterThan(travelDurationMs(40));
  });

  it("clamps both ends — no teleport, no crawl", () => {
    expect(travelDurationMs(0)).toBe(travelDurationMs(1));
    expect(travelDurationMs(5000)).toBe(travelDurationMs(10000));
    expect(travelDurationMs(5000)).toBeLessThanOrEqual(800);
  });
});

describe("useDemoCursorTour", () => {
  it("stays away until it is made active", async () => {
    const { stageRef, plan, clicks } = setupStage(3);
    const { result } = renderHook(() =>
      useDemoCursorTour({ stageRef, active: false, stops: plan }),
    );

    await run(WHOLE_TOUR_MS);
    expect(result.current.visible).toBe(false);
    expect(clicks).toEqual([]);
  });

  it("shows the cursor and clicks every stop, in order", async () => {
    const { stageRef, plan, clicks } = setupStage(4);
    const { result } = renderHook(() =>
      useDemoCursorTour({ stageRef, active: true, stops: plan }),
    );

    await run(WHOLE_TOUR_MS);
    expect(clicks).toEqual(["0", "1", "2", "3"]);
    expect(result.current.taps).toBe(4);
    // ...and withdraws once the last one is made.
    expect(result.current.visible).toBe(false);
  });

  // What the frame's own controls read to know whether a show is on. The
  // cursor's `visible` cannot answer it: the arrow is off stage through the
  // opening beat and again for the whole withdrawal, while the run still holds
  // every click it has made.
  describe("running", () => {
    it("is on from the opening beat, before the cursor has walked on", async () => {
      const { stageRef, plan } = setupStage(3);
      const { result } = renderHook(() =>
        useDemoCursorTour({ stageRef, active: true, stops: plan }),
      );

      expect(result.current.running).toBe(true);
      await run(200);
      expect(result.current.visible).toBe(false);
      expect(result.current.running).toBe(true);
    });

    it("stays on until the hand-over, the withdrawal included", async () => {
      const { stageRef, plan } = setupStage(2);
      let handedOver = false;
      const { result } = renderHook(() =>
        useDemoCursorTour({
          stageRef,
          active: true,
          stops: plan,
          onComplete: () => {
            handedOver = true;
          },
        }),
      );

      // Sampled finely, because the gap this guards against is one 260ms fade:
      // the cursor leaves the stage BEFORE the demo puts itself back, so a
      // frame reading `visible` for this would flash its controls on in there
      // and off again a quarter of a second later.
      let offEarly = false;
      for (let elapsed = 0; elapsed < WHOLE_TOUR_MS; elapsed += 40) {
        await run(40);
        if (!result.current.running && !handedOver) offEarly = true;
      }

      expect(offEarly).toBe(false);
      expect(handedOver).toBe(true);
      expect(result.current.running).toBe(false);
    });

    it("goes off the moment the visitor takes the stage", async () => {
      const { stageRef, plan, stage } = setupStage(4);
      const { result } = renderHook(() =>
        useDemoCursorTour({ stageRef, active: true, stops: plan }),
      );

      await run(1600);
      expect(result.current.running).toBe(true);
      act(() => {
        stage.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      });
      expect(result.current.running).toBe(false);
    });

    it("goes off when the frame leaves the screen mid-performance", async () => {
      const { stageRef, plan } = setupStage(4);
      const { result, rerender } = renderHook(
        ({ active }) => useDemoCursorTour({ stageRef, active, stops: plan }),
        { initialProps: { active: true } },
      );

      await run(1600);
      expect(result.current.running).toBe(true);
      rerender({ active: false });
      expect(result.current.running).toBe(false);
    });

    it("stays off for a plan that called the whole thing off", async () => {
      const { stageRef } = setupStage(2);
      const { result } = renderHook(() =>
        useDemoCursorTour({ stageRef, active: true, stops: () => [] }),
      );

      await run(WHOLE_TOUR_MS);
      expect(result.current.running).toBe(false);
    });

    // Every stop resolved to null, so the cursor never came on — but the run is
    // over all the same, and a frame left believing otherwise would never offer
    // its controls again.
    it("goes off when not one stop resolved", async () => {
      const { stageRef } = setupStage(2);
      const { result } = renderHook(() =>
        useDemoCursorTour({
          stageRef,
          active: true,
          stops: () => [() => null, () => null],
        }),
      );

      expect(result.current.running).toBe(true);
      await run(WHOLE_TOUR_MS);
      expect(result.current.running).toBe(false);
    });
  });

  it("puts the cursor on each stop's centre, in stage coordinates", async () => {
    const { stageRef, plan } = setupStage(2);
    const { result } = renderHook(() =>
      useDemoCursorTour({ stageRef, active: true, stops: plan }),
    );

    // Far enough in to have arrived at the first stop (60, 72) but not the
    // second: the opening beat, the fade-in and one travel.
    await run(1200);
    expect(result.current.point).toEqual({ x: 12, y: 72 });
    expect(result.current.visible).toBe(true);
  });

  // `active` is a live gate, not a latch: it goes false when the frame has
  // properly left the screen, and a performance nobody is in the room for is
  // one worth calling off and giving again.
  it("runs again from the top when the frame comes back", async () => {
    const { stageRef, plan, clicks } = setupStage(3);
    const { rerender } = renderHook(
      ({ active }) => useDemoCursorTour({ stageRef, active, stops: plan }),
      { initialProps: { active: true } },
    );

    await run(WHOLE_TOUR_MS);
    expect(clicks).toEqual(["0", "1", "2"]);

    rerender({ active: false });
    rerender({ active: true });
    await run(WHOLE_TOUR_MS);
    // From the first stop again, not resumed from where it left off.
    expect(clicks).toEqual(["0", "1", "2", "0", "1", "2"]);
  });

  it("does not start over just because it re-rendered on screen", async () => {
    const { stageRef, plan, clicks } = setupStage(3);
    const { rerender } = renderHook(
      ({ active }) => useDemoCursorTour({ stageRef, active, stops: plan }),
      { initialProps: { active: true } },
    );

    await run(WHOLE_TOUR_MS);
    rerender({ active: true });
    rerender({ active: true });
    await run(WHOLE_TOUR_MS);
    expect(clicks).toHaveLength(3);
  });

  it("pauses where it stands when the frame leaves", async () => {
    const { stageRef, plan, clicks } = setupStage(4);
    const { result, rerender } = renderHook(
      ({ active }) => useDemoCursorTour({ stageRef, active, stops: plan }),
      { initialProps: { active: true } },
    );

    await run(1600);
    const taken = clicks.length;
    expect(taken).toBeGreaterThan(0);

    rerender({ active: false });
    await run(WHOLE_TOUR_MS);

    expect(clicks).toHaveLength(taken);
    // Off the stage outright, not merely faded: a cursor left frozen mid-tour
    // is the first thing you would see on the way back in.
    expect(result.current.point).toBeNull();
  });

  it("puts the demo back when it is paused part-way through", async () => {
    const { stageRef, plan } = setupStage(4);
    const rewind = vi.fn();
    const { rerender } = renderHook(
      ({ active }) =>
        useDemoCursorTour({ stageRef, active, stops: plan, onRewind: rewind }),
      { initialProps: { active: true } },
    );

    await run(1600);
    rerender({ active: false });
    // Not to the state a finished run hands back — to the one the NEXT run has
    // to start from, since that is what happens when the frame returns.
    expect(rewind).toHaveBeenCalledTimes(1);
  });

  it("has nothing to put back when it never got as far as committing", async () => {
    const { stageRef, plan } = setupStage(4);
    const rewind = vi.fn();
    const { rerender } = renderHook(
      ({ active }) =>
        useDemoCursorTour({ stageRef, active, stops: plan, onRewind: rewind }),
      { initialProps: { active: true } },
    );

    // Still in the opening beat — the cursor has not even arrived.
    await run(300);
    rerender({ active: false });
    expect(rewind).not.toHaveBeenCalled();
  });

  it("leaves the visitor's own work alone when it is paused after they took over", async () => {
    const { stageRef, plan, stage } = setupStage(4);
    const rewind = vi.fn();
    const { rerender } = renderHook(
      ({ active }) =>
        useDemoCursorTour({ stageRef, active, stops: plan, onRewind: rewind }),
      { initialProps: { active: true } },
    );

    await run(1600);
    act(() => {
      stage.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    rerender({ active: false });

    // Once a real hand has been on the stage, what is on it is theirs.
    expect(rewind).not.toHaveBeenCalled();
  });

  // A press on Replay is a one-shot override, not a standing exemption.
  it("does not let a spent replay start an ambient run it should have refused", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const { stageRef, plan, clicks } = setupStage(3);
    const { result, rerender } = renderHook(
      ({ active }) => useDemoCursorTour({ stageRef, active, stops: plan }),
      { initialProps: { active: true } },
    );

    await run(WHOLE_TOUR_MS);
    expect(clicks).toEqual([]);

    act(() => result.current.replay());
    await run(WHOLE_TOUR_MS);
    expect(clicks).toHaveLength(3);

    // Scrolling away and back is the AMBIENT path, which still owes this
    // visitor the stillness they asked for.
    rerender({ active: false });
    rerender({ active: true });
    await run(WHOLE_TOUR_MS);
    expect(clicks).toHaveLength(3);
    vi.unstubAllGlobals();
  });

  it("gets out of the way the moment the visitor takes over", async () => {
    const { stageRef, plan, clicks, stage } = setupStage(4);
    const { result } = renderHook(() =>
      useDemoCursorTour({ stageRef, active: true, stops: plan }),
    );

    // One stop in, then a real press lands on the stage.
    await run(1600);
    expect(clicks.length).toBeGreaterThan(0);
    const taken = clicks.length;

    act(() => {
      stage.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    await run(WHOLE_TOUR_MS);

    expect(clicks).toHaveLength(taken);
    expect(result.current.visible).toBe(false);
  });

  it("skips a tour with nothing to visit", async () => {
    const { stageRef } = setupStage(0);
    const { result } = renderHook(() =>
      useDemoCursorTour({ stageRef, active: true, stops: () => [] }),
    );

    await run(WHOLE_TOUR_MS);
    expect(result.current.visible).toBe(false);
  });

  // The whole point of resolving late: a walkthrough that OPENS things spends
  // most of its stops clicking elements its own previous click created.
  it("resolves each stop as it sets off, not when the tour is planned", async () => {
    const { stageRef, stage, stops, clicks } = setupStage(1);
    const opened = document.createElement("button");
    opened.dataset.opened = "";
    opened.getBoundingClientRect = () => new DOMRect(120, 60, 24, 24);
    opened.addEventListener("click", () => clicks.push("opened"));
    // Exists only once the first stop has been clicked — as a popover's day
    // cell exists only once the field that opens it has been.
    stops[0].addEventListener("click", () => stage.appendChild(opened));

    renderHook(() =>
      useDemoCursorTour({
        stageRef,
        active: true,
        stops: () => [
          () => stops[0],
          () => stage.querySelector<HTMLElement>("[data-opened]"),
        ],
      }),
    );

    await run(WHOLE_TOUR_MS);
    expect(clicks).toEqual(["0", "opened"]);
  });

  it("skips a stop the DOM never produced and carries on", async () => {
    const { stageRef, stops, clicks } = setupStage(3);
    renderHook(() =>
      useDemoCursorTour({
        stageRef,
        active: true,
        stops: () => [() => stops[0], () => null, () => stops[2]],
      }),
    );

    await run(WHOLE_TOUR_MS);
    expect(clicks).toEqual(["0", "2"]);
  });

  // A tour whose every stop dissolved never came on stage, so there is nothing
  // to withdraw and nothing for the demo to put back.
  it("never reports back on a tour where nothing resolved", async () => {
    const { stageRef } = setupStage(1);
    const done = vi.fn();
    const { result } = renderHook(() =>
      useDemoCursorTour({
        stageRef,
        active: true,
        stops: () => [() => null, () => null],
        onComplete: done,
      }),
    );

    await run(WHOLE_TOUR_MS);
    expect(result.current.point).toBeNull();
    expect(done).not.toHaveBeenCalled();
  });

  // A marquee is not a click with a longer press: the band is geometry over the
  // POINTER, so the only thing that grows it is a stream of positions between
  // the two corners. Nothing below asserts the band itself — that is the
  // calendar's own suite — only that the gesture the calendar is listening for
  // is the one that leaves this hook.
  it("presses, draws and releases for a stop with two ends", async () => {
    const { stageRef, stops } = setupStage(3);
    const pointer = recordPointer();
    renderHook(() =>
      useDemoCursorTour({
        stageRef,
        active: true,
        stops: () => [{ from: () => stops[0], to: () => stops[2] }],
      }),
    );

    await run(WHOLE_TOUR_MS);

    const [press] = pointer.events;
    expect(press.type).toBe("pointerdown");
    // On the cell, at its centre — a band pins its first corner where you
    // pressed, so a press aimed anywhere else draws a different rectangle.
    expect(press.on).toBe("0");
    expect([press.x, press.y]).toEqual([12, 72]);

    const release = pointer.events.at(-1)!;
    expect(release.type).toBe("pointerup");
    expect([release.x, release.y]).toEqual([92, 72]);

    // Drawn, not jumped: a single move would hand the calendar the finished
    // rectangle while the cursor was still halfway across it.
    expect(pointer.count("pointermove")).toBeGreaterThan(4);
    pointer.off();
  });

  it("holds the press down for the length of the sweep", async () => {
    const { stageRef, stops } = setupStage(4);
    const pointer = recordPointer();
    const { result } = renderHook(() =>
      useDemoCursorTour({
        stageRef,
        active: true,
        stops: () => [{ from: () => stops[0], to: () => stops[3] }],
      }),
    );

    // Past the entry, the travel and the dip, into the drag itself.
    await run(1400);
    expect(result.current.pressed).toBe(true);
    expect(pointer.count("pointerup")).toBe(0);
    // ...and the cursor is somewhere between the corners rather than at either.
    const midway = result.current.point!;
    expect(midway.x).toBeGreaterThan(12);
    expect(midway.x).toBeLessThan(132);

    await run(WHOLE_TOUR_MS);
    expect(result.current.pressed).toBe(false);
    expect(pointer.count("pointerup")).toBe(1);
    pointer.off();
  });

  // The tour has to fire the very event it treats as "the visitor's hand just
  // arrived", so it must be able to tell its own gesture from a real one.
  it("does not mistake its own press for the visitor taking over", async () => {
    const { stageRef, stops, clicks } = setupStage(3);
    const pointer = recordPointer();
    renderHook(() =>
      useDemoCursorTour({
        stageRef,
        active: true,
        stops: () => [
          { from: () => stops[0], to: () => stops[1] },
          () => stops[2],
        ],
      }),
    );

    await run(WHOLE_TOUR_MS);
    // The sweep commits through the drag, not a click — so the only click in
    // the plan is the stop that follows it, and its presence is the proof the
    // tour was still running.
    expect(clicks).toEqual(["2"]);
    pointer.off();
  });

  it("lets go of a sweep the visitor cut short", async () => {
    const { stageRef, stops, stage } = setupStage(4);
    const pointer = recordPointer();
    renderHook(() =>
      useDemoCursorTour({
        stageRef,
        active: true,
        stops: () => [{ from: () => stops[0], to: () => stops[3] }],
      }),
    );

    await run(1400);
    expect(pointer.count("pointerdown")).toBe(1);
    expect(pointer.count("pointerup")).toBe(0);

    act(() => {
      stage.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    // Walking away mid-drag would leave the press held forever, and every move
    // the visitor made after it would go on redrawing the tour's band.
    expect(pointer.count("pointerup")).toBe(1);
    await run(WHOLE_TOUR_MS);
    expect(pointer.count("pointerup")).toBe(1);
    pointer.off();
  });

  it("skips a sweep whose far end the DOM never produced", async () => {
    const { stageRef, stops, clicks } = setupStage(2);
    const pointer = recordPointer();
    renderHook(() =>
      useDemoCursorTour({
        stageRef,
        active: true,
        stops: () => [{ from: () => stops[0], to: () => null }, () => stops[1]],
      }),
    );

    await run(WHOLE_TOUR_MS);
    // Half a band is not a shorter band, it is no gesture at all.
    expect(pointer.count("pointerdown")).toBe(0);
    expect(clicks).toEqual(["1"]);
    pointer.off();
  });

  it("holds the finale beat before withdrawing, so the result can be read", async () => {
    const { stageRef, plan } = setupStage(1);
    const done = vi.fn();
    const { result } = renderHook(() =>
      useDemoCursorTour({
        stageRef,
        active: true,
        stops: plan,
        finaleMs: 4000,
        onComplete: done,
      }),
    );

    // Past the one click (≈1.3s) and its hold, well short of the finale.
    await run(2000);
    expect(result.current.taps).toBe(1);
    expect(result.current.visible).toBe(true);
    expect(done).not.toHaveBeenCalled();

    await run(WHOLE_TOUR_MS);
    expect(result.current.visible).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("reports back once the cursor has finished and left", async () => {
    const { stageRef, plan, clicks } = setupStage(3);
    const done = vi.fn();
    renderHook(() =>
      useDemoCursorTour({
        stageRef,
        active: true,
        stops: plan,
        onComplete: done,
      }),
    );

    await run(WHOLE_TOUR_MS);
    expect(clicks).toHaveLength(3);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("does not report back on a tour the visitor cut short", async () => {
    const { stageRef, plan, stage } = setupStage(4);
    const done = vi.fn();
    renderHook(() =>
      useDemoCursorTour({
        stageRef,
        active: true,
        stops: plan,
        onComplete: done,
      }),
    );

    await run(1600);
    act(() => {
      stage.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    await run(WHOLE_TOUR_MS);

    expect(done).not.toHaveBeenCalled();
  });

  it("replays on request, spent latch and all", async () => {
    const { stageRef, plan, clicks } = setupStage(3);
    const { result } = renderHook(() =>
      useDemoCursorTour({ stageRef, active: true, stops: plan }),
    );

    await run(WHOLE_TOUR_MS);
    expect(clicks).toHaveLength(3);

    act(() => result.current.replay());
    await run(WHOLE_TOUR_MS);
    expect(clicks).toHaveLength(6);
    expect(result.current.visible).toBe(false);
  });

  it("replays a run that is still in flight, from the top", async () => {
    const { stageRef, plan, clicks } = setupStage(4);
    const { result } = renderHook(() =>
      useDemoCursorTour({ stageRef, active: true, stops: plan }),
    );

    await run(1600);
    expect(clicks).toEqual(["0"]);

    act(() => result.current.replay());
    await run(WHOLE_TOUR_MS);

    // The restart begins at the first stop again rather than resuming.
    expect(clicks).toEqual(["0", "0", "1", "2", "3"]);
  });

  it("replays even where nothing would have started it", async () => {
    // Never in view, and a visitor who asked for less motion — but a press on
    // Replay is a direct request, and outranks both.
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const { stageRef, plan, clicks } = setupStage(3);
    const { result } = renderHook(() =>
      useDemoCursorTour({ stageRef, active: false, stops: plan }),
    );

    await run(WHOLE_TOUR_MS);
    expect(clicks).toEqual([]);

    act(() => result.current.replay());
    await run(WHOLE_TOUR_MS);
    expect(clicks).toEqual(["0", "1", "2"]);
    vi.unstubAllGlobals();
  });

  it("stops where it stands on request", async () => {
    const { stageRef, plan, clicks } = setupStage(4);
    const { result } = renderHook(() =>
      useDemoCursorTour({ stageRef, active: true, stops: plan }),
    );

    await run(1600);
    const taken = clicks.length;
    act(() => result.current.stop());
    await run(WHOLE_TOUR_MS);

    expect(clicks).toHaveLength(taken);
    expect(result.current.visible).toBe(false);
  });

  it("does not perform for anyone who asked for less motion", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const { stageRef, plan, clicks } = setupStage(3);
    const { result } = renderHook(() =>
      useDemoCursorTour({ stageRef, active: true, stops: plan }),
    );

    await run(WHOLE_TOUR_MS);
    expect(clicks).toEqual([]);
    expect(result.current.visible).toBe(false);
    vi.unstubAllGlobals();
  });
});
