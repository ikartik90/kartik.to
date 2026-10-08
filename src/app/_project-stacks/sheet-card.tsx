"use client";

import { Fragment, useEffect, useRef, type CSSProperties, type HTMLAttributes } from "react";
import { css, cx } from "../../../styled-system/css";
import { carousel } from "../../../styled-system/recipes";
import ExpandIcon from "@/assets/icons/expand.svg";
import { CheckInsFigure, DesignSystemFigure, OnboardingFigure, ShiftSchedulingFigure } from "./card-figures";
import type { ProjectCard } from "./data";
import { figureHost } from "./figure";

// One card per project, which opens its sheet. `data-sheet-source` marks the card's surface. Its face's text
// (`CardFace`) is also the top of the sheet.

const carouselStyles = carousel();

// The scroller clips: room for the focus ring. On phones, a portrait card. Hidden until the carousel comes into view
// and its cards rise in (`data-entering`).
const slideStyle = css({
  "--slide-aspect": "calc(4 / 3)",
  paddingBlock: "md",
  mdDown: { "--slide-aspect": "0.68" },
  "[data-entering] &": { opacity: 0 },
});

// Hovered or focused, the card's surface opens out to its whole box from `sm` inside it, and what sits in a top
// corner rides out with that corner; nothing scales. Without a cursor it rests open.
const HOVER_EASE = "800ms cubic-bezier(0.165, 0.84, 0.44, 1)";
const INSET_Y = "token(spacing.sm)";
// At the card's ratio, so the cropped surface is the open one, smaller.
const INSET_X = "calc(token(spacing.sm) * var(--slide-aspect))";
const OPEN_CLIP = "inset(0 round token(radii.xl))";
// How far what rides a top corner sits in from it, and its slide out.
const RIDING = { "--ride-x": INSET_X, "--ride-y": INSET_Y };
const RODE = { "--ride-x": "0px", "--ride-y": "0px" };
const RIDE = `--ride-x ${HOVER_EASE}, --ride-y ${HOVER_EASE}`;

const ring = { outline: "1.5px solid var(--colors-border-focus-ring)", outlineOffset: "2px" };

// The card's box, which holds the focus ring outside the surface's crop. On phones it fills the carousel's view, the
// next card peeking past it. Where the surface rests cropped, the box reaches past its slide by the crop, so the
// resting card lines up with the slide, and the headline.
const cardStyle = css({
  display: "block",
  width: "min(calc(var(--slide-height) * var(--slide-aspect)), var(--carousel-fit))",
  mdDown: { width: "var(--carousel-fit)" },
  _hasCursor: { marginInline: `calc(-1 * ${INSET_X})` },
  padding: "none",
  border: "none",
  borderRadius: "xl",
  background: "none",
  appearance: "none",
  textAlign: "start",
  color: "inherit",
  cursor: "pointer",
  "&[data-closed]": { cursor: "default" },
  outline: "none",
  "html[data-keyboard-focus] &": { "&:focus-visible": ring },
});

// On the figure's ground, framed by a line that keeps to the crop (`Frame`).
const surfaceStyle = css({
  position: "relative",
  display: "block",
  borderRadius: "xl",
  backgroundColor: "bg.canvas",
  clipPath: OPEN_CLIP,
  _hasCursor: { clipPath: `inset(${INSET_Y} ${INSET_X} round token(radii.xl))` },
  transition: `clip-path ${HOVER_EASE}`,
  "[data-sheet-card]:hover &": { clipPath: OPEN_CLIP },
  "html[data-keyboard-focus] [data-sheet-card]:focus-visible &": { clipPath: OPEN_CLIP },
});

// The frame's line is SVG so it moves by fractions of a pixel: a box's edge or shadow snaps to whole ones, and steps
// as the crop opens. The line's middle sits half its width in from the edge. Its corner is `--frame-x`, `--frame-y`:
// Panda takes `x` and `y` for translate.
const HALF_LINE = "calc(token(spacing.xxs) / 2)";
const frameAt = (x: string, y: string) => ({
  "--frame-x": `calc(${x} + ${HALF_LINE})`,
  "--frame-y": `calc(${y} + ${HALF_LINE})`,
});
const frameSize = (x: string, y: string) => ({
  width: `calc(100% - 2 * ${x} - token(spacing.xxs))`,
  height: `calc(100% - 2 * ${y} - token(spacing.xxs))`,
});
const FRAME_OPEN = { ...frameAt("0px", "0px"), "& rect": frameSize("0px", "0px") };

const frameStyle = css({
  position: "absolute",
  zIndex: 2,
  inset: 0,
  pointerEvents: "none",
  color: "color-mix(in srgb, token(colors.border.divider) 50%, transparent)",
  ...frameAt("0px", "0px"),
  "& > svg": { display: "block", width: "token(spacing.full)", height: "token(spacing.full)", overflow: "visible" },
  "& rect": {
    ...frameSize("0px", "0px"),
    rx: `calc(token(radii.xl) - ${HALF_LINE})`,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "token(spacing.xxs)",
  },
  // On a card: over the figure, at the surface's crop and opening with it.
  "&[data-crop]": {
    zIndex: 3,
    transition: "color 300ms ease",
    _hasCursor: { ...frameAt(INSET_X, INSET_Y), "& rect": frameSize(INSET_X, INSET_Y) },
    "& rect": { transition: `x ${HOVER_EASE}, y ${HOVER_EASE}, width ${HOVER_EASE}, height ${HOVER_EASE}` },
  },
  "[data-sheet-card]:hover &": FRAME_OPEN,
  "html[data-keyboard-focus] [data-sheet-card]:focus-visible &": FRAME_OPEN,
  "[data-hover-heading]:is(:hover, [data-figure-held], html[data-keyboard-focus] :focus-visible) &": {
    color: "color-mix(in srgb, token(colors.text.highlight) 50%, transparent)",
  },
});

const FRAME_CORNER = { x: "var(--frame-x)", y: "var(--frame-y)" } as CSSProperties;

/** The line round a card (`crop`, keeping to its crop) or its sheet. */
export function Frame({ crop, ...props }: { crop?: boolean } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span aria-hidden className={frameStyle} data-crop={crop ? "" : undefined} {...props}>
      <svg>
        <rect style={FRAME_CORNER} />
      </svg>
    </span>
  );
}

// The figure under the card's heading, filling its face.
const figureLayerStyle = css({ position: "absolute", inset: 0 });

const FIGURES = {
  "design-system": { Figure: DesignSystemFigure, host: figureHost({ explode: true, hoverInk: "both", hoverHeading: true }) },
  "shift-scheduling": { Figure: ShiftSchedulingFigure, host: figureHost({ play: true, hoverInk: "both", hoverHeading: true }) },
  "check-ins": { Figure: CheckInsFigure, host: figureHost({ play: true, hoverInk: "both", hoverHeading: true }) },
  onboarding: { Figure: OnboardingFigure, host: figureHost({ play: true, hoverInk: "both", hoverHeading: true }) },
};

// The card is the button, so the icon is drawn, not a button: a ring at rest, the brand fill while the card is
// hovered.
const lit = { backgroundColor: "bg.button.accent.hover", color: "field.text.active", boxShadow: "none" };
const soonLit = { backgroundColor: "text.highlight", color: "text.brandedEmphasis", boxShadow: "none" };

const expandStyle = css({
  position: "absolute",
  zIndex: 2,
  insetBlockStart: "lg",
  insetInlineEnd: "lg",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "token(spacing.4xl)",
  height: "token(spacing.4xl)",
  borderRadius: "full",
  color: "text.body",
  boxShadow: "inset 0 0 0 token(spacing.xxs) var(--colors-field-border-default)",
  pointerEvents: "none",
  willChange: "transform",
  translate: "calc(-1 * var(--ride-x)) var(--ride-y)",
  _hasCursor: RIDING,
  transition: `background-color 150ms ease, color 150ms ease, box-shadow 150ms ease, ${RIDE}`,
  "& svg": { width: "token(spacing.xxl)", height: "token(spacing.xxl)", display: "block" },
  "& svg path[stroke]": { stroke: "currentColor" },
  // In the icon's place on a card whose sheet isn't ready, on the title's line so the heading keeps its measure.
  "&[data-soon]": {
    insetBlockStart: "calc(token(spacing.xl) - token(spacing.xs))",
    width: "auto",
    height: "auto",
    paddingBlock: "xs",
    paddingInline: "md",
    textStyle: "caption",
    whiteSpace: "nowrap",
  },
  "[data-sheet-card]:hover &": { ...RODE, "&:not([data-soon])": lit, "&[data-soon]": soonLit },
  "html[data-keyboard-focus] [data-sheet-card]:focus-visible &": {
    ...RODE,
    "&:not([data-soon])": lit,
    "&[data-soon]": soonLit,
  },
});

// The card's face, at the slide's ratio. No automatic minimum: Safari otherwise lets the content stretch the ratio by
// a few px. On phones it grows no taller than the large carousel's slides, so a wider screen gets a squarer card.
const faceStyle = css({
  position: "relative",
  display: "block",
  width: "token(spacing.full)",
  aspectRatio: "var(--slide-aspect)",
  minHeight: 0,
  overflow: "hidden",
  mdDown: { maxHeight: "calc(token(sizes.articleContent) * 14 / 16)" },
});

// Pinned to the face's edges: a percentage height inside a ratio resolves unreliably in Safari.
const faceCardStyle = css({
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  gap: "xl",
  paddingBlockStart: "xl",
  overflow: "hidden",
  textAlign: "start",
});

// The face's text at the top of the sheet. Its heading takes the card's measure at its own size (`--face-text-width`,
// set as it opens), so it keeps the card's lines where it fits.
const sheetFaceStyle = css({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: "xl",
  padding: "3xl",
  paddingBlockEnd: "none",
  mdDown: { padding: "xl", paddingBlockEnd: "none" },
  textAlign: "start",
});

const faceTextStyle = css({ display: "flex", flexDirection: "column", gap: "xs" });

// Over the figure, clear of the expand icon. It rides the surface's top-left corner. It and the icon slide on layers
// they keep (`willChange`), or each step redraws the text and its letters snap to the pixels one by one. They slide by
// `--ride-*` (registered in `SheetCard`), not a `translate` transition: Safari runs that ahead of the page's clock, out
// of step with the crop.
const cardTextStyle = css({
  position: "relative",
  zIndex: 1,
  paddingInlineStart: "xl",
  paddingInlineEnd: "calc(token(spacing.4xl) + token(spacing.xl))",
  willChange: "transform",
  translate: "var(--ride-x) var(--ride-y)",
  transition: RIDE,
  _hasCursor: RIDING,
  "[data-sheet-card]:hover &": RODE,
  "html[data-keyboard-focus] [data-sheet-card]:focus-visible &": RODE,
});

// The eyebrow's middle on the Close button's, which sits on the padding (`closeRowStyle` in project-sheet.tsx).
const sheetTextStyle = css({
  position: "relative",
  zIndex: 1,
  "& > *": { maxWidth: "var(--face-text-width)" },
  "& > [data-face-title]": { marginBlockStart: "calc(token(spacing.4xl) / 2 - 0.5lh)" },
});

// The heading turns to the brand colour with the figure.
const faceTitleStyle = css({
  textStyle: "caption",
  color: "text.body",
  transition: "color 300ms ease",
  "[data-hover-heading]:is(:hover, [data-figure-held], html[data-keyboard-focus] :focus-visible) &": { color: "text.highlight" },
});
const faceHeadingStyle = css({
  color: "text.title",
  textWrap: "balance",
  transition: "color 300ms ease",
  "[data-hover-heading]:is(:hover, [data-figure-held], html[data-keyboard-focus] :focus-visible) &": { color: "text.highlight" },
});
const cardHeadingStyle = css({ textStyle: "subheading" });
const sheetHeadingStyle = css({ textStyle: "subheadingLarge" });
// Each word its own box, so the sheet can bring the heading in a line at a time.
const sheetWordStyle = css({ display: "inline-block" });

/** On the card (`place="card"`), its text over its figure, or at the top of the sheet, larger and alone. */
export function CardFace({ card, place }: { card: ProjectCard; place: "card" | "sheet" }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const onCard = place === "card";
  const text = (
    <span ref={textRef} className={cx(faceTextStyle, onCard ? cardTextStyle : sheetTextStyle)} data-face-text="">
      <span className={faceTitleStyle} data-face-title="">
        {card.title}
      </span>
      <span className={cx(faceHeadingStyle, onCard ? cardHeadingStyle : sheetHeadingStyle)} data-face-heading="">
        {onCard
          ? card.sentence
          : card.sentence.split(" ").map((word, i) => (
              <Fragment key={i}>
                {i > 0 && " "}
                <span className={sheetWordStyle} data-face-word="">
                  {word}
                </span>
              </Fragment>
            ))}
      </span>
    </span>
  );

  if (!onCard) return <span className={sheetFaceStyle}>{text}</span>;
  const { Figure } = FIGURES[card.figure];
  return (
    <span className={faceStyle}>
      <span className={figureLayerStyle} data-face-picture="">
        <Figure headingRef={textRef} />
      </span>
      <span className={faceCardStyle}>{text}</span>
    </span>
  );
}

/** Without `onOpen` the card doesn't open: it's no longer a button. */
export function SheetCard({ card, onOpen }: { card: ProjectCard; onOpen?: (card: ProjectCard) => void }) {
  useEffect(() => {
    for (const name of ["--ride-x", "--ride-y"]) {
      try {
        CSS.registerProperty({ name, syntax: "<length>", inherits: false, initialValue: "0px" });
      } catch {
        // Registered already, by another card.
      }
    }
  }, []);

  const surface = (
    <span className={surfaceStyle} data-sheet-source="">
      <CardFace card={card} place="card" />
      <Frame crop />
      {card.soon ? (
        <span className={expandStyle} data-soon="">
          Coming this week
        </span>
      ) : (
        <span aria-hidden className={expandStyle}>
          <ExpandIcon />
        </span>
      )}
    </span>
  );
  const { host } = FIGURES[card.figure];

  return (
    <div className={cx(carouselStyles.slide, slideStyle)} data-carousel-slide="">
      {onOpen ? (
        <button
          type="button"
          className={cardStyle}
          data-sheet-card={card.id}
          {...host}
          aria-label={`${card.title}: ${card.sentence}`}
          aria-haspopup="dialog"
          onClick={() => onOpen(card)}
        >
          {surface}
        </button>
      ) : (
        <div className={cardStyle} data-sheet-card={card.id} data-closed="" {...host}>
          {surface}
        </div>
      )}
    </div>
  );
}
