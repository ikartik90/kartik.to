// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { travelDurationMs, useDemoCursorTour } from "../use-demo-cursor-tour";

// Only timers are faked: real microtasks let advanceTimersByTimeAsync flush the hook's awaits.
beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

const WHOLE_TOUR_MS = 12_000;

const run = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

function setupStage(count: number) {
  const stage = document.createElement("div");
  stage.getBoundingClientRect = () => new DOMRect(0, 0, 400, 200);
  document.body.appendChild(stage);

  const clicks: string[] = [];
  const stops = Array.from({ length: count }, (_, index) => {
    const stop = document.createElement("button");
    stop.dataset.stop = String(index);
    // jsdom measures nothing, so each stop gets a box, 40px apart.
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
    plan: () => stops.map((stop) => () => stop),
  };
}

const POINTER_TYPES = ["pointerdown", "pointermove", "pointerup"];

/** Listens on window, where both the bubbled press and the aimed moves arrive. */
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
    expect(result.current.visible).toBe(false);
  });

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

      // Sampled every 40ms: the gap this guards is a single 260ms fade.
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

    // At the first stop, not yet the second.
    await run(1200);
    expect(result.current.point).toEqual({ x: 12, y: 72 });
    expect(result.current.visible).toBe(true);
  });

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

    expect(rewind).not.toHaveBeenCalled();
  });

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

  it("resolves each stop as it sets off, not when the tour is planned", async () => {
    const { stageRef, stage, stops, clicks } = setupStage(1);
    const opened = document.createElement("button");
    opened.dataset.opened = "";
    opened.getBoundingClientRect = () => new DOMRect(120, 60, 24, 24);
    opened.addEventListener("click", () => clicks.push("opened"));
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
    expect(press.on).toBe("0");
    expect([press.x, press.y]).toEqual([12, 72]);

    const release = pointer.events.at(-1)!;
    expect(release.type).toBe("pointerup");
    expect([release.x, release.y]).toEqual([92, 72]);

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

    await run(1400);
    expect(result.current.pressed).toBe(true);
    expect(pointer.count("pointerup")).toBe(0);
    const midway = result.current.point!;
    expect(midway.x).toBeGreaterThan(12);
    expect(midway.x).toBeLessThan(132);

    await run(WHOLE_TOUR_MS);
    expect(result.current.pressed).toBe(false);
    expect(pointer.count("pointerup")).toBe(1);
    pointer.off();
  });

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

    expect(clicks).toEqual(["0", "0", "1", "2", "3"]);
  });

  it("replays even where nothing would have started it", async () => {
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
