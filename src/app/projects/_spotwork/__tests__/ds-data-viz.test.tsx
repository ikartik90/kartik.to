import { cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DATA_VIZ_STORIES } from "../ds-data-viz";
import { renderStories } from "./story-harness";

afterEach(cleanup);

describe("the Data Viz page's examples", () => {
  it("shows each component by each of Figma's properties", () => {
    const { titles } = renderStories(DATA_VIZ_STORIES);
    expect(titles("Progress Bar")).toEqual(["Progress"]);
    expect(titles("Stacked Bar Chart")).toEqual(["Type", "Show max value", "Legend position"]);
    expect(titles("Bar Chart")).toEqual(["Show scale"]);
    expect(titles("Risk Matrix")).toEqual([]);
    expect(titles("Spider Chart")).toEqual(["Details"]);
    expect([...document.querySelectorAll("[data-ds-story]")].map((story) => story.getAttribute("aria-label"))).toEqual([
      "Progress Bar",
      "Stacked Bar Chart",
      "Bar Chart",
      "Spider Chart",
      "Risk Matrix",
    ]);
  });

  it("fills each Progress's bar to its shift's places filled, in its hue", () => {
    const { preview } = renderStories(DATA_VIZ_STORIES);
    const fills = [...preview("Progress Bar", "Progress").querySelectorAll<HTMLElement>("[data-tone]")].map(
      (track) => [track.dataset.tone, track.querySelector<HTMLElement>("span")!.style.width],
    );
    expect(fills.map(([tone]) => tone)).toEqual(["low", "mid", "high", "full"]);
    expect(preview("Progress Bar", "Progress").textContent).toBe("7/30Filled15/30Filled24/30Filled30/30Filled");
  });

  it("draws each chart's bar and its score with and without its max", () => {
    const { preview } = renderStories(DATA_VIZ_STORIES);
    expect(preview("Stacked Bar Chart", "Type").querySelectorAll("[data-segment]")).toHaveLength(8);
    expect(preview("Stacked Bar Chart", "Show max value").textContent?.match(/out of/g)).toHaveLength(1);
    expect(preview("Stacked Bar Chart", "Legend position").querySelectorAll("ul")).toHaveLength(2);
    // What it charts heads the card holding it, never the chart.
    expect(preview("Stacked Bar Chart").textContent).not.toContain("Spotscore");
    expect(preview("Stacked Bar Chart").querySelector("[data-card]")).toBeNull();
    expect(preview("Bar Chart", "Show scale").querySelectorAll("[data-scale]")).toHaveLength(1);
    // Its metric's value, what the six weeks came to, beside its bar.
    expect(preview("Bar Chart").textContent).toMatch(/^63,726\.73 CADSep 20–Oct 31/);
  });

  it("tips every bar of each Bar Chart with its week's dates and what was spent", () => {
    const { preview } = renderStories(DATA_VIZ_STORIES);
    const tips = (title?: string) =>
      [...preview("Bar Chart", title).querySelectorAll("[data-segment]")].map((bar) =>
        [...bar.querySelectorAll(":scope > [data-place=above] > span")].map((line) => line.textContent),
      );
    expect(tips()).toEqual([
      ["Sep 20–26", "10,472.36 CAD"],
      ["Sep 27–Oct 3", "12,016.42 CAD"],
      ["Oct 4–10", "11,248.17 CAD"],
      ["Oct 11–17", "12,016.85 CAD"],
      ["Oct 18–24", "9,640.29 CAD"],
      ["Oct 25–31", "8,332.64 CAD"],
    ]);
    expect(tips("Show scale").flat()).toHaveLength(24);
  });

  it("names each metric by its tooltip", () => {
    const { preview } = renderStories(DATA_VIZ_STORIES);
    expect(within(preview("Risk Matrix")).getAllByRole("button").map((metric) => metric.getAttribute("aria-label"))).toEqual([
      "Location Disabled",
      "Absent Last Shift",
      "Flagged Message",
      "New Worker",
    ]);
  });

  it("charts the worker's no-show risk, listing each factor's reading as the side sheet's header does", () => {
    const { preview } = renderStories(DATA_VIZ_STORIES);
    const risk = preview("Spider Chart");
    expect(within(risk).getByRole("img", { name: /^Brittany Pilz's risk factor: High\. New worker: High, / })).toBeTruthy();
    expect(within(risk).getAllByRole("listitem")).toHaveLength(6);
    const [card, sheet] = [...preview("Spider Chart", "Details").querySelectorAll("[data-cell]")];
    expect([card.querySelectorAll("li").length, sheet.querySelectorAll("li").length]).toEqual([0, 6]);
  });

  it("shows the side sheet's Risk factor card as the app draws it", () => {
    const { preview } = renderStories(DATA_VIZ_STORIES);
    const risk = preview("Spider Chart");
    expect(within(risk).getByRole("heading", { level: 3, name: "Risk factor" })).toBeTruthy();
    expect(within(risk).getByRole("checkbox", { name: "Acknowledge Risk" })).toBeTruthy();
  });

  it("writes each example as the code that draws it", () => {
    const { code } = renderStories(DATA_VIZ_STORIES);
    // A legend is its stacked bar chart's own.
    expect(code("Stacked Bar Chart")).toContain("        <StackedBarChart.Legend>\n          <StackedBarChart.LegendUnit>");
    expect(code("Stacked Bar Chart")).not.toMatch(/<Legend|import \{ Legend \}/);
    // A segment's label is its data; its tooltip is a Tooltip.
    expect(code("Bar Chart")).not.toMatch(/tooltip=|<BarChart type=/);
    expect(code("Bar Chart")).toMatch(
      /<BarChart\.Segment value=\{10472\.36\} label="39">\s*<Tooltip above>\s*<span>Sep 20–26<\/span>\s*<span>10,472\.36 CAD<\/span>\s*<\/Tooltip>\s*<\/BarChart\.Segment>/,
    );
    expect(code("Bar Chart")).toMatch(/<BarChart\.Metric>\s*<BarChart\.Value>[^]*<\/BarChart\.Value>\s*<BarChart\.Bar>\s*<BarChart\.Segment\b/);
    // Charts and metrics take their words as children, and their data as parts.
    for (const id of ["Stacked Bar Chart", "Spider Chart", "Risk Matrix"])
      expect(code(id)).not.toMatch(/ (label|unit|value|max|categories|readings)=/);
    expect(code("Stacked Bar Chart")).toContain("<StackedBarChart.Segment count={59} />");
    expect(code("Spider Chart")).toContain("<SpiderChart.Factor level={3}>");
    // A progress bar's places come from its shift.
    expect(code("Progress Bar")).toContain("<ProgressBar value={shift.filled} max={shift.total}>");
    expect(code("Progress Bar")).not.toContain("nn/");
  });
});
