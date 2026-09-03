import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { WeatherGraphic } from "../weather-graphic";
import { WEATHER_CONDITIONS } from "@/domain/weather";

// Every layer in the kit, by the `data-layer` it is tagged with.
const LAYERS = [
  "plasma",
  "halo",
  "sun",
  "moon",
  "cloud-big",
  "cloud-small",
  "rain",
  "snow",
  "bolt",
];

describe("WeatherGraphic", () => {
  // Vitest runs without globals here, so RTL never registers its own.
  afterEach(cleanup);

  it("keeps every layer mounted in every condition", () => {
    // The whole transition model rests on this: a condition change moves and
    // fades layers that are ALREADY on screen. The moment one of them is
    // conditionally rendered instead, clear → rain becomes a cut.
    for (const condition of WEATHER_CONDITIONS) {
      const { container, unmount } = render(
        <WeatherGraphic condition={condition} />,
      );
      for (const layer of LAYERS) {
        expect(
          container.querySelector(`[data-layer="${layer}"]`),
          `${condition} is missing the ${layer} layer`,
        ).not.toBeNull();
      }
      unmount();
    }
  });

  it("names the Figma variant it is drawing", () => {
    const { container } = render(
      <WeatherGraphic condition="fog" time="night" />,
    );
    expect(container.firstElementChild?.getAttribute("data-variant")).toBe(
      "Weather=Fog, Time=Night",
    );
  });

  it("keeps tracking the time of day under an overcast sky", () => {
    // Rain has one Figma variant for both halves of the day, but the body
    // behind the cloud still has to be the moon so that rain → clear at night
    // does not reveal a sun.
    const { container } = render(
      <WeatherGraphic condition="rain" time="night" />,
    );
    const svg = container.firstElementChild as SVGSVGElement;
    expect(svg.getAttribute("data-variant")).toBe("Weather=Rain, Time=Anytime");
    // The night fills are still selected underneath the overcast.
    expect(svg.getAttribute("class")).toContain("time_night");
  });

  it("is announced by its condition alone", () => {
    // Not "Clear night" — see weatherLabel. The hour stays available on
    // `data-variant` for anyone tracing a drawing back to its Figma cell.
    const { container } = render(
      <WeatherGraphic condition="clear" time="night" />,
    );
    expect(screen.getByRole("img", { name: "Clear" })).toBeTruthy();
    expect(container.firstElementChild?.getAttribute("data-variant")).toBe(
      "Weather=Clear, Time=Night",
    );
  });

  it("takes an explicit label over the derived one", () => {
    render(<WeatherGraphic condition="snow" label="Snowing in Toronto" />);
    expect(
      screen.getByRole("img", { name: "Snowing in Toronto" }),
    ).toBeTruthy();
  });

  it("goes decorative when the label is dropped", () => {
    const { container } = render(
      <WeatherGraphic condition="snow" label={null} />,
    );
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("gives each instance its own gradient and clip ids", () => {
    // Two graphics on one page — the demo grid renders eleven. Shared ids
    // would make every clip path resolve to the FIRST instance's, so ten
    // clouds would be frosting a sun that is somewhere else entirely.
    const { container } = render(
      <>
        <WeatherGraphic condition="cloudy" />
        <WeatherGraphic condition="fog" />
      </>,
    );
    const ids = [...container.querySelectorAll("[id]")].map((n) => n.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points every url() reference at an id that exists in the same instance", () => {
    // A namespaced id is only half the job: the references have to be
    // namespaced with it. A stale `url(#cloud-mask)` fails silently — SVG
    // renders the element unmasked rather than erroring.
    const { container } = render(<WeatherGraphic condition="thundershower" />);
    const svg = container.firstElementChild as SVGSVGElement;
    const ids = new Set([...svg.querySelectorAll("[id]")].map((n) => n.id));

    const referenced: string[] = [];
    for (const node of svg.querySelectorAll("*")) {
      for (const attr of node.attributes) {
        for (const [, id] of attr.value.matchAll(/url\(#([^)]+)\)/g)) {
          referenced.push(id);
        }
      }
    }

    expect(referenced.length).toBeGreaterThan(0);
    for (const id of referenced) {
      expect(ids, `url(#${id}) has no target`).toContain(id);
    }
  });
});
