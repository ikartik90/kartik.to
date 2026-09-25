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

export interface TestimonialQuoteProps {
  testimonial: Testimonial;
}

export function TestimonialQuote({ testimonial }: TestimonialQuoteProps) {
  const styles = testimonialCard({ surface: "page" });
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
    <figure
      className={styles.root}
      // Gates the recipe's hover edge (`&[data-linked]:hover`).
      data-linked={linkedinUrl ? "" : undefined}
    >
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
