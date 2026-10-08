"use client";

import { useEffect, useState, type RefObject } from "react";
import { carouselSlides } from "@/components/carousel";
import { inViewThreshold, THRESHOLD_STEPS } from "@/hooks/use-in-view";

const sameSet = (a: ReadonlySet<number>, b: ReadonlySet<number>) =>
  a.size === b.size && [...a].every((index) => b.has(index));

/**
 * The indices of the slides the screen shows whole: one cut off by the scroller's edge or the
 * screen's is not among them. `slides` must change whenever a slide is added, removed or moved.
 */
export function useWholeSlides(
  scrollerRef: RefObject<HTMLElement | null>,
  slides: unknown,
): ReadonlySet<number> {
  const [whole, setWhole] = useState<ReadonlySet<number>>(() => new Set());

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || typeof IntersectionObserver === "undefined") return;
    const order = carouselSlides(scroller);

    const observer = new IntersectionObserver(
      (entries) =>
        setWhole((was) => {
          const next = new Set(was);
          for (const entry of entries) {
            const index = order.indexOf(entry.target as HTMLElement);
            const box = entry.boundingClientRect;
            const shown = entry.intersectionRect;
            // WebKit rounds the part shown to whole pixels, short of a box at a fraction of one.
            const fits =
              (box.width - shown.width < 1 && box.height - shown.height < 1) ||
              entry.intersectionRatio + 1e-6 >=
                inViewThreshold(1, box.height, entry.rootBounds?.height ?? 0);
            if (fits) next.add(index);
            else next.delete(index);
          }
          return sameSet(was, next) ? was : next;
        }),
      { threshold: THRESHOLD_STEPS },
    );
    order.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [scrollerRef, slides]);

  return whole;
}
