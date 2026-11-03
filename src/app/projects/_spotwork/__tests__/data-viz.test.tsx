import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { BarChart, ProgressBar, StackedBarChart, progressTone, ticksOf } from "../data-viz";
import { Chip, Tooltip, Typography } from "../ui";

afterEach(cleanup);

const unit = (label: string, count?: number) => (
  <StackedBarChart.LegendUnit key={label}>
    <Typography variant="metadata">{label}</Typography>
    {count !== undefined && <Chip size="small" state="affirmative">{count}</Chip>}
  </StackedBarChart.LegendUnit>
);

const metric = (bar?: ReactNode, max = true) => (
  <StackedBarChart.Metric>
    <StackedBarChart.Value>
      <Typography variant="title">98</Typography>
      {max && <Typography variant="metadata">out of 100</Typography>}
    </StackedBarChart.Value>
    {bar}
  </StackedBarChart.Metric>
);

const hue = (n: number) => `var(--sw-glyph-data-viz-hue-${n})`;
const shade = (n: number) => `var(--sw-glyph-data-viz-shade-${n})`;
/** The colour a dot or segment is drawn in. */
const fillOf = (node: Element) => (node as HTMLElement).style.color || (node as HTMLElement).style.backgroundColor;

describe("a progress bar", () => {
  it("takes its hue from Figma's progress ranges", () => {
    expect([0, 0.3, 0.31, 0.6, 0.61, 0.85, 0.86, 1].map(progressTone)).toEqual([
      "low",
      "low",
      "mid",
      "mid",
      "high",
      "high",
      "full",
      "full",
    ]);
  });

  it("fills its bar to its progress, in its tone, under its count", () => {
    const { container } = render(
      <ProgressBar value={21} max={28} tone="high">
        <Typography variant="metadata">21/28</Typography>
        <Typography variant="metadata">Filled</Typography>
      </ProgressBar>,
    );
    expect(container.textContent).toBe("21/28Filled");
    const fill = container.querySelector<HTMLElement>("[data-tone=high] > span");
    expect(fill?.style.width).toBe("75%");
  });

  it("sets what's filled apart from what's left, as a stacked bar's segments are, with nothing to part when empty or full", () => {
    const { container } = render(
      <>
        <ProgressBar value={7} max={28} />
        <ProgressBar value={0} max={28} />
        <ProgressBar value={28} max={28} />
      </>,
    );
    const parts = [...container.querySelectorAll("[data-tone]")].map((track) =>
      [...track.children].map((part) => (part.hasAttribute("data-rest") ? "rest" : (part as HTMLElement).style.width)),
    );
    expect(parts).toEqual([["25%", "rest"], ["rest"], ["100%"]]);
  });

  it("takes its tone from its progress unless given one", () => {
    const { container } = render(
      <>
        <ProgressBar value={15} max={30} />
        <ProgressBar value={15} max={30} tone="active" />
      </>,
    );
    expect([...container.querySelectorAll("[data-tone]")].map((bar) => bar.getAttribute("data-tone"))).toEqual(["mid", "active"]);
  });

  it("stretches across what holds it with fill, never wider", () => {
    const { container } = render(<ProgressBar fill value={1} max={2} />);
    expect(container.firstElementChild!.className).not.toMatch(/min-w_/);
  });

  it("draws its bar alone without a count", () => {
    const { container } = render(<ProgressBar value={1} max={2} />);
    expect(container.textContent).toBe("");
    expect(container.firstElementChild!.children).toHaveLength(1);
  });
});

describe("a stacked bar chart", () => {
  it("draws its bar's segment for each category with a count, growing by its count, in its type's fill", () => {
    const { container } = render(
      <StackedBarChart type="monochrome">
        {metric(
          <StackedBarChart.Bar>
            <StackedBarChart.Segment count={3} />
            <StackedBarChart.Segment count={0} />
            <StackedBarChart.Segment count={1} />
          </StackedBarChart.Bar>,
        )}
      </StackedBarChart>,
    );
    const segments = [...container.querySelectorAll<HTMLElement>("[data-segment]")];
    expect(segments.map((segment) => segment.style.flexGrow)).toEqual(["3", "1"]);
    expect(segments.map(fillOf)).toEqual([shade(1), shade(3)]);
  });

  it("reads its metric's value out of its maximum, and alone without one", () => {
    const { container, rerender } = render(<StackedBarChart type="status">{metric()}</StackedBarChart>);
    expect(container.textContent).toBe("98out of 100");
    rerender(<StackedBarChart type="status">{metric(null, false)}</StackedBarChart>);
    expect(container.textContent).toBe("98");
  });

  it("lists its legend's units in order, each with its count, dotted in its type's fill for its place", () => {
    const legend = (
      <StackedBarChart.Legend>
        {unit("On Time", 59)}
        {unit("Late", 27)}
        {unit("Absent")}
      </StackedBarChart.Legend>
    );
    const { container, rerender } = render(<StackedBarChart type="status">{legend}</StackedBarChart>);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["On Time59", "Late27", "Absent"]);
    const dots = () => [...container.querySelectorAll("li > span[aria-hidden]")].map(fillOf);
    expect(dots()).toEqual([hue(1), hue(2), hue(3)]);
    rerender(<StackedBarChart type="monochrome">{legend}</StackedBarChart>);
    expect(dots()).toEqual([shade(1), shade(2), shade(3)]);
  });
});

describe("a bar chart", () => {
  const segment = (value: number, i: number, subdued?: boolean) => (
    <BarChart.Segment key={i} value={value} label={`W${i + 1}`} subdued={subdued}>
      <Tooltip above>
        <span>{`Week ${i + 1}`}</span>
        <span>{`${value}`}</span>
      </Tooltip>
    </BarChart.Segment>
  );
  const chart = (values: number[]) =>
    render(
      <BarChart>
        <BarChart.Bar>{values.map((value, i) => segment(value, i))}</BarChart.Bar>
      </BarChart>,
    );
  const segments = () => [...document.querySelectorAll<HTMLElement>("[data-segment]")];

  it("holds its metric's value, then its bar, as a stacked bar chart does", () => {
    const { container } = render(
      <BarChart>
        <BarChart.Metric>
          <BarChart.Value>
            <Typography variant="title">63,726</Typography>
            <Typography variant="metadata">Sep 20–Oct 31</Typography>
          </BarChart.Value>
          <BarChart.Bar>{[4, 2].map((value, i) => segment(value, i))}</BarChart.Bar>
        </BarChart.Metric>
      </BarChart>,
    );
    const [value, bar] = container.firstElementChild!.children;
    expect(value.textContent).toBe("63,726Sep 20–Oct 31");
    expect(bar.querySelectorAll("[data-segment]")).toHaveLength(2);
  });

  it("draws each segment as tall as its share of the tallest, over its label, in Shade 3, having one series and so no type", () => {
    chart([50, 100, 25]);
    expect(segments().map((bar) => bar.style.height)).toEqual(["50%", "100%", "25%"]);
    expect(screen.getAllByRole("listitem").map((bar) => bar.querySelector(":scope > [data-typography]")?.textContent)).toEqual(["W1", "W2", "W3"]);
    expect(segments().map(fillOf)).toEqual([shade(3), shade(3), shade(3)]);
  });

  it("draws a subdued segment in Shade 5", () => {
    render(
      <BarChart>
        <BarChart.Bar>
          {segment(4, 0)}
          {segment(2, 1, true)}
        </BarChart.Bar>
      </BarChart>,
    );
    expect(segments().map(fillOf)).toEqual([shade(3), shade(5)]);
  });

  const week39 = (
    <BarChart.Bar>
      <BarChart.Segment value={4} label="39">
        <Tooltip above>
          <span>Sep 20–26</span>
          <span>12,016.42 CAD</span>
        </Tooltip>
      </BarChart.Segment>
    </BarChart.Bar>
  );

  it("writes its label itself, as a metadata line, never taking it as a child", () => {
    render(<BarChart>{week39}</BarChart>);
    const label = screen.getByRole("listitem").querySelector(":scope > [data-typography]")!;
    expect([label.textContent, label.getAttribute("data-typography")]).toEqual(["39", "metadata"]);
  });

  it("hangs its Tooltip child from its bar, above it, while the pointer rests on its column", () => {
    render(<BarChart>{week39}</BarChart>);
    const tip = segments()[0].querySelector(":scope > [data-place=above]")!;
    expect([...tip.querySelectorAll(":scope > span")].map((line) => line.textContent)).toEqual(["Sep 20–26", "12,016.42 CAD"]);
    expect(screen.getByRole("listitem").hasAttribute("data-tip")).toBe(true);
    expect(segments()[0].hasAttribute("data-tip-anchor")).toBe(true);
  });

  it("reads each segment's label, then its tooltip's lines, to a screen reader", () => {
    render(
      <BarChart scale unit="Week">
        {week39}
      </BarChart>,
    );
    /** The words a screen reader reaches under `node`, past anything hidden from it. */
    const spoken = (node: Node): string[] =>
      node instanceof Element && node.getAttribute("aria-hidden") === "true"
        ? []
        : node.nodeType === Node.TEXT_NODE
          ? [node.textContent!]
          : [...node.childNodes].flatMap(spoken);
    expect(spoken(screen.getByRole("listitem"))).toEqual(["39", "Sep 20–26", "12,016.42 CAD"]);
  });

  it("draws no segment where nothing's been spent", () => {
    chart([0, 0]);
    expect(segments().map((bar) => bar.style.height)).toEqual(["0%", "0%"]);
  });

  it("rounds its scale up to at most three equal steps of 1, 2, 2.5 or 5 times a power of ten", () => {
    expect(ticksOf(12016)).toEqual([0, 5000, 10000, 15000]);
    expect(ticksOf(10000)).toEqual([0, 5000, 10000]);
    expect(ticksOf(700)).toEqual([0, 250, 500, 750]);
    expect(ticksOf(0)).toEqual([0]);
  });

  it("with a scale, writes its amounts but 0 beside its bar, top first and short, each on a dashed line across it, its unit under them, and draws each segment against the top one", () => {
    render(
      <BarChart scale unit="Week">
        <BarChart.Bar>
          {segment(12016, 0)}
          {segment(8332, 1)}
        </BarChart.Bar>
      </BarChart>,
    );
    expect(document.querySelector("[data-scale]")?.textContent).toBe("15k10k5kWeek");
    expect(document.querySelectorAll("[data-axis]")).toHaveLength(0);
    expect([...document.querySelectorAll<HTMLElement>("[data-gridline]")].map((line) => line.style.bottom)).toEqual([
      "100%",
      `${(10000 / 15000) * 100}%`,
      `${(5000 / 15000) * 100}%`,
    ]);
    expect(segments().map((bar) => bar.style.height)).toEqual([`${(12016 / 15000) * 100}%`, `${(8332 / 15000) * 100}%`]);
  });
});
