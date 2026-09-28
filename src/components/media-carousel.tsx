"use client";

import { useRef, useState, type CSSProperties } from "react";
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
import { MediaCaption } from "@/components/media-caption";
import { MediaTile } from "@/components/media-tile";
import {
  mediaSurfaceAspect,
  type CollectionNode,
  type MediaNode,
} from "@/domain/nodes";
import { useGestureInput } from "@/hooks/use-gesture-input";
import type { Point } from "@/utils/lightbox-gesture";

const styles = carousel();

// A pinch on a slide opens it in the lightbox once it has spread this much.
const PINCH_OPENS_AT = 1.05;

export interface MediaCarouselProps
  extends Pick<
    CollectionNode,
    "size" | "lightbox" | "showCaptions" | "captionStyle"
  > {
  items: MediaNode[];
}

export function MediaCarousel({
  items,
  size,
  lightbox = true,
  showCaptions = false,
  captionStyle,
}: MediaCarouselProps) {
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
      if (!lightbox || !frame.pinch || openIndex !== null) return false;
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

  // The picture, not its caption: the lightbox zooms out of it.
  const slide = (index: number) =>
    slides()[index]?.querySelector<HTMLElement>("[data-media-surface]") ?? null;

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
      <Carousel scrollerRef={scrollerRef} size={size}>
        {items.map((item, index) => (
          <figure
            key={`${index}-${item.src}`}
            className={cx(styles.slide, styles.stack)}
            data-carousel-slide=""
            style={
              {
                "--slide-aspect": String(mediaSurfaceAspect(item, item)),
              } as CSSProperties
            }
          >
            <MediaTile
              item={item}
              classes={{
                surface: cx(styles.picture, styles.cell),
                tile: styles.tile,
                image: styles.image,
                backgroundEffect: styles.backgroundEffect,
              }}
              fallbackLabel={`Image ${index + 1}`}
              onOpen={lightbox ? () => setOpenIndex(index) : undefined}
            />
            {showCaptions && (
              <MediaCaption
                caption={item.caption}
                captionStyle={captionStyle}
                className={styles.caption}
              />
            )}
          </figure>
        ))}
      </Carousel>

      {/* Must stay mounted while it can open; see the effect in MediaLightbox. */}
      {lightbox && (
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
      )}
    </>
  );
}
