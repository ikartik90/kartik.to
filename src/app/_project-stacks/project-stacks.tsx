"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { css, cx } from "../../../styled-system/css";
import { pageOpening, sectionHeadline } from "../../../styled-system/recipes";
import { Carousel } from "@/components/carousel";
import { HERO_OPENING_LINES, HERO_OPENING_STEPS, openingStepDelay } from "@/data/page-opening";
import { SPOTWORK } from "./data";
import { joinOpening, riseIn } from "./opening";
import { ProjectSheet } from "./project-sheet";
import { SheetCard } from "./sheet-card";

// At the showcase's width, so the headline starts at the edge the cards start at. The hero's "See my work" lands
// here, clear of the page top.
const sectionStyle = css({
  width: "min(100%, token(sizes.articleShowcase))",
  marginInline: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "xl",
  scrollMarginBlockStart: "5xl",
});

// The headline, then the carousel's arrows, are the page opening's steps after the hero's, on screen or not: off it,
// the opening is long over before they're scrolled to.
const openingStep = (i: number) => ({
  "data-opening-step": "",
  style: { "--opening-delay": `${openingStepDelay(HERO_OPENING_LINES, HERO_OPENING_STEPS + i)}ms` } as CSSProperties,
});
const stepOpening = pageOpening({ part: "step" });

// How much of the carousel shows before its cards come in.
const ENTER_AT = 0.3;

/**
 * True until the carousel comes into view; then the cards on screen rise in one by one (carrying the page's opening
 * on, while it's under way), and the ones past its edge are simply there for when they're swiped to.
 */
function useCardsEnter(scrollerRef: RefObject<HTMLDivElement | null>) {
  const [entering, setEntering] = useState(true);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.intersectionRatio >= ENTER_AT)) return;
        observer.disconnect();
        const slides = Array.from(scroller.querySelectorAll<HTMLElement>("[data-carousel-slide]")).filter((slide) => {
          const r = slide.getBoundingClientRect();
          return r.right > 0 && r.left < window.innerWidth;
        });
        if (!joinOpening(slides)) riseIn(slides);
        setEntering(false);
      },
      { threshold: ENTER_AT },
    );
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [scrollerRef]);

  return entering;
}

/** `?sheet=<card id>` opens that card's sheet on load. */
export function ProjectStacks({ id }: { id?: string }) {
  const section = SPOTWORK;
  const opens = section.cards.filter((card) => !card.soon);
  const [openSheet, setOpenSheet] = useState<string | null>(null);
  useEffect(() => {
    const sheet = new URLSearchParams(window.location.search).get("sheet");
    // Read once on mount: the address isn't known on the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (sheet && opens.some((card) => card.id === sheet)) setOpenSheet(sheet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const entering = useCardsEnter(scrollerRef);

  return (
    <section
      id={id}
      className={sectionStyle}
      aria-labelledby="spotwork-headline"
      data-entering={entering ? "" : undefined}
    >
      <h2 id="spotwork-headline" className={cx(sectionHeadline(), stepOpening)} {...openingStep(0)}>
        {section.headline}
      </h2>

      <Carousel
        scrollerRef={scrollerRef}
        size="medium"
        controlsProps={{ className: stepOpening, ...openingStep(1) }}
      >
        {section.cards.map((card) => (
          <SheetCard
            key={card.id}
            card={card}
            onOpen={opens.includes(card) ? (opened) => setOpenSheet(opened.id) : undefined}
          />
        ))}
      </Carousel>

      <ProjectSheet cards={opens} openId={openSheet} onClosed={() => setOpenSheet(null)} onSwitch={setOpenSheet} />
    </section>
  );
}
