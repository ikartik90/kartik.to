"use client";

import {
  useCallback,
  useLayoutEffect,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { carousel } from "../../styled-system/recipes";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import type { CarouselSize } from "@/domain/nodes";
import { carouselRestOffsets, carouselStep } from "@/utils/carousel-snap";
import ChevronLeftIcon from "@/assets/icons/chevron-left.svg";
import ChevronRightIcon from "@/assets/icons/chevron-right.svg";

export const CAROUSEL_SLIDE = "[data-carousel-slide]";

export function carouselSlides(scroller: HTMLElement) {
  return Array.from(scroller.querySelectorAll<HTMLElement>(CAROUSEL_SLIDE));
}

/** Where the scroller rests with each slide in place; a slide's `offsetLeft` is measured in the scroller. */
export function restOffsets(scroller: HTMLElement): number[] {
  const inset =
    parseFloat(getComputedStyle(scroller).scrollPaddingInlineStart) || 0;
  return carouselRestOffsets(
    carouselSlides(scroller).map((slide) => slide.offsetLeft),
    inset,
    scroller.scrollWidth - scroller.clientWidth,
  );
}

interface Reach {
  scrollable: boolean;
  back: boolean;
  forward: boolean;
}

export interface CarouselProps {
  scrollerRef: RefObject<HTMLDivElement | null>;
  editing?: boolean;
  size?: CarouselSize;
  rootProps?: HTMLAttributes<HTMLDivElement> & {
    ref?: Ref<HTMLDivElement>;
    [state: `data-${string}`]: unknown;
  };
  /** The slides, each marked `data-carousel-slide`. */
  children: ReactNode;
}

export function Carousel({
  scrollerRef,
  editing = false,
  size,
  rootProps,
  children,
}: CarouselProps) {
  const styles = carousel({ editing, size });
  const [reach, setReach] = useState<Reach>({
    scrollable: true,
    back: false,
    forward: true,
  });

  const measure = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const offsets = restOffsets(scroller);
    const at = scroller.scrollLeft;
    const next: Reach = {
      scrollable: offsets.some((offset) => offset > 0),
      back: carouselStep(offsets, at, -1) !== null,
      forward: carouselStep(offsets, at, 1) !== null,
    };
    setReach((was) =>
      was.scrollable === next.scrollable &&
      was.back === next.back &&
      was.forward === next.forward
        ? was
        : next,
    );
  }, [scrollerRef]);

  // The track too: it grows as slides arrive and pictures load, where the scroller does not.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    if (scroller.firstElementChild) {
      observer.observe(scroller.firstElementChild);
    }
    return () => observer.disconnect();
  }, [measure, scrollerRef]);

  const step = (direction: 1 | -1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const left = carouselStep(
      restOffsets(scroller),
      scroller.scrollLeft,
      direction,
    );
    if (left === null) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scroller.scrollTo({ left, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div {...rootProps} className={styles.root} data-carousel="">
      {reach.scrollable && (
        <div className={styles.controls}>
          <Button
            variant="icon"
            emphasis="secondary"
            aria-label="Previous"
            aria-disabled={!reach.back || undefined}
            onClick={() => step(-1)}
          >
            <ChevronLeftIcon aria-hidden />
            <Button.Tooltip>
              <Tooltip.Text>Previous</Tooltip.Text>
            </Button.Tooltip>
          </Button>
          <Button
            variant="icon"
            emphasis="secondary"
            aria-label="Next"
            aria-disabled={!reach.forward || undefined}
            onClick={() => step(1)}
          >
            <ChevronRightIcon aria-hidden />
            <Button.Tooltip>
              <Tooltip.Text>Next</Tooltip.Text>
            </Button.Tooltip>
          </Button>
        </div>
      )}

      <div
        ref={scrollerRef}
        className={styles.scroller}
        data-carousel-scroller=""
        onScroll={measure}
      >
        <div className={styles.track}>{children}</div>
      </div>
    </div>
  );
}
