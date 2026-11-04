"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { css } from "../../../../../styled-system/css";
import { Carousel } from "@/components/carousel";
import { joinOpening, riseIn } from "../opening";
import { useHasCursor } from "@/hooks/use-has-cursor";
import { useWholeSlides } from "@/hooks/use-whole-slides";
import { PROJECT_CARDS } from "@/data/project-cards";
import { LandingCard } from "./landing-card";
import { useRestingHover } from "./use-resting-hover";

// The homepage's work under the hero: a card per project of Spotwork's prototype.

// The carousel's gutter is the room from the column out to the window's edges, so its strip runs out to them while the
// first card rests on the column's start, the last on its end and any between in its middle. `cqw` is the carousel's.
const sectionStyle = css({
  "--carousel-gutter": "calc((100vw - var(--page-inset-end, 0px) - 100cqw) / 2)",
  width: "min(100%, token(sizes.articleShowcase))",
  marginInline: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "xl",
  scrollMarginBlockStart: "5xl",
});

const ENTER_AT = 0.3;

/**
 * True until the carousel comes into view; then the cards on screen rise in one by one. Any of it in view joins the
 * page's opening while it runs, or in the first fold rises in at once; scrolled to, they wait for `ENTER_AT` of it.
 */
function useCardsEnter(scrollerRef: RefObject<HTMLDivElement | null>) {
  const [entering, setEntering] = useState(true);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let firstFold = true;
    const observer = new IntersectionObserver(
      (entries) => {
        const inFirstFold = firstFold;
        firstFold = false;
        if (!entries.some((entry) => entry.isIntersecting)) return;
        const slides = Array.from(scroller.querySelectorAll<HTMLElement>("[data-carousel-slide]")).filter((slide) => {
          const r = slide.getBoundingClientRect();
          return r.right > 0 && r.left < window.innerWidth;
        });
        if (!joinOpening(slides)) {
          if (!inFirstFold && !entries.some((entry) => entry.intersectionRatio >= ENTER_AT)) return;
          riseIn(slides);
        }
        observer.disconnect();
        setEntering(false);
      },
      { threshold: [0, ENTER_AT] },
    );
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [scrollerRef]);

  return entering;
}

/** Whether the carousel is within half a window of the window; it clips its cards, so each card can't tell. */
function useNear(scrollerRef: RefObject<HTMLDivElement | null>) {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setNear(true);
      },
      { rootMargin: "50%" },
    );
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [scrollerRef]);

  return near;
}

/** `base`: as for `projectPath`. `themeClassName`: Spotwork's, for the app's ground in each card's window. */
export function LandingCards({
  id,
  paused,
  base,
  themeClassName,
  onOpen,
}: {
  id?: string;
  paused: boolean;
  base?: string;
  themeClassName?: string;
  onOpen: (project: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const entering = useCardsEnter(scrollerRef);
  const near = useNear(scrollerRef);
  const hasCursor = useHasCursor();
  const whole = useWholeSlides(scrollerRef, PROJECT_CARDS, !hasCursor);
  const hovered = useRestingHover(hasCursor);

  return (
    <section id={id} className={sectionStyle} aria-label="Work" data-entering={entering ? "" : undefined}>
      <Carousel
        scrollerRef={scrollerRef}
        contained
        size="medium"
        controls={false}
        rootProps={{ "data-cursor": "hand" }}
      >
        {PROJECT_CARDS.map((card, i) => (
          <LandingCard
            key={card.id}
            card={card}
            base={base}
            shown={hasCursor ? undefined : whole.has(i)}
            hovered={hovered === card.id}
            near={near}
            paused={paused}
            themeClassName={themeClassName}
            onOpen={() => onOpen(card.id)}
          />
        ))}
      </Carousel>
    </section>
  );
}
