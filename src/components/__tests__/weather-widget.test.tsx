import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { WeatherWidget } from "../weather-widget";
import { DEGREE_RING, type WeatherReading } from "@/domain/weather";
import { WEATHER_LOCATION } from "@/data/weather-location";

const reading: WeatherReading = {
  condition: "cloudy",
  time: "night",
  temperatureC: 22.6,
  place: WEATHER_LOCATION.place,
};

function drawnSky(container: HTMLElement): string | null | undefined {
  return container.querySelector("[data-variant]")?.getAttribute("data-variant");
}

// Matched on `textContent`: the degree ring is its own element, so `getByText("23°")` can't find it.
function temperatureLine(text: string): HTMLElement {
  return screen.getByText(
    (_, element) => element?.tagName === "P" && element.textContent === text,
  );
}

// Document order, since jsdom lays nothing out.
function positionOf(container: HTMLElement, node: Element | null): number {
  return [...container.querySelectorAll("*")].indexOf(node as Element);
}

// Holds animation frames so the entry is observable as its own state.
function heldFrames() {
  const queue: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    queue.push(cb);
    return queue.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  return {
    flush() {
      act(() => {
        for (let i = 0; i < 10 && queue.length; i += 1) {
          queue.splice(0).forEach((cb) => cb(0));
        }
      });
    },
  };
}

function prefersReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

describe("WeatherWidget", () => {
  let frames: ReturnType<typeof heldFrames>;

  beforeEach(() => {
    prefersReducedMotion(false);
    frames = heldFrames();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe("the readout", () => {
    it("reads out the temperature, the condition and the place", () => {
      render(<WeatherWidget reading={reading} />);
      expect(temperatureLine("23°")).toBeTruthy();
      expect(screen.getByText(WEATHER_LOCATION.place)).toBeTruthy();
      expect(screen.getByText("Cloudy")).toBeTruthy();
    });

    it("leads with the place, then the drawing, then the temperature and the condition", () => {
      const { container } = render(<WeatherWidget reading={reading} />);
      const order = [
        screen.getByText(WEATHER_LOCATION.place),
        container.querySelector("[data-variant]"),
        temperatureLine("23°"),
        screen.getByText("Cloudy"),
      ].map((node) => positionOf(container, node));

      expect(order.every((at) => at >= 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it("hangs the ring off the digits rather than centring the two together", () => {
      render(<WeatherWidget reading={reading} />);
      const line = temperatureLine("23°");

      expect(line.firstChild?.nodeValue).toBe("23");
      expect(line.querySelector("span")?.textContent).toBe(DEGREE_RING);
    });

    it("keeps the drawing out of the accessibility tree", () => {
      render(<WeatherWidget reading={reading} />);
      expect(screen.queryByRole("img")).toBeNull();
    });

    it("shows no temperature at all when there is no reading", () => {
      render(<WeatherWidget reading={null} />);
      expect(screen.queryByText(/°/)).toBeNull();
      expect(screen.getByText(/unavailable/i)).toBeTruthy();
    });

    it("still names the place when there is no reading", () => {
      render(<WeatherWidget reading={null} />);
      expect(screen.getByText(WEATHER_LOCATION.place)).toBeTruthy();
    });
  });

  describe("the sky it draws", () => {
    it("settles on the sky the reading describes", () => {
      const { container } = render(<WeatherWidget reading={reading} />);
      frames.flush();
      expect(drawnSky(container)).toBe("Weather=Cloudy, Time=Night");
    });

    it("holds an empty sky rather than inventing weather when there is no reading", () => {
      const { container } = render(<WeatherWidget reading={null} />);
      frames.flush();
      expect(drawnSky(container)).toBe("Weather=Clear, Time=Day");
    });
  });

  describe("the entry", () => {
    it("opens on a resting sky and settles into the reading", () => {
      const { container } = render(<WeatherWidget reading={reading} />);
      expect(drawnSky(container)).toBe("Weather=Clear, Time=Night");
      frames.flush();
      expect(drawnSky(container)).toBe("Weather=Cloudy, Time=Night");
    });

    it("cuts to the resting sky rather than transitioning into it", () => {
      const { container } = render(<WeatherWidget reading={reading} />);
      expect(
        container.querySelector("[data-entry]")?.getAttribute("data-entry"),
      ).toBe("resting");

      frames.flush();
      expect(container.querySelector("[data-entry]")).toBeNull();
    });

    it("rests at the reading's OWN hour, so night never flashes a sun", () => {
      const { container } = render(
        <WeatherWidget reading={{ ...reading, condition: "rain" }} />,
      );
      expect(drawnSky(container)).toBe("Weather=Clear, Time=Night");
    });

    it("is skipped entirely when motion is not wanted", () => {
      prefersReducedMotion(true);
      const { container } = render(<WeatherWidget reading={reading} />);
      expect(drawnSky(container)).toBe("Weather=Cloudy, Time=Night");
    });

    it("draws the true sky before any of this, for a visitor running no JS", () => {
      const html = renderToString(<WeatherWidget reading={reading} />);
      expect(html).toContain("Weather=Cloudy, Time=Night");
    });
  });
});

describe("when the service is down", () => {
  it("stops the drawing short of being a claim about the sky", () => {
    const { container } = render(<WeatherWidget reading={null} />);
    expect(
      container.querySelector("[data-available]")?.getAttribute("data-available"),
    ).toBe("false");
  });

  it("keeps the drawing at full strength when there IS a reading", () => {
    const { container } = render(<WeatherWidget reading={reading} />);
    expect(
      container.querySelector("[data-available]")?.getAttribute("data-available"),
    ).toBe("true");
  });
});

describe("when no animation frames arrive", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
  afterEach(() => vi.useRealTimers());

  it("settles anyway, on a timer", () => {
    const { container } = render(<WeatherWidget reading={reading} />);
    expect(drawnSky(container)).toBe("Weather=Clear, Time=Night");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(drawnSky(container)).toBe("Weather=Cloudy, Time=Night");
  });
});
