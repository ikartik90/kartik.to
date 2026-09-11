"use client";

import { testimonialCard } from "../../../../styled-system/recipes";
import { testimonialShown, type Testimonial } from "@/domain/testimonial";
import LinkedInIcon from "@/assets/icons/linkedin.svg";

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
  const { name, avatarUrl, linkedinUrl } = testimonial;

  return (
    <button
      type="button"
      // `aria-pressed` rather than `aria-selected`, which is only valid inside
      // a listbox/grid/tab role — this is a set of plain buttons, and one of
      // them is currently the one being edited.
      aria-pressed={selected}
      className={styles.root}
      onClick={onSelect}
    >
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
          {/* Absent rather than empty when there is no profile. An empty row
              here would leave a gap under the name that reads as a handle
              still loading. */}
          {linkedinUrl && (
            <span className={styles.handle}>
              <LinkedInIcon aria-hidden />
              <span>{handleOf(linkedinUrl)}</span>
            </span>
          )}
        </span>
      </div>

      {/* The chosen portion, or all of it. Asked of the domain rather than
          spelled out here, so this card, a future public page and a link
          preview cannot disagree about which words a testimonial shows. */}
      <p className={styles.quote}>{testimonialShown(testimonial)}</p>
    </button>
  );
}
