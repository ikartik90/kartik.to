import { css } from "../../styled-system/css";
import { linkCard } from "../../styled-system/recipes";
import { Typography } from "./ui/typography";
import { BackgroundEffectLayer } from "@/components/background-effect";
import { Media } from "@/components/media";
import { ScrimBlur } from "@/components/scrim-blur";
import { gridItemVars } from "@/utils/grid-item-vars";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";
import type { LinkCardTone } from "@/domain/link-card";
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
//
// EVERY PART OF IT IS OPTIONAL, and that arrived with the link card — a tile
// published from the component library rather than derived from a post. A post
// always has a title and takes its picture from its own document; a link card
// is a shell somebody fills in, so it has to be a real thing at every stage of
// being built: a picture with no words, words with no picture, and, while it is
// being authored, neither and nowhere to go.
// ---------------------------------------------------------------------------

/**
 * The light picture, hidden where the reader's theme is dark — and its
 * opposite. Only ever applied when there are TWO of them; a card with one
 * picture shows it in both themes and wears neither class.
 *
 * CSS rather than a resolved theme read in JS, and that is the load-bearing
 * half: this card is rendered on the SERVER, where the theme cannot be asked,
 * so a scripted answer would paint the light screenshot onto a dark page and
 * swap it a frame after hydration. The same trade every other two-asset switch
 * in this codebase makes (`PropertiesPanel.DockIcon`, the upload dialog's
 * illustration) — one extra request, and the right picture in the first paint.
 */
const lightOnlyStyle = css({ _dark: { display: "none" } });
const darkOnlyStyle = css({ display: "none", _dark: { display: "block" } });

export interface LinkCardProps {
  /**
   * Where the card goes — and `undefined` for one that has not been pointed
   * anywhere yet.
   *
   * Absent renders a plain box rather than an anchor with an empty `href`,
   * which is a link to the page you are already on: focusable, followable, and
   * announced as a link to nowhere. A half-built card should be none of those.
   */
  href?: string;
  /**
   * The name written across the card, and `undefined` for a tile that is a
   * picture alone. See `label` for how a wordless card is named.
   */
  title?: string;
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
   * Rendered as a meta line above the title. Pre-formatted, because what goes
   * there is the listing's business and not the tile's — an article's card
   * passes its date, a link card passes whatever the author typed, and the
   * projects grid passes none at all.
   */
  meta?: string;
  /**
   * The link's accessible name, for a card that shows no words.
   *
   * Only consulted when there is no `title`, and needed exactly then: the media
   * is decorative (`alt=""`, inside an aria-hidden box), so a wordless card's
   * anchor would otherwise have no accessible name whatsoever and be announced
   * as its own URL. A titled card is named by its title and ignores this.
   */
  label?: string;
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
   * The picture to show instead where the reader's theme is dark.
   *
   * A second file rather than a filter, because the case it exists for is a
   * screenshot: the card is a window onto something that has its own light and
   * dark appearance, and no amount of inversion turns one into the other.
   *
   * Absent means the one picture serves both themes, which is what every card
   * that predates this does — a photograph or an illustration reads either way
   * and duplicating it would be two requests for one picture.
   */
  coverDark?: MediaNode | null;
  /**
   * Whether the caption stands on a scrim — the frosting and the wash that
   * separate it from the picture underneath.
   *
   * Defaults to "wherever there is a picture", which is what the card has
   * always done: over the flat plate a coverless card draws there is nothing to
   * separate the words from, and a `bg.surface` wash on `bg.surface` is an
   * invisible gradient plus two backdrop filters nobody asked the compositor
   * for. `false` turns it off over a picture that is already flat and dark
   * where the caption sits, and where a wash would only grey it out.
   */
  scrim?: boolean;
  /**
   * Which theme the band is drawn in, pinned rather than followed.
   *
   * Absent lets the caption and the wash track the reader's theme, which is
   * right for a post's tile: its picture is the article's own illustration and
   * was authored alongside the page. A link card's cover is frequently a
   * screenshot of a fixed appearance, and then the band has to be pinned to
   * match it — see the recipe's `tone` variant for what it actually reassigns.
   */
  tone?: LinkCardTone;
  /** Whether following the card leaves this tab. */
  newTab?: boolean;
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
  meta,
  label,
  cover,
  coverDark,
  scrim,
  tone,
  newTab = false,
  interactive = true,
}: LinkCardProps) {
  const styles = linkCard({ aspect, tone });

  // Either picture counts. The ink reassignment and the scrim's default are
  // about whether the words stand on a PICTURE, and a card given only a dark
  // one has a picture in exactly the theme it was given for.
  const covered = Boolean(cover || coverDark);
  // The words, asked once. Both are optional and a card with neither draws no
  // caption box at all — an empty one is padding and a gap, which is a strip of
  // dead space across the foot of the picture with a scrim shading nothing.
  const captioned = Boolean(title || meta);
  const grounded = scrim ?? covered;

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
      // The name of a card that shows no words — see `label`. Never set
      // alongside a title, which would win over the visible text and make the
      // card read as something other than what it says.
      aria-label={!title && label ? label : undefined}
      tabIndex={interactive ? undefined : -1}
      target={newTab ? "_blank" : undefined}
      // Never `_blank` without it: the opened page otherwise gets a live handle
      // on this one through `window.opener`.
      rel={newTab ? "noopener noreferrer" : undefined}
      // Whether this tile is a picture or a plate, said once on the card
      // itself. Nothing inside needs to ask — the scrim only exists when there
      // is something to lay it over — so this is for anything reading the card
      // from outside it.
      data-covered={covered ? "" : undefined}
    >
      {/* The picture's slot, and a flat plate behind whatever fills it — out of
          flow, so it fills the card without ever being able to stretch it,
          which is what leaves the caption as the only thing that could.

          The media is DECORATIVE, `alt=""` and inside an aria-hidden box. The
          link is already named by the words below it — or by `label` where
          there are none — and a card that read out the diagram's description
          before its own title would say the picture twice: once as the
          article's illustration and once as the name of the thing you are
          about to open. */}
      <div className={styles.cover} role="presentation" aria-hidden="true">
        <CardCover
          media={cover}
          styles={styles}
          // Only where there are two. One picture serves both themes and must
          // not be hidden in either.
          className={coverDark ? lightOnlyStyle : undefined}
        />
        {coverDark && (
          <CardCover
            media={coverDark}
            styles={styles}
            className={cover ? darkOnlyStyle : undefined}
          />
        )}
      </div>
      {/* The words, and — where they are grounded — the band they stand on, in
          ONE box. Written in the order they PAINT, which is the design:
          the frosting that softens the picture, the wash that tints what the
          frosting produced, and the caption over both. Put the wash first and
          the frosting filters a near-opaque plate — a backdrop filter only
          works on what has already painted — which is a blur costing two
          compositor layers and showing nothing.

          The box is the CAPTION's, with a floor of a quarter of the card, so
          the scrim is `max(a quarter, the words)` without anything being
          measured. Both layers are `inset: 0` inside it, so neither the blur
          nor the gradient can reach past it — and bounding only one of them
          would bound only half of what the eye reads as the scrim.

          Absent entirely for a card with no words and no band: the box exists
          to hold and ground a caption, and one holding neither is a quarter of
          the card reserved for nothing. */}
      {(captioned || grounded) && (
        <div className={styles.scrim}>
          {grounded && (
            <>
              <ScrimBlur towards="top" />
              <div className={styles.wash} />
            </>
          )}
          {captioned && (
            <div className={styles.caption}>
              {/* Above the title, not below it: the title is what the card is
                  called and belongs on the last line before the card's edge,
                  with anything qualifying it read on the way in. */}
              {meta && (
                <Typography tag="p" type="caption">
                  {meta}
                </Typography>
              )}
              {title && (
                <Typography tag="h2" type="bodyLarge">
                  {title}
                </Typography>
              )}
            </div>
          )}
        </div>
      )}
    </a>
  );
}

/**
 * One picture and the ground behind it, in the paint order the cover demands.
 *
 * Its own component because the card draws this up to twice — once per theme —
 * and the two must be identical in every respect but which of them is showing.
 * Written out twice it would be the ground, the frame, the fit, the inset, the
 * corner and the source shape stated in two places, which is six chances for
 * the dark card to drift away from the light one.
 */
function CardCover({
  media,
  styles,
  className,
}: {
  media: MediaNode | null | undefined;
  styles: ReturnType<typeof linkCard>;
  /** Which theme this copy is for, where there are two. */
  className?: string;
}) {
  if (!media) return null;
  return (
    <>
      {/* The ground first, and only where the object actually has one — a
          shader is a WebGL context apiece, so an empty one is not a layer that
          costs nothing. */}
      {media.backgroundEffect && (
        <BackgroundEffectLayer
          effect={media.backgroundEffect}
          className={`${styles.backgroundEffect}${className ? ` ${className}` : ""}`}
        />
      )}
      <div
        className={`${styles.mediaFrame}${className ? ` ${className}` : ""}`}
      >
        <Media
          src={media.src}
          alt=""
          kind={media.kind}
          className={styles.media}
          // The fit, the inset and the corner off the object itself — the same
          // three the editor previewed and the reader's tile draws. They are
          // what leaves any of the ground visible, so a card that dropped them
          // would carry a shader nobody could see. All of them resolve as
          // shares of this box, so the article's composition arrives at the
          // card's size rather than at the article's.
          layout={media}
          // And the source's own shape, so the box is held from the first paint
          // instead of opening under the reader.
          width={media.width}
          height={media.height}
        />
      </div>
    </>
  );
}
