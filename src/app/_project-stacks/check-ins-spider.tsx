"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { css, cx } from "../../../styled-system/css";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import CalendarIcon from "@/assets/icons/calendar.svg";
import CheckCircleIcon from "@/assets/icons/check-circle.svg";
import ClockIcon from "@/assets/icons/clock.svg";
import ExclamationIcon from "@/assets/icons/exclamation-mark.svg";
import FirewallIcon from "@/assets/icons/firewall.svg";
import MapPinIcon from "@/assets/icons/map-pin.svg";
import NewbornIcon from "@/assets/icons/newborn.svg";
import WarningMessageIcon from "@/assets/icons/warning-message.svg";
import { headEndStyle, Pill, ring, whoStyle, type Icon } from "./check-ins-wireframes";
import { eyebrowStyle } from "./diagram-parts";
import { Split } from "./gap-split";
import { paneStyle, toggleStyle } from "./onboarding-wireframes";
import { Head } from "./sheet-article";

// A worker's no-show risk on a spider chart, a spoke per risk factor, each none, low, medium or high, beside the
// worker's risk signals card. A marker and its factor's row light each other.

export type Level = 0 | 1 | 2 | 3;
type Readings = Record<string, { level: Level; text: string }>;
export interface SpiderData {
  title: string;
  levels: [string, string, string, string];
  factors: { id: string; label: string }[];
  workers: { key: string; first: string; name: string; shift: string; readings: Readings }[];
}

const R = 150;
const N_LEVELS = 3;
/** None at the centre, then low, medium and high a third of the way out each. */
export const radius = (level: number) => (R * level) / N_LEVELS;
// A marker's hit area, 24 across. The markers at none share the centre, and its one hit area.
const HIT = 12;
/** Whether `id` is lit: `hot` is one factor, or every factor at none, space-separated, when the centre is pointed at. */
export const isHot = (hot: string | null | undefined, id: string) => !!hot && hot.split(" ").includes(id);
const MOVE_MS = 600;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

const angle = (i: number, n: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
const at = (i: number, n: number, r: number) => [r * Math.cos(angle(i, n)), r * Math.sin(angle(i, n))] as const;
const ringPoints = (n: number, r: number) =>
  Array.from({ length: n }, (_, i) => at(i, n, r).map((v) => v.toFixed(2)).join(",")).join(" ");
const percent = (x: number, y: number): CSSProperties => ({ left: `${50 + (x / (2 * R)) * 100}%`, top: `${50 + (y / (2 * R)) * 100}%` });

/** Where a spoke's label sits, just past its end, and which way it reads from there. */
function labelPlace(i: number, n: number): CSSProperties {
  const [x, y] = at(i, n, R + 16);
  const cos = Math.cos(angle(i, n));
  const sin = Math.sin(angle(i, n));
  const place = percent(x, y);
  if (cos > 0.2) return { ...place, translate: "0 -50%", textAlign: "start" };
  if (cos < -0.2) return { ...place, translate: "-100% -50%", textAlign: "end" };
  return { ...place, translate: sin < 0 ? "-50% -100%" : "-50% 0", textAlign: "center", maxWidth: "none" };
}

/** The levels shown, easing from wherever they are to `target` whenever it changes. */
function useEased(target: number[]) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const key = target.join();
  useEffect(() => {
    const start = from.current;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = still ? 1 : Math.min(1, (now - t0) / MOVE_MS);
      const next = target.map((v, i) => start[i] + (v - start[i]) * ease(t));
      from.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return shown;
}

/** The overall risk, 1 low to 3 high: the share of the most a worker could score, in thirds. */
export function overall(levels: number[]) {
  const share = levels.reduce((a, b) => a + b, 0) / (levels.length * N_LEVELS);
  return (share >= 0.6 ? 3 : share >= 0.3 ? 2 : 1) as 1 | 2 | 3;
}
const levelsOf = (factors: SpiderData["factors"], readings: Readings) => factors.map((f) => readings[f.id].level);

function OverallPill({ risk, levels }: { risk: 1 | 2 | 3; levels: SpiderData["levels"] }) {
  return (
    <Pill icon={risk === 1 ? CheckCircleIcon : ExclamationIcon} tone={risk === 3 ? "solid" : risk === 1 ? "waiting" : undefined}>
      {levels[risk]}
    </Pill>
  );
}

// ——— The plot ———

// The square, with room round it for the spokes' labels.
const chartStyle = css({
  "--ink": "token(colors.text.default)",
  "--side": "calc(token(spacing.5xl) + token(spacing.4xl))",
  position: "relative",
  paddingInline: "var(--side)",
  paddingBlock: "4xl",
  mdDown: { "--side": "token(spacing.5xl)" },
});
const squareStyle = css({
  position: "relative",
  aspectRatio: "1",
  "& > svg": { display: "block", width: "token(spacing.full)", height: "token(spacing.full)", overflow: "visible" },
});
const ringStyle = css({ fill: "none", stroke: "color-mix(in srgb, var(--ink) 20%, transparent)", strokeWidth: 1 });
const spokeStyle = css({ stroke: "color-mix(in srgb, var(--ink) 35%, var(--sheet-ground, token(colors.bg.surface)))", strokeWidth: 1 });
const shapeStyle = css({ fill: "bg.highlight", stroke: "text.highlight", strokeWidth: 2, strokeLinejoin: "round" });
// Ringed in the sheet's ground, so it stands off the line.
const pointStyle = css({
  fill: "text.highlight",
  stroke: "var(--sheet-ground, token(colors.bg.surface))",
  strokeWidth: 2,
  transformBox: "fill-box",
  transformOrigin: "center",
  transition: "scale 200ms ease",
  "&[data-hot]": { scale: "1.5" },
});
const hitStyle = css({ fill: "transparent" });
const labelStyle = css({
  position: "absolute",
  width: "max-content",
  maxWidth: "calc(var(--side) - token(spacing.sm))",
  textStyle: "caption",
  color: "text.body",
  transition: "color 300ms ease",
  "&[data-hot]": { color: "text.highlight" },
});

function SpiderPlot({
  data,
  levels,
  label,
  hot,
  onHot,
}: {
  data: SpiderData;
  levels: number[];
  label: string;
  hot: string | null;
  onHot: (id: string | null) => void;
}) {
  const { factors } = data;
  const n = factors.length;
  const markers = levels.map((v, i) => at(i, n, radius(v)));
  const atCentre = factors.filter((_, i) => levels[i] === 0).map((f) => f.id);
  return (
    <div className={chartStyle} role="img" aria-label={label}>
      <div className={squareStyle}>
        <svg viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`} aria-hidden>
          {Array.from({ length: N_LEVELS }, (_, l) => (
            <polygon key={l} className={ringStyle} points={ringPoints(n, radius(l + 1))} vectorEffect="non-scaling-stroke" />
          ))}
          {factors.map(({ id }, i) => {
            const [x, y] = at(i, n, R);
            return <line key={id} className={spokeStyle} x1={0} y1={0} x2={x} y2={y} vectorEffect="non-scaling-stroke" />;
          })}
          <polygon
            className={shapeStyle}
            points={markers.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}
            vectorEffect="non-scaling-stroke"
          />
          {markers.map(([x, y], i) =>
            atCentre.includes(factors[i].id) ? null : (
              <circle
                key={factors[i].id}
                className={pointStyle}
                data-hot={isHot(hot, factors[i].id) ? "" : undefined}
                cx={x}
                cy={y}
                r={4}
                vectorEffect="non-scaling-stroke"
              />
            ),
          )}
          {/* The factors at none share one marker, lit when any of them is. */}
          {atCentre.length > 0 && (
            <circle
              className={pointStyle}
              data-hot={atCentre.some((id) => isHot(hot, id)) ? "" : undefined}
              cx={0}
              cy={0}
              r={4}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {markers.map(([x, y], i) =>
            atCentre.includes(factors[i].id) ? null : (
              <circle
                key={factors[i].id}
                className={hitStyle}
                cx={x}
                cy={y}
                r={HIT}
                onPointerEnter={() => onHot(factors[i].id)}
                onPointerLeave={() => onHot(null)}
              />
            ),
          )}
          {atCentre.length > 0 && (
            <circle
              className={hitStyle}
              cx={0}
              cy={0}
              r={HIT}
              onPointerEnter={() => onHot(atCentre.join(" "))}
              onPointerLeave={() => onHot(null)}
            />
          )}
        </svg>
        {factors.map(({ id, label: name }, i) => (
          <span
            key={id}
            className={labelStyle}
            data-hot={isHot(hot, id) ? "" : undefined}
            style={labelPlace(i, n)}
            onPointerEnter={() => onHot(id)}
            onPointerLeave={() => onHot(null)}
            aria-hidden
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

const describe = (data: SpiderData, name: string, readings: Readings) =>
  `${name}'s ${data.title.toLowerCase()}: ${data.levels[overall(levelsOf(data.factors, readings))]}. ${data.factors
    .map((f) => `${f.label}: ${data.levels[readings[f.id].level]}`)
    .join(", ")}.`;

// ——— The worker's risk signals card ———

// The toggle, the cards and the chart as the split's own grid items, so the chart centres on the card rather than on
// the toggle and card. The chart's cell takes no height, so the row is the card's and the chart runs past it evenly.
const signalsColumnStyle = css({ display: "contents" });
const signalsToggleStyle = css({ justifySelf: "center", md: { gridColumn: 1 } });
const spiderCellStyle = css({
  md: { gridColumn: 2, gridRow: 2, height: 0, display: "flex", flexDirection: "column", justifyContent: "center" },
});
// `5xl` under the card to the section's end: the split's own `4xl`, and the rest here.
const signalsRowStyle = css({ md: { paddingBlockEnd: "calc(token(spacing.5xl) - token(spacing.4xl))" } });
// Every worker's card in one cell, so it holds the tallest one's height and nothing moves as they cross-fade.
const signalPanesStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  justifySelf: "center",
  width: "min(100%, token(sizes.testimonialCardWide))",
  "& > *": { gridArea: "1 / 1" },
  md: { gridColumn: 1 },
  mdDown: { marginBlockStart: "calc(token(spacing.4xl) - token(spacing.3xl))" },
});
const sheetStyle = css({
  "--sheet-ground": "token(colors.bg.surface)",
  width: "token(spacing.full)",
  borderRadius: "xl",
  backgroundColor: "bg.surface",
  color: "text.body",
  boxShadow: `${ring}, 0 4px 16px color-mix(in srgb, token(colors.neutral.900) 12%, transparent)`,
  overflow: "hidden",
});
const sheetHeadStyle = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "md",
  paddingInline: "xl",
  paddingBlock: "lg",
  borderBlockEndWidth: "token(spacing.xxs)",
  borderBlockEndStyle: "solid",
  borderBlockEndColor: "border.divider",
});
const sheetNameStyle = css({ textStyle: "quote", color: "text.title" });
const sheetSubStyle = css({ textStyle: "caption", color: "text.body" });
const overallStyle = css({ display: "flex", alignItems: "center", gap: "md" });
const signalsStyle = css({ display: "flex", flexDirection: "column", paddingInline: "xl", paddingBlockEnd: "md" });
// A factor: its icon, the reading over the factor's name, its level at the end. None reads faint unless pointed at;
// the rest fade back while one is pointed at, here or on the chart.
const signalRowStyle = css({
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  columnGap: "md",
  rowGap: "xxs",
  alignItems: "center",
  paddingBlock: "md",
  borderBlockStartWidth: "token(spacing.xxs)",
  borderBlockStartStyle: "solid",
  borderBlockStartColor: "border.divider",
  "&:first-child": { borderBlockStartWidth: 0 },
  transition: "opacity 300ms ease",
  "& > svg": { width: "token(spacing.xxl)", height: "token(spacing.xxl)", color: "text.highlight" },
  "& svg path[stroke]": { stroke: "currentColor" },
  "& svg path[fill]:not([fill=none])": { fill: "currentColor" },
  "& > :nth-child(4)": { gridColumn: 2 },
  "&[data-level='0']": { opacity: 0.5, "& > svg": { color: "field.text.muted" } },
  "&[data-level='0'][data-hot]": { opacity: 1, "& > svg": { color: "text.highlight" } },
  "[data-pointing] &": { "&:not([data-hot])": { opacity: 0.25 } },
});
const signalTitleStyle = css({ textStyle: "bodySmall", color: "text.title", transition: "color 300ms ease", "[data-hot] &": { color: "text.highlight" } });
const signalLevelStyle = css({
  gridColumn: 3,
  textStyle: "caption",
  color: "text.body",
  whiteSpace: "nowrap",
  "&[data-level='2'], &[data-level='3']": { color: "text.highlight" },
});

const FACTOR_ICON: Record<string, Icon> = {
  worker: NewbornIcon,
  company: FirewallIcon,
  cancel: WarningMessageIcon,
  lateCancel: CalendarIcon,
  attendance: ClockIcon,
  location: MapPinIcon,
};

/** One worker's risk signals card: the shift they're on, their no-show risk, every factor's reading. */
function SignalsCard({
  data,
  worker,
  hot,
  onHot,
}: {
  data: SpiderData;
  worker: SpiderData["workers"][number];
  hot: string | null;
  onHot: (id: string | null) => void;
}) {
  return (
    <div className={sheetStyle}>
      <div className={sheetHeadStyle}>
        <span className={whoStyle}>
          <span className={sheetNameStyle}>{worker.name}</span>
          <span className={sheetSubStyle}>{worker.shift}</span>
        </span>
        <span className={headEndStyle}>
          <span className={overallStyle}>
            <span className={eyebrowStyle}>{data.title}</span>
            <OverallPill risk={overall(levelsOf(data.factors, worker.readings))} levels={data.levels} />
          </span>
        </span>
      </div>
      <div className={signalsStyle}>
        {data.factors.map(({ id, label }) => {
          const { level, text } = worker.readings[id];
          const SignalIcon = FACTOR_ICON[id];
          return (
            <div
              key={id}
              className={signalRowStyle}
              data-level={level}
              data-hot={isHot(hot, id) ? "" : undefined}
              onPointerEnter={() => onHot(id)}
              onPointerLeave={() => onHot(null)}
            >
              <SignalIcon aria-hidden />
              <span className={signalTitleStyle}>{text}</span>
              <span className={signalLevelStyle} data-level={level}>
                {data.levels[level]}
              </span>
              <span className={sheetSubStyle}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Laid out as the shift sheet's concepts: the heading above, a toggle over the worker's risk signals card on the left,
 * the cards cross-fading, and their spider chart on the right.
 */
export function SpiderSignalsSplit({ data, head }: { data: SpiderData; head: { eyebrow: string; heading: string } }) {
  const [key, setKey] = useState(data.workers[0].key);
  const [hot, setHot] = useState<string | null>(null);
  const worker = data.workers.find((w) => w.key === key)!;
  const shown = useEased(levelsOf(data.factors, worker.readings));
  return (
    <Split words={<Head caption={head.eyebrow}>{head.heading}</Head>} centre inBleed className={signalsRowStyle}>
      <div className={signalsColumnStyle} data-pointing={hot ? "" : undefined}>
        <SegmentedControl
          ariaLabel="Worker"
          className={cx(toggleStyle, signalsToggleStyle)}
          options={data.workers.map((w) => ({ value: w.key, label: w.first }))}
          value={key}
          onValueChange={setKey}
        />
        <div className={signalPanesStyle}>
          {data.workers.map((w) => (
            <div key={w.key} className={paneStyle} data-presented={w.key === key} aria-hidden={w.key !== key} inert={w.key !== key}>
              <SignalsCard data={data} worker={w} hot={w.key === key ? hot : null} onHot={setHot} />
            </div>
          ))}
        </div>
        <div className={spiderCellStyle}>
          <SpiderPlot data={data} levels={shown} label={describe(data, worker.name, worker.readings)} hot={hot} onHot={setHot} />
        </div>
      </div>
    </Split>
  );
}
