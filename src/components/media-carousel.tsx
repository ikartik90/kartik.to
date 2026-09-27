"use client";

import { useRef, useState } from "react";
import { cx } from "../../styled-system/css";
import { carousel } from "../../styled-system/recipes";
import {
  Carousel,
  carouselSlides,
  restOffsets,
} from "@/components/carousel";
import {
  MediaLightbox,
  type MediaLightboxHandle,
} from "@/components/media-lightbox";
import { MediaTile } from "@/components/media-tile";
import { mediaSurfaceAspect, type MediaNode } from "@/domain/nodes";
import { useGestureInput } from "@/hooks/use-gesture-input";
import type { Point } from "@/utils/lightbox-gesture";

const styles = carousel();

// A pinch on a slide opens it in the lightbox once it has spread this much.
const PINCH_OPENS_AT = 1.05;

export interface MediaCarouselProps {
  items: MediaNode[];
}

export function MediaCarousel({ items }: MediaCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const lightboxRef = useRef<MediaLightboxHandle>(null);
  const pinching = useRef<{ index: number; opened: boolean } | null>(null);

  const slides = () =>
    scrollerRef.current ? carouselSlides(scrollerRef.current) : [];

  const slideAt = ({ x, y }: Point) =>
    slides().findIndex((each) => {
      const box = each.getBoundingClientRect();
      return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    });

  // Only a pinch over a slide: a drag or a plain wheel stays the scroller's own.
  useGestureInput(scrollerRef, {
    start: (frame) => {
      if (!frame.pinch || openIndex !== null) return false;
      const index = slideAt(frame.start);
      if (index < 0) return false;
      pinching.current = { index, opened: false };
      return true;
    },
    move: (frame) => {
      const pinch = pinching.current;
      if (!pinch) return;
      if (pinch.opened) return lightboxRef.current?.pinch.move(frame);
      if (frame.scale < PINCH_OPENS_AT) return;
      pinch.opened = true;
      lightboxRef.current?.pinch.begin(frame);
      setOpenIndex(pinch.index);
    },
    end: (frame) => {
      const pinch = pinching.current;
      pinching.current = null;
      if (pinch?.opened) lightboxRef.current?.pinch.end(frame);
    },
  });

  const slide = (index: number) => slides()[index] ?? null;

  // Behind the lightbox, so closing it zooms back into the slide it ends on.
  const bringIntoView = (index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const left = restOffsets(scroller)[index];
    if (left !== undefined) scroller.scrollTo({ left, behavior: "instant" });
  };

  if (items.length === 0) return null;

  return (
    <>
      <Carousel scrollerRef={scrollerRef}>
        {items.map((item, index) => (
          <MediaTile
            key={`${index}-${item.src}`}
            item={item}
            classes={{
              surface: cx(styles.slide, styles.cell),
              tile: styles.tile,
              image: styles.image,
              backgroundEffect: styles.backgroundEffect,
            }}
            fallbackLabel={`Image ${index + 1}`}
            onOpen={() => setOpenIndex(index)}
            surfaceProps={{
              "data-carousel-slide": "",
              style: { aspectRatio: String(mediaSurfaceAspect(item, item)) },
            }}
          />
        ))}
      </Carousel>

      {/* Must stay mounted; see the effect in MediaLightbox. */}
      <MediaLightbox
        ref={lightboxRef}
        items={items}
        index={openIndex}
        onIndexChange={(index) => {
          setOpenIndex(index);
          bringIntoView(index);
        }}
        onClose={() => setOpenIndex(null)}
        sourceFor={slide}
      />
    </>
  );
}
