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

// ---------------------------------------------------------------------------
// One published testimonial, as a reader sees it — the card the wall at the
// foot of the homepage is made of.
//
// THE BOARD'S CARD PREDICTED THIS ONE and said so: "the day these words get a
// page of their own, that page's card will be a different component again — it
// will have no selection, no id, and nothing to say about when the row
// arrived." That is what this is, and the difference is smaller than it sounds,
// which is why the two share a recipe (`surface: "page"` here, `"board"`
// there) and every derived value (`testimonialInitial`, `linkedInHandle`,
// `testimonialShown` are all the domain's). What differs is the markup, and it
// differs for two reasons:
//
// NOT A BUTTON, so this can be real quotation markup. The board's card is a
// control that opens a rail, and nothing inside a button may be interactive.
// Here the card is at most a LINK, which is transparent about what it may
// contain — so the card is a `<figure>` holding a `<blockquote>` and its
// `<figcaption>`, the shape the HTML has for exactly this: words attributed to
// somebody. The attribution goes ABOVE the quote, as it does on the board, and
// `<figcaption>` is allowed either end of a figure.
//
// THE WHOLE CARD IS THE LINK, and there is no icon on it. There was one — the
// house social icon, shader and all, parked at the end of the byline — and it
// made a 280px card carry a 24px target for the one thing a reader might want
// to do with it. The card now stretches `select` over itself as an anchor (the
// same slot the board stretches a button over), the glyph moves into the
// tooltip where it says which network without taking up room on the card, and
// the tooltip's words are the person's handle alone. A card with no profile
// stored renders no anchor at all and is a quote and nothing else — which is
// also what `data-linked` tells the stylesheet, so only a card that can be
// followed lights its edge under the pointer.
//
// THE TOOLTIP IS THE SOCIAL ROW'S, word for word: `LinkedIn ∣ ↗`. Not the
// handle, which two earlier passes of this card showed — `lalit-arya-design`
// under a card headed "Lalit Arya" is the same fact spelled worse, and eight of
// them is eight lines of URL where the name is already the largest thing on the
// card. What a reader does not know is WHERE pressing goes, and that is the one
// thing the tooltip now says. The goto past the hairline says it leaves.
//
// The goto is decorative here, unlike the social row's, where it is a second
// anchor: a tooltip trailing the cursor across a 400px card cannot be aimed at,
// and there is nothing to aim at it for, because the card under it is already
// the link.
//
// `useActionTooltip` RATHER THAN A TOOLTIP OF ITS OWN. It is the hook `Button`
// and `Link` use, and what is wanted from it here is everything except the part
// about children: the cursor seeding, the touch gate (a finger must not raise a
// label it cannot dismiss) and the host context the portalled `Tooltip` reads.
// Portalled matters on this surface more than anywhere — the band around these
// cards is masked at both edges, and a tooltip drawn inside that mask would
// fade out with it.
//
// A CLIENT COMPONENT, and it was one before any of this: `SocialIconLink` takes
// its glyph as a COMPONENT, and a function cannot cross the server/client
// boundary. The tooltip needs the boundary for its own reasons now. The wall
// above stays a server component either way — it renders these, and the
// boundary starts here rather than there.
// ---------------------------------------------------------------------------

/**
 * What the tooltip calls the destination.
 *
 * The same word the row under the homepage's intro uses for the same place —
 * see `SOCIAL_ITEMS` in `social-links.tsx`. Spelled out here rather than
 * imported from that list, which is a description of THAT row (an href, a mask,
 * whether the icon copies or navigates) and not a naming table; what the two
 * share is a proper noun.
 */
const LINKEDIN_LABEL = "LinkedIn";

export interface TestimonialQuoteProps {
  testimonial: Testimonial;
}

export function TestimonialQuote({ testimonial }: TestimonialQuoteProps) {
  const styles = testimonialCard({ surface: "page" });
  const { name, avatarUrl, linkedinUrl, tagline } = testimonial;

  // Given the whole tooltip, or nothing when there is no profile to name — the
  // hook itself runs either way, as a hook must.
  const { tooltipNode, show, hide } = useActionTooltip(
    linkedinUrl ? (
      <Tooltip>
        <Tooltip.Text>{LINKEDIN_LABEL}</Tooltip.Text>
        {/* Sized and tinted by the tooltip recipe's own `& svg` rule, so a
            bare glyph in here needs no class of its own. */}
        <GotoIcon aria-hidden />
      </Tooltip>
    ) : null,
  );

  return (
    <figure
      className={styles.root}
      // Whether this card goes anywhere, for the stylesheet's benefit: the
      // hover edge is the recipe's, and it must not fire on a card that cannot
      // be followed. Read by `&[data-linked]:hover` in `testimonialCard`.
      data-linked={linkedinUrl ? "" : undefined}
    >
      <figcaption className={styles.byline}>
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
              // The wall is below the fold on every screen, and eight faces is
              // eight requests a reader may never scroll to.
              loading="lazy"
              decoding="async"
            />
          ) : (
            testimonialInitial(name)
          )}
        </span>

        <span className={styles.identity}>
          <span className={styles.name}>{name}</span>
          {/* Absent rather than empty when there is none, so a row without one
              leaves no gap under the name reading as a line still loading. */}
          {tagline && <span className={styles.tagline}>{tagline}</span>}
        </span>
      </figcaption>

      {/* The chosen portion, or all of it — asked of the domain so the board,
          this wall and any link preview cannot disagree about which words a
          testimonial shows. */}
      <blockquote className={styles.quote}>
        {testimonialShown(testimonial)}
      </blockquote>

      {/* THE HIT AREA: the card. An empty anchor over the whole of it, so a
          press anywhere lands on the profile — the same slot the board
          stretches its select button over, which is why the keyboard ring
          traces the card's own corners.

          NAMED BY THE PERSON, because a wall of eight would otherwise be eight
          links announcing themselves as the same handle. The tooltip carries
          the handle for anyone looking rather than listening. */}
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

      {/* Portalled to the body wherever it is written, so this is a placement
          in the source rather than on the screen. */}
      {tooltipNode}
    </figure>
  );
}
