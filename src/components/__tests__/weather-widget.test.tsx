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

/** The sky currently drawn, as its Figma variant name. */
function drawnSky(container: HTMLElement): string | null | undefined {
  return container.querySelector("[data-variant]")?.getAttribute("data-variant");
}

/**
 * The temperature line, matched by the whole string a screen reader hears.
 *
 * `getByText("23°")` cannot find it any more: the ring is its own element, and
 * Testing Library matches an element against its own direct text nodes rather
 * than its full `textContent`. Matching on `textContent` is the right assertion
 * anyway — it is the thing that has to stay "23°" however the two halves are
 * laid out.
 */
function temperatureLine(text: string): HTMLElement {
  return screen.getByText(
    (_, element) => element?.tagName === "P" && element.textContent === text,
  );
}

/**
 * Where a node falls in the card, counting every element in document order.
 *
 * Document order rather than geometry because jsdom lays nothing out — but it
 * is also the honest thing to assert: the card is a plain column, so the order
 * it is READ in (by a screen reader, by anything without the stylesheet) and
 * the order it is drawn in are the same list, and only one of them can be
 * checked here.
 */
function positionOf(container: HTMLElement, node: Element | null): number {
  return [...container.querySelectorAll("*")].indexOf(node as Element);
}

/**
 * Hold the animation frames rather than running them, so the ENTRY can be
 * observed as a distinct state instead of only its destination.
 */
function heldFrames() {
  const queue: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    queue.push(cb);
    return queue.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  return {
    /** Run every frame queued so far, and any they queue in turn. */
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
      // "Cloudy", not "cloudy": the lowercasing is a `text-transform`, so the
      // card reads lowercase but a screen reader still hears the word as it
      // is written. Asserting the DOM text keeps it that way round.
      expect(screen.getByText("Cloudy")).toBeTruthy();
    });

    it("leads with the place, then the drawing, then the temperature and the condition", () => {
      // The order is the specification, not a by-product of the layout. The
      // temperature is by far the loudest thing on the card, and a visitor who
      // meets it before they meet the city reads it as their OWN weather and
      // has to be corrected by a line further down. Naming the place first
      // means nothing has to be taken back.
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
      // The card centres every line on one vertical axis, and the temperature
      // was the one line that looked off it: centring "23°" as a whole string
      // pushes the DIGITS left by half the ring's width, and the digits are
      // what the eye reads the axis from. So the ring is its own element, taken
      // out of flow by the recipe — the text node the line is centred on is the
      // number alone.
      render(<WeatherWidget reading={reading} />);
      const line = temperatureLine("23°");

      expect(line.firstChild?.nodeValue).toBe("23");
      expect(line.querySelector("span")?.textContent).toBe(DEGREE_RING);
    });

    it("keeps the drawing out of the accessibility tree", () => {
      // The readout already says "cloudy" in words. Naming the graphic too
      // would have a screen reader announce the same fact twice over.
      render(<WeatherWidget reading={reading} />);
      expect(screen.queryByRole("img")).toBeNull();
    });

    it("shows no temperature at all when there is no reading", () => {
      // Not a zero, and not a plausible default: a card that is confidently
      // wrong looks exactly like a card that is right.
      render(<WeatherWidget reading={null} />);
      expect(screen.queryByText(/°/)).toBeNull();
      expect(screen.getByText(/unavailable/i)).toBeTruthy();
    });

    it("still names the place when there is no reading", () => {
      // The place is a constant, not part of the response — losing the service
      // is no reason to stop saying where the card is about.
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
      // The whole point of the graphic is the transition between two skies,
      // and real weather changes far too rarely for a visitor to ever catch
      // one. So the card arrives by performing one: it starts empty and the
      // reading's own weather moves in.
      const { container } = render(<WeatherWidget reading={reading} />);
      expect(drawnSky(container)).toBe("Weather=Clear, Time=Night");
      frames.flush();
      expect(drawnSky(container)).toBe("Weather=Cloudy, Time=Night");
    });

    it("cuts to the resting sky rather than transitioning into it", () => {
      // The graphic transitions between any two skies, which is the whole
      // point of it — and it means the drop to the resting sky is itself a
      // 900ms animation. Left to run, the clouds get about 30ms of fading out
      // before the settle reverses them, so the card's "entry" is a pair of
      // layers twitching at full opacity and nothing else. The resting frame
      // has to arrive instantly for the settle to have somewhere to come from.
      const { container } = render(<WeatherWidget reading={reading} />);
      expect(
        container.querySelector("[data-entry]")?.getAttribute("data-entry"),
      ).toBe("resting");

      frames.flush();
      // And the suppression must be gone by the time the sky changes, or the
      // settle cuts too and there is no animation at all.
      expect(container.querySelector("[data-entry]")).toBeNull();
    });

    it("rests at the reading's OWN hour, so night never flashes a sun", () => {
      const { container } = render(
        <WeatherWidget reading={{ ...reading, condition: "rain" }} />,
      );
      expect(drawnSky(container)).toBe("Weather=Clear, Time=Night");
    });

    it("is skipped entirely when motion is not wanted", () => {
      // Not merely shortened — there is no resting frame at all, so the card
      // never shows a sky that is not the real one.
      prefersReducedMotion(true);
      const { container } = render(<WeatherWidget reading={reading} />);
      expect(drawnSky(container)).toBe("Weather=Cloudy, Time=Night");
    });

    it("draws the true sky before any of this, for a visitor running no JS", () => {
      // The entry is staged from a layout effect, so the markup React renders
      // — the markup the server sends — is already correct. A card whose
      // weather only becomes true once a bundle has executed is a card that
      // is wrong in the HTML.
      const html = renderToString(<WeatherWidget reading={reading} />);
      expect(html).toContain("Weather=Cloudy, Time=Night");
    });
  });
});

describe("when the service is down", () => {
  it("stops the drawing short of being a claim about the sky", () => {
    // The fallback sky is `clear`, and drawn at full strength that is a bright
    // sun — a card reading "weather unavailable" under a picture of a lovely
    // afternoon. The drawing has to visibly stand down with the numbers.
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
  // A hidden tab runs no `requestAnimationFrame` callbacks at all — a card
  // opened in a background tab, or restored with a session, gets none until
  // someone looks at it. Staging the entry on frames alone left the card
  // parked on the resting sky the whole time: a clear sky under the word
  // "cloudy", which is the one thing this card must never do.
  // ONLY the timers: Vitest's fake clock stands in for `requestAnimationFrame`
  // as well by default, which would hand the entry exactly the frames this
  // test exists to withhold.
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
