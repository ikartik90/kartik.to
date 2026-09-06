import type { MediaNode } from "@/domain/nodes";
import type { Document } from "@/domain/post";

// ---------------------------------------------------------------------------
// A post's cover, read off the post itself.
//
// A card on the homepage used to be a flat plate with a name on it, and the
// picture it wanted was already in the document — the diagram the article opens
// with, the featured shot of a project's collection. Asking the author to
// nominate one AGAIN, in a field beside the document, is a second copy of a
// fact the writing already carries: it would have to be set on every post that
// exists, kept in step when the opening image is swapped, and it would go stale
// silently, because nothing about a card can tell you its picture is no longer
// in the article.
//
// So the cover is DERIVED, and the rule is the plainest one there is: the first
// media the document holds, reading top to bottom. Whatever the reader meets
// first is what the card shows — which is also the picture an author would have
// picked, since it is the one they chose to open with.
//
// The two positions media occupies answer the same way, because a collection
// item IS a media node (`CollectionItemSchema`): a standalone block contributes
// itself, and a collection contributes its FEATURED item, which is slot 0 by
// definition rather than by a flag (see `featureItem` in `collection-items.ts`).
// Nothing here reads a `featured` field, because there is no such field to
// disagree with the order.
//
// It stops at the top level, and that is not a gap: `BlockNodeSchema` is flat —
// no block holds another — so a walk over `content` has already seen every node
// there is.
// ---------------------------------------------------------------------------

/**
 * The media OBJECT, whole — the file, and the ground the author put behind it.
 *
 * This was a narrowing at first, `{ src, kind }` and nothing else, on the
 * argument that the fit, the inset and the corner were chosen against a column
 * of prose and a card is a different box. Half of that argument was right and
 * the half that was wrong is the half that matters: a `backgroundEffect` is not
 * a property of the frame, it is the picture's GROUND, and a shader is only
 * ever visible through what the fit and the inset leave uncovered. Carrying the
 * ground and dropping the composition that reveals it would have carried
 * nothing at all — a shader behind a `cover`-cropped opaque picture is a shader
 * nobody can see.
 *
 * So the whole object travels, and the card renders it the way every other
 * surface does (`MediaTile`, the lightbox, the article block): `mediaObjectStyle`
 * and its siblings are written in shares of the box rather than in pixels, so
 * the same object composes at 300px and at 960px without being re-decided. A
 * picture that states no fit still fills the tile, because filling is what
 * `DEFAULT_MEDIA_FIT` already is.
 *
 * `alt` and `caption` travel with it and go unread: the card is named by its
 * title and the picture in it is decorative. They are not stripped, because
 * this is a media node rather than a card-shaped copy of one, and a copy is a
 * thing that goes stale.
 *
 * `null` for a document with no media in it at all. Such a post keeps the flat
 * plate the card has always drawn; there is nothing to fall back to and nothing
 * to invent.
 */
export function postCover(document: Document): MediaNode | null {
  for (const block of document.content) {
    if (block.type === "media") return block;
    // An empty collection is a legal document — removing images one by one has
    // to pass through zero — so it is a block with no cover IN it rather than
    // an answer of "this post has no cover", and the walk goes on past it.
    if (block.type === "collection" && block.items[0]) {
      return block.items[0];
    }
  }
  return null;
}
