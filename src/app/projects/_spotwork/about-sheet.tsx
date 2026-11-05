"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { css, cx } from "../../../../styled-system/css";
import { action } from "../../../../styled-system/recipes";
import { useActionTooltip } from "@/components/ui/action";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Marked } from "./marked";
import { MetricCard } from "./metric-card";
import ChevronDownIcon from "@/assets/icons/chevron-down.svg";
import CrossIcon from "@/assets/icons/cross.svg";
import GotoIcon from "@/assets/icons/goto.svg";
import PlayIcon from "@/assets/icons/play.svg";
import RightSidebarIcon from "@/assets/icons/right-sidebar.svg";
import { ABOUT, type AboutProject, type Demo, type Fact, type Link, type Story } from "./about-stories";
import { CommentEditor, EditCommentsToggle } from "./comment-editor";
import { DEMO, SIDEBAR } from "./copy";
import { FROSTED, LAYERS, cardGroundStyle, sheetVars, useSheetTuning } from "./sheet-tuning";
import { useCommentEditor } from "./tour";

// A project's story over the overlay, as Notification Center draws its own: cards on a blur that thickens
// toward the right edge, or down from its top edge under the window. From 1440px, and on a tablet on its side, a
// dockable sheet stays open beside the window instead (the overlay gives it the room); on a touch screen upright, under
// the window, scrolling up over it. Its blur, cards, column and motion read the variables its properties panel sets
// (sheet-tuning.ts).

// 1440px, or a touch screen on its side from 1024px, which docks it; the styles write the same query out, as Panda has
// no breakpoint there.
const WIDE = "screen and (min-width: 90rem), screen and (orientation: landscape) and (any-pointer: coarse) and (min-width: 64rem)";
// A touch screen upright, short of 1440px, which lays it under the window.
const UPRIGHT = "screen and (orientation: portrait) and (any-pointer: coarse) and (width < 90rem)";
// Docked short of 1440px, on a tablet on its side, where it can be hidden to give the window the room.
const STOWABLE = "screen and (orientation: landscape) and (any-pointer: coarse) and (min-width: 64rem) and (width < 90rem)";

/** Whether the window matches the media `query`; never on the server. */
export function useMedia(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

/** Whether the window is wide enough for the sheet to dock. */
export const useWide = () => useMedia(WIDE);

/** Whether the window is a touch screen's upright, with the sheet under it. */
export const useUpright = () => useMedia(UPRIGHT);

/** Whether the window is a tablet's on its side, where the docked sheet can be hidden. */
export const useStowable = () => useMedia(STOWABLE);

// Each layer ramps in from clear at its left edge, or its top edge, under its own mask, which also shapes its tint;
// the layers stacked are the blur.
const BLUR = LAYERS.map(
  (layer) =>
    ({
      backdropFilter: `var(--sheet-${layer}-filter)`,
      WebkitBackdropFilter: `var(--sheet-${layer}-filter)`,
      backgroundColor: `color-mix(in srgb, var(--colors-bg-surface) var(--sheet-${layer}-tint), transparent)`,
      "--layer-width": `var(--sheet-${layer}-width)`,
      "--layer-mask": `var(--sheet-${layer}-mask)`,
      "--layer-turned-mask": `var(--sheet-${layer}-turned-mask)`,
      "--layer-opacity": `var(--sheet-${layer}-opacity)`,
    }) as CSSProperties,
);

const sheetStyle = css({
  position: "absolute",
  insetBlock: 0,
  insetInlineEnd: 0,
  // Over the tour's tips.
  zIndex: 11,
  display: "flex",
  justifyContent: "flex-end",
  // As wide as its widest layer or its column; each keeps its own width.
  width:
    "min(max(var(--sheet-column-width), var(--sheet-outer-width), var(--sheet-middle-width), var(--sheet-inner-width)), 100%)",
  overflow: "clip",
  visibility: "hidden",
  transitionProperty: "visibility",
  transitionDuration: "var(--sheet-duration)",
  // Visible at once, so focus can move in.
  "&[data-open]": { visibility: "visible", transitionDuration: "0s" },
  // Docked, its blur reaches over the window's edge, so only its column takes presses. The column's scroll reaches to
  // xxl short of the window, past the stage's inset and the window's slack, and never less than its own inset.
  "&[data-dockable]": {
    "@media screen and (min-width: 90rem), screen and (orientation: landscape) and (any-pointer: coarse) and (min-width: 64rem)": {
      "--sheet-reach":
        "max(var(--sheet-column-inset), calc(var(--window-slack, 0px) + token(spacing.4xl) - token(spacing.xxl)))",
      width:
        "min(max(calc(var(--sheet-column-width) - var(--sheet-column-inset) + var(--sheet-reach)), var(--sheet-outer-width), var(--sheet-middle-width), var(--sheet-inner-width)), 100%)",
      visibility: "visible",
      transitionDuration: "0s",
      pointerEvents: "none",
    },
  },
  // Under the window, in the overlay's scroll below the window, so it scrolls up over it; the window's inset is the
  // stage's.
  "&[data-upright]": {
    "--window-inset": "token(spacing.4xl)",
    "@media screen and (width < 51.25rem), screen and (height < 31.25rem)": {
      "--window-inset": "token(spacing.lg)",
    },
    position: "relative",
    gridArea: "1 / 1",
    inset: "auto",
    width: "100%",
    marginBlockStart: "var(--stage-height)",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    visibility: "visible",
    transitionDuration: "0s",
  },
  _motionReduce: { transitionDuration: "0s" },
});

// Under the window, the blur rides the sheet's top edge up to the overlay's controls and stays there, the rest of the
// screen's height; scrolled up that far, the sheet ends.
const groundStyle = css({
  "[data-upright] > &": {
    gridArea: "1 / 1",
    position: "sticky",
    insetBlockStart: "calc(token(spacing.3xl) + token(spacing.4xl))",
    height: "calc(100dvh - token(spacing.3xl) - token(spacing.4xl))",
  },
});

// Opacity on the layers themselves: on an ancestor it would cut the blur off from what's behind until it settled.
const blurStyle = css({
  position: "absolute",
  insetBlock: 0,
  insetInlineEnd: 0,
  width: "var(--layer-width)",
  maskImage: "var(--layer-mask)",
  WebkitMaskImage: "var(--layer-mask)",
  opacity: 0,
  transitionProperty: "opacity",
  transitionDuration: "var(--sheet-duration)",
  transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
  "[data-open] > div > &": { opacity: "var(--layer-opacity)" },
  "[data-dockable] > div > &": { "@media screen and (min-width: 90rem), screen and (orientation: landscape) and (any-pointer: coarse) and (min-width: 64rem)": { opacity: "var(--layer-opacity)" } },
  // Under the window, a quarter turn clockwise: the whole width, its ramp a fixed length down from its top edge.
  "[data-upright] > div > &": {
    opacity: "var(--layer-opacity)",
    width: "100%",
    maskImage: "var(--layer-turned-mask)",
    WebkitMaskImage: "var(--layer-turned-mask)",
  },
  _motionReduce: { transitionDuration: "0s" },
});

const columnStyle = css({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: "var(--sheet-card-gap)",
  width: "min(var(--sheet-column-width), 100%)",
  padding: "var(--sheet-column-inset)",
  overflowY: "auto",
  translate: "100% 0",
  transitionProperty: "translate",
  transitionDuration: "var(--sheet-duration)",
  transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
  "[data-open] > &": { translate: "none" },
  "[data-dockable] > &": {
    "@media screen and (min-width: 90rem), screen and (orientation: landscape) and (any-pointer: coarse) and (min-width: 64rem)": {
      width: "min(calc(var(--sheet-column-width) - var(--sheet-column-inset) + var(--sheet-reach)), 100%)",
      paddingInlineStart: "var(--sheet-reach)",
      translate: "none",
      pointerEvents: "auto",
    },
  },
  // Under the window, centred and no wider than an article, its cards a 4xl below the window.
  "[data-upright] > &": {
    gridArea: "1 / 1",
    width: "100%",
    paddingInline: "max(var(--window-inset), calc((100% - token(sizes.articleContent)) / 2))",
    paddingBlockStart: "4xl",
    overflowY: "visible",
    translate: "none",
    // Put there, not slid in: the page coming live lays it out upright, under the overlay's opening.
    transitionDuration: "0s",
  },
  _motionReduce: { transitionDuration: "0s" },
});

// Its Close where the overlay's own is, at the column's default inset, staying there over the cards as they scroll;
// only its buttons take presses there. A sticky inset counts from inside the column's padding.
const headStyle = css({
  position: "sticky",
  insetBlockStart: 0,
  zIndex: 1,
  display: "flex",
  justifyContent: "flex-end",
  pointerEvents: "none",
  "& button": { pointerEvents: "auto" },
});

// Its buttons' bar, its padding outside them so they stand where they would without it.
const barStyle = css({
  position: "relative",
  display: "flex",
  alignItems: "center",
  // The overlay's controls' gap, so its toggle stands where theirs does once it's hidden.
  gap: "md",
  padding: "md",
  margin: "calc(token(spacing.md) * -1)",
  borderRadius: "full",
});

// Blurring the cards under the bar; clear over the sheet's own ground.
const barGroundStyle = css({
  position: "absolute",
  inset: 0,
  zIndex: -1,
  borderRadius: "inherit",
  opacity: 0,
  transitionProperty: "opacity",
  transitionDuration: "var(--sheet-duration)",
  transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
  "[data-covered] > &": { opacity: 1 },
  _motionReduce: { transitionDuration: "0s" },
});

const cardStyle = cx(
  cardGroundStyle,
  css({
    display: "flex",
    flexDirection: "column",
    gap: "md",
    flexShrink: 0,
    padding: "var(--sheet-card-padding)",
    // The metric card draws its own padding and corners.
    "&[data-flush]": { padding: 0, overflow: "hidden" },
  }),
);

// An eyebrow's letters start where the card's padding ends.
const labelStyle = css({ textStyle: "caption", color: "text.body", textBox: "trim-both cap alphabetic" });

const headingStyle = css({ textStyle: "quote", color: "text.title", textWrap: "balance" });

const bodyStyle = css({ textStyle: "bodySmall", color: "text.body" });

// A row under a card's words, the card's gap above its divider (none atop its card): a fact beside its value, or a
// demo beside its Play.
const rowStyle = css({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "xl",
  paddingBlockStart: "md",
  borderBlockStartWidth: "1px",
  borderBlockStartStyle: "dashed",
  borderBlockStartColor: "border.divider",
  // A list keeps the label on its first line.
  "&[data-list]": { alignItems: "baseline" },
  "&:first-child": { paddingBlockStart: 0, borderBlockStartWidth: 0 },
});

const rowTextStyle = css({ textStyle: "bodyLarge", color: "text.title", whiteSpace: "nowrap" });

const rowListStyle = css({ display: "flex", flexDirection: "column", alignItems: "flex-end" });

// Half the card's gap. A chevron sits at its end, on its first line.
const cardHeadStyle = css({
  display: "grid",
  gridTemplateColumns: "1fr auto",
  rowGap: "sm",
  "& > :not(svg)": { gridColumn: 1 },
  "& > span + h2": { gridColumn: "1 / -1" },
});

// The heading's words, a button for the keyboard only: the card takes the pointer's presses.
const headingToggleStyle = css({ textAlign: "inherit" });

// Centred on its line without making it taller.
const chevronStyle = css({
  gridColumn: 2,
  gridRow: 1,
  alignSelf: "center",
  width: "xxl",
  height: "xxl",
  marginBlock: "-md",
  marginInlineStart: "md",
  color: "text.body",
  rotate: "180deg",
  transitionProperty: "rotate",
  transitionDuration: "var(--sheet-duration)",
  transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
  "[data-folded] &": { rotate: "0deg" },
  "& path[stroke]": { stroke: "currentColor" },
  _motionReduce: { transitionDuration: "0s" },
});

// A card's words, folded to nothing under its head along with the card's gap above them.
const foldStyle = css({
  display: "grid",
  gridTemplateRows: "1fr",
  transitionProperty: "grid-template-rows, margin-block-start",
  transitionDuration: "var(--sheet-duration)",
  transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
  "&[inert]": { gridTemplateRows: "0fr", marginBlockStart: "-md" },
  "& > div": { display: "flex", flexDirection: "column", gap: "md", minHeight: 0, overflow: "hidden" },
  _motionReduce: { transitionDuration: "0s" },
});

/** The sheet's last card: a row for each fact, its roles one a line, as its year is set, or its year. */
function FactsCard({ facts }: { facts: Fact[] }) {
  const id = useId();
  return (
    <div className={cardStyle} style={FROSTED} data-card="">
      {facts.map((fact, i) => (
        <div key={fact.label} className={rowStyle} data-list={"list" in fact ? "" : undefined}>
          <span id={`${id}-${i}`} className={rowTextStyle}>
            {fact.label}
          </span>
          {"list" in fact ? (
            <ul className={rowListStyle} aria-labelledby={`${id}-${i}`}>
              {fact.list.map((item) => (
                <li key={item} className={rowTextStyle}>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <span className={rowTextStyle}>{fact.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * A row under a card's words, one button named by them: what it does, beside the icon button's look, which lights
 * with its tooltip, `name`, from anywhere on the row.
 */
function ActionRow({
  label,
  name,
  onClick,
  children,
}: {
  label: string;
  name: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const { tooltipNode, visible, show, hide } = useActionTooltip(
    <Tooltip>
      <Tooltip.Text>{name}</Tooltip.Text>
    </Tooltip>,
  );
  return (
    <>
      <button
        type="button"
        className={rowStyle}
        aria-describedby={id}
        onClick={onClick}
        onPointerEnter={show}
        onPointerLeave={hide}
        // Safari's default Tab order skips a <button> without an explicit tabindex.
        tabIndex={0}
        data-row=""
      >
        <span className={rowTextStyle}>{label}</span>
        <span className={action({ variant: "icon", emphasis: "accent" })} data-hover={visible ? "" : undefined}>
          {children}
        </span>
      </button>
      <span id={id} hidden>
        {name}
      </span>
      {tooltipNode}
    </>
  );
}

/**
 * A card of the story: its words, then, given `onPlay`, a row for each demo, its label beside its Play, and, given
 * `onGo`, a row for each page it opens. One that `folds` starts with its words folded under its chevron; a press
 * anywhere on it but a row or a link unfolds or folds them.
 */
function StoryCard({
  label,
  heading,
  body,
  demos = [],
  links = [],
  folds = false,
  onPlay,
  onGo,
}: Story & { folds?: boolean; onPlay?: (demo: Demo) => void; onGo?: (link: Link) => void }) {
  const id = useId();
  const [open, setOpen] = useState(!folds);
  return (
    <section
      className={cardStyle}
      style={FROSTED}
      aria-labelledby={id}
      data-card=""
      data-folds={folds ? "" : undefined}
      data-folded={open ? undefined : ""}
      onClick={(event) => {
        if (folds && !(event.target as Element).closest("a, [data-row]")) setOpen(!open);
      }}
    >
      <div className={cardHeadStyle}>
        {label && <span className={labelStyle}>{label}</span>}
        <h2 id={id} className={headingStyle}>
          {folds ? (
            <button type="button" className={headingToggleStyle} aria-expanded={open} aria-controls={`${id}-body`}>
              {heading}
            </button>
          ) : (
            heading
          )}
        </h2>
        {folds && <ChevronDownIcon className={chevronStyle} aria-hidden data-chevron="" />}
      </div>
      <div id={`${id}-body`} className={foldStyle} inert={!open}>
        <div>
          {body.map((paragraph) => (
            <p key={paragraph} className={bodyStyle}>
              <Marked text={paragraph} />
            </p>
          ))}
        </div>
      </div>
      {onPlay &&
        demos.map((demo) => (
          <ActionRow key={demo.label} label={demo.label} name={DEMO.play} onClick={() => onPlay(demo)}>
            <PlayIcon aria-hidden />
          </ActionRow>
        ))}
      {onGo &&
        links.map((link) => (
          <ActionRow key={link.label} label={link.label} name={SIDEBAR.links.open} onClick={() => onGo(link)}>
            <GotoIcon aria-hidden />
          </ActionRow>
        ))}
    </section>
  );
}

export function AboutSheet({
  open,
  project = "check-ins",
  dockable = false,
  onClose,
  onStow,
  opener,
  onPlay,
  onGo,
}: {
  /** Floating over the window; a docked sheet is always open. */
  open: boolean;
  /** Whose story it tells. */
  project?: AboutProject;
  /**
   * Docked beside the window from 1440px and on a tablet on its side, where its Close is the overlay's own, and under
   * it on a touch screen upright, where the overlay's Close stays.
   */
  dockable?: boolean;
  onClose: () => void;
  /** Hides it while docked, from a toggle left of its Close. */
  onStow?: () => void;
  /** The button that opened it, which focus goes back to. */
  opener: RefObject<HTMLButtonElement | null>;
  /** Plays a demo from its card. */
  onPlay?: (demo: Demo) => void;
  /** Opens a page of the design system's site from its card. */
  onGo?: (link: Link) => void;
}) {
  const about = ABOUT[project];
  const docked = useWide() && dockable;
  const upright = useUpright() && dockable;
  const floating = open && !docked && !upright;
  const { editing } = useCommentEditor();
  const sheet = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [covered, setCovered] = useState(false);
  const [tuning] = useSheetTuning();

  // Focus follows the sheet in, and back to its button unless a press outside took it elsewhere.
  const wasOpen = useRef(false);
  useEffect(() => {
    const focused = document.activeElement;
    if (floating) close.current?.focus({ preventScroll: true });
    else if (wasOpen.current && (!focused || focused === document.body || sheet.current?.contains(focused)))
      opener.current?.focus({ preventScroll: true });
    wasOpen.current = floating;
  }, [floating, opener]);

  useEffect(() => {
    const node = sheet.current;
    if (!floating || !node) return;
    node.addEventListener("escape-layer", onClose);
    return () => node.removeEventListener("escape-layer", onClose);
  }, [floating, onClose]);

  return (
    <aside
      ref={sheet}
      className={sheetStyle}
      style={sheetVars(tuning) as CSSProperties}
      aria-label="About the project"
      data-open={floating ? "" : undefined}
      data-dockable={dockable ? "" : undefined}
      data-upright={upright ? "" : undefined}
      data-escape-layer={floating ? "" : undefined}
      inert={!floating && !docked && !upright}
      onClick={(event) => {
        if (floating && !(event.target as Element).closest("[data-card], button")) onClose();
      }}
    >
      <div className={groundStyle} aria-hidden>
        {BLUR.map((layer, i) => (
          <div key={LAYERS[i]} className={blurStyle} style={layer} data-overlay-motion="ground" />
        ))}
      </div>
      <div
        className={columnStyle}
        data-overlay-motion="cards"
        onScroll={(event) => {
          const card = event.currentTarget.querySelector("[data-card]");
          const head = bar.current?.getBoundingClientRect();
          setCovered(!!card && !!head && card.getBoundingClientRect().top < head.bottom);
        }}
      >
        {/* Under the window, the overlay's controls carry Close and the comments' toggle. */}
        {!upright && (
          <div className={headStyle}>
            <div ref={bar} className={barStyle} data-covered={covered ? "" : undefined}>
              <div className={barGroundStyle} style={FROSTED} aria-hidden />
              <EditCommentsToggle />
              {docked && onStow && (
                <Button variant="icon" emphasis="glass" shape="circle" aria-label={SIDEBAR.hide} onClick={onStow}>
                  <RightSidebarIcon aria-hidden />
                </Button>
              )}
              <Button ref={close} variant="icon" emphasis="glass" shape="circle" aria-label="Close" onClick={onClose}>
                <CrossIcon aria-hidden />
              </Button>
            </div>
          </div>
        )}
        {editing ? (
          <div className={cardStyle} style={FROSTED} data-card="">
            <CommentEditor />
          </div>
        ) : (
          <>
            {about.sections.map((section, i) => (
              <StoryCard key={section.heading} {...section} folds={i > 0} onPlay={onPlay} onGo={onGo} />
            ))}
            {"outcome" in about && (
              <div className={cardStyle} style={FROSTED} data-card="" data-flush="">
                <MetricCard metric={about.outcome} variant="brand" dots={false} square={false} />
              </div>
            )}
            <FactsCard facts={about.facts} />
          </>
        )}
      </div>
    </aside>
  );
}
