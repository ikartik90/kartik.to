import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCATION_HISTORY } from "../copy";
import type { Ping } from "../dashboard";
import { AddNote, LocationMap } from "../dashboard-overlays";
import { COMPANY_PLACE } from "../geo";
import { centroid, offset } from "../geofence";
import { PLAY_STEP } from "../location-history";

afterEach(cleanup);

describe("Add a note", () => {
  it("adds its note once one is typed, an empty one turning its field Alert", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddNote onAdd={onAdd} onCancel={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "Add a note" });
    const add = within(dialog).getByRole("button", { name: "Add note" });
    expect((add as HTMLButtonElement).disabled).toBe(false);
    await user.click(add);
    expect(onAdd).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("textbox", { name: "Note" }).closest("[data-field]")!.getAttribute("data-state")).toBe("alert");
    await user.type(within(dialog).getByRole("textbox", { name: "Note" }), "Called again.");
    await user.click(add);
    expect(onAdd).toHaveBeenCalledWith("Called again.");
  });
});

describe("LocationMap", () => {
  const FENCE = [
    { lat: 43.6756, lng: -79.7151 },
    { lat: 43.6757, lng: -79.7135 },
    { lat: 43.6744, lng: -79.7134 },
    { lat: 43.6743, lng: -79.715 },
  ];
  const drawn = (container: HTMLElement) => {
    const points = container.querySelector("polygon")!.getAttribute("points")!.split(" ").map((point) => point.split(",").map(Number));
    const dot = container.querySelector<SVGElement>("[data-worker]")!;
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    return {
      fence: { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) },
      worker: { x: parseFloat(dot.style.left) + 6, y: parseFloat(dot.style.top) + 6 },
    };
  };

  it("draws the job site's geofence and its pin, the worker inside it when on site", () => {
    const { container } = render(<LocationMap site={COMPANY_PLACE} fence={FENCE} away={0} />);
    const { fence, worker } = drawn(container);
    expect(container.querySelector("img")).toBeTruthy();
    expect(worker.x).toBeGreaterThan(fence.left);
    expect(worker.x).toBeLessThan(fence.right);
    expect(worker.y).toBeGreaterThan(fence.top);
    expect(worker.y).toBeLessThan(fence.bottom);
  });

  it("puts an off-site worker as far away as they are, framed with the site", () => {
    const { container } = render(<LocationMap site={COMPANY_PLACE} fence={FENCE} away={7300} />);
    const { fence, worker } = drawn(container);
    expect(worker.x < fence.left || worker.x > fence.right || worker.y < fence.top || worker.y > fence.bottom).toBe(true);
    expect(fence.right - fence.left).toBeLessThan(20);
  });

  it("puts the worker where their phone last reported them, given that", () => {
    const east = offset(centroid(FENCE), 7300, 90);
    const { container } = render(<LocationMap site={COMPANY_PLACE} fence={FENCE} away={7300} reported={east} />);
    const { fence, worker } = drawn(container);
    expect(worker.x).toBeGreaterThan(fence.right);
    expect(Math.abs(worker.y - (fence.top + fence.bottom) / 2)).toBeLessThan(3);
    expect(container.querySelector("[data-arc]")).not.toBeNull();
  });

  describe("given the worker's location history", () => {
    // Reported whenever the worker's phone moved far enough, so at no fixed interval; the first on site.
    const away = (metres: number, bearing: number) => offset(centroid(FENCE), metres, bearing);
    const TRACE: Ping[] = [
      { at: 20 * 60 + 47 },
      { at: 21 * 60 + 6, place: away(400, 200) },
      { at: 21 * 60 + 31, place: away(8200, 238) },
      { at: 22 * 60 + 38, place: away(10600, 243) },
      { at: 22 * 60 + 50, place: away(7300, 233) },
    ];
    const slider = () => screen.getByRole("slider", { name: LOCATION_HISTORY.timeline });
    const shown = () => slider().getAttribute("aria-valuetext");
    const width = (container: HTMLElement) => {
      const { fence } = drawn(container);
      return fence.right - fence.left;
    };

    it("opens on the last report, the earlier ones faint, a tick for each report spaced evenly however far apart they were, and no arc", () => {
      const { container } = render(<LocationMap site={COMPANY_PLACE} fence={FENCE} trace={TRACE} />);
      expect(shown()).toBe("10:50 PM");
      expect(container.querySelectorAll("[data-worker]")).toHaveLength(1);
      expect(container.querySelectorAll("[data-trail]")).toHaveLength(TRACE.length - 1);
      expect(container.querySelector("[data-arc]")).toBeNull();
      expect([...container.querySelectorAll<HTMLElement>("[data-tick]")].map((tick) => tick.style.left)).toEqual([
        "0%",
        "25%",
        "50%",
        "75%",
        "100%",
      ]);
    });

    it("steps between reports with the arrow keys, the dot jumping to each and those before it faint", async () => {
      const user = userEvent.setup();
      const { container } = render(<LocationMap site={COMPANY_PLACE} fence={FENCE} trace={TRACE} />);
      slider().focus();
      await user.keyboard("{Home}");
      expect(shown()).toBe("8:47 PM");
      expect(container.querySelectorAll("[data-trail]")).toHaveLength(0);
      await user.keyboard("{ArrowRight}{ArrowRight}");
      expect(shown()).toBe("9:31 PM");
      expect(container.querySelectorAll("[data-trail]")).toHaveLength(2);
      await user.keyboard("{ArrowLeft}");
      expect(shown()).toBe("9:06 PM");
    });

    it("snaps the handle to the report nearest where the timeline's pressed or dragged, telling that report's time", () => {
      const { container } = render(<LocationMap site={COMPANY_PLACE} fence={FENCE} trace={TRACE} />);
      const track = container.querySelector<HTMLElement>("[data-track]")!;
      track.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 4, right: 100, bottom: 4, x: 0, y: 0, toJSON: () => ({}) });
      fireEvent.pointerDown(track, { pointerId: 1, clientX: 60 });
      expect(shown()).toBe("9:31 PM");
      expect(slider().textContent).toBe("9:31 PM");
      expect(slider().style.left).toBe("50%");
      expect(container.querySelectorAll("[data-trail]")).toHaveLength(2);
      fireEvent.pointerMove(track, { pointerId: 1, clientX: 70 });
      fireEvent.pointerUp(track, { pointerId: 1 });
      expect(shown()).toBe("10:38 PM");
      expect(slider().textContent).toBe("10:38 PM");
      expect(slider().style.left).toBe("75%");
      expect(container.querySelectorAll("[data-trail]")).toHaveLength(3);
    });

    it("keeps a press on the timeline from selecting the page's text as it's dragged", () => {
      const { container } = render(<LocationMap site={COMPANY_PLACE} fence={FENCE} trace={TRACE} />);
      expect(fireEvent.pointerDown(container.querySelector("[data-track]")!, { pointerId: 1, clientX: 0 })).toBe(false);
    });

    it("draws the timeline thicker between reports made within 5 minutes of each other, filling as the handle passes", async () => {
      const user = userEvent.setup();
      const driving: Ping[] = [
        { at: 20 * 60 + 47 },
        { at: 21 * 60 + 5, place: away(700, 0) },
        { at: 21 * 60 + 7, place: away(2200, 10) },
        { at: 21 * 60 + 8, place: away(3400, 20) },
        { at: 21 * 60 + 30, place: away(9000, 60) },
        { at: 21 * 60 + 33, place: away(10500, 70) },
      ];
      const { container } = render(<LocationMap site={COMPANY_PLACE} fence={FENCE} trace={driving} />);
      const runs = () =>
        [...container.querySelectorAll<HTMLElement>("[data-run]")].map((run) => ({
          left: run.style.left,
          width: run.style.width,
          filled: run.querySelector<HTMLElement>("[data-fill]")!.style.width,
        }));
      expect(runs()).toEqual([
        { left: "20%", width: "40%", filled: "100%" },
        { left: "80%", width: "20%", filled: "100%" },
      ]);
      slider().focus();
      await user.keyboard("{Home}");
      expect(runs().map((run) => run.filled)).toEqual(["0%", "0%"]);
      await user.keyboard("{ArrowRight}{ArrowRight}");
      expect(runs().map((run) => run.filled)).toEqual(["50%", "0%"]);
    });

    it("draws each report where it was made, the one on site in the fence", async () => {
      const user = userEvent.setup();
      const east: Ping[] = [{ at: 20 * 60 + 47 }, { at: 21 * 60 + 6, place: away(7300, 90) }];
      const { container } = render(<LocationMap site={COMPANY_PLACE} fence={FENCE} trace={east} />);
      const there = drawn(container);
      expect(there.worker.x).toBeGreaterThan(there.fence.right);
      expect(Math.abs(there.worker.y - (there.fence.top + there.fence.bottom) / 2)).toBeLessThan(3);
      slider().focus();
      await user.keyboard("{Home}");
      const { fence, worker } = drawn(container);
      expect(worker.x).toBeGreaterThan(fence.left);
      expect(worker.x).toBeLessThan(fence.right);
      expect(worker.y).toBeGreaterThan(fence.top);
      expect(worker.y).toBeLessThan(fence.bottom);
    });

    it("frames only the job site and where the worker is now, zooming out as they go further and back in as they return", async () => {
      const user = userEvent.setup();
      const { container } = render(<LocationMap site={COMPANY_PLACE} fence={FENCE} trace={TRACE} />);
      slider().focus();
      await user.keyboard("{Home}");
      const onSite = width(container);
      await user.keyboard("{ArrowRight}{ArrowRight}");
      const away = width(container);
      await user.keyboard("{ArrowRight}");
      const furthest = width(container);
      await user.keyboard("{ArrowRight}");
      const returning = width(container);
      expect(away).toBeLessThan(onSite);
      expect(furthest).toBeLessThan(away);
      expect(returning).toBeGreaterThan(furthest);
      const { container: now } = render(<LocationMap site={COMPANY_PLACE} fence={FENCE} reported={TRACE[4].place} />);
      expect(returning).toBeCloseTo(width(now), 5);
      await user.keyboard("{Home}");
      expect(width(container)).toBeCloseTo(onSite, 5);
    });

    it("plays from the first report to the last one at a time, at a steady pace however far apart they were, and pauses on the one it's got to", () => {
      vi.useFakeTimers();
      try {
        render(<LocationMap site={COMPANY_PLACE} fence={FENCE} trace={TRACE} />);
        fireEvent.click(screen.getByRole("button", { name: LOCATION_HISTORY.play }));
        act(() => vi.advanceTimersByTime(50));
        expect(shown()).toBe("8:47 PM");
        act(() => vi.advanceTimersByTime(PLAY_STEP));
        expect(shown()).toBe("9:06 PM");
        act(() => vi.advanceTimersByTime(PLAY_STEP));
        expect(shown()).toBe("9:31 PM");
        act(() => vi.advanceTimersByTime(PLAY_STEP / 2));
        fireEvent.click(screen.getByRole("button", { name: LOCATION_HISTORY.pause }));
        expect(shown()).toBe("9:31 PM");
        expect(slider().style.left).toBe("50%");
        act(() => vi.advanceTimersByTime(4000));
        expect(shown()).toBe("9:31 PM");
        fireEvent.click(screen.getByRole("button", { name: LOCATION_HISTORY.play }));
        act(() => vi.advanceTimersByTime(60_000));
        expect(shown()).toBe("10:50 PM");
        expect(screen.getByRole("button", { name: LOCATION_HISTORY.play })).toBeDefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it("marks only the last report untracked when the worker's location went off after it", async () => {
      const user = userEvent.setup();
      const { container } = render(<LocationMap site={COMPANY_PLACE} fence={FENCE} trace={TRACE} untracked />);
      expect(container.querySelector("[data-worker][data-untracked]")).not.toBeNull();
      expect(container.querySelector("[data-last-known]")).not.toBeNull();
      expect(container.querySelector("[data-trail][data-untracked]")).toBeNull();
      slider().focus();
      await user.keyboard("{ArrowLeft}");
      expect(container.querySelector("[data-untracked], [data-last-known]")).toBeNull();
    });
  });
});

