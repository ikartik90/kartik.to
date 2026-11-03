import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSyntheticPointer } from "@/utils/synthetic-pointer";
import { stillScrollers, useDemo, type Step } from "../demo";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const byText = (text: string) => () => screen.queryByText(text);

function Harness({ steps, late, before }: { steps: Step[]; late?: number; before?: () => Promise<void> }) {
  const stage = useRef<HTMLDivElement>(null);
  const demo = useDemo(stage);
  const [shown, setShown] = useState(!late);
  const [company, setCompany] = useState("");
  const log = (what: string) => document.body.dataset.log = `${document.body.dataset.log ?? ""}${what};`;
  return (
    <>
      <button onClick={() => {
        if (late) setTimeout(() => setShown(true), late);
        demo.play(steps, before);
      }}>Play</button>
      <div ref={stage} data-testid="stage">
        <input aria-label="Title" onFocus={() => log("focus title")} />
        <input aria-label="Company" value={company} onChange={(event) => setCompany(event.target.value.toUpperCase())} />
        <button onClick={() => log("first")}>First</button>
        {shown && <button onClick={() => log("late")}>Late</button>}
        <div
          data-testid="track"
          onPointerDown={(event) => log(`down ${isSyntheticPointer(event.nativeEvent)}`)}
          onPointerMove={(event) => {
            document.body.dataset.moved = "yes";
            document.body.dataset.at = `${event.clientX},${event.clientY}`;
            const far = Math.max(Number(document.body.dataset.far ?? 0), Math.hypot(event.clientX, event.clientY));
            document.body.dataset.far = String(far);
          }}
          onPointerUp={() => log("up")}
        >
          <span>From</span>
          <span>To</span>
        </div>
        <span onPointerEnter={() => log("enter")} onPointerLeave={() => log("leave")} onClick={() => log("pressed")}>
          Factor
        </span>
        <span
          onPointerEnter={() => log("enter spot")}
          onPointerLeave={() => log("leave spot")}
          onPointerMove={(event) => log(`move ${event.clientX},${event.clientY}`)}
          onClick={(event) => log(`click ${event.clientX},${event.clientY}`)}
        >
          Spot
        </span>
        <div
          data-testid="map"
          onWheel={(event) => {
            const { dataset } = document.body;
            dataset.wheel = String(Number(dataset.wheel ?? 0) + event.deltaY);
            dataset.wheeled = `${(event.target as Element).textContent} ${event.ctrlKey ? "ctrl" : ""} ${event.clientX},${event.clientY}`;
          }}
        >
          <span>Tile</span>
        </div>
        <button onClick={() => log("last")}>Last</button>
      </div>
      <span data-testid="cursor" data-visible={demo.cursor.visible || undefined} data-playing={demo.playing || undefined} />
    </>
  );
}

async function play(steps: Step[], late?: number, before?: () => Promise<void>) {
  delete document.body.dataset.log;
  delete document.body.dataset.moved;
  delete document.body.dataset.at;
  delete document.body.dataset.far;
  delete document.body.dataset.wheel;
  delete document.body.dataset.wheeled;
  render(<Harness steps={steps} late={late} before={before} />);
  fireEvent.click(screen.getByText("Play"));
}

const log = () => document.body.dataset.log?.split(";").filter(Boolean) ?? [];
// In slices, so React renders along the way as a browser would.
async function run(ms = 10_000) {
  for (let t = 0; t < ms; t += 100) await act(() => vi.advanceTimersByTimeAsync(100));
}

describe("the demo's cursor", () => {
  it("presses each target in turn, focusing a field so it types itself in", async () => {
    await play([{ at: () => screen.getByLabelText("Title") }, { at: byText("First") }, { at: byText("Last") }]);
    await run();
    expect(log()).toEqual(["focus title", "first", "last"]);
    expect(document.activeElement).toBe(screen.getByLabelText("Title"));
  });

  it("acts on each target only once its caller lets it, its cursor waiting there", async () => {
    let go = () => {};
    await play([{ at: byText("First") }, { at: byText("Last") }], undefined, () => new Promise<void>((resolve) => (go = resolve)));
    await run();
    expect(log()).toEqual([]);
    expect(screen.getByTestId("cursor").dataset.visible).toBeDefined();

    await act(() => go());
    await run();
    expect(log()).toEqual(["first"]);

    await act(() => go());
    await run();
    expect(log()).toEqual(["first", "last"]);
  });

  it("types into a field a character at a time, through the field's own onChange", async () => {
    await play([{ at: () => screen.getByLabelText("Company"), type: "ShipFusion" }, { at: byText("Last") }]);
    await run(1400);
    const typing = (screen.getByLabelText("Company") as HTMLInputElement).value;
    expect(typing.length).toBeGreaterThan(0);
    expect(typing.length).toBeLessThan("ShipFusion".length);
    await run();
    expect((screen.getByLabelText("Company") as HTMLInputElement).value).toBe("SHIPFUSION");
    expect(log()).toEqual(["last"]);
  });

  it("shows while it plays and leaves once it's done", async () => {
    await play([{ at: byText("First") }]);
    await run(900);
    expect(screen.getByTestId("cursor").hasAttribute("data-visible")).toBe(true);
    await run();
    expect(screen.getByTestId("cursor").hasAttribute("data-visible")).toBe(false);
  });

  it("is playing from Play, before its cursor shows, until it's done", async () => {
    const playing = () => screen.getByTestId("cursor").hasAttribute("data-playing");
    await play([{ at: byText("First") }]);
    await run(100);
    expect(screen.getByTestId("cursor").hasAttribute("data-visible")).toBe(false);
    expect(playing()).toBe(true);
    await run();
    expect(playing()).toBe(false);
  });

  it("waits for a target that's still on its way", async () => {
    await play([{ at: byText("Late") }, { at: byText("Last") }], 800);
    await run();
    expect(log()).toEqual(["late", "last"]);
  });

  it("skips an optional target that isn't there, without waiting for it", async () => {
    await play([{ at: byText("Missing"), optional: true }, { at: byText("First") }]);
    await run(1500);
    expect(log()).toEqual(["first"]);
  });

  it("drags from one element to another with pointer events marked as its own", async () => {
    await play([{ at: byText("From"), to: byText("To") }, { at: byText("Last") }]);
    await run();
    expect(log()).toEqual(["down true", "up", "last"]);
    expect(document.body.dataset.moved).toBe("yes");
  });

  it("drags from an element to a point", async () => {
    await play([{ at: byText("From"), to: () => ({ x: 90, y: 12 }) }]);
    await run();
    expect(log()).toEqual(["down true", "up"]);
    expect(document.body.dataset.at).toBe("90,12");
  });

  it("overshoots a short drag and comes back, so it reaches far enough from the press not to read as a click", async () => {
    await play([{ at: byText("From"), to: () => ({ x: 3, y: 0 }) }]);
    await run();
    expect(document.body.dataset.at).toBe("3,0");
    expect(Number(document.body.dataset.far)).toBeGreaterThanOrEqual(6);
  });

  it("drags a long way straight there", async () => {
    await play([{ at: byText("From"), to: () => ({ x: 90, y: 12 }) }]);
    await run();
    expect(Number(document.body.dataset.far)).toBeCloseTo(Math.hypot(90, 12), 6);
  });

  it("presses a spot on a target, pointing there first so what follows the pointer shows", async () => {
    await play([{ at: byText("Spot"), on: () => ({ x: 30, y: 40 }) }, { at: byText("Last") }]);
    await run();
    expect(log()).toEqual(["enter spot", "move 30,40", "click 30,40", "leave spot", "last"]);
  });

  it("stays over a target it points at when it presses it next", async () => {
    const spot = { at: byText("Spot"), on: () => ({ x: 30, y: 40 }) };
    await play([{ ...spot, hover: true, hold: 1000 }, spot]);
    await run();
    expect(log()).toEqual(["enter spot", "move 30,40", "move 30,40", "click 30,40", "leave spot"]);
  });

  it("points at a target without pressing it, and moves off it for the next", async () => {
    await play([{ at: byText("Factor"), hover: true, hold: 1000 }, { at: byText("Last") }]);
    await run(2000);
    expect(log()).toEqual(["enter"]);
    await run();
    expect(log()).toEqual(["enter", "leave", "last"]);
  });

  it("moves off a target pointed at last before it leaves", async () => {
    await play([{ at: byText("Factor"), hover: true }]);
    await run();
    expect(log()).toEqual(["enter", "leave"]);
  });

  it("pinches at a spot as a trackpad does, its wheel's travel sent with ctrl held to what's under the pointer", async () => {
    document.elementFromPoint = (x, y) => (x === 30 && y === 40 ? screen.getByText("Tile") : null);
    try {
      await play([{ at: () => screen.queryByTestId("map"), on: () => ({ x: 30, y: 40 }), pinch: -120 }, { at: byText("Last") }]);
      await run();
      expect(Number(document.body.dataset.wheel)).toBeCloseTo(-120, 6);
      expect(document.body.dataset.wheeled).toBe("Tile ctrl 30,40");
      expect(log()).toEqual(["last"]);
    } finally {
      Reflect.deleteProperty(document, "elementFromPoint");
    }
  });

  it("pinches what it aims at when what's under the pointer is outside its stage, as over an inert one", async () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    let strays = 0;
    outside.addEventListener("wheel", () => strays++);
    document.elementFromPoint = () => outside;
    try {
      await play([{ at: () => screen.queryByTestId("map"), on: () => ({ x: 30, y: 40 }), pinch: -120 }]);
      await run();
      expect(strays).toBe(0);
      expect(Number(document.body.dataset.wheel)).toBeCloseTo(-120, 6);
    } finally {
      Reflect.deleteProperty(document, "elementFromPoint");
      outside.remove();
    }
  });

  describe("brings what it presses into view first", () => {
    const box = (top: number, bottom: number, left = 0, right = 400) =>
      ({ top, bottom, left, right, x: left, y: top, width: right - left, height: bottom - top, toJSON: () => ({}) }) as DOMRect;

    /** `page`: the stage sits in a page that scrolls, as a landing card's does. `clipped`: the card sits in a box that
     * clips it, as a dialog's rounded corners do. */
    function Sheet({ steps, page, clipped }: { steps: Step[]; page?: boolean; clipped?: boolean }) {
      const card = (
        <div data-card="" data-testid="card">
          <button onClick={() => document.body.dataset.log = "manage;"}>Manage</button>
        </div>
      );
      const stage = useRef<HTMLDivElement>(null);
      const demo = useDemo(stage);
      return (
        <>
          <button onClick={() => demo.play(steps)}>Play</button>
          <div data-testid="page" style={{ overflowY: page ? "auto" : "visible" }}>
            <div ref={stage}>
              <div data-testid="scroller" style={{ overflowY: "auto" }}>
                {clipped ? <div data-testid="clip" style={{ overflowY: "hidden" }}>{card}</div> : card}
              </div>
              <div role="status">Team added</div>
            </div>
          </div>
        </>
      );
    }

    // The scroller's scrollTops asked for, laid out as given: `scale` is the transform the scroller's shown at. `still`:
    // its scrollers clipped, as a card's cover draws them.
    async function scrolls({ scroller, card, target, snackbar = box(0, 0, 0, 0), scale = 1, clip, still }: { scroller: DOMRect; card: DOMRect; target: DOMRect; snackbar?: DOMRect; scale?: number; clip?: DOMRect; still?: boolean }) {
      delete document.body.dataset.log;
      const { container } = render(<Sheet steps={[{ at: () => screen.getByText("Manage") }]} clipped={!!clip} />);
      if (still) stillScrollers(container);
      if (clip) vi.spyOn(screen.getByTestId("clip"), "getBoundingClientRect").mockReturnValue(clip);
      const node = screen.getByTestId("scroller");
      vi.spyOn(node, "getBoundingClientRect").mockReturnValue(scroller);
      vi.spyOn(screen.getByTestId("card"), "getBoundingClientRect").mockReturnValue(card);
      vi.spyOn(screen.getByText("Manage"), "getBoundingClientRect").mockReturnValue(target);
      vi.spyOn(screen.getByRole("status"), "getBoundingClientRect").mockReturnValue(snackbar);
      const height = scroller.height / scale;
      Object.defineProperties(node, { offsetHeight: { value: height }, clientHeight: { value: height }, scrollHeight: { value: height * 5 } });
      const scrollTo = vi.fn((options: ScrollToOptions) => options);
      node.scrollTo = scrollTo as typeof node.scrollTo;
      fireEvent.click(screen.getByText("Play"));
      await run();
      expect(log()).toEqual(["manage"]);
      return scrollTo.mock.calls.map(([options]) => options.top);
    }

    it("its card whole, where it's cut off at its scroller's foot", async () => {
      const [top, ...more] = await scrolls({ scroller: box(0, 400), card: box(300, 500), target: box(460, 480) });
      expect(more).toEqual([]);
      expect(top).toBeGreaterThanOrEqual(100);
      expect(top).toBeLessThanOrEqual(300);
    });

    it("clear of a snackbar over it", async () => {
      const [top] = await scrolls({ scroller: box(0, 400), card: box(250, 390), target: box(360, 380), snackbar: box(340, 370, 100, 300) });
      expect(top).toBeGreaterThanOrEqual(50);
      expect(top).toBeLessThanOrEqual(250);
    });

    it("in the scroller's own pixels, where the window shows it shrunk", async () => {
      const [top] = await scrolls({ scroller: box(0, 200), card: box(150, 250), target: box(220, 240), scale: 0.5 });
      expect(top).toBeGreaterThanOrEqual(100);
      expect(top).toBeLessThanOrEqual(300);
    });

    it("only itself, where its card is taller than the view", async () => {
      const [top] = await scrolls({ scroller: box(0, 400), card: box(100, 700), target: box(450, 470) });
      expect(top).toBeGreaterThanOrEqual(70);
      expect(top).toBeLessThan(300);
    });

    it("in a scroller a card's cover clips", async () => {
      const [top] = await scrolls({ scroller: box(0, 400), card: box(300, 500), target: box(460, 480), still: true });
      expect(getComputedStyle(screen.getByTestId("scroller")).overflowY).toBe("hidden");
      expect(top).toBeGreaterThanOrEqual(100);
      expect(top).toBeLessThanOrEqual(300);
    });

    it("not at all, where its card already shows", async () => {
      expect(await scrolls({ scroller: box(0, 400), card: box(100, 200), target: box(150, 170) })).toEqual([]);
    });

    it("not at all, where only a box that scrolls along with it, as its dialog, comes close to it", async () => {
      expect(await scrolls({ scroller: box(0, 400), clip: box(100, 304), card: box(200, 300), target: box(260, 280) })).toEqual([]);
    });

    it("never past its stage, where the stage runs off the page", async () => {
      delete document.body.dataset.log;
      render(<Sheet steps={[{ at: () => screen.getByText("Manage") }]} page />);
      const scrolled = vi.fn();
      for (const [node, rect] of [[screen.getByTestId("page"), box(0, 400)], [screen.getByTestId("scroller"), box(300, 700)]] as const) {
        vi.spyOn(node, "getBoundingClientRect").mockReturnValue(rect);
        Object.defineProperties(node, { offsetHeight: { value: 400 }, clientHeight: { value: 400 }, scrollHeight: { value: 2000 } });
        node.scrollTo = scrolled;
      }
      vi.spyOn(screen.getByTestId("card"), "getBoundingClientRect").mockReturnValue(box(500, 600));
      vi.spyOn(screen.getByText("Manage"), "getBoundingClientRect").mockReturnValue(box(550, 570));
      fireEvent.click(screen.getByText("Play"));
      await run();
      expect(log()).toEqual(["manage"]);
      expect(scrolled).not.toHaveBeenCalled();
    });
  });

  it("gives way the moment the visitor presses inside the app", async () => {
    await play([{ at: byText("First") }, 2000, { at: byText("Last") }]);
    await run(2000);
    expect(log()).toEqual(["first"]);
    fireEvent.pointerDown(screen.getByTestId("stage"));
    await run();
    expect(log()).toEqual(["first"]);
    expect(screen.getByTestId("cursor").hasAttribute("data-visible")).toBe(false);
    expect(screen.getByTestId("cursor").hasAttribute("data-playing")).toBe(false);
  });
});
