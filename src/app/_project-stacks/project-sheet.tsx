"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { css } from "../../../styled-system/css";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import CrossIcon from "@/assets/icons/cross.svg";
import { isBottomSheetLayout } from "@/data/media-queries";
import { cubicBezier } from "@/utils/eased-fade";
import { ZOOM_MS } from "@/utils/lightbox-motion";
import type { ProjectCard } from "./data";
import { focusIn, reducedMotion, RISE_CURVE, RISE_MS } from "./opening";
import { OnboardingSheet } from "./onboarding-sheet";
import { CardFace, Frame } from "./sheet-card";
import { ShiftSheet } from "./shift-sheet";

// The card's sheet: the panel fades in as it slides up, its heading coming into focus a line at a time and the rest
// a block at a time; closing fades it as it drops. A bottom sheet rises from the view's foot instead.

const SHEETS: Record<string, ReactNode> = {
  onboarding: <OnboardingSheet />,
  "shift-scheduling": <ShiftSheet />,
};

const dialogStyle = css({
  width: "token(spacing.full)",
  height: "100dvh",
  maxWidth: "none",
  maxHeight: "none",
  overflowY: "auto",
  // No sideways scrollbar while the panel moves.
  overflowX: "hidden",
  overscrollBehavior: "contain",
  overflowAnchor: "none",
  "--sheet-gutter": "token(spacing.5xl)",
  paddingBlock: "var(--sheet-gutter)",
  paddingInline: "xxl",
  mdDown: { "--sheet-gutter": "token(spacing.xxl)", paddingInline: "lg" },
  backgroundColor: "transparent",
  focusVisibleRing: "none",
  // A bottom sheet: the panel at the view's foot, scrolling inside itself, under the view's height of nothing that
  // swiping it down scrolls into. The backdrop clears as it goes (`--sheet-shown`, 0 to 1).
  _bottomSheet: {
    "--sheet-gutter": "0px",
    paddingInline: 0,
    overflowY: "scroll",
    overscrollBehavior: "none",
    scrollSnapType: "y mandatory",
    scrollbarWidth: "none",
    // Over the Dialog's own `[open]::backdrop`.
    "&:is(dialog)[open]::backdrop": { opacity: "var(--sheet-shown, 1)", transition: "none" },
    "& > [data-sheet-panel]": {
      width: "token(spacing.full)",
      height: "calc(100dvh - token(spacing.4xl))",
      marginBlockStart: "4xl",
      overflowX: "hidden",
      overflowY: "auto",
      scrollSnapAlign: "end",
      borderEndStartRadius: 0,
      borderEndEndRadius: 0,
      // Its edge, where the sheet is the page's own ground: the frame (`Frame`) can't follow its scroll.
      boxShadow:
        "0 0 0 token(spacing.xxs) color-mix(in srgb, token(colors.border.divider) 50%, transparent), 0 4px 16px color-mix(in srgb, token(colors.neutral.900) 12%, transparent)",
    },
    // Swiped down, or the room above it pressed, instead.
    "& [data-sheet-border], & [data-sheet-close]": { display: "none" },
  },
});

// What a bottom sheet is swiped down into, above it; its foot, in view over the sheet, closes it.
const sheetRoomStyle = css({
  display: "none",
  _bottomSheet: { display: "block", flexShrink: 0, height: "100dvh", scrollSnapAlign: "start" },
});
// A bottom sheet's grip, over its top.
const gripStyle = css({
  display: "none",
  _bottomSheet: {
    display: "block",
    position: "absolute",
    zIndex: 3,
    insetBlockStart: "lg",
    insetInlineStart: "50%",
    translate: "-50% 0",
    width: "token(spacing.3xl)",
    height: "token(spacing.sm)",
    borderRadius: "full",
    backgroundColor: "border.divider",
  },
});

// It stands on the cards' ground. `--sheet-ground` names it for what paints over the dots in it.
const panelStyle = css({
  position: "relative",
  flexShrink: 0,
  width: "min(token(sizes.articleShowcase), 100%)",
  // Its article across it (globals.css holds an article to the showcase's width), and its clips as tall against it as
  // at 960, 560px of 896.
  xl: {
    width: "min(token(sizes.projectSheetWide), 100%)",
    "--carousel-slide-height": "max(token(sizes.carouselSlideLarge), calc(100cqw * 10 / 16))",
    "& article": { width: "token(spacing.full)" },
  },
  marginInline: "auto",
  overflow: "clip",
  borderRadius: "xl",
  "--sheet-ground": "token(colors.bg.canvas)",
  backgroundColor: "var(--sheet-ground)",
});

const heroStyle = css({ display: "block" });

const contentStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "5xl",
  padding: "3xl",
  mdDown: { padding: "xl", gap: "3xl" },
});

// No height of its own, so the button sits over the face's corner, its top and end on the content's padding: centred
// on a point that far in, plus half the button. Once the sheet's top reaches the top of the view it stays there, over
// the heading (`zIndex` 1) and the frame (2). Sticky holds clear of the dialog's padding, so it sticks that far above.
const closeRowStyle = css({
  "--close-inset": "calc(token(spacing.3xl) + token(spacing.4xl) / 2)",
  mdDown: { "--close-inset": "calc(token(spacing.xl) + token(spacing.4xl) / 2)" },
  position: "sticky",
  zIndex: 3,
  insetBlockStart: "calc(-1 * var(--sheet-gutter))",
  translate: "0 var(--close-inset)",
  height: "0",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  paddingInlineEnd: "var(--close-inset)",
});
const closePointStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "0",
  height: "0",
  "& > button": { flexShrink: 0 },
});

// The projects either side, under a rule at the sheet's foot: the previous at the start, the next at the end.
const navStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  columnGap: "3xl",
  paddingBlockStart: "3xl",
  borderBlockStartWidth: "token(spacing.xxs)",
  borderBlockStartStyle: "solid",
  borderBlockStartColor: "border.divider",
  mdDown: { columnGap: "xl", paddingBlockStart: "xl" },
  // Under a band out to the sheet's edges, its rule out to them too, as the North Star's (`bandStyle` in
  // sheet-article.tsx).
  ":has([data-sheet-band]) > &": {
    width: "calc(100% + 2 * token(spacing.3xl))",
    marginInline: "calc(-1 * token(spacing.3xl))",
    paddingInline: "3xl",
    borderBlockStartColor: "color-mix(in srgb, token(colors.border.divider) 50%, transparent)",
    mdDown: { width: "calc(100% + 2 * token(spacing.xl))", marginInline: "calc(-1 * token(spacing.xl))", paddingInline: "xl" },
  },
});
const navLinkStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "xs",
  padding: 0,
  border: "none",
  background: "none",
  textAlign: "start",
  cursor: "pointer",
  "&[data-sheet-nav='next']": { gridColumn: "2", alignItems: "flex-end", textAlign: "end" },
  "&:hover > [data-nav-name]": { color: "text.highlight" },
  "html[data-keyboard-focus] &": {
    "&:focus-visible": { outline: "1.5px solid var(--colors-border-focus-ring)", outlineOffset: "token(spacing.sm)", borderRadius: "sm" },
  },
});
const navLabelStyle = css({ textStyle: "bodySmall", color: "text.body" });
const navNameStyle = css({ textStyle: "bodyLarge", color: "text.title", textWrap: "balance", transition: "color 150ms ease" });

type Direction = 1 | -1;

/** Links to the projects either side of `card`, wrapping round at the ends. */
function SheetNav({ cards, card, onGo }: { cards: ProjectCard[]; card: ProjectCard; onGo: (id: string, by: Direction) => void }) {
  const at = cards.indexOf(card);
  if (cards.length < 2 || at === -1) return null;
  const sides = [
    { by: -1 as const, label: "Previous", to: cards[(at - 1 + cards.length) % cards.length] },
    { by: 1 as const, label: "Next", to: cards[(at + 1) % cards.length] },
  ];
  return (
    <nav className={navStyle} aria-label="More projects" data-sheet-step="">
      {sides.map(({ by, label, to }) => (
        <button
          key={label}
          type="button"
          className={navLinkStyle}
          data-sheet-nav={by === 1 ? "next" : "previous"}
          onClick={() => onGo(to.id, by)}
        >
          <span className={navLabelStyle}>{label}</span>
          <span className={navNameStyle} data-nav-name="">
            {to.title}
          </span>
        </button>
      ))}
    </nav>
  );
}

// How far the panel slides as it opens or closes, and the content as it goes to another card's.
const slideOf = (el: Element) => parseFloat(getComputedStyle(el).getPropertyValue("--spacing-5xl"));
const SLIDE_OUT_MS = 180;

const OPEN_MS = 800;
const OPEN_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const CLOSE_MS = ZOOM_MS;
const CLOSE_EASE = "ease";

// A bottom sheet's rise from the view's foot.
const LIFT_EASE = cubicBezier(0.2, 0, 0, 1);

/**
 * Calls `frame` with the elapsed ms on every frame until `duration`, the last call at `duration`, and resolves a frame
 * after that one, once it has painted: what follows must not replace it unseen.
 */
function timeline(duration: number, frame: (ms: number) => void) {
  return new Promise<void>((resolve) => {
    if (reducedMotion()) {
      frame(duration);
      resolve();
      return;
    }
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const ms = Math.min(now - start, duration);
      frame(ms);
      requestAnimationFrame(ms < duration ? tick : () => resolve());
    };
    requestAnimationFrame(tick);
  });
}

const lerp = (from: number, to: number, e: number) => from + (to - from) * e;

/**
 * Holds `animations` at their start until the first frame is drawn. Building the sheet's content can take frames, and
 * WebKit otherwise starts their clock at the click, so the sheet first shows already most of the way in.
 */
function fromFirstFrame(animations: Animation[]) {
  animations.forEach((a) => a.pause());
  requestAnimationFrame(() => {
    const now = document.timeline.currentTime;
    animations.forEach((a) => a.playState === "paused" && (a.startTime = now));
  });
  return animations;
}

/** The face's lines, top down: its title, then the words on each line its heading wraps to. */
function faceLines(hero: HTMLElement) {
  const title = hero.querySelector<HTMLElement>("[data-face-title]");
  const lines: HTMLElement[][] = title ? [[title]] : [];
  let top: number | null = null;
  hero.querySelectorAll<HTMLElement>("[data-face-word]").forEach((word) => {
    if (word.offsetTop !== top) lines.push([]);
    top = word.offsetTop;
    lines[lines.length - 1].push(word);
  });
  return lines;
}

/** The face comes into focus a line at a time, then the content's steps in view. */
function reveal(hero: HTMLElement, content: HTMLElement) {
  if (reducedMotion()) return [];
  const steps = [...content.querySelectorAll<HTMLElement>("[data-sheet-step]")].filter(
    (el) => el.getBoundingClientRect().top < window.innerHeight,
  );
  return focusIn(faceLines(hero), steps);
}

function sourceOf(id: string) {
  return document.querySelector<HTMLElement>(`[data-sheet-card="${id}"] [data-sheet-source]`);
}

const fontSize = (el: Element) => parseFloat(getComputedStyle(el).fontSize);

/** The sheet's heading takes the card's text measure at its own size, so it keeps the card's lines where it fits. */
function fitFace(hero: HTMLElement, source: HTMLElement | null) {
  const text = source?.querySelector<HTMLElement>("[data-face-text]");
  const heading = text?.querySelector("[data-face-heading]");
  const sheetHeading = hero.querySelector("[data-face-heading]");
  if (!text || !heading || !sheetHeading) return;
  const cs = getComputedStyle(text);
  const measure = text.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  hero.style.setProperty("--face-text-width", `${(measure * fontSize(sheetHeading)) / fontSize(heading)}px`);
}

export function ProjectSheet({
  cards,
  openId,
  onClosed,
  onSwitch,
}: {
  cards: ProjectCard[];
  openId: string | null;
  onClosed: () => void;
  /** Asks for another card's sheet in place of this one, the sheet staying open. */
  onSwitch: (id: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  // The opening's animations, cut short if it closes first.
  const opening = useRef<Animation[]>([]);
  // Which way the content is going to another card's, from when it starts sliding out until it is in.
  const switching = useRef<Direction | null>(null);
  const slidOut = useRef<Animation | null>(null);
  // The card whose sheet is showing.
  const shown = useRef<string | null>(null);
  // It opened as a bottom sheet, rising from the view's foot.
  const sheet = useRef(false);
  // The bottom sheet is still rising, its backdrop the loop's.
  const lifting = useRef(false);

  const card = cards.find((c) => c.id === openId);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    const hero = heroRef.current;
    const inner = contentRef.current;
    if (!dialog || !panel || !hero || !inner || !openId) return;
    const left = shown.current;
    shown.current = openId;
    const source = sourceOf(openId);

    // Another card's sheet in place of this one: the carousel brought round to the new card, so closing shows it, and
    // the new content slides in.
    const by = switching.current;
    if (dialog.open && by && left) {
      const track = trackRef.current;
      fitFace(hero, source);
      if (source && !sheet.current) {
        source.closest("[data-carousel-slide]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      // A bottom sheet's own top; the dialog's would scroll it out of the view, which closes it.
      (sheet.current ? panel : dialog).scrollTop = 0;
      slidOut.current?.cancel();
      slidOut.current = null;
      const done = () => (switching.current = null);
      if (!track || reducedMotion()) return void done();
      const [slideIn] = fromFirstFrame([
        track.animate(
          [
            { opacity: 0, translate: `${by * slideOf(track)}px 0px` },
            { opacity: 1, translate: "0px 0px" },
          ],
          { duration: RISE_MS, easing: `cubic-bezier(${RISE_CURVE.join(", ")})`, fill: "backwards" },
        ),
      ]);
      slideIn.finished.then(done, done);
      return;
    }

    sheet.current = isBottomSheetLayout();
    dialog.setAttribute("autofocus", "");
    dialog.showModal();
    fitFace(hero, source);

    // A bottom sheet rises from the view's foot.
    if (sheet.current) {
      dialog.scrollTop = dialog.scrollHeight;
      panel.scrollTop = 0;
      const below = window.innerHeight - panel.getBoundingClientRect().top;
      const frame = (ms: number) => {
        const e = LIFT_EASE(ms / ZOOM_MS);
        panel.style.translate = `0px ${lerp(below, 0, e)}px`;
        dialog.style.setProperty("--sheet-shown", String(e));
      };
      // Unsnapped while it moves: snapping follows the moved panel, and would scroll the dialog after it.
      dialog.style.scrollSnapType = "none";
      lifting.current = true;
      frame(0);
      opening.current = fromFirstFrame(reveal(hero, inner));
      timeline(ZOOM_MS, frame).then(() => {
        panel.style.removeProperty("translate");
        dialog.style.removeProperty("scroll-snap-type");
        lifting.current = false;
      });
      return;
    }

    dialog.scrollTop = 0;
    if (reducedMotion()) return;
    // The backdrop's fade replaces the Dialog's own (`zoom`), which is spent before the first frame is drawn.
    opening.current = fromFirstFrame([
      dialog.animate([{ opacity: 0 }, { opacity: 1 }], {
        pseudoElement: "::backdrop",
        duration: OPEN_MS,
        easing: OPEN_EASE,
        fill: "forwards",
      }),
      panel.animate(
        [
          { opacity: 0, translate: `0px ${slideOf(panel)}px` },
          { opacity: 1, translate: "0px 0px" },
        ],
        { duration: OPEN_MS, easing: OPEN_EASE },
      ),
      ...reveal(hero, inner),
    ]);
  }, [openId]);

  /** `swiped`: a bottom sheet already scrolled out of the view, so it closes where it is. */
  const requestClose = (swiped = false) => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    if (!dialog || !panel || !openId || closing.current || switching.current) return;
    closing.current = true;
    // Not a bottom sheet's: its backdrop clears with it.
    if (!sheet.current) dialog.setAttribute("data-closing", "");

    // One task: the dialog goes and the page has it gone in the same frame. The panel's last frame is let go only
    // after, or Safari can paint the sheet back in place for a frame; `fade`, the backdrop's, too.
    const finish = (fade?: Animation) => {
      dialog.removeAttribute("data-closing");
      closing.current = false;
      dialog.close();
      onClosed();
      requestAnimationFrame(() => {
        fade?.cancel();
        panel.getAnimations().forEach((a) => a.cancel());
        panel.style.removeProperty("translate");
        dialog.style.removeProperty("--sheet-shown");
        dialog.style.removeProperty("scroll-snap-type");
      });
    };

    // A bottom sheet drops back out of the view, unsnapped as it opened.
    if (sheet.current) {
      opening.current.forEach((a) => a.finish());
      if (swiped) return finish();
      dialog.style.scrollSnapType = "none";
      const below = window.innerHeight - panel.getBoundingClientRect().top;
      timeline(ZOOM_MS, (ms) => {
        const e = LIFT_EASE(ms / ZOOM_MS);
        panel.style.translate = `0px ${lerp(0, below, e)}px`;
        dialog.style.setProperty("--sheet-shown", String(1 - e));
      }).then(() => finish());
      return;
    }

    if (reducedMotion()) return finish();
    // It fades as it drops, and its backdrop with it, from wherever their opening had got to.
    const drawn = getComputedStyle(panel);
    const from = { opacity: drawn.opacity, translate: drawn.translate === "none" ? "0px 0px" : drawn.translate };
    const shade = getComputedStyle(dialog, "::backdrop").opacity;
    opening.current.forEach((a) => {
      const target = (a.effect as KeyframeEffect | null)?.target;
      if (target === panel || target === dialog) a.cancel();
      else a.finish();
    });
    const closingTiming = { duration: CLOSE_MS, easing: CLOSE_EASE, fill: "forwards" } as const;
    const fade = dialog.animate([{ opacity: shade }, { opacity: 0 }], {
      pseudoElement: "::backdrop",
      ...closingTiming,
    });
    const drop = panel.animate([from, { opacity: 0, translate: `0px ${slideOf(panel)}px` }], closingTiming);
    const done = () => finish(fade);
    drop.finished.then(done, done);
  };

  const switchTo = (id: string, by: Direction) => {
    const track = trackRef.current;
    if (!track || closing.current || switching.current) return;
    switching.current = by;
    const go = () => onSwitch(id);
    if (reducedMotion()) return go();
    slidOut.current = track.animate(
      [
        { opacity: 1, translate: "0px 0px" },
        { opacity: 0, translate: `${-by * slideOf(track)}px 0px` },
      ],
      { duration: SLIDE_OUT_MS, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" },
    );
    slidOut.current.finished.then(go, () => (switching.current = null));
  };

  return (
    <Dialog
      ref={dialogRef}
      motion="zoom"
      aria-label={card?.title ?? "Project"}
      className={dialogStyle}
      onRequestClose={requestClose}
      onScroll={(event) => {
        const dialog = event.currentTarget;
        if (!sheet.current || lifting.current || closing.current || event.target !== dialog) return;
        const room = dialog.scrollHeight - dialog.clientHeight;
        dialog.style.setProperty("--sheet-shown", String(room > 0 ? dialog.scrollTop / room : 1));
        if (dialog.scrollTop <= 0) requestClose(true);
      }}
    >
      <div aria-hidden className={sheetRoomStyle} onClick={() => requestClose()} />
      <div ref={panelRef} className={panelStyle} data-sheet-panel="">
        <span aria-hidden className={gripStyle} />
        <div className={closeRowStyle} data-sheet-close="">
          <span className={closePointStyle}>
            <Button variant="icon" emphasis="accent" aria-label="Close" onClick={() => requestClose()}>
              <CrossIcon aria-hidden />
            </Button>
          </span>
        </div>

        <div ref={trackRef}>
          <div ref={heroRef} className={heroStyle}>
            {card && <CardFace card={card} place="sheet" />}
          </div>

          <div ref={contentRef} className={contentStyle}>
            {card && SHEETS[card.id]}
            {card && <SheetNav cards={cards} card={card} onGo={switchTo} />}
          </div>
        </div>

        <Frame data-sheet-border="" />
      </div>
    </Dialog>
  );
}
