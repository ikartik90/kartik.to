"use client";

import { useRef, type CSSProperties } from "react";
import { css, cx } from "../../../styled-system/css";
import { articleShowcase, carousel } from "../../../styled-system/recipes";
import { Carousel } from "@/components/carousel";
import { MediaTile } from "@/components/media-tile";
import { mediaSurfaceAspect, type BackgroundEffect, type MediaNode } from "@/domain/nodes";
import { useWholeSlides } from "@/hooks/use-whole-slides";

// A sheet's walkthrough clips in an article's carousel, across the sheet's content, each played while it's whole on
// screen. The arrows centre on the last line of the sheet's heading, the content's padding above.

/** A clip's shader ground, the walkthroughs' own wave. */
export const clipGround = (colors: string[], rest: Partial<BackgroundEffect>): BackgroundEffect => ({
  colors,
  positions: 2,
  waveX: 1,
  waveXShift: 0.6,
  waveY: 1,
  waveYShift: 0.21,
  mixing: 0.93,
  grainMixer: 0,
  grainOverlay: 0,
  scale: 1,
  rotation: -90,
  offsetX: 0,
  offsetY: 0,
  ...rest,
});

/** A 2160 × 1350 screen recording, inset on its ground. */
export const walkthroughClip = (
  src: string,
  poster: string,
  alt: string,
  backgroundEffect: BackgroundEffect,
): MediaNode => ({
  type: "media",
  kind: "video",
  src,
  poster,
  alt,
  width: 2160,
  height: 1350,
  padding: 40,
  objectFit: "contain",
  borderRadius: 6,
  backgroundEffect,
});

const styles = carousel();

// The sheet's content padding (`contentStyle` in project-sheet.tsx), which the strip reaches out across; the sheet's
// heading's text style and its gap above, for the arrows.
const clipsStyle = css({
  "--carousel-gutter": "token(spacing.3xl)",
  "--carousel-heading-gap": "token(spacing.3xl)",
  textStyle: "subheadingLarge",
  mdDown: { "--carousel-gutter": "token(spacing.xl)", "--carousel-heading-gap": "token(spacing.xl)" },
});

export function ClipsCarousel({ clips }: { clips: MediaNode[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const whole = useWholeSlides(scrollerRef, clips);

  return (
    <figure
      className={cx(articleShowcase(), clipsStyle)}
      // The first clip's shape, for a caller sizing the slides to it.
      style={{ "--clips-aspect": String(mediaSurfaceAspect(clips[0], clips[0])) } as CSSProperties}
      data-sheet-step=""
    >
      <Carousel scrollerRef={scrollerRef} contained size="large">
        {clips.map((clip, index) => (
          <figure
            key={clip.src}
            className={cx(styles.slide, styles.stack)}
            data-carousel-slide=""
            style={{ "--slide-aspect": String(mediaSurfaceAspect(clip, clip)) } as CSSProperties}
          >
            <MediaTile
              item={clip}
              classes={{
                surface: cx(styles.picture, styles.cell),
                tile: styles.tile,
                image: styles.image,
                backgroundEffect: styles.backgroundEffect,
              }}
              fallbackLabel={`Clip ${index + 1}`}
              autoPlay={whole.has(index)}
            />
          </figure>
        ))}
      </Carousel>
    </figure>
  );
}
