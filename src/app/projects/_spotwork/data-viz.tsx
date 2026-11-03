"use client";

import { Children, createContext, isValidElement, useContext, type ReactNode } from "react";
import { css } from "../../../../styled-system/css";
import { Typography } from "./ui";

// SW Curie's Data Viz components (Figma page 1643:1436).

export type ChartType = "status" | "monochrome";

/** Each chart type's fills, in its categories' order: Glyph/Data Viz/Hue/1–5 or Shade/1–5. */
const FILLS: Record<ChartType, string[]> = {
  status: [1, 2, 3, 4, 5].map((step) => `var(--sw-glyph-data-viz-hue-${step})`),
  monochrome: [1, 2, 3, 4, 5].map((step) => `var(--sw-glyph-data-viz-shade-${step})`),
};

/** A chart's type, which the bar and legend in it draw in. */
const ChartContext = createContext<ChartType>("status");

/** A part's type and its place among its siblings, which pick its fill. */
const PlaceContext = createContext({ type: "status" as ChartType, place: 0 });

/** `children`, each told its place and `type`. */
const placed = (type: ChartType, children: ReactNode) =>
  Children.toArray(children).map((child, place) => (
    <PlaceContext key={isValidElement(child) ? child.key : place} value={{ type, place }}>
      {child}
    </PlaceContext>
  ));

export type ProgressTone = "full" | "high" | "mid" | "low";

/** Atoms/Progress Bar's Progress for `progress` (0–1): 0–30% low, 31-60% mid, 61–85% high, 86–100% full. */
export function progressTone(progress: number): ProgressTone {
  const percent = Math.round(progress * 100);
  return percent <= 30 ? "low" : percent <= 60 ? "mid" : percent <= 85 ? "high" : "full";
}

const progressStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xs)",
  width: "7.5rem",
  "&[data-fill]": { width: "100%" },
});

const progressCountStyle = css({ display: "flex", gap: "var(--sw-gap-xs)" });

// What's filled, then what's left, a stacked bar's gap between them.
const progressTrackStyle = css({
  display: "flex",
  gap: "var(--sw-gap-3xs)",
  height: "0.25rem",
  overflow: "hidden",
  borderRadius: "var(--sw-radius-full)",
  "& > :not([data-rest])": {
    flexShrink: 0,
    backgroundColor: "var(--sw-glyph-data-viz-progress-2)",
    transition: "width 400ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  "&[data-tone=full] > :not([data-rest])": { backgroundColor: "var(--sw-glyph-data-viz-progress-1)" },
  "&[data-tone=high] > :not([data-rest])": { backgroundColor: "var(--sw-glyph-data-viz-progress-2)" },
  "&[data-tone=mid] > :not([data-rest])": { backgroundColor: "var(--sw-glyph-data-viz-progress-3)" },
  "&[data-tone=low] > :not([data-rest])": { backgroundColor: "var(--sw-glyph-data-viz-progress-4)" },
  // A row can set `--progress-track` to Track/Active while it's pointed at.
  "& > [data-rest]": { flex: 1, minWidth: 0, backgroundColor: "var(--progress-track, var(--sw-surface-data-viz-track-default))" },
  // Loading, a gray track of no progress.
  "[aria-busy=true] &": {
    "& > :not([data-rest])": { display: "none" },
    "& > [data-rest]": { backgroundColor: "var(--sw-surface-disabled)" },
  },
});

/**
 * Atoms/Progress Bar: its count and unit, if any (each a `Typography`), over a bar filled to `value` of `max`, in the
 * hue of its Progress (`progressTone`) unless given a `tone`, `active` being Progress/2. With `fill`, as wide as its
 * parent.
 */
export function ProgressBar({
  value,
  max,
  tone,
  fill,
  children,
}: {
  value: number;
  max: number;
  tone?: ProgressTone | "active";
  fill?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={progressStyle} data-fill={fill ? "" : undefined} data-progress="">
      {children && <div className={progressCountStyle}>{children}</div>}
      <span className={progressTrackStyle} data-tone={tone ?? progressTone(value / max)}>
        {value > 0 && <span style={{ width: `${(value / max) * 100}%` }} />}
        {value < max && <span data-rest="" />}
      </span>
    </div>
  );
}

// A legend unit's 8px dot in a 16px cell, in the colour set on it.
const dotStyle = css({
  position: "relative",
  display: "block",
  flexShrink: 0,
  padding: "var(--sw-padding-xxs)",
  "&::before": {
    content: '""',
    display: "block",
    width: "0.5rem",
    height: "0.5rem",
    borderRadius: "var(--sw-radius-full)",
    backgroundColor: "currentColor",
  },
});

const legendStyle = css({ display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: "var(--sw-gap-xs) var(--sw-gap-xl)" });

const legendItemStyle = css({ display: "flex", alignItems: "center", gap: "var(--sw-gap-xxs)" });

// A unit's label, then its count in a small `Chip`'s look.
const legendUnitStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "var(--sw-gap-xs)",
  whiteSpace: "nowrap",
  "& > [data-tone]": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "1rem",
    minWidth: "1.25rem",
    overflow: "hidden",
  },
});

/** The chart's legend: its units, each dotted in the chart's type's fill for its place. */
function Legend({ children }: { children: ReactNode }) {
  const type = useContext(ChartContext);
  return <ul className={legendStyle}>{placed(type, children)}</ul>;
}

/** A legend's unit: a category's label (a `Typography`), and its count (a small `Chip`) when it has one. */
function LegendUnit({ children }: { children: ReactNode }) {
  const { type, place } = useContext(PlaceContext);
  return (
    <li className={legendItemStyle}>
      <span className={dotStyle} style={{ color: FILLS[type][place] }} aria-hidden />
      <span className={legendUnitStyle}>{children}</span>
    </li>
  );
}

const valueStyle = css({ display: "flex", alignItems: "baseline", gap: "var(--sw-gap-xxs)", whiteSpace: "nowrap" });

const chartStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-sm)",
  // Its legend listed down beside its metric, the last unit level with the bar.
  "&[data-legend=beside]": {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "end",
    gap: "var(--sw-gap-xl)",
    "& > ul": { display: "grid" },
  },
});

const metricRaw = css.raw({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-xs)" });

const metricStyle = css(metricRaw);

const barStyle = css({
  display: "flex",
  gap: "var(--sw-gap-3xs)",
  height: "0.25rem",
  overflow: "hidden",
  borderRadius: "var(--sw-radius-full)",
  "& > span": { flexBasis: 0, minWidth: 0 },
});

// As tall as a `metadata` line, the bar centred in it, so a line of words beside it lines up.
const barLineStyle = css({ display: "flex", flexDirection: "column", justifyContent: "center", height: "1.25rem" });

/**
 * Atoms/Data Viz/Stacked Bar Chart: its metric, then its `Legend` of its categories, both in `type`'s fills; the legend
 * below the metric or, listed down, `beside` it. What it charts heads the card holding it.
 */
function StackedBarChartRoot({
  type,
  legend = "below",
  children,
}: {
  type: ChartType;
  legend?: "below" | "beside";
  children: ReactNode;
}) {
  return (
    <ChartContext value={type}>
      <div className={chartStyle} data-legend={legend}>
        {children}
      </div>
    </ChartContext>
  );
}

/** The chart's metric: its `Value`, then its bar. */
function Metric({ children }: { children: ReactNode }) {
  return <div className={metricStyle}>{children}</div>;
}

/** The metric's value, then "out of" its maximum when it has one, each a `Typography`. */
function Value({ children }: { children: ReactNode }) {
  return <div className={valueStyle}>{children}</div>;
}

/** The chart's bar, shared among its segments by count, in a `metadata` line's height. */
function Bar({ children }: { children: ReactNode }) {
  const type = useContext(ChartContext);
  return (
    <div className={barLineStyle} aria-hidden>
      <div className={barStyle}>{placed(type, children)}</div>
    </div>
  );
}

/** A category's share of the bar, in its type's fill for its place; none without a count. */
function Segment({ count }: { count: number }) {
  const { type, place } = useContext(PlaceContext);
  return count > 0 ? <span data-segment="" style={{ flexGrow: count, backgroundColor: FILLS[type][place] }} /> : null;
}

StackedBarChartRoot.displayName = "StackedBarChart";
Metric.displayName = "StackedBarChart.Metric";
Value.displayName = "StackedBarChart.Value";
Bar.displayName = "StackedBarChart.Bar";
Segment.displayName = "StackedBarChart.Segment";
Legend.displayName = "StackedBarChart.Legend";
LegendUnit.displayName = "StackedBarChart.LegendUnit";

export const StackedBarChart = Object.assign(StackedBarChartRoot, { Metric, Value, Bar, Segment, Legend, LegendUnit });

/** With `scale`, the `unit` a bar chart's scale counts in. */
const BarChartContext = createContext<{ scale?: boolean; unit?: string }>({});

/** What a bar's segments are drawn against: its tallest, or its scale's top. */
const BarContext = createContext({ max: 0 });

// Its value beside its bar, their feet level.
const barMetricStyle = css({ display: "flex", alignItems: "flex-end", gap: "var(--sw-gap-xs)" });

// As wide as the widest amount under 100,000.
const barValueStyle = css(metricRaw, { flexShrink: 0, width: "9.75rem", whiteSpace: "nowrap" });

// At least as tall as its scale: three amounts, 0's line and its unit, a `metadata` line each, the unit's overlapping
// 0's but for a gap.
const barChartStyle = css({ display: "flex", flex: 1, gap: "var(--sw-gap-xs)", minWidth: 0, minHeight: "5.75rem" });

const plotStyle = css({
  position: "relative",
  display: "flex",
  flex: 1,
  minWidth: 0,
  // Scaled, half a `metadata` line clear at its top, so its top amount's line stays inside it.
  "[data-scaled] > &": { paddingBlockStart: "0.625rem" },
});

const barsStyle = css({ display: "flex", flex: 1, gap: "var(--sw-gap-xxs)", minWidth: 0 });

// The amounts' dashed lines, behind the bars in the room they stand in.
const gridStyle = css({
  position: "absolute",
  insetInline: 0,
  top: "0.625rem",
  bottom: "calc(1.25rem + var(--sw-gap-xxs))",
  "& > span": {
    position: "absolute",
    insetInline: 0,
    translate: "0 50%",
    borderBlockStart: "1px dashed var(--sw-border-subdued)",
  },
});

// Its amounts, then its unit on the bars' labels' line, right-aligned in a fixed column.
const scaleStyle = css({ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, width: "2.25rem" });

// The amounts, centred on their heights: from half a `metadata` line above the bars' top to half a line below their
// foot, which their unit's line, a gap below the foot, overlaps. 0 goes unwritten, its line kept.
const ticksStyle = css({
  display: "flex",
  flex: 1,
  flexDirection: "column",
  justifyContent: "space-between",
  alignItems: "flex-end",
  marginBlockEnd: "calc(var(--sw-gap-xxs) - 0.625rem)",
  "& > :empty": { height: "1.25rem" },
});

const columnStyle = css({ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", gap: "var(--sw-gap-xxs)", minWidth: 0 });

// The room above a bar's label, the bar standing at its foot.
const columnTrackStyle = css({
  position: "relative",
  flex: 1,
  alignSelf: "stretch",
  "& > span": {
    position: "absolute",
    insetInline: 0,
    bottom: 0,
    borderStartStartRadius: "var(--sw-radius-xxs)",
    borderStartEndRadius: "var(--sw-radius-xxs)",
  },
});

const spokenStyle = css({ srOnly: true });

/** Round amounts from 0 past `max`, in at most three equal steps of 1, 2, 2.5 or 5 times a power of ten. */
export function ticksOf(max: number): number[] {
  if (max <= 0) return [0];
  const power = 10 ** Math.floor(Math.log10(max / 3));
  const step = power * ([1, 2, 2.5, 5, 10].find((nice) => nice * power >= max / 3) ?? 10);
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact" });

/**
 * Atoms/Data Viz/Bar Chart: its metric, its bar in Shade 3, against a scale counted in `unit` with `scale`. It charts
 * one series, so it has no type. What it charts heads the card holding it.
 */
function BarChartRoot({ scale, unit, children }: { scale?: boolean; unit?: string; children: ReactNode }) {
  return <BarChartContext value={{ scale, unit }}>{children}</BarChartContext>;
}

/** The chart's metric: its `Value`, then its bar beside it. */
function BarChartMetric({ children }: { children: ReactNode }) {
  return <div className={barMetricStyle}>{children}</div>;
}

/** The metric's value, then what it covers, each a `Typography`. */
function BarChartValue({ children }: { children: ReactNode }) {
  return <div className={barValueStyle}>{children}</div>;
}

/**
 * The chart's bar: its segments abreast, each as tall as its share of the tallest. With the chart's scale, against
 * `ticksOf` the tallest, written short beside them but 0, each on a dashed line across them, over the unit their labels
 * count in.
 */
function BarChartBar({ children }: { children: ReactNode }) {
  const { scale, unit } = useContext(BarChartContext);
  const values = Children.toArray(children).map((child) => (isValidElement<{ value: number }>(child) ? child.props.value : 0));
  const ticks = ticksOf(Math.max(0, ...values));
  return (
    <BarContext value={{ max: scale ? ticks.at(-1)! : Math.max(0, ...values) }}>
      <div className={barChartStyle} data-scaled={scale ? "" : undefined}>
        {scale && (
          <div className={scaleStyle} data-scale="" aria-hidden>
            <div className={ticksStyle}>
              {ticks.toReversed().map((tick) =>
                tick ? (
                  <Typography key={tick} variant="metadata" color="subdued">
                    {compact.format(tick).toLowerCase()}
                  </Typography>
                ) : (
                  <span key={tick} />
                ),
              )}
            </div>
            <Typography variant="metadata" color="subdued">
              {unit}
            </Typography>
          </div>
        )}
        <div className={plotStyle}>
          {scale && (
            <div className={gridStyle} aria-hidden>
              {ticks
                .slice(1)
                .toReversed()
                .map((tick) => (
                  <span key={tick} data-gridline="" style={{ bottom: `${(tick / ticks.at(-1)!) * 100}%` }} />
                ))}
            </div>
          )}
          <ul className={barsStyle}>{children}</ul>
        </div>
      </div>
    </BarContext>
  );
}

/** The words under `node`. */
const textOf = (node: ReactNode): string =>
  typeof node === "string" || typeof node === "number"
    ? `${node}`
    : isValidElement<{ children?: ReactNode }>(node)
      ? Children.toArray(node.props.children).map(textOf).join("")
      : "";

/**
 * A segment of `value`, over its `label`; `subdued`, in Shade 5. Its `Tooltip` child, its lines saying what it stands
 * for and its value, hangs from it while the pointer rests on its column.
 */
function BarChartSegment({
  value,
  label,
  subdued,
  children,
}: {
  value: number;
  label: string;
  subdued?: boolean;
  children: ReactNode;
}) {
  const { max } = useContext(BarContext);
  const lines = Children.toArray(children).flatMap((tip) =>
    isValidElement<{ children?: ReactNode }>(tip) ? Children.toArray(tip.props.children).map(textOf) : [],
  );
  return (
    <li className={columnStyle} data-tip="">
      <span className={columnTrackStyle} aria-hidden>
        <span
          data-segment=""
          data-tip-anchor=""
          style={{
            height: `${max ? (value / max) * 100 : 0}%`,
            backgroundColor: FILLS.monochrome[subdued ? 4 : 2],
          }}
        >
          {children}
        </span>
      </span>
      <Typography variant="metadata" color="subdued">
        {label}
      </Typography>
      {/* The tooltip is hidden from screen readers, so its lines are read after the label. */}
      {lines.map((line) => (
        <Typography key={line} variant="metadata" className={spokenStyle}>
          {line}
        </Typography>
      ))}
    </li>
  );
}

BarChartRoot.displayName = "BarChart";
BarChartMetric.displayName = "BarChart.Metric";
BarChartValue.displayName = "BarChart.Value";
BarChartBar.displayName = "BarChart.Bar";
BarChartSegment.displayName = "BarChart.Segment";

export const BarChart = Object.assign(BarChartRoot, {
  Metric: BarChartMetric,
  Value: BarChartValue,
  Bar: BarChartBar,
  Segment: BarChartSegment,
});
