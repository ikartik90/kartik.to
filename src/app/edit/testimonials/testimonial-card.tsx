"use client";

import { testimonialCard } from "../../../../styled-system/recipes";
import { PROPERTIES_TRIGGER_ATTR } from "@/components/ui/properties-panel";
import { testimonialShown, type Testimonial } from "@/domain/testimonial";
import LinkedInIcon from "@/assets/icons/linkedin.svg";
import { SocialIconLink } from "@/components/social-icon-link";

/** The glyph's silhouette, the same file the homepage's row is masked to. */
const LINKEDIN_MASK = "/social-shader-masks/linkedin.svg";

// ---------------------------------------------------------------------------
// One collected testimonial, on the board at `/edit/testimonials`.
//
// LOCAL TO THIS ROUTE, and staying local until something else needs it. It is
// close kin to `LinkCard`, which is global, but the two answer different
// questions: a link card is a way INTO the site, and this is a row of a table I
// am annotating. The day these words get a page of their own, that page's card
// will be a different component again — it will have no selection, no id, and
// nothing to say about when the row arrived.
//
// A BUTTON, not a div with a handler. Pressing it opens the rail that edits it,
// which makes it a control, and the only way to get keyboard operation, focus
// and a pressed state without hand-rolling all three is to use the element that
// has them. That decision reaches into the markup exactly once, and it is the
// interesting constraint here: nothing inside a button may be interactive, so
// a stored profile appears as its handle in TEXT. The rail is where it is a
// link. See the recipe's note.
//
// Everything below is derived rather than passed. The card is handed a row and
// nothing else, so there is no way for the board to hand it a name and a
// different initial, or a URL and a mismatched handle.
//
// AN EXCERPT, WHEN THERE IS ONE. Most of these run to the 280-character cap,
// and six full ones side by side is a wall. The card draws the portion chosen
// in the rail and falls back to the whole quote — which is also what makes the
// board's cards different heights, and gives it its near-masonry look.
//
// NO DATE. The row has a `createdAt` and the card deliberately does not draw
// it: the board is read to find the testimonial being annotated, and that is
// done by the words and the face, never by when it arrived. The list is still
// ordered newest-first, so the information is in the ORDER — printing it as
// well was a column of numbers nothing was looking up.
// ---------------------------------------------------------------------------

/**
 * What to write in an empty avatar.
 *
 * The first CHARACTER, not the first letter of each word: initials would need
 * to know which parts of a name are given names, and no rule for that survives
 * contact with the names people actually have. One character is a placeholder
 * admitting to being one.
 */
function initialOf(name: string): string {
  return name.trim().charAt(0);
}

/**
 * A profile URL as the bit of it worth reading — `in/ada` out of forty
 * characters of scheme and host.
 *
 * The URL is stored canonically (`LinkedInProfileUrlSchema`), so this is a
 * slice rather than a parse. Falls back to the whole value if it ever meets one
 * that is not: showing something odd beats showing nothing, and the rail has
 * the real value either way.
 */
function handleOf(url: string): string {
  const path = url.replace(/^https?:\/\/[^/]+\//i, "");
  return path === "" ? url : path;
}

export interface TestimonialCardProps {
  testimonial: Testimonial;
  /** Whether the rail is currently editing this row. */
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
      {/* The hit target, and nothing else — see the recipe. Named by a label
          rather than by the words it used to wrap, which is what lets the
          profile beside it be a real link. */}
      <button
        type="button"
        // This card is what OPENS the rail, so it is exempt from the rail's
        // outside-press dismiss. Without it, pressing a second card closed the
        // panel on pointerdown and the click reopened it on the next — the rail
        // sliding out and back in on every selection, which is not what
        // choosing a card means.
        {...PROPERTIES_TRIGGER_ATTR}
        // `aria-pressed` rather than `aria-selected`, which is only valid
        // inside a listbox/grid/tab role — this is a set of plain buttons, and
        // one of them is currently the one being edited.
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
              // DECORATIVE, deliberately: the name is written immediately
              // beside it, so a described picture would say the same thing
              // twice to anyone listening rather than looking.
              alt=""
              width={40}
              height={40}
            />
          ) : (
            initialOf(name)
          )}
        </span>

        <span className={styles.identity}>
          <span className={styles.name}>{name}</span>
          {/* Absent rather than empty when there is none, so a row without one
              leaves no gap under the name reading as a line still loading. */}
          {tagline && <span className={styles.tagline}>{tagline}</span>}
        </span>

        {/* The same control the homepage's social row is made of — shader,
            cursor tooltip and all. The tooltip carries the HANDLE, which is
            what the card used to print under the name: the information is
            still a hover away, and the line it was taking up now says
            something about the person instead. */}
        {linkedinUrl && (
          <SocialIconLink
            className={styles.profile}
            href={linkedinUrl}
            label={handleOf(linkedinUrl)}
            // Whose profile, because a board of twelve cards would otherwise be
            // twelve links announcing themselves as a path.
            ariaLabel={`${name} on LinkedIn`}
            maskSrc={LINKEDIN_MASK}
            Icon={LinkedInIcon}
            // The 24px chip rather than the 28px toolbar one. The glyph is the
            // house 20px either way; what comes in is the inset around it, so
            // the icon sits against the name as part of the byline rather than
            // as a control parked at the end of it.
            size="sm"
          />
        )}
      </div>

      {/* The chosen portion, or all of it. Asked of the domain rather than
          spelled out here, so this card, a future public page and a link
          preview cannot disagree about which words a testimonial shows. */}
      <p className={styles.quote}>{testimonialShown(testimonial)}</p>
    </div>
  );
}
