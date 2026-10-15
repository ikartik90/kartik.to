"use client";

import { useId, useLayoutEffect, useRef } from "react";
import { css } from "../../styled-system/css";
import type { Testimonial } from "@/domain/testimonial";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { TestimonialQuote, type MeshShape, type MeshTint } from "./testimonial-quote";

/** Slow enough to read a card as it passes. */
const DRIFT_PX_PER_S = 30;

/** One run of the loop holds at least this many cards, so it spans the widest screen before it repeats. */
const MIN_RUN_CARDS = 24;

/**
 * Copies of the run on the strip. The reader is kept within half a run of `HOME_RUN`, so a drag or a swipe always has
 * half a run or more before it meets an end.
 */
const RUNS = 4;
const HOME_RUN = 2;

/** How long the strip must go unscrolled to count as at rest. */
const REST_MS = 150;

/** How far a flick carries on, per px/ms it was let go at; `useDragScroll` eases it to a stop. */
const GLIDE_PX_PER_SPEED = 200;

const EDGE_FADE = "clamp(24px, 5vw, 120px)";

/** One run of the loop: the cards in order, repeated until they fill whole columns of two and number `min`. */
export function loopRun<T>(items: T[], min = MIN_RUN_CARDS): T[] {
  if (items.length === 0) return [];
  let times = Math.ceil(min / items.length);
  if ((times * items.length) % 2) times += 1;
  return Array.from({ length: times }, () => items).flat();
}

const bandStyle = css({
  // Never squashed by the body's flex column, which would leave cards hanging out of the box.
  flexShrink: 0,
  marginBlockStart: "5xl",
  marginBlockEnd: "calc(token(spacing.3xl) + token(spacing.4xl))",
});

const unseenStyle = css({ srOnly: true });

const stripStyle = css({
  overflowX: "auto",
  overflowY: "hidden",
  // Hidden, so a classic scrollbar never takes height from the cards; both forms for cross-browser.
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" },
  maskImage: `linear-gradient(to right, transparent, black ${EDGE_FADE}, black calc(100% - ${EDGE_FADE}), transparent)`,
});

const trackStyle = css({
  position: "relative",
  display: "flex",
  alignItems: "flex-start",
  gap: "xl",
  width: "max-content",
  // A cover over the cards while a mouse drag moves the strip, so cards passing under the pointer don't hover. Above
  // the cards' own layers (to 2).
  "&::after": { content: '""', position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" },
  "[data-panning] > &": { "&::after": { pointerEvents: "auto" } },
});

const columnStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "xl",
  flexShrink: 0,
  width: "clamp({sizes.testimonialCard}, 22vw, {sizes.testimonialCardWide})",
  "&[data-stagger='20']": { marginBlockStart: "xxl" },
  "&[data-stagger='40']": { marginBlockStart: "4xl" },
  "&[data-stagger='60']": { marginBlockStart: "calc(token(spacing.4xl) + token(spacing.xxl))" },
  "&[data-stagger='80']": { marginBlockStart: "5xl" },
});

/** Each column's drop in px, in an order with no two neighbours alike, wrapping included. */
const STAGGERS = ["40", "80", "20", "60", "20", "80", "60"];

/**
 * Drifts the track right to left a run at a time, on the compositor, over the strip's own scroll. A mouse over a card
 * or a gap between cards, a touch until the strip comes to rest, focus inside it, or the section being off screen
 * holds it. At rest, the scroll moves by whole runs, onto the same cards, back to `HOME_RUN`.
 */
function useDrift(
  sectionRef: React.RefObject<HTMLElement | null>,
  stripRef: React.RefObject<HTMLDivElement | null>,
  count: number,
) {
  useLayoutEffect(() => {
    const section = sectionRef.current;
    const strip = stripRef.current;
    const track = strip?.firstElementChild;
    if (!section || !strip || !(track instanceof HTMLElement)) return;

    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const holds = new Set<string>();
    let run = 0;
    let drift: Animation | null = null;
    let rest = 0;

    const progress = () => drift?.effect?.getComputedTiming().progress ?? 0;

    // A drag and its glide place the scroll themselves; it carries on once they come to rest.
    const resume = () => {
      if (!holds.size && !strip.dataset.panning) drift?.play();
    };
    const hold = (why: string) => {
      holds.add(why);
      drift?.pause();
    };
    const release = (why: string) => {
      holds.delete(why);
      resume();
    };

    const recentre = () => {
      if (!run || strip.dataset.panning || holds.has("focus")) return;
      const seen = strip.scrollLeft + progress() * run;
      const runs = Math.floor((seen - (HOME_RUN - 0.5) * run) / run);
      if (runs) strip.scrollLeft -= runs * run;
    };

    const settle = () => {
      clearTimeout(rest);
      rest = window.setTimeout(() => {
        recentre();
        holds.delete("touch");
        resume();
      }, REST_MS);
    };

    const layout = () => {
      const starts = track.querySelectorAll<HTMLElement>("[data-run-start]");
      const width = starts.length > 1 ? starts[1].offsetLeft - starts[0].offsetLeft : 0;
      if (Math.abs(width - run) < 0.5) return;
      const at = progress();
      run = width;
      drift?.cancel();
      drift = null;
      strip.scrollLeft = HOME_RUN * run;
      if (!run || still || typeof track.animate !== "function") return;
      const duration = (run / DRIFT_PX_PER_S) * 1000;
      drift = track.animate(
        [{ transform: "translateX(0px)" }, { transform: `translateX(${-run}px)` }],
        { duration, iterations: Infinity },
      );
      drift.currentTime = at * duration;
      if (holds.size) drift.pause();
    };

    // On the track itself, the pointer is between columns or under a shorter one: only a gap with a card beside it
    // at that height counts.
    const overCards = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !track.contains(target)) return false;
      if (target !== track) return true;
      const columns = [...track.children];
      const next = columns.findIndex((column) => column.getBoundingClientRect().left > event.clientX);
      const before = columns[next < 0 ? columns.length - 1 : next - 1]?.getBoundingClientRect();
      const after = next < 0 ? undefined : columns[next].getBoundingClientRect();
      const beside = (box?: DOMRect) => !!box && event.clientY >= box.top && event.clientY <= box.bottom;
      if (before && event.clientX <= before.right) return beside(before);
      return beside(before) || beside(after);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const over = overCards(event);
      if (over !== holds.has("pointer")) (over ? hold : release)("pointer");
    };
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType !== "touch") release("pointer");
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      clearTimeout(rest);
      hold("touch");
    };
    // Only the keyboard's focus holds it: Chromium also focuses a link on a mouse press.
    let pressed = false;
    const onPress = () => (pressed = true);
    const onKey = () => (pressed = false);
    const onFocusIn = () => {
      if (!pressed) hold("focus");
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!section.contains(event.relatedTarget as Node | null)) release("focus");
    };

    layout();
    const resized = new ResizeObserver(layout);
    resized.observe(track);

    const seen =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) =>
            entry.isIntersecting ? release("away") : hold("away"),
          );
    seen?.observe(section);

    strip.addEventListener("pointermove", onMove);
    strip.addEventListener("pointerleave", onLeave);
    section.addEventListener("focusin", onFocusIn);
    section.addEventListener("focusout", onFocusOut);
    section.addEventListener("pointerdown", onPress);
    strip.addEventListener("pointerdown", onDown);
    strip.addEventListener("scroll", settle, { passive: true });
    // Also a drag let go anywhere, and a tap that never scrolled.
    window.addEventListener("pointerup", settle);
    window.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(rest);
      drift?.cancel();
      resized.disconnect();
      seen?.disconnect();
      strip.removeEventListener("pointermove", onMove);
      strip.removeEventListener("pointerleave", onLeave);
      section.removeEventListener("focusin", onFocusIn);
      section.removeEventListener("focusout", onFocusOut);
      section.removeEventListener("pointerdown", onPress);
      strip.removeEventListener("pointerdown", onDown);
      strip.removeEventListener("scroll", settle);
      window.removeEventListener("pointerup", settle);
      window.removeEventListener("keydown", onKey);
    };
  }, [sectionRef, stripRef, count]);
}

/** Cosmic Track's three colours, taken in turn. */
const TINTS: MeshTint[] = ["1", "2", "3"];

/** Five, against the three colours, so no two neighbours (two or five cards apart in the run) share both. */
const SHAPES: MeshShape[] = ["1", "2", "3", "4", "5"];

export interface TestimonialWallProps {
  /** Published rows only; this does no filtering. */
  testimonials: Testimonial[];
}

export function TestimonialWall({ testimonials }: TestimonialWallProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  useDrift(sectionRef, stripRef, testimonials.length);
  useDragScroll(stripRef, {
    landing: (velocity) => {
      const strip = stripRef.current;
      if (!strip) return 0;
      const reach = Math.max(strip.scrollWidth - strip.clientWidth, 0);
      return Math.min(Math.max(strip.scrollLeft + velocity * GLIDE_PX_PER_SPEED, 0), reach);
    },
  });

  if (testimonials.length === 0) return null;

  const run = loopRun(testimonials);
  const columns = Array.from({ length: run.length / 2 }, (_, column) => column);

  return (
    <section ref={sectionRef} aria-labelledby={headingId} className={bandStyle}>
      <h2 id={headingId} className={unseenStyle}>
        Music to my ears
      </h2>
      <div ref={stripRef} className={stripStyle} data-testimonial-strip="">
        <div className={trackStyle}>
          {Array.from({ length: RUNS }, (_, copy) =>
            columns.map((column) => (
              <div
                key={`${copy}:${column}`}
                className={columnStyle}
                data-run-start={column === 0 ? copy : undefined}
                data-stagger={STAGGERS[column % STAGGERS.length]}
              >
                {[column * 2, column * 2 + 1].map((index) => {
                  // A reader meets each testimonial once: on the run the strip starts on, its first pass.
                  const copied = copy !== HOME_RUN || index >= testimonials.length;
                  return (
                    <div key={index} aria-hidden={copied || undefined} inert={copied}>
                      <TestimonialQuote
                        testimonial={run[index]}
                        tint={TINTS[index % TINTS.length]}
                        shape={SHAPES[index % SHAPES.length]}
                      />
                    </div>
                  );
                })}
              </div>
            )),
          )}
        </div>
      </div>
    </section>
  );
}
