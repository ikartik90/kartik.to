import { postCardMedia, type Post } from "@/domain/post";
import { POST_CATEGORIES } from "@/data/post-categories";
import { listingDate } from "@/utils/listing-date";
import { postCover } from "@/utils/post-cover";
import type { LinkCardTone } from "@/domain/link-card";
import type { MediaNode } from "@/domain/nodes";

// ---------------------------------------------------------------------------
// The post's card, resolved for a surface that is a picture rather than a page.
//
// Every one of these answers already exists on the homepage: the title is the
// post's, the line above it is the date or what the author typed, the picture
// is the document's opening media unless the card took it over, and the band is
// pinned or follows the reader. This states them once more for the Open Graph
// image, because that surface has to answer TWO of them differently and
// pretending otherwise would draw the wrong card.
//
// It has no reader, so it has no theme. The grid's card follows the page and
// swaps its picture per theme in CSS; a PNG is one picture and somebody has to
// choose. Light, unless the card was pinned dark — the band's default in both
// themes reads as the light one (see the recipe's `tone` variant, whose light
// values are exactly what the untoned card resolves to in a light theme), and
// a light card is the one that sits well in the feeds these are read in.
//
// And it cannot play anything. A clip's cover is its still (`ogCoverSrc`), and
// a clip with no still contributes no picture at all — the ground behind it is
// still drawn, which is why that is a separate question from which media object
// the card is showing.
// ---------------------------------------------------------------------------

/** What a post with no name is called, matching the grid's own answer. */
const UNTITLED = "Untitled";

export interface OgCard {
  title: string;
  /** The line above the title, or `null` for a card filed under nothing. */
  meta: string | null;
  /** Which band the card is drawn in — see the file note on why it must pick. */
  tone: LinkCardTone;
  /** Whether the words stand on a wash, as `LinkCard`'s `scrim` decides it. */
  scrim: boolean;
  /**
   * The media object the card shows — the whole object, because the ground
   * behind the picture and the way the picture sits in it are one composition.
   * `null` for a post whose card is a flat plate.
   */
  cover: MediaNode | null;
}

export function ogCard(post: Post): OgCard {
  const card = post.card ?? {};
  const { light, dark } = postCardMedia(card, postCover(post.content));
  const tone: LinkCardTone = card.tone ?? "light";

  // The matching picture where there is one, and the other where there is not:
  // a card given a single picture shows it in both bands, which is what every
  // card with one cover already does.
  const cover = (tone === "dark" ? (dark ?? light) : (light ?? dark)) ?? null;

  return {
    title: post.title ?? UNTITLED,
    // The post's own line wins over the authored one — the same rule `PostCard`
    // follows, and for the same reason: an article is filed by its date and the
    // rail offers no Meta row on one at all.
    meta:
      (POST_CATEGORIES[post.category].dated && post.publishedAt
        ? listingDate(post.publishedAt)
        : card.meta) ?? null,
    tone,
    // `LinkCard`'s own default: wherever there is a picture, unless the author
    // turned it off over one that is already flat where the caption sits.
    scrim: card.scrim ?? Boolean(cover),
    cover,
  };
}

/**
 * The URL of the picture to draw, or `null` where there is none to draw.
 *
 * A clip answers with its STILL, and with nothing at all when it has none —
 * every clip stored before `capture-poster` existed, and any whose decode gave
 * out. That is not the same as having no cover: the media object may carry a
 * background effect, and a ground with no picture on it is still the card's
 * ground. So the two questions are asked separately.
 */
export function ogCoverSrc(media: MediaNode | null): string | null {
  if (!media) return null;
  if (media.kind === "video") return media.poster ?? null;
  return media.src;
}
