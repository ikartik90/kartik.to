import { css } from "../../../styled-system/css";
import { token } from "../../../styled-system/tokens";
import MetricIcon from "@/assets/icons/metric.svg";
import { Dots } from "./dots";
import { fadeBelow } from "./figure";

// A metric on the project cards' dotted ground and frame. `brand` draws what it says brighter (the number, how far it
// moved, the caption's marked words) in the brand colour. `small` leaves the caption out. `landscape`, for a band
// across the sheet with no frame: the caption at a subheading's size, under the metric, and from `md` in the two
// thirds beside it.

/** What was measured; `*`s in `detail` mark the part said brighter. */
export interface Metric {
  value: string;
  label: string;
  /** Which way it moved, for a number with a previous value to move from. */
  trend?: "up" | "down";
  /** How far it moved, said beside the number (`16 points`); the trend says which way. */
  change?: string;
  detail?: string;
}

export interface MetricCardProps {
  metric: Metric;
  variant?: "neutral" | "brand";
  size?: "large" | "small";
  landscape?: boolean;
  /** On a dotted ground already: filled with the ground's colour, so only its own dots show, at half strength. */
  onDots?: boolean;
}

// A landscape card's dots, full from its top and fading out to clear at its foot, eased in and out so the ramp shows
// no edge: the cards' downward fade, run up from the foot.
const FADE_ROOM = parseFloat(token("spacing.5xl"));
const FADE_OUT = fadeBelow(0, { start: 0, length: FADE_ROOM, amount: 1, curve: [0.63, 0, 0.48, 1] }, 1).replace(
  "to bottom",
  "to top",
);

const cardStyle = css({
  position: "relative",
  isolation: "isolate",
  display: "flex",
  flexDirection: "column",
  height: "token(spacing.full)",
  padding: "xxl",
  overflow: "hidden",
  borderRadius: "lg",
  boxShadow: "inset 0 0 0 token(spacing.xxs) color-mix(in srgb, token(colors.neutral.500) 25%, transparent)",
  textAlign: "start",
  mdDown: { aspectRatio: "1", padding: "xl" },
  // Small isn't squared on a phone: it has no caption to make room for.
  "&[data-size='small']": { mdDown: { aspectRatio: "auto" } },
  // Out to the sheet's edges (`closingCardStyle` in sheet-article.tsx), its words where they were inside the content's
  // padding; no frame, the dots fading out toward its foot.
  "&[data-landscape]": {
    borderRadius: 0,
    boxShadow: "none",
    paddingInline: "calc(2 * token(spacing.xl))",
    paddingBlock: "5xl",
    md: { paddingInline: "calc(token(spacing.5xl) + token(spacing.3xl))" },
    mdDown: { aspectRatio: "auto", paddingBlockStart: "4xl" },
  },
  "&[data-on-dots]": { backgroundColor: "bg.canvas", "& > [data-inset]": { opacity: 0.5 } },
});

// The card's height past its content never trails under its last line, where it would look like something failed to
// render: a caption goes to the foot, and with none the metric does.
const storyStyle = css({
  display: "flex",
  flexDirection: "column",
  flex: "1",
  minHeight: 0,
  "&:not([data-captioned])": { flex: "none", marginBlockStart: "auto" },
  "[data-landscape] &": {
    // Their tops level, the row at the foot.
    md: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      columnGap: "xxl",
      alignContent: "end",
      alignItems: "start",
    },
  },
});
const metricStyle = css({ display: "flex", flexDirection: "column", gap: "xs" });
const numberRowStyle = css({ display: "flex", alignItems: "center", gap: "md" });
const numberStyle = css({
  textStyle: "title",
  color: "text.title",
  fontVariantNumeric: "tabular-nums",
  "[data-metric-card][data-variant='brand'] &": { color: "text.highlight" },
});
// How far it moved, with the way it went, outlined.
const pillStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "xs",
  paddingInlineStart: "sm",
  paddingInlineEnd: "md",
  borderRadius: "full",
  // A ring inside its box, so the line adds nothing to its height.
  boxShadow: "inset 0 0 0 token(spacing.xxs) token(colors.text.body)",
  color: "text.body",
  textStyle: "caption",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
  "& svg": { width: "token(spacing.xl)", height: "token(spacing.xl)", flexShrink: 0 },
  "& path": { stroke: "currentColor" },
  "&[data-trend='down'] svg": { scale: "1 -1" },
  "[data-metric-card][data-variant='brand'] &": {
    boxShadow: "inset 0 0 0 token(spacing.xxs) token(colors.text.highlight)",
    color: "text.highlight",
  },
  "[data-landscape] &": { backgroundColor: "color-mix(in srgb, token(colors.text.highlight) 5%, transparent)" },
});
const labelStyle = css({ textStyle: "bodyLarge", color: "text.title", textWrap: "pretty" });
// What the number means, said once: the part between `*`s brighter than the rest.
const captionStyle = css({
  marginBlockStart: "auto",
  paddingBlockStart: "xl",
  textStyle: "bodySmall",
  color: "text.body",
  textWrap: "pretty",
  "& > strong": { fontWeight: "inherit", color: "text.title" },
  "[data-metric-card][data-variant='brand'] &": { "& > strong": { color: "text.highlight" } },
  // As far under the metric as it is beside it from `md`.
  "[data-landscape] &": {
    marginBlockStart: 0,
    paddingBlockStart: "xxl",
    textStyle: "subheading",
    md: { gridColumn: "span 2", paddingBlockStart: 0 },
  },
});

export function MetricCard({ metric, variant = "neutral", size = "large", landscape, onDots }: MetricCardProps) {
  const captioned = size === "large" && !!metric.detail;
  return (
    <div
      role="group"
      aria-label={metric.label}
      className={cardStyle}
      data-metric-card=""
      data-variant={variant}
      data-size={size}
      data-landscape={landscape ? "" : undefined}
      data-on-dots={onDots ? "" : undefined}
    >
      <Dots inset={!landscape} mask={landscape ? FADE_OUT : undefined} />
      <div className={storyStyle} data-captioned={captioned ? "" : undefined}>
        <div className={metricStyle}>
          <div className={numberRowStyle}>
            <span className={numberStyle}>{metric.value}</span>
            {metric.change && (
              <span className={pillStyle} data-trend={metric.trend}>
                <MetricIcon aria-hidden />
                {metric.change}
              </span>
            )}
          </div>
          <span className={labelStyle}>{metric.label}</span>
        </div>
        {captioned && metric.detail && (
          <p className={captionStyle}>
            {metric.detail.split("*").map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}
          </p>
        )}
      </div>
    </div>
  );
}
