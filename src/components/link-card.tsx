import { linkCard } from "../../styled-system/recipes";
import { Typography } from "./ui/typography";
import { gridItemVars } from "@/utils/grid-item-vars";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";

// ---------------------------------------------------------------------------
// One tile of a listing: a picture at a declared shape with the name of what it
// points at written across it. The projects grid is made of these, and the
// articles grid will be next — which is the whole reason it takes plain props
// rather than the `Post` its predecessor did.
//
// That predecessor, `ProjectCard`, took the record and derived the card from
// it: the href from the slug, the blurb from the first paragraph of the
// document. Reading a card off a domain object that way looks economical right
// up to the second source, at which point every field is a branch — an article
// dates its card and a project does not, a curated tile has no post behind it
// at all — and the component starts knowing about the shapes of things it
// renders. Plain props push all of that back to the caller, where it is four
// lines of mapping in plain sight, and leave this able to be fed by anything.
//
// The blurb did not come with it. It was the post's opening paragraph presented
// where a summary belongs, which is a different claim from the one it could
// actually support, and the new card has no room under the title for it anyway.
// ---------------------------------------------------------------------------

export interface LinkCardProps {
  href: string;
  title: string;
  /**
   * The card's shape, from the app's one ratio map — the same eleven keys the
   * demo frame picks from. Deliberately not a card-specific enum: a second list
   * of ratios is a second place to add the twelfth, and the last time this
   * quantity lived in more than one place three copies of it drifted apart. The
   * TYPE still reads as the demo frame's because that is where the map lives;
   * it is shared, not borrowed.
   */
  aspect: DemoFrameAspectRatio;
  /**
   * How many columns the card takes in a masonry grid. Cut down to the columns
   * the grid actually has, in CSS, at the width it ends up at — so asking for
   * three here is a ceiling, not a promise, and a card is never the reason a
   * narrow grid overflows.
   *
   * Harmless outside a grid: it sets a custom property nothing else reads.
   */
  span?: number;
  /**
   * Rendered as a meta line above the title. Pre-formatted, because how a date
   * reads is the listing's business and not the tile's — the projects grid
   * passes none at all.
   */
  date?: string;
  /**
   * The poster's key in R2. Accepted now and rendered by nobody: the cover is
   * still the flat plate it has always been, and wiring the prop ahead of the
   * picture is what lets the callers that already know their key start passing
   * it without a second pass over every call site when posters land.
   */
  coverImageKey?: string;
  /**
   * Whether the card can be followed. False while the grid is being edited: the
   * card is scenery then, and navigating away would discard the unsaved layout.
   *
   * Takes the link OUT OF THE TAB ORDER rather than only blocking the pointer,
   * because Enter on a focused link navigates just as well as a click. The href
   * stays put — it is what the card IS, and the card is still readable.
   */
  interactive?: boolean;
}

export function LinkCard({
  href,
  title,
  aspect,
  span,
  date,
  interactive = true,
}: LinkCardProps) {
  const styles = linkCard({ aspect });

  return (
    // The shape is declared TWICE over, to two different mechanisms, from one
    // prop. The recipe's `aspect` variant sets a real `aspect-ratio`, which is
    // what gives the card its height under `grid-lanes` and under no masonry at
    // all; the custom properties are what the fine-track fallback computes a row
    // span from. Derived here rather than asked of the caller precisely because
    // they must never disagree.
    <a
      href={href}
      className={styles.root}
      style={gridItemVars(aspect, span)}
      tabIndex={interactive ? undefined : -1}
    >
      {/* The picture's slot. Empty and inert until there is a picture — it is
          out of flow, so it fills the card without ever being able to stretch
          it, which is what leaves the caption as the only thing that could. */}
      <div className={styles.cover} role="presentation" aria-hidden="true" />
      <div className={styles.caption}>
        {/* Above the title, not below it: the title is what the card is called
            and belongs on the last line before the card's edge, with anything
            qualifying it read on the way in. */}
        {date && (
          <Typography tag="p" type="caption">
            {date}
          </Typography>
        )}
        <Typography tag="h2" type="bodyLarge">
          {title}
        </Typography>
      </div>
    </a>
  );
}
