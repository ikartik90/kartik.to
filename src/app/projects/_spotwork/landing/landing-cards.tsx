"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { css } from "../../../../../styled-system/css";
import { Carousel } from "@/components/carousel";
import { riseIn } from "../opening";
import { useHasCursor } from "@/hooks/use-has-cursor";
import { useWholeSlides } from "@/hooks/use-whole-slides";
import { HERO_OPENING_LINES, HERO_OPENING_STEPS, openingStepDelay } from "@/data/page-opening";
import { PROJECT_CARDS } from "@/data/project-cards";
import { holdFirstFold } from "@/utils/first-fold";
import { LandingCard } from "./landing-card";
import { useRestingHover } from "./use-resting-hover";
import { loadLiveApp } from "../use-live-app";

// The homepage's work under the hero: a card per project of Spotwork's prototype.

// Fetched while the page hydrates, not after: the first card waits on nothing else.
if (typeof window !== "undefined") loadLiveApp().catch(() => {});

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
 * The cards come in on the page's opening, from the server's page. Out of view as the page comes to life, they're
 * `scrolledTo` instead: hidden (`entering`) until `ENTER_AT` of them is on screen, then the ones there rise in.
 */
function useCardsEnter(scrollerRef: RefObject<HTMLDivElement | null>) {
  const [entrance, setEntrance] = useState<"opening" | "waiting" | "risen">("opening");

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let firstLook = true;
    const observer = new IntersectionObserver(
      (entries) => {
        const first = firstLook;
        firstLook = false;
        if (first && entries.some((entry) => entry.isIntersecting)) return observer.disconnect();
        if (first) return setEntrance("waiting");
        if (!entries.some((entry) => entry.intersectionRatio >= ENTER_AT)) return;
        riseIn(
          Array.from(scroller.querySelectorAll<HTMLElement>("[data-carousel-slide]")).filter((slide) => {
            const r = slide.getBoundingClientRect();
            return r.right > 0 && r.left < window.innerWidth;
          }),
        );
        observer.disconnect();
        setEntrance("risen");
      },
      { threshold: [0, ENTER_AT] },
    );
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [scrollerRef]);

  return { entering: entrance === "waiting", scrolledTo: entrance !== "opening" };
}

// Past this, what waits on the cards goes ahead without them.
const FIRST_FOLD_HOLD_MS = 15_000;

/**
 * The cards' apps come before anything else on the page, one at a time in the carousel's order: each is built once the
 * one before it is shown, and the rest of the page waits until the last is. `shown[i]` is card i's stable callback.
 */
function useBuildInTurn(count: number) {
  const [done, setDone] = useState(0);
  const [shown] = useState(() =>
    Array.from({ length: count }, (_, i) => () => setDone((was) => Math.max(was, i + 1))),
  );
  const release = useRef<(() => void) | null>(null);
  useEffect(() => {
    release.current = holdFirstFold(FIRST_FOLD_HOLD_MS);
    return () => release.current?.();
  }, []);
  useEffect(() => {
    if (done >= count) release.current?.();
  }, [done, count]);
  return { builds: (i: number) => i <= done, shown };
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
  const { entering, scrolledTo } = useCardsEnter(scrollerRef);
  const { builds, shown } = useBuildInTurn(PROJECT_CARDS.length);
  const hasCursor = useHasCursor();
  const whole = useWholeSlides(scrollerRef, PROJECT_CARDS, !hasCursor);
  const hovered = useRestingHover(hasCursor);

  return (
    <section
      id={id}
      className={sectionStyle}
      aria-label="Work"
      data-entering={entering ? "" : undefined}
      data-scrolled-to={scrolledTo ? "" : undefined}
    >
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
            paused={paused}
            themeClassName={themeClassName}
            openingDelay={openingStepDelay(HERO_OPENING_LINES, HERO_OPENING_STEPS + i)}
            due={builds(i)}
            onAppShown={shown[i]}
            onOpen={() => onOpen(card.id)}
          />
        ))}
      </Carousel>
    </section>
  );
}
