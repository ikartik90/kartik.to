import { linkCard } from "../../styled-system/recipes";
import { Typography } from "./ui/typography";
import { BackgroundEffectLayer } from "@/components/background-effect";
import { Media } from "@/components/media";
import { ScrimBlur } from "@/components/scrim-blur";
import { gridItemVars } from "@/utils/grid-item-vars";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";
import type { MediaNode } from "@/domain/nodes";

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
   * The media object laid across the whole card, and `undefined` for a tile
   * that has none: it keeps the flat plate the card has always drawn.
   *
   * The whole OBJECT — the file, its ground, and how it sits in that ground —
   * because those three are one composition and a card showing two of them is
   * showing a different picture. Rendered exactly as the reader's tile and the
   * lightbox render it, in shares of this box rather than in the article's
   * pixels; see `postCover`, which is where the homepage gets one.
   *
   * WHICH object is the caller's business, not this component's. The card has
   * never read a `Post` and still does not.
   */
  cover?: MediaNode | null;
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
  cover,
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
      // Whether this tile is a picture or a plate, said once on the card
      // itself. Nothing inside needs to ask — the scrim only exists when there
      // is something to lay it over — so this is for anything reading the card
      // from outside it.
      data-covered={cover ? "" : undefined}
    >
      {/* The picture's slot, and a flat plate behind whatever fills it — out of
          flow, so it fills the card without ever being able to stretch it,
          which is what leaves the caption as the only thing that could.

          The media is DECORATIVE, `alt=""` and inside an aria-hidden box. The
          link is already named by the words below it, and a card that read out
          the diagram's description before its own title would say the picture
          twice: once as the article's illustration and once as the name of the
          thing you are about to open. */}
      <div className={styles.cover} role="presentation" aria-hidden="true">
        {cover && (
          <>
            {/* The ground first, and only where the object actually has one —
                a shader is a WebGL context apiece, so an empty one is not a
                layer that costs nothing. */}
            {cover.backgroundEffect && (
              <BackgroundEffectLayer
                effect={cover.backgroundEffect}
                className={styles.backgroundEffect}
              />
            )}
            <div className={styles.mediaFrame}>
              <Media
                src={cover.src}
                alt=""
                kind={cover.kind}
                className={styles.media}
                // The fit, the inset and the corner off the object itself —
                // the same three the editor previewed and the reader's tile
                // draws. They are what leaves any of the ground visible, so a
                // card that dropped them would carry a shader nobody could
                // see. All of them resolve as shares of this box, so the
                // article's composition arrives at the card's size rather than
                // at the article's.
                layout={cover}
                // And the source's own shape, so the box is held from the
                // first paint instead of opening under the reader.
                width={cover.width}
                height={cover.height}
              />
            </div>
          </>
        )}
      </div>
      {/* The words, and — where there is a picture — the ground they stand on,
          in ONE box. Written in the order they PAINT, which is the design:
          the frosting that softens the picture, the wash that tints what the
          frosting produced, and the caption over both. Put the wash first and
          the frosting filters a near-opaque plate — a backdrop filter only
          works on what has already painted — which is a blur costing two
          compositor layers and showing nothing.

          The box is the CAPTION's, with a floor of half the card, so the scrim
          is `max(half, the words)` without anything being measured. Both
          layers are `inset: 0` inside it, so neither the blur nor the gradient
          can reach past it — and bounding only one of them would bound only
          half of what the eye reads as the scrim. */}
      <div className={styles.scrim}>
        {cover && (
          <>
            <ScrimBlur towards="top" />
            <div className={styles.wash} />
          </>
        )}
        <div className={styles.caption}>
          {/* Above the title, not below it: the title is what the card is
              called and belongs on the last line before the card's edge, with
              anything qualifying it read on the way in. */}
          {date && (
            <Typography tag="p" type="caption">
              {date}
            </Typography>
          )}
          <Typography tag="h2" type="bodyLarge">
            {title}
          </Typography>
        </div>
      </div>
    </a>
  );
}
