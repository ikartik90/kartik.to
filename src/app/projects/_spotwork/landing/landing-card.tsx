"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type HTMLAttributes } from "react";
import { css, cx } from "../../../../../styled-system/css";
import { carousel } from "../../../../../styled-system/recipes";
import ExpandIcon from "@/assets/icons/expand.svg";
import { useShownHover } from "../use-shown-hover";
import { mediaSurfaceAspect } from "@/domain/nodes";
import { useInView } from "@/hooks/use-in-view";
import { projectPath, type ProjectCard } from "@/data/project-cards";
import { isPlainClick } from "@/utils/plain-click";
import { cubicBezier } from "@/utils/eased-fade";
import { AppVeil } from "../app-veil";
import { useLiveApp } from "../use-live-app";
import { Backlight } from "./backlight";
import { Monitor } from "./monitor";

// A project's card on the homepage, the live app playing the project's demo on a backlit monitor's screen, under its
// words. A link to the project's address, which a plain click opens over the page instead.

const carouselStyles = carousel();
const CLIP_ASPECT = mediaSurfaceAspect({ width: 2160, height: 1350 }, { padding: 40 });

// Below md each card's words take their own height, so the slides stretch to the tallest and the cards fill them.
const slideStyle = css({
  paddingBlock: "md",
  "[data-entering] &": { opacity: 0 },
  mdDown: { alignSelf: "stretch", display: "flex" },
});

const HOVER_EASE = "800ms cubic-bezier(0.165, 0.84, 0.44, 1)";
const INSET_Y = "token(spacing.sm)";
const INSET_X = "calc(token(spacing.sm) * var(--slide-aspect))";
const OPEN_CLIP = "inset(0 round token(radii.xl))";
const RIDING = { "--ride-x": INSET_X, "--ride-y": INSET_Y };
const RODE = { "--ride-x": "0px", "--ride-y": "0px" };
const RIDE = `--ride-x ${HOVER_EASE}, --ride-y ${HOVER_EASE}`;

const ring = { outline: "1.5px solid var(--colors-border-focus-ring)", outlineOffset: "2px" };

// As tall as the large carousel's slides, or from `xl` as the column is wide at 16:10, and never wider than the
// column. From `md`, where the gutter is barely wider than the gap between slides, it gives up the room
// that shows as much of the next card as that gap. `cqw` is the carousel's.
const cardStyle = css({
  "--clip-height": "token(sizes.carouselSlideLarge)",
  xl: { "--clip-height": "max(token(sizes.carouselSlideLarge), 100cqw * 10 / 16)" },
  position: "relative",
  display: "block",
  width: "min(var(--clip-height) * var(--slide-aspect), 100cqw)",
  md: {
    width:
      "min(var(--clip-height) * var(--slide-aspect), 100cqw - max(0px, token(spacing.xxl) * 2 - var(--carousel-gutter)))",
  },
  _hasCursor: { marginInline: `calc(-1 * ${INSET_X})` },
  borderRadius: "xl",
  mdDown: { display: "flex", flexDirection: "column" },
});

// The press: over the whole card, the live app under it taking none. First in the card, so the card's pressed, hovered and
// focused looks follow it as siblings (`button:active ~ &`): a `:has()` round it restyled the whole live app each press.
const pressStyle = css({
  position: "absolute",
  zIndex: 4,
  inset: 0,
  padding: "none",
  border: "none",
  borderRadius: "xl",
  background: "none",
  appearance: "none",
  cursor: "pointer",
  outline: "none",
  "html[data-keyboard-focus] &": { "&:focus-visible": ring },
});

const surfaceStyle = css({
  position: "relative",
  display: "block",
  borderRadius: "xl",
  backgroundColor: "bg.canvas",
  clipPath: OPEN_CLIP,
  _hasCursor: { clipPath: `inset(${INSET_Y} ${INSET_X} round token(radii.xl))` },
  transition: `clip-path ${HOVER_EASE}, transform 150ms cubic-bezier(0.4, 0, 0.2, 1)`,
  "[data-sheet-card] > a:active ~ &": { transform: "scale(0.98)" },
  "&[data-hover-held]": { clipPath: OPEN_CLIP },
  "[data-sheet-card] > a:focus-visible ~ &": { clipPath: OPEN_CLIP },
  mdDown: { display: "flex", flexDirection: "column", flexGrow: 1 },
});

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
const BRAND_SHOWN = { "& rect[data-brand]": { opacity: 0.6 } };

const frameStyle = css({
  position: "absolute",
  zIndex: 3,
  inset: 0,
  pointerEvents: "none",
  color: "color-mix(in srgb, token(colors.border.divider) 50%, transparent)",
  ...frameAt("0px", "0px"),
  _hasCursor: { ...frameAt(INSET_X, INSET_Y), "& rect": frameSize(INSET_X, INSET_Y) },
  "& > svg": { display: "block", width: "token(spacing.full)", height: "token(spacing.full)", overflow: "visible" },
  "& rect": {
    ...frameSize("0px", "0px"),
    rx: `calc(token(radii.xl) - ${HALF_LINE})`,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "token(spacing.xxs)",
    transition: `x ${HOVER_EASE}, y ${HOVER_EASE}, width ${HOVER_EASE}, height ${HOVER_EASE}`,
  },
  "& rect[data-brand]": {
    opacity: 0,
    transition: `opacity 300ms ease, x ${HOVER_EASE}, y ${HOVER_EASE}, width ${HOVER_EASE}, height ${HOVER_EASE}`,
  },
  "& stop": { stopColor: "token(colors.text.highlight)" },
  "&[data-hover-held]": { ...FRAME_OPEN, ...BRAND_SHOWN },
  "[data-sheet-card] > a:focus-visible ~ * &": { ...FRAME_OPEN, "&[data-hover-brand]": BRAND_SHOWN },
});

const FRAME_CORNER = { x: "var(--frame-x)", y: "var(--frame-y)" } as CSSProperties;
const brandEase = cubicBezier(0.44, 0.12, 0.24, 1);
const BRAND_STOPS = Array.from({ length: 65 }, (_, i) => i / 64).map((t) => ({
  offset: t,
  opacity: Number(brandEase(1 - t).toFixed(4)),
}));

function Frame(props: HTMLAttributes<HTMLSpanElement>) {
  const brand = `frame-brand${useId().replace(/[^\w-]/g, "")}`;
  return (
    <span aria-hidden className={frameStyle} {...props}>
      <svg>
        <defs>
          <linearGradient id={brand} x1="0" y1="0" x2="0" y2="0.25">
            {BRAND_STOPS.map(({ offset, opacity }) => (
              <stop key={offset} offset={offset} stopOpacity={opacity} />
            ))}
          </linearGradient>
        </defs>
        <rect style={FRAME_CORNER} />
        <rect data-brand="" style={{ ...FRAME_CORNER, stroke: `url(#${brand})` }} />
      </svg>
    </span>
  );
}

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
  "&[data-hover-held]": { ...RODE, ...lit },
  "html[data-keyboard-focus] [data-sheet-card] > a:focus-visible ~ * &": { ...RODE, ...lit },
});

const faceStyle = css({
  position: "relative",
  display: "block",
  width: "token(spacing.full)",
  aspectRatio: "var(--slide-aspect)",
  minHeight: 0,
  overflow: "hidden",
  mdDown: { aspectRatio: "auto", display: "flex", flexDirection: "column", flexGrow: 1 },
});
const faceTextStyle = css({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: "xs",
  paddingBlockStart: "xl",
  paddingInlineStart: "xl",
  textAlign: "start",
  paddingInlineEnd: "calc(token(spacing.4xl) + token(spacing.xl))",
  paddingBlockEnd: "xl",
  gridArea: "1 / 1",
  willChange: "transform",
  translate: "var(--ride-x) var(--ride-y)",
  transition: RIDE,
  _hasCursor: { ...RIDING, paddingBlockEnd: `calc(token(spacing.xl) + ${INSET_Y})` },
  "&[data-hover-held]": RODE,
  "[data-sheet-card] > a:focus-visible ~ * &": RODE,
  mdDown: { order: -1, paddingBlockEnd: 0 },
});
const faceTitleStyle = css({
  textStyle: "caption",
  color: "text.body",
  transition: "color 300ms ease",
  "&[data-hover-held]": { color: "text.highlight" },
  "[data-sheet-card] > a:focus-visible ~ * &": { "&[data-hover-brand]": { color: "text.highlight" } },
});
const faceHeadingStyle = css({ textStyle: "subheading", color: "text.title", textWrap: "balance" });

// The monitor and its backlight covering the face from its top, the words on it, and the app's window on the monitor's
// screen (monitor.tsx). Centred without a transform, which would cut the stand off the backlight. The words' row is as
// tall as the bezel's offset or the words, so the monitor moves down only as far as it keeps them xl clear of the bezel.
// Below md, where the words would cover the screen, the monitor sits under them at the face's foot instead. The bezel's
// top is monitor.tsx's 139.5 of its 1536 width, written out for Panda, which can't read it through an import.
const BEZEL_OFFSET = "calc(var(--monitor-w) * 139.5 / 1536)";
const coverStyle = css({
  "--monitor-w": "max(100cqw, 100cqh * 1536 / 1099)",
  position: "absolute",
  inset: 0,
  containerType: "size",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  alignContent: "start",
  pointerEvents: "none",
  _before: { content: '""', gridArea: "1 / 1", height: BEZEL_OFFSET },
  mdDown: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    containerType: "inline-size",
    _before: { display: "none" },
  },
});
const groundStyle = css({ position: "absolute", inset: 0 });
const monitorStyle = css({
  position: "relative",
  gridArea: "2 / 1",
  marginBlockStart: `calc(-1 * ${BEZEL_OFFSET})`,
  marginInlineStart: "calc(50cqw - var(--monitor-w) / 2)",
  width: "var(--monitor-w)",
  aspectRatio: "1536 / 1099",
  mdDown: { "--monitor-w": "100cqw", marginBlockStart: "auto" },
});
const windowStyle = css({
  position: "absolute",
  insetInlineStart: "calc(100% * 179 / 1536)",
  insetBlockStart: "calc(100% * 153 / 1099)",
  width: "calc(100% * 1181 / 1536)",
  aspectRatio: "1440 / 900",
  overflow: "clip",
});

const SHOWN_HOVER_DELAY = 100;
const IN_SIGHT = { enter: 0.1, exit: 0.1 };

/**
 * `shown`, on a screen without a cursor: whether the card is whole on screen, so it plays as if hovered. `hovered`, with
 * a cursor: whether it's under it, as it was when the page last came to rest (`useRestingHover`), never `:hover`.
 */
export function LandingCard({
  card,
  shown,
  hovered = false,
  near,
  paused,
  base,
  themeClassName,
  onOpen,
}: {
  card: ProjectCard;
  base?: string;
  shown?: boolean;
  hovered?: boolean;
  near: boolean;
  paused: boolean;
  themeClassName?: string;
  onOpen: () => void;
}) {
  // The monitor and its backlight draw at once; the app on its screen comes in once its code has.
  const live = useLiveApp();
  const [drawn, setDrawn] = useState(false);
  const onShown = useCallback(() => setDrawn(true), []);
  const slideRef = useRef<HTMLDivElement>(null);
  const inSight = useInView(slideRef, { ...IN_SIGHT, enabled: shown !== undefined });
  const { on: shownHeld } = useShownHover(shown ?? false, inSight, SHOWN_HOVER_DELAY);
  const held = shown === undefined ? hovered : shownHeld;
  useEffect(() => {
    for (const name of ["--ride-x", "--ride-y"]) {
      try {
        CSS.registerProperty({ name, syntax: "<length>", inherits: false, initialValue: "0px" });
      } catch {
        // Registered already, by another card.
      }
    }
  }, []);
  // On the parts the hover restyles, never on an element round the live app for its styles to follow: Safari then
  // restyles the whole app.
  const hover = { "data-hover-held": held ? "" : undefined };
  const brand = { ...hover, "data-hover-brand": shown === undefined || held ? "" : undefined };

  return (
    <div
      ref={slideRef}
      className={cx(carouselStyles.slide, slideStyle)}
      style={{ "--slide-aspect": String(CLIP_ASPECT) } as CSSProperties}
      data-carousel-slide=""
    >
      <div className={cardStyle} data-sheet-card={card.id}>
        <a
          href={projectPath(card.id, base)}
          className={pressStyle}
          aria-label={`${card.title}: ${card.sentence}`}
          aria-haspopup="dialog"
          onClick={(event) => {
            if (!isPlainClick(event)) return;
            event.preventDefault();
            onOpen();
          }}
        />
        <span className={surfaceStyle} {...hover}>
          <span className={faceStyle}>
            <span className={coverStyle} data-cover="">
              <span className={monitorStyle}>
                <Backlight className={groundStyle} />
                <Monitor />
                <span className={windowStyle}>
                  {live && <live.LiveDemo project={card.id} paused={paused} near={near} onShown={onShown} />}
                  <AppVeil shown={drawn} className={themeClassName} />
                </span>
              </span>
              <span className={faceTextStyle} {...hover}>
                <span className={faceTitleStyle} {...brand}>{card.title}</span>
                <span className={faceHeadingStyle}>{card.sentence}</span>
              </span>
            </span>
          </span>
          <Frame {...brand} />
          <span aria-hidden className={expandStyle} {...hover}>
            <ExpandIcon />
          </span>
        </span>
      </div>
    </div>
  );
}
