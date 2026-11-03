"use client";

import { Children, createContext, use, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { css, cx } from "../../../../styled-system/css";
import { CHECK_INS } from "./sheet-words";
import { isHot, overall, radius, type Level } from "./risk-levels";
import type { RiskReading } from "./dashboard";
import { partsOf, restOf, textOf } from "./slots";
import { Chip, Pill, Typography, toneStyle } from "./ui";

// The project sheet's no-show risk spider chart (check-ins-spider.tsx) in SW Curie's look. A marker, its factor's name
// and its reading light each other. Factors are known by their place.

const { spider } = CHECK_INS.signals;
const R = radius(3);
// In the chart's own units, R to a side of the 140px square.
const MARKER = 7.5;
const HIT = 30;
const LABEL_GAP = 30;

const angle = (i: number, n: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
const at = (i: number, n: number, r: number) => [r * Math.cos(angle(i, n)), r * Math.sin(angle(i, n))] as const;
const ringPoints = (n: number, r: number) =>
  Array.from({ length: n }, (_, i) => at(i, n, r).map((v) => v.toFixed(2)).join(",")).join(" ");
const percent = (x: number, y: number): CSSProperties => ({ left: `${50 + (x / (2 * R)) * 100}%`, top: `${50 + (y / (2 * R)) * 100}%` });

function labelPlace(i: number, n: number): CSSProperties {
  const [x, y] = at(i, n, R + LABEL_GAP);
  const cos = Math.cos(angle(i, n));
  const place = percent(x, y);
  if (cos > 0.2) return { ...place, translate: "0 -50%", textAlign: "start" };
  if (cos < -0.2) return { ...place, translate: "-100% -50%", textAlign: "end" };
  return { ...place, translate: Math.sin(angle(i, n)) < 0 ? "-50% -100%" : "-50% 0", textAlign: "center", maxWidth: "none" };
}

/** The overall level's caution colours, for `data-tone`. */
export const RISK_TONE = { 1: "success", 2: "warning", 3: "alert" } as const;

const riskStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-md)" });

const headStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "var(--sw-gap-md)",
  "& > :last-child": { marginInlineStart: "auto" },
});

// Room round the square for the factors' names.
const chartStyle = css({ width: "fit-content", marginInline: "auto", paddingBlock: "1.75rem", paddingInline: "5.25rem" });

const squareStyle = css({
  position: "relative",
  width: "8.75rem",
  aspectRatio: "1",
  "& > svg": { display: "block", width: "100%", height: "100%", overflow: "visible" },
});

const ringStyle = css({ fill: "none", stroke: "var(--sw-border-subdued)", strokeWidth: 1 });

const shapeStyle = css({
  fill: "var(--tone-surface)",
  fillOpacity: 0.7,
  stroke: "var(--tone-glyph)",
  strokeWidth: 1.5,
  strokeLinejoin: "round",
});

const pointStyle = css({
  fill: "var(--tone-glyph)",
  stroke: "var(--sw-surface-default)",
  strokeWidth: 1.5,
  transformBox: "fill-box",
  transformOrigin: "center",
  transition: "scale 200ms ease",
  "&[data-hot]": { scale: "1.5" },
});

const hitStyle = css({ fill: "transparent" });

const labelStyle = css({
  position: "absolute",
  width: "max-content",
  maxWidth: "5.25rem",
  color: "var(--sw-glyph-subdued)",
  transition: "color 300ms ease",
  "& > [data-typography]": { color: "inherit" },
  "&[data-hot]": { color: "var(--tone-glyph)" },
});

const detailsStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  columnGap: "var(--sw-gap-xl)",
  alignItems: "center",
});

// A factor: what was found over the factor's name, its level at the end, ruled off from the one above. Pointed at, here
// or on the chart, it lights up as a record does (cards.tsx), without the rules above and below it. None reads faint.
const readingStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  columnGap: "var(--sw-gap-md)",
  alignItems: "center",
  paddingBlock: "var(--sw-padding-xs)",
  paddingInline: "var(--sw-padding-sm)",
  "& + &:not([data-hot], [data-hot] + *)": { boxShadow: "inset 0 1px 0 var(--sw-border-subdued)" },
  "&[data-hot]": { borderRadius: "var(--sw-radius-xs)", backgroundColor: "var(--sw-hover-shade)" },
  "& > :first-child": { color: "var(--sw-glyph-default)" },
  "& > :last-child": { gridColumn: 1 },
  "&[data-level='0'] > *": { opacity: 0.5 },
});

/** The factor pointed at, here or on the chart, as `isHot` reads it, and each factor's place. */
const HotContext = createContext<{ hot: string | null; setHot: (id: string | null) => void }>({
  hot: null,
  setHot: () => {},
});
const PlaceContext = createContext(0);

type FactorProps = { level: Level; children: ReactNode };

/** A factor's name: its last child. */
const nameOf = (factor: ReactElement<FactorProps>) => Children.toArray(factor.props.children).at(-1);

/**
 * A no-show risk: its title (a `Typography`) and overall level (a small `Chip`, or a `Pill` beside a card's heading), then
 * anything else at the head's end, over the chart of its `Factor`s, in the overall level's caution colours. With
 * `details`, each factor's reading and level are listed beside the chart, as on the project sheet. `name`, whose risk it
 * is, names the chart.
 */
function SpiderChartRoot({
  name,
  details,
  className,
  children,
}: {
  name: string;
  details?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [hot, setHot] = useState<string | null>(null);
  const factors = partsOf(children, Factor) as ReactElement<FactorProps>[];
  const head = restOf(children, Factor);
  const levels = factors.map((factor) => factor.props.level);
  const risk = overall(levels);
  const label = `${name}'s ${textOf(partsOf(head, Typography)).toLowerCase()}: ${textOf([...partsOf(head, Chip), ...partsOf(head, Pill)])}. ${factors
    .map((factor, i) => `${textOf(nameOf(factor))}: ${spider.levels[levels[i]]}`)
    .join(", ")}.`;
  const chart = <RiskChart label={label} factors={factors} />;
  return (
    <HotContext value={{ hot, setHot }}>
      <div className={cx(riskStyle, toneStyle, className)} data-tone={RISK_TONE[risk]} data-risk="">
        <div className={headStyle}>{head}</div>
        {details ? (
          <div className={detailsStyle}>
            <ul>
              {factors.map((factor, i) => (
                <PlaceContext key={i} value={i}>
                  {factor}
                </PlaceContext>
              ))}
            </ul>
            {chart}
          </div>
        ) : (
          chart
        )}
      </div>
    </HotContext>
  );
}

/**
 * A factor at its `level`: with the chart's `details`, what was found (a `Typography`) and its level (a small `Chip`, or a
 * `Typography` at none); then its name (a `Typography`).
 */
function Factor({ level, children }: FactorProps) {
  const { hot, setHot } = use(HotContext);
  const id = String(use(PlaceContext));
  return (
    <li
      className={readingStyle}
      data-level={level}
      data-hot={isHot(hot, id) ? "" : undefined}
      onPointerEnter={() => setHot(id)}
      onPointerLeave={() => setHot(null)}
    >
      {children}
    </li>
  );
}

SpiderChartRoot.displayName = "SpiderChart";
Factor.displayName = "SpiderChart.Factor";

export const SpiderChart = Object.assign(SpiderChartRoot, { Factor });

/**
 * A worker's no-show risk from their `readings`, in the sheet's factors' order. With `heading`, it heads a card: its level
 * in a `Pill` beside the heading, `action` at the head's end.
 */
export function NoShowRisk({
  name,
  readings,
  details,
  heading,
  action,
  className,
}: {
  name: string;
  readings: RiskReading[];
  details?: boolean;
  heading?: string;
  action?: ReactNode;
  className?: string;
}) {
  const risk = overall(readings.map((reading) => reading.level));
  const tone = RISK_TONE[risk];
  return (
    <SpiderChart name={name} details={details} className={className}>
      {heading ? (
        <Typography tag="h3" variant="heading">
          {heading}
        </Typography>
      ) : (
        <Typography variant="metadata" color="subdued">
          {spider.title}
        </Typography>
      )}
      {heading ? <Pill state={tone}>{spider.levels[risk]}</Pill> : <Chip size="small" state={tone}>{spider.levels[risk]}</Chip>}
      {action}
      {spider.factors.map(({ id, label }, i) => {
        const { level, text } = readings[i];
        return (
          <SpiderChart.Factor key={id} level={level}>
            {details && <Typography variant="body">{text}</Typography>}
            {details &&
              (level ? (
                <Chip size="small" state={RISK_TONE[level]}>{spider.levels[level]}</Chip>
              ) : (
                <Typography variant="metadata" color="subdued">
                  {spider.levels[level]}
                </Typography>
              ))}
            <Typography variant="metadata" color="subdued">
              {label}
            </Typography>
          </SpiderChart.Factor>
        );
      })}
    </SpiderChart>
  );
}

// The code view shows the composition.
NoShowRisk.unwrap = NoShowRisk;

function RiskChart({ label, factors }: { label: string; factors: ReactElement<FactorProps>[] }) {
  const { hot, setHot: onHot } = use(HotContext);
  const n = factors.length;
  const levels = factors.map((factor) => factor.props.level);
  const ids = factors.map((_, i) => String(i));
  const markers = levels.map((level, i) => at(i, n, radius(level)));
  const atCentre = ids.filter((_, i) => levels[i] === 0);
  const marker = (key: string, [x, y]: readonly [number, number], hits: string[]) => (
    <g key={key}>
      <circle
        className={pointStyle}
        data-hot={hits.some((id) => isHot(hot, id)) ? "" : undefined}
        cx={x}
        cy={y}
        r={MARKER}
        vectorEffect="non-scaling-stroke"
      />
      <circle
        className={hitStyle}
        cx={x}
        cy={y}
        r={HIT}
        onPointerEnter={() => onHot(hits.join(" "))}
        onPointerLeave={() => onHot(null)}
      />
    </g>
  );
  return (
    <div className={chartStyle} role="img" aria-label={label}>
      <div className={squareStyle}>
        <svg viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`} aria-hidden>
          {[1, 2, 3].map((level) => (
            <polygon key={level} className={ringStyle} points={ringPoints(n, radius(level))} vectorEffect="non-scaling-stroke" />
          ))}
          {ids.map((id, i) => {
            const [x, y] = at(i, n, R);
            return <line key={id} className={ringStyle} x1={0} y1={0} x2={x} y2={y} vectorEffect="non-scaling-stroke" />;
          })}
          <polygon
            className={shapeStyle}
            points={markers.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}
            vectorEffect="non-scaling-stroke"
          />
          {/* The factors at none share the centre, and one marker there. */}
          {markers.map((point, i) => (levels[i] === 0 ? null : marker(ids[i], point, [ids[i]])))}
          {atCentre.length > 0 && marker("centre", [0, 0], atCentre)}
        </svg>
        {factors.map((factor, i) => (
          <span
            key={ids[i]}
            className={labelStyle}
            data-hot={isHot(hot, ids[i]) ? "" : undefined}
            style={labelPlace(i, n)}
            onPointerEnter={() => onHot(ids[i])}
            onPointerLeave={() => onHot(null)}
            aria-hidden
          >
            {nameOf(factor)}
          </span>
        ))}
      </div>
    </div>
  );
}
