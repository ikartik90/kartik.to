import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveDemo } from "../live-demo";

const { builds, play, stop } = vi.hoisted(() => ({ builds: [] as string[], play: vi.fn(), stop: vi.fn() }));

vi.mock("../../check-ins-app", () => ({
  CheckInsApp: function App() {
    useEffect(() => void builds.push("app"), []);
    return null;
  },
}));
vi.mock("../../design-system", () => ({ DesignSystem: () => null }));
vi.mock("../../browser-bar/browser-bar", () => ({ BAR_HEIGHT: 40, BrowserBar: () => null }));
vi.mock("../../prototype-overlay", () => ({ windowOf: () => ({ site: "app", url: "" }), pageOf: () => "dashboard" }));
vi.mock("../../theme", () => ({ manrope: { variable: "" }, poppins: { variable: "" }, spotworkTheme: "" }));
vi.mock("../../demos", () => ({ demoOf: () => [] }));
vi.mock("../../demo", () => ({ useDemo: () => ({ cursor: {}, playing: false, play, stop }) }));
vi.mock("@/components/demo/demo-cursor", () => ({ DemoCursor: () => null }));
vi.mock("@/components/shaders/use-shader-policy", () => ({ useReducedMotion: () => false }));

const observers: { callback: IntersectionObserverCallback; nodes: Element[] }[] = [];
// An hour on per test, past the last test's scrolls and builds: the cards share one clock.
let hour = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: ++hour * 3_600_000 });
  builds.length = 0;
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
