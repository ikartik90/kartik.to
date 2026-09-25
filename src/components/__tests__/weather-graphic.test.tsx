import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { WeatherGraphic } from "../weather-graphic";
import { WEATHER_CONDITIONS } from "@/domain/weather";

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
    const { container } = render(
      <WeatherGraphic condition="rain" time="night" />,
    );
    const svg = container.firstElementChild as SVGSVGElement;
    expect(svg.getAttribute("data-variant")).toBe("Weather=Rain, Time=Anytime");
    expect(svg.getAttribute("class")).toContain("time_night");
  });

  it("is announced by its condition alone", () => {
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
