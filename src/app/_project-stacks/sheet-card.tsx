"use client";

import { Fragment, useEffect, useId, useRef, type CSSProperties, type HTMLAttributes } from "react";
import { css, cx } from "../../../styled-system/css";
import { carousel } from "../../../styled-system/recipes";
import ExpandIcon from "@/assets/icons/expand.svg";
import { useInView } from "@/hooks/use-in-view";
import { cubicBezier } from "@/utils/eased-fade";
import { isPlainClick } from "@/utils/plain-click";
import { projectPath, type ProjectCard } from "./data";
import { DisplayCover } from "./display-cover";
import { useShownHover } from "./use-shown-hover";

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
  // Through a drag of its carousel (`data-panning`) and the glide after, the card it began on stays hovered wherever
  // the pointer goes, until the strip stops: its hover ending mid-drag would play on the thread that moves the strip.
  // So the box takes no transform, which would hold this cover to it; the press shrinks the surface instead.
  "[data-panning] &": { "&:hover::after": { content: '""', position: "fixed", inset: 0 } },
  "&[data-closed]": { cursor: "default" },
  outline: "none",
  "html[data-keyboard-focus] &": { "&:focus-visible": ring },
});

// On the cover's ground, framed by a line that keeps to the crop (`Frame`).
const surfaceStyle = css({
  position: "relative",
  display: "block",
  borderRadius: "xl",
  backgroundColor: "bg.canvas",
  clipPath: OPEN_CLIP,
  _hasCursor: { clipPath: `inset(${INSET_Y} ${INSET_X} round token(radii.xl))` },
  transition: `clip-path ${HOVER_EASE}, transform 150ms cubic-bezier(0.4, 0, 0.2, 1)`,
  "[data-sheet-card]:not([data-closed]):active &": { transform: "scale(0.98)" },
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
  // On a card: over the cover, at the surface's crop and opening with it.
  "&[data-crop]": {
    zIndex: 3,
    _hasCursor: { ...frameAt(INSET_X, INSET_Y), "& rect": frameSize(INSET_X, INSET_Y) },
    "& rect": { transition: `x ${HOVER_EASE}, y ${HOVER_EASE}, width ${HOVER_EASE}, height ${HOVER_EASE}` },
    // Restated here, where it outranks the line's own.
    "& rect[data-brand]": {
      transition: `opacity 300ms ease, x ${HOVER_EASE}, y ${HOVER_EASE}, width ${HOVER_EASE}, height ${HOVER_EASE}`,
    },
  },
  "[data-sheet-card]:hover &": FRAME_OPEN,
  "html[data-keyboard-focus] [data-sheet-card]:focus-visible &": FRAME_OPEN,
  // A card's line turns to the brand colour along its top while hovered, easing out down its sides.
  "& rect[data-brand]": { opacity: 0 },
  "& stop": { stopColor: "token(colors.text.highlight)" },
  "[data-hover-brand]:is(:hover, [data-hover-held], html[data-keyboard-focus] :focus-visible) &": {
    "& rect[data-brand]": { opacity: 0.6 },
  },
});

const FRAME_CORNER = { x: "var(--frame-x)", y: "var(--frame-y)" } as CSSProperties;
// Whole at the top, clear a quarter of the way down; 65 stops, so the ramp shows no edge. Rounded, so the server's
// render and the browser's agree.
const brandEase = cubicBezier(0.44, 0.12, 0.24, 1);
const BRAND_STOPS = Array.from({ length: 65 }, (_, i) => i / 64).map((t) => ({
  offset: t,
  opacity: Number(brandEase(1 - t).toFixed(4)),
}));

/** The line round a card (`crop`, keeping to its crop, its top brand while hovered) or its sheet. */
export function Frame({ crop, ...props }: { crop?: boolean } & HTMLAttributes<HTMLSpanElement>) {
  const brand = `frame-brand${useId().replace(/[^\w-]/g, "")}`;
  return (
    <span aria-hidden className={frameStyle} data-crop={crop ? "" : undefined} {...props}>
      <svg>
        {crop && (
          <defs>
            <linearGradient id={brand} x1="0" y1="0" x2="0" y2="0.25">
              {BRAND_STOPS.map(({ offset, opacity }) => (
                <stop key={offset} offset={offset} stopOpacity={opacity} />
              ))}
            </linearGradient>
          </defs>
        )}
        <rect style={FRAME_CORNER} />
        {crop && <rect data-brand="" style={{ ...FRAME_CORNER, stroke: `url(#${brand})` }} />}
      </svg>
    </span>
  );
}

// The cover under the card's heading, filling its face.
const coverLayerStyle = css({ position: "absolute", inset: 0 });

// The card is the link, so the icon is drawn, not a button: a ring at rest, the brand fill while the card is
// hovered.
const lit = { backgroundColor: "bg.button.accent.hover", color: "field.text.active", boxShadow: "none" };

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
  // On the card's hover hook, not the card, so a touch can't light it (`SheetCard`).
  "[data-hover-brand]:is(:hover, [data-hover-held]) &": { ...RODE, ...lit },
  "html[data-keyboard-focus] [data-sheet-card]:focus-visible &": { ...RODE, ...lit },
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

// Over the cover, clear of the expand icon. It rides the surface's top-left corner. It and the icon slide on layers
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

// The eyebrow turns to the brand colour while the card is hovered; the heading stays.
const faceTitleStyle = css({
  textStyle: "caption",
  color: "text.body",
  transition: "color 300ms ease",
  "[data-hover-brand]:is(:hover, [data-hover-held], html[data-keyboard-focus] :focus-visible) &": { color: "text.highlight" },
});
const faceHeadingStyle = css({ color: "text.title", textWrap: "balance" });
const cardHeadingStyle = css({ textStyle: "subheading" });
const sheetHeadingStyle = css({ textStyle: "subheadingLarge" });
// Each word its own box, so the sheet can bring the heading in a line at a time.
const sheetWordStyle = css({ display: "inline-block" });

/** On the card (`place="card"`), its text over its cover, or at the top of the sheet, larger and alone. */
export function CardFace({ card, place }: { card: ProjectCard; place: "card" | "sheet" }) {
  const onCard = place === "card";
  const text = (
    <span className={cx(faceTextStyle, onCard ? cardTextStyle : sheetTextStyle)} data-face-text="">
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
  return (
    <span className={faceStyle}>
      <span className={coverLayerStyle} data-face-picture="">
        <DisplayCover card={card} />
      </span>
      <span className={faceCardStyle}>{text}</span>
    </span>
  );
}

// How long a card waits, once `shown`, before playing as if hovered.
const SHOWN_HOVER_DELAY = 100;
// More of it on screen than the sliver a neighbour shows, peeking past the card in view.
const IN_SIGHT = { enter: 0.1, exit: 0.1 };

/**
 * A link to its sheet's address, which `onOpen` opens in place. Without `onOpen` the card doesn't open. `shown` is for
 * a screen without a cursor: whether the card is whole on screen. It plays as if hovered `SHOWN_HOVER_DELAY` after,
 * until it is out of sight.
 */
export function SheetCard({
  card,
  base,
  shown,
  onOpen,
}: {
  card: ProjectCard;
  base?: string;
  shown?: boolean;
  onOpen?: (card: ProjectCard) => void;
}) {
  const slideRef = useRef<HTMLDivElement>(null);
  const inSight = useInView(slideRef, { ...IN_SIGHT, enabled: shown !== undefined });
  const { on: held } = useShownHover(shown ?? false, inSight, SHOWN_HOVER_DELAY);
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
      <span aria-hidden className={expandStyle}>
        <ExpandIcon />
      </span>
    </span>
  );
  // Without a cursor, iOS keeps the card a finger last touched hovered, on screen or off: the card offers its hover
  // hook only while it plays.
  const host = shown === undefined || held ? { "data-hover-brand": "", "data-hover-held": held ? "" : undefined } : {};

  return (
    <div ref={slideRef} className={cx(carouselStyles.slide, slideStyle)} data-carousel-slide="">
      {onOpen ? (
        <a
          href={projectPath(card.id, base)}
          className={cardStyle}
          data-sheet-card={card.id}
          {...host}
          aria-label={`${card.title}: ${card.sentence}`}
          aria-haspopup="dialog"
          onClick={(event) => {
            if (!isPlainClick(event)) return;
            event.preventDefault();
            onOpen(card);
          }}
        >
          {surface}
        </a>
      ) : (
        <div className={cardStyle} data-sheet-card={card.id} data-closed="" {...host}>
          {surface}
        </div>
      )}
    </div>
  );
}
