"use client";

import { testimonialCard } from "../../styled-system/recipes";
import {
  testimonialInitial,
  testimonialShown,
  type Testimonial,
} from "@/domain/testimonial";
import GotoIcon from "@/assets/icons/goto.svg";
import { useActionTooltip } from "./ui/action";
import { Tooltip } from "./ui/tooltip";

/** Matches the label in `SOCIAL_ITEMS` (`social-links.tsx`). */
const LINKEDIN_LABEL = "LinkedIn";

/** Cosmic Track's first, second or third colour. */
export type MeshTint = "1" | "2" | "3";

/** One of the mesh's five waves. */
export type MeshShape = "1" | "2" | "3" | "4" | "5";

/**
 * A wave filled down to the foot of a 100 × 100 box: its middle line from the top, how far it rises and falls, how many
 * swells cross the box and where the first starts.
 */
function wave(middle: number, rise: number, swells: number, start: number): string {
  const edge = Array.from({ length: 21 }, (_, i) => {
    const x = i * 5;
    const y = middle - rise * Math.sin(2 * Math.PI * ((swells * x) / 100 + start));
    return `${x} ${y.toFixed(1)}`;
  });
  return `M${edge.join(" L")} V100 H0 Z`;
}

/** Each shape's back wave, then its front one. */
const WAVES: Record<MeshShape, [string, string]> = {
  "1": [wave(36, 16, 1, 0), wave(56, 10, 1, 0.5)],
  "2": [wave(40, 20, 0.5, 0), wave(58, 10, 1.5, 0.25)],
  "3": [wave(36, 16, 1.5, 0.1), wave(56, 12, 0.75, 0.6)],
  "4": [wave(40, 18, 0.75, 0.5), wave(58, 10, 1.25, 0)],
  "5": [wave(36, 14, 2, 0), wave(56, 12, 1, 0.75)],
};

export interface TestimonialQuoteProps {
  testimonial: Testimonial;
  /** The mesh under the card's foot: its colour and its wave. */
  tint: MeshTint;
  shape: MeshShape;
  /** No mesh or grain, which are costly to draw. */
  bare?: boolean;
}

export function TestimonialQuote({ testimonial, tint, shape, bare = false }: TestimonialQuoteProps) {
  const styles = testimonialCard({ surface: "page", tint });
  const { name, avatarUrl, linkedinUrl, tagline } = testimonial;

  const { tooltipNode, show, hide } = useActionTooltip(
    linkedinUrl ? (
      <Tooltip>
        <Tooltip.Text>{LINKEDIN_LABEL}</Tooltip.Text>
        <GotoIcon aria-hidden />
      </Tooltip>
    ) : null,
  );

  return (
    <figure className={styles.root} data-tint={tint} data-shape={shape}>
      {!bare && (
        <>
          <span className={styles.mesh} data-mesh="" aria-hidden>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <path data-wave="back" d={WAVES[shape][0]} />
              <path data-wave="front" d={WAVES[shape][1]} />
            </svg>
          </span>
          <span className={styles.grain} data-grain="" aria-hidden />
        </>
      )}

      <figcaption className={styles.byline}>
        <span className={styles.avatar}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              // Decorative: the name is written beside it.
              alt=""
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
            />
          ) : (
            testimonialInitial(name)
          )}
        </span>

        <span className={styles.identity}>
          <span className={styles.name}>{name}</span>
          {tagline && <span className={styles.tagline}>{tagline}</span>}
        </span>
      </figcaption>

      <blockquote className={styles.quote}>
        {testimonialShown(testimonial)}
      </blockquote>

      {/* The hit area: an empty anchor stretched over the card, named by the person. */}
      {linkedinUrl && (
        <a
          href={linkedinUrl}
          className={styles.select}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${name} on LinkedIn`}
          onPointerEnter={show}
          onPointerLeave={hide}
        />
      )}

      {tooltipNode}
    </figure>
  );
}
