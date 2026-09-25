"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { css, cx } from "../../../styled-system/css";
import {
  ASPECT_RATIOS,
  DEMO_FRAME_CONTENT_PADDING_PX,
  type DemoFrameAspectRatio,
} from "@/utils/demo-frame-sizing";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import {
  ShiftFormShell,
  SHELL_ACTION_BAR_HEIGHT,
  SHELL_FORM_INSET,
  SHELL_HEADER_HEIGHT,
  SHELL_TEAR_HEIGHT,
} from "./shift-form-shell";

export type Arrangement = "before" | "after";

const ARRANGEMENTS = [
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
];

/** A bracket beside the card, in the card's own 1:1 coordinates. */
export interface DiagramRedline {
  label: string;
  side: "start" | "end";
  /** From the top of the card. */
  top: number;
  /** The solid run. */
  spine: number;
  /** A dotted run-on for a region the card crops; without it the spine closes with a foot tick. */
  tail?: number;
  /** Where the leader tick and caption attach, from the mark's top. */
  attach: number;
}

export interface RedesignArrangement {
  /** Layout and exit motion for this pane. */
  className?: string;
  children: ReactNode;
  /** Runs past the foot of the block, so the cut is drawn while it shows. */
  overflows?: boolean;
}

// `ShiftFormShell`'s width.
const CARD_WIDTH = 615;

const DEFAULT_TOGGLE_GAP = 76;

const MIN_AIR = 32;

// The 8px mark plus its 4px gutter, then 4px out to the caption.
const REDLINE_CLEARANCE = 12;
const CAPTION_GAP = 4;

// Caption widths; BADGE_SIZE must match the badge's drawn size (`spacing.xxl`).
const LABEL_WIDTH = 76;
const BADGE_SIZE = 20;

/** 799: the drawing with labels. */
export const LABELLED_WIDTH =
  CARD_WIDTH + 2 * (REDLINE_CLEARANCE + CAPTION_GAP + LABEL_WIDTH);

/** 687: the drawing with numbered marks. */
export const NUMBERED_WIDTH =
  CARD_WIDTH + 2 * (REDLINE_CLEARANCE + CAPTION_GAP + BADGE_SIZE);

export type RedlineAnnotation = "labels" | "numbers";

export interface DiagramFit {
  annotation: RedlineAnnotation;
  width: number;
  /** 1 until the numbered drawing reaches the gutter; its share of it after. */
  fit: number;
}

/** `available` is the frame's inner width less its side padding. Floored at 0: a negative scale mirrors. */
export function resolveDiagramFit(available: number): DiagramFit {
  if (available >= LABELLED_WIDTH) {
    return { annotation: "labels", width: LABELLED_WIDTH, fit: 1 };
  }

  return {
    annotation: "numbers",
    width: NUMBERED_WIDTH,
    fit: Math.min(1, Math.max(0, available) / NUMBERED_WIDTH),
  };
}

// Written by the observer below; defaults to the labelled drawing at 1:1.
// Not a CSS `tan(atan2())` ratio: WebKit returns 0 from it.
const fitStyle = css({
  "--demo-fit": "1",
  "--demo-diagram-width": `${LABELLED_WIDTH}px`,
  width: "calc(var(--demo-diagram-width) * var(--demo-fit))",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  // Fills the frame's content box so the toggle sits at the top; the share follows the caller's aspect.
  minHeight: "calc(var(--demo-frame-height) - token(spacing.4xl))",
});

// A transform costs no layout, so the scaled drawing needs a box of its scaled size.
const drawingBoxStyle = css({
  position: "relative",
  flex: "none",
  width: "calc(var(--demo-diagram-width) * var(--demo-fit))",
  height: "calc(var(--demo-card-height) * var(--demo-fit))",
});

// Equal springs above and below keep the drawing centred between the toggle and the legend.
const airStyle = css({
  // Basis zero, so the free space is split evenly.
  flex: "1 1 0",
  width: "token(spacing.none)",
});

// The caller's gap is a ceiling. The floor is the smaller of the two, since a larger
// min-height would override the max.
const airAboveStyle = css({
  minHeight: `calc(min(${MIN_AIR}px, var(--demo-toggle-gap)) * var(--demo-fit))`,
  maxHeight: "calc(var(--demo-toggle-gap) * var(--demo-fit))",
});

const airBelowLegendStyle = css({
  minHeight: `calc(${MIN_AIR}px * var(--demo-fit))`,
});

const drawingStyle = css({
  position: "absolute",
  insetBlockStart: "token(spacing.none)",
  insetInlineStart: "token(spacing.none)",
  width: "var(--demo-diagram-width)",
  height: "var(--demo-card-height)",
  transformOrigin: "top left",
  transform: "scale(var(--demo-fit))",
  display: "flex",
  justifyContent: "center",
});

// `flex: none`: the toolbar's `fit="fill"` is `flex: 1 1 0`, which collapses it in this column.
const toggleStyle = css({
  flex: "none",
  width: "132px",
  borderRadius: "token(radii.full)",
});

const cardStyle = css({
  position: "relative",
  display: "flex",
  minWidth: 0,
});

const redlinesStyle = css({
  pointerEvents: "none",
  color: "field.text.active",
  transitionProperty: "opacity",
  transitionDuration: "200ms",
  transitionTimingFunction: "ease-out",
  "&[data-presented=false]": { opacity: 0 },
});

const redlineStyle = css({
  position: "absolute",
  width: "token(spacing.md)",
  transitionProperty: "transform, opacity",
  transitionDuration: "260ms",
  transitionTimingFunction: "ease-out",
  "&[data-side=start]": {
    insetInlineStart: "calc(-1 * (token(spacing.md) + token(spacing.sm)))",
    "[data-presented=false] &": { transform: "translateX(-8px)" },
  },
  "&[data-side=end]": {
    insetInlineEnd: "calc(-1 * (token(spacing.md) + token(spacing.sm)))",
    "[data-presented=false] &": { transform: "translateX(8px)" },
  },
});

const redlineMarkStyle = css({
  display: "block",
  "[data-side=end] &": { transform: "scaleX(-1)" },
});

const redlineLabelStyle = css({
  position: "absolute",
  transform: "translateY(-50%)",
  width: `${LABEL_WIDTH}px`,
  textStyle: "bodySmall",
  color: "field.text.active",
  "[data-side=start] &": {
    insetInlineEnd: "calc(100% + token(spacing.sm))",
    textAlign: "end",
  },
  "[data-side=end] &": {
    insetInlineStart: "calc(100% + token(spacing.sm))",
    textAlign: "start",
  },
});

const badgeStyle = css({
  display: "flex",
  flex: "none",
  alignItems: "center",
  justifyContent: "center",
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  borderRadius: "token(radii.full)",
  borderWidth: "token(spacing.xxs)",
  borderStyle: "solid",
  borderColor: "field.text.active",
  textStyle: "bodySmall",
  lineHeight: "1",
  // Lifts the digit to optical centre; `text-box: trim-both` is not cross-browser yet.
  paddingBlockEnd: "token(spacing.xxs)",
  color: "field.text.active",
});

const redlineBadgeStyle = css({
  position: "absolute",
  transform: "translateY(-50%)",
  "[data-side=start] &": { insetInlineEnd: "calc(100% + token(spacing.sm))" },
  "[data-side=end] &": { insetInlineStart: "calc(100% + token(spacing.sm))" },
});

const legendStyle = css({
  flex: "none",
  maxWidth: "token(spacing.full)",
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  alignItems: "center",
  columnGap: "3xl",
  rowGap: "md",
  listStyle: "none",
  pointerEvents: "none",
  transitionProperty: "opacity",
  transitionDuration: "200ms",
  transitionTimingFunction: "ease-out",
  "&[data-presented=false]": { opacity: 0 },
});

const legendEntryStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  textStyle: "bodySmall",
  color: "field.text.active",
  whiteSpace: "nowrap",
});

/** One redline, built from the Figma export's own path moves; only the stroke is `currentColor`. */
function RedlineMark({ spine, tail, attach }: DiagramRedline) {
  const height = tail == null ? spine : spine + 2 + tail;
  // The `.375`s are the stroke's half-width, so the SVG renders at 1:1.
  const leader = `${attach + 0.375}`;
  const foot =
    tail == null
      ? `M8.375 ${spine + 0.375}H4.375V${leader}`
      : `M4.375 ${spine + 0.375}V${leader}`;

  return (
    <svg
      className={redlineMarkStyle}
      width="8.75"
      height={height + 0.75}
      viewBox={`0 0 8.75 ${height + 0.75}`}
      fill="none"
      aria-hidden
      focusable="false"
    >
      <path
        d={`M8.375 0.375H4.375V${leader}${foot}M4.375 ${leader}H0.375`}
        stroke="currentColor"
        strokeWidth="0.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {tail == null ? null : (
        <path
          d={`M4.375 ${height + 0.375}V${spine + 2.375}`}
          stroke="currentColor"
          strokeWidth="0.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1.5 1.5"
        />
      )}
    </svg>
  );
}

// Fixed height, so the panes cross-fade without the card resizing; clips overflow at the cut.
const bodyStyle = css({
  position: "relative",
  height: "var(--demo-body-height)",
  overflow: "hidden",
});

// A share of the block, so tall and short blocks dissolve alike.
const CUT_FADE_SHARE = 0.4;

/** Shared by the panes and the cut, so the two leave together. */
const MORPH_MS = 300;

// The cut leaves a beat after its content, on the way out only.
const CUT_STAGGER_MS = 80;

const cropFadeStyle = css({
  position: "absolute",
  insetInline: 0,
  bottom: 0,
  height: `calc(var(--demo-body-height) * ${CUT_FADE_SHARE})`,
  pointerEvents: "none",
  // A transition takes its duration from the target state: 0s shows the cut at once.
  transitionProperty: "opacity",
  transitionDuration: "0s",
  "&[data-presented=false]": {
    opacity: 0,
    transitionDuration: `${MORPH_MS}ms`,
    transitionDelay: `${CUT_STAGGER_MS}ms`,
    transitionTimingFunction: "ease-out",
  },
  backgroundImage: [
    "linear-gradient(to top",
    "var(--colors-bg-surface) 0%",
    "color-mix(in srgb, var(--colors-bg-surface) 88%, transparent) 20%",
    "color-mix(in srgb, var(--colors-bg-surface) 66%, transparent) 40%",
    "color-mix(in srgb, var(--colors-bg-surface) 40%, transparent) 60%",
    "color-mix(in srgb, var(--colors-bg-surface) 17%, transparent) 80%",
    "color-mix(in srgb, var(--colors-bg-surface) 0%, transparent) 100%)",
  ].join(", "),
});

const paneStyle = css({
  position: "absolute",
  inset: 0,
  transitionProperty: "opacity, transform, filter",
  transitionDuration: `${MORPH_MS}ms`,
  transitionTimingFunction: "ease-out",
  // The leaving pane blurs so only one arrangement is legible at a time; the body clips the bleed.
  "&[data-presented=false]": { opacity: 0, filter: "blur(4px)" },
});

export interface RedesignDiagramProps {
  /** Names the toggle: what the two arrangements are arrangements of. */
  ariaLabel: string;
  /** The card body's height at 1:1, shared by both arrangements. */
  bodyHeight: number;
  /** End at one torn edge partway down (header, body, tear) rather than stage the whole dialog. */
  cropped?: boolean;
  /** The most the drawing sits below the toggle at 1:1; a ceiling, not a distance. */
  toggleGap?: number;
  /** The frame's shape, passed down because a publication may override it. */
  aspect?: DemoFrameAspectRatio;
  redlines: readonly DiagramRedline[];
  before: RedesignArrangement;
  after: RedesignArrangement;
}

export function RedesignDiagram({
  ariaLabel,
  bodyHeight,
  cropped = false,
  toggleGap = DEFAULT_TOGGLE_GAP,
  aspect = "2/1",
  redlines,
  before,
  after,
}: RedesignDiagramProps) {
  const [arrangement, setArrangement] = useState<Arrangement>("before");
  const showing = (which: Arrangement) => arrangement === which;

  const fitRef = useRef<HTMLDivElement>(null);
  // The measured width, so a resize that changes nothing re-renders nothing.
  const [available, setAvailable] = useState(LABELLED_WIDTH);
  const { annotation, width, fit } = resolveDiagramFit(available);

  // Observe the demo frame, never nearer: this element is sized from the scale.
  useLayoutEffect(() => {
    const host = fitRef.current?.closest("[data-demo-frame]");
    if (!host || typeof ResizeObserver === "undefined") return;

    const measure = () =>
      setAvailable(host.clientWidth - DEMO_FRAME_CONTENT_PADDING_PX);

    const observer = new ResizeObserver(measure);
    observer.observe(host);
    measure();

    return () => observer.disconnect();
  }, []);

  const [aspectWidth, aspectHeight] = ASPECT_RATIOS[aspect];

  // Summed from the shell's rows, not stated, so the redlines track the chrome.
  const cardHeight = cropped
    ? SHELL_HEADER_HEIGHT + bodyHeight + SHELL_TEAR_HEIGHT
    : SHELL_HEADER_HEIGHT +
      SHELL_TEAR_HEIGHT +
      SHELL_TEAR_HEIGHT +
      SHELL_FORM_INSET +
      bodyHeight +
      SHELL_FORM_INSET +
      SHELL_TEAR_HEIGHT +
      SHELL_TEAR_HEIGHT +
      SHELL_ACTION_BAR_HEIGHT;

  return (
    <div
      ref={fitRef}
      className={fitStyle}
      data-testid="redesign-diagram"
      style={
        {
          "--demo-fit": fit,
          "--demo-diagram-width": `${width}px`,
          "--demo-body-height": `${bodyHeight}px`,
          "--demo-card-height": `${cardHeight}px`,
          "--demo-toggle-gap": `${toggleGap}px`,
          "--demo-frame-height": `${(aspectHeight / aspectWidth) * 100}cqw`,
        } as CSSProperties
      }
    >
      <SegmentedControl
        ariaLabel={ariaLabel}
        className={toggleStyle}
        options={ARRANGEMENTS}
        value={arrangement}
        onValueChange={(next) => setArrangement(next as Arrangement)}
      />

      <div className={cx(airStyle, airAboveStyle)} aria-hidden />

      <div className={drawingBoxStyle}>
        <div className={drawingStyle} data-testid="redesign-drawing">
          <div className={cardStyle}>
            {/* Outside the card, which clips at its rails and tear. */}
            <div
              className={redlinesStyle}
              data-testid="redlines"
              data-presented={showing("before")}
              aria-hidden={!showing("before")}
            >
              {redlines.map((redline, index) => (
                <div
                  key={redline.label}
                  className={redlineStyle}
                  data-side={redline.side}
                  style={{ top: `${redline.top}px` }}
                >
                  {annotation === "labels" ? (
                    <span
                      className={redlineLabelStyle}
                      data-testid="redline-label"
                      style={{ top: `${redline.attach}px` }}
                    >
                      {redline.label}
                    </span>
                  ) : (
                    <span
                      className={cx(badgeStyle, redlineBadgeStyle)}
                      data-testid="redline-badge"
                      style={{ top: `${redline.attach}px` }}
                    >
                      {index + 1}
                    </span>
                  )}
                  <RedlineMark {...redline} />
                </div>
              ))}
            </div>

            <ShiftFormShell cropped={cropped}>
              <div className={bodyStyle}>
                <div
                  className={cx(paneStyle, before.className)}
                  data-testid="before-pane"
                  data-presented={showing("before")}
                  aria-hidden={!showing("before")}
                  inert={!showing("before")}
                >
                  {before.children}
                </div>

                <div
                  className={cx(paneStyle, after.className)}
                  data-testid="after-pane"
                  data-presented={showing("after")}
                  aria-hidden={!showing("after")}
                  inert={!showing("after")}
                >
                  {after.children}
                </div>

                {/* Outside both panes, so it neither fades nor travels with them. */}
                {before.overflows || after.overflows ? (
                  <div
                    className={cropFadeStyle}
                    data-testid="crop-fade"
                    data-presented={Boolean(
                      (showing("before") ? before : after).overflows,
                    )}
                    aria-hidden
                  />
                ) : null}
              </div>
            </ShiftFormShell>
          </div>
        </div>
      </div>

      <div
        className={cx(
          airStyle,
          annotation === "numbers" ? airBelowLegendStyle : undefined,
        )}
        aria-hidden
      />

      {annotation === "numbers" ? (
        <ol
          className={legendStyle}
          data-testid="redline-legend"
          data-presented={showing("before")}
          aria-hidden={!showing("before")}
        >
          {redlines.map((redline, index) => (
            <li key={redline.label} className={legendEntryStyle}>
              <span className={badgeStyle} aria-hidden>
                {index + 1}
              </span>
              {redline.label}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
