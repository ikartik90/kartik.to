"use client";

import { testimonialCard } from "../../../../styled-system/recipes";
import { PROPERTIES_TRIGGER_ATTR } from "@/components/ui/properties-panel";
import {
  linkedInHandle,
  testimonialInitial,
  testimonialShown,
  type Testimonial,
} from "@/domain/testimonial";
import LinkedInIcon from "@/assets/icons/linkedin.svg";
import { SocialIconLink } from "@/components/social-icon-link";

const LINKEDIN_MASK = "/social-shader-masks/linkedin.svg";

export interface TestimonialCardProps {
  testimonial: Testimonial;
  selected: boolean;
  onSelect: () => void;
}

export function TestimonialCard({
  testimonial,
  selected,
  onSelect,
}: TestimonialCardProps) {
  const styles = testimonialCard({ selected });
  const { name, avatarUrl, linkedinUrl, tagline } = testimonial;

  return (
    <div className={styles.root}>
      <button
        type="button"
        // Exempts the card that opens the rail from the rail's outside-press dismiss.
        {...PROPERTIES_TRIGGER_ATTR}
        aria-pressed={selected}
        aria-label={`Edit ${name}'s testimonial`}
        className={styles.select}
        onClick={onSelect}
      />

      <div className={styles.byline}>
        <span className={styles.avatar}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              width={40}
              height={40}
            />
          ) : (
            testimonialInitial(name)
          )}
        </span>

        <span className={styles.identity}>
          <span className={styles.name}>{name}</span>
          {tagline && <span className={styles.tagline}>{tagline}</span>}
        </span>

        {linkedinUrl && (
          <SocialIconLink
            className={styles.profile}
            href={linkedinUrl}
            label={linkedInHandle(linkedinUrl)}
            ariaLabel={`${name} on LinkedIn`}
            maskSrc={LINKEDIN_MASK}
            Icon={LinkedInIcon}
            size="sm"
          />
        )}
      </div>

      <p className={styles.quote}>{testimonialShown(testimonial)}</p>
    </div>
  );
}
