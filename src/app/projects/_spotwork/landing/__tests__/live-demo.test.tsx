import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { use, useEffect } from "react";
import { GeoContext, ONLINE } from "../../geo";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveDemo } from "../live-demo";

const { builds, renders, play, stop, demoOf, demoFencesOf, fences, geos } = vi.hoisted(() => ({
  builds: [] as string[],
  renders: { count: 0 },
  play: vi.fn(),
  stop: vi.fn(),
  demoOf: vi.fn((..._: unknown[]) => [] as unknown[]),
  demoFencesOf: vi.fn((..._: unknown[]) => ({ picker: [] }) as unknown),
  fences: [] as unknown[],
  geos: [] as unknown[],
}));

vi.mock("../../check-ins-app", () => ({
  CheckInsApp: function App(props: { fences?: unknown }) {
    renders.count++;
    fences.push(props.fences);
    geos.push(use(GeoContext));
    useEffect(() => void builds.push("app"), []);
    return <div style={{ overflowY: "auto" }} />;
  },
}));
vi.mock("../../design-system", () => ({ DesignSystem: () => null }));
vi.mock("../../browser-bar/browser-bar", () => ({ BAR_HEIGHT: 40, BrowserBar: () => null }));
vi.mock("../../prototype-overlay", () => ({ windowOf: () => ({ site: "app", url: "" }), pageOf: () => "dashboard" }));
vi.mock("../../theme", () => ({ manrope: { variable: "" }, poppins: { variable: "" }, spotworkTheme: "" }));
vi.mock("../../demos", () => ({ demoOf, demoFencesOf }));
vi.mock("../../demo", async (actual) => ({
  ...(await actual<typeof import("../../demo")>()),
  useDemo: () => ({ cursor: {}, playing: false, play, stop }),
}));
vi.mock("@/components/demo/demo-cursor", () => ({ DemoCursor: () => null }));
vi.mock("@/components/shaders/use-shader-policy", () => ({ useReducedMotion: () => false }));

const observers: { callback: IntersectionObserverCallback; nodes: Element[] }[] = [];
// An hour on per test, past the last test's scrolls and builds: the cards share one clock.
let hour = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: ++hour * 3_600_000 });
  builds.length = 0;
  renders.count = 0;
  fences.length = 0;
  geos.length = 0;
  demoOf.mockClear();
  demoFencesOf.mockClear();
  play.mockClear();
  stop.mockClear();
  observers.length = 0;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      entry: { callback: IntersectionObserverCallback; nodes: Element[] };
      constructor(callback: IntersectionObserverCallback) {
        this.entry = { callback, nodes: [] };
        observers.push(this.entry);
      }
      observe(node: Element) {
        this.entry.nodes.push(node);
      }
      disconnect() {
        this.entry.nodes = [];
      }
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(720);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(450);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** As much of every card's face on screen as `ratio`. */
const show = (ratio: number) =>
  act(() => {
    for (const { callback, nodes } of observers)
      callback(
        nodes.map((target) => ({ target, intersectionRatio: ratio, isIntersecting: ratio > 0 }) as IntersectionObserverEntry),
        {} as IntersectionObserver,
      );
  });

/** The page scrolling for `ms`, as a carousel's glide does, a scroll every frame. */
const scroll = (ms: number) =>
  act(() => {
    for (let t = 0; t < ms; t += 16) {
      fireEvent.scroll(document.body);
      vi.advanceTimersByTime(16);
    }
  });

/** A frame at a time, for each frame's renders and effects to run before the next. */
const wait = async (ms: number) => {
  for (let t = 0; t < ms; t += 16) await act(() => vi.advanceTimersByTime(16));
};

const Card = ({ project = "check-ins" }: { project?: string }) => (
  <div data-cover="">
    <LiveDemo project={project} paused={false} near />
  </div>
);

describe("LiveDemo", () => {
  it("builds its app, and starts its demo, only once the scroll that brought it into view has settled", async () => {
    render(<Card />);
    await scroll(200);
    show(1);
    await scroll(300);
    expect(builds).toEqual([]);
    expect(play).not.toHaveBeenCalled();

    await wait(1000);
    expect(builds).toEqual(["app"]);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("plays the first demo its project's About sheet lists, on the app as that demo starts it", async () => {
    render(<Card />);
    show(1);
    await wait(1000);
    const choice = { project: "check-ins", version: "company" };
    expect(demoOf).toHaveBeenLastCalledWith(choice, expect.any(Function), "geofence");
    expect(demoFencesOf).toHaveBeenCalledWith(choice, "geofence");
    expect(fences.at(-1)).toEqual({ picker: [] });
  });

  it("gives its app Google's maps, as the prototype does, for the geofence demo to draw on", async () => {
    render(<Card />);
    show(1);
    await wait(1000);
    expect(geos.at(-1)).toBe(ONLINE);
  });

  it("plays only while all of it is in view", async () => {
    render(<Card />);
    show(0.9);
    await wait(1000);
    expect(builds).toEqual(["app"]);
    expect(play).not.toHaveBeenCalled();

    show(1);
    await wait(1000);
    expect(play).toHaveBeenCalledTimes(1);

    show(0.95);
    await wait(16);
    expect(stop).toHaveBeenCalled();
  });

  // Stopping restyles the app, which would stall the strip mid-drag.
  it("stops its demo as it leaves view only once the scroll that carried it out has settled", async () => {
    render(<Card />);
    show(1);
    await wait(1000);
    expect(play).toHaveBeenCalledTimes(1);

    await scroll(100);
    show(0.95);
    await scroll(300);
    expect(stop).not.toHaveBeenCalled();

    await wait(300);
    expect(stop).toHaveBeenCalled();
  });

  it("starts afresh as it comes back into view only once the scroll has settled", async () => {
    render(<Card />);
    show(1);
    await wait(1000);
    expect(builds).toEqual(["app"]);

    show(0);
    await scroll(300);
    show(1);
    await scroll(300);
    expect(builds).toEqual(["app"]);
    expect(play).toHaveBeenCalledTimes(1);

    await wait(1000);
    expect(builds).toEqual(["app", "app"]);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("holds each of its demo's steps while the page scrolls", async () => {
    render(<Card />);
    show(1);
    await wait(1000);
    const before = play.mock.calls[0][1] as () => Promise<void>;
    let acted = false;
    void before().then(() => (acted = true));
    await scroll(300);
    expect(acted).toBe(false);

    await wait(300);
    expect(acted).toBe(true);
  });

  it("leaves its app be as the card round it renders again, as it does on each hover", async () => {
    const { rerender } = render(<Card />);
    show(1);
    await wait(1000);
    const built = renders.count;
    expect(built).toBeGreaterThan(0);
    rerender(<Card />);
    rerender(<Card />);
    expect(renders.count).toBe(built);
  });

  it("doesn't build two cards' apps in one beat", async () => {
    render(
      <>
        <Card />
        <Card project="activation-and-retention" />
      </>,
    );
    show(1);
    await wait(50);
    expect(builds).toEqual(["app"]);

    await wait(1000);
    expect(builds).toEqual(["app", "app"]);
  });

  it("isn't held by its own app scrolling", async () => {
    const { container } = render(<Card />);
    show(1);
    await act(() => {
      for (let t = 0; t < 600; t += 16) {
        fireEvent.scroll(container.querySelector("[data-cover] > *")!);
        vi.advanceTimersByTime(16);
      }
    });
    expect(builds).toEqual(["app"]);
  });

  // Safari draws a box that scrolls at the app's full size, however small the card shows it.
  it("clips each box its app scrolls, as it comes", async () => {
    const { container } = render(<Card />);
    await wait(500);
    const window = container.querySelector<HTMLElement>("[inert] > div")!;
    const later = document.createElement("div");
    later.style.overflowY = "auto";
    await act(async () => void window.append(later));
    expect([window.firstElementChild!, later].map((box) => getComputedStyle(box).overflowY)).toEqual(["hidden", "hidden"]);
  });

  it.each([
    ["wider", 977, 525, 977 / 1440],
    ["taller", 600, 450, 450 / 900],
  ])("lays its window out at 1440×900 in a box %s than that, scaled to cover the box", async (_, width, height, scale) => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(height);
    const { container } = render(<Card />);
    await wait(500);
    const window = container.querySelector<HTMLElement>("[inert] > div")!;
    expect([window.style.width, window.style.height]).toEqual(["1440px", "900px"]);
    expect(window.style.transform).toBe(`scale(${scale})`);
  });
});
