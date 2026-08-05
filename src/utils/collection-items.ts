import { COLLECTION_MAX_ITEMS, type CollectionItem } from "@/domain/nodes";

// ---------------------------------------------------------------------------
// Collection item algebra
//
// Every mutation a collection block supports, as a pure array transform. The
// editor's grid and the reader's showcase are then both dumb: they take an
// ordered `items` array and render it. Two conventions carry the whole model:
//
//   • Index 0 IS the featured image. There is no `featured` flag to keep in
//     sync with the order, so "feature this one" is a move-to-front.
//   • The reader shows the first THREE items; anything past that lives only in
//     the surplus badge and the lightbox.
//
// Out-of-range indices are no-ops rather than throws: the editor's toolbars are
// rendered per slot and a removal can land between a render and a click.
// ---------------------------------------------------------------------------

/** How many tiles the reader's featured skeleton puts on screen. */
const READER_VISIBLE_TILES = 3;

const inRange = (items: readonly CollectionItem[], index: number) =>
  Number.isInteger(index) && index >= 0 && index < items.length;

/**
 * Exchanges two slots. This is the ONE reordering primitive the grid needs:
 * dragging a tile onto another swaps the pair, and featuring an image is the
 * same move with slot 0 as the destination.
 *
 * Swapping rather than splice-and-shift is what keeps the grid legible while
 * you rearrange it — two cells change and every other one stays where your eye
 * left it, instead of the whole tail sliding along by one.
 */
export function swapItems(
  items: readonly CollectionItem[],
  a: number,
  b: number,
): CollectionItem[] {
  const next = [...items];
  if (!inRange(items, a) || !inRange(items, b) || a === b) return next;
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/**
 * Makes `index` the featured image by exchanging it with slot 0 — index 0 IS
 * the featured position, so there is no flag to set, and dropping a tile into
 * the first cell reaches this same state by the same route.
 */
export function featureItem(
  items: readonly CollectionItem[],
  index: number,
): CollectionItem[] {
  return swapItems(items, index, 0);
}

export function removeItem(
  items: readonly CollectionItem[],
  index: number,
): CollectionItem[] {
  if (!inRange(items, index)) return [...items];
  return items.filter((_, i) => i !== index);
}

/**
 * Blank captions are stored as `undefined`, not `""` — the schema field is
 * optional and an empty string would serialize noise into every document.
 */
export function setItemCaption(
  items: readonly CollectionItem[],
  index: number,
  caption: string | undefined,
): CollectionItem[] {
  if (!inRange(items, index)) return [...items];
  const trimmed = caption?.trim();
  return items.map((item, i) => {
    if (i !== index) return item;
    const { caption: _dropped, ...rest } = item;
    return trimmed ? { ...rest, caption: trimmed } : rest;
  });
}

/** Appends up to the block's cap and silently drops the overflow. */
export function appendItems(
  items: readonly CollectionItem[],
  added: readonly CollectionItem[],
): CollectionItem[] {
  return [...items, ...added].slice(0, COLLECTION_MAX_ITEMS);
}

/**
 * Swaps the image in one slot. The caption belongs to the SLOT, not the file —
 * replacing a photo you've already annotated keeps the annotation, unless the
 * incoming item brings one of its own.
 */
export function replaceItem(
  items: readonly CollectionItem[],
  index: number,
  next: CollectionItem,
): CollectionItem[] {
  if (!inRange(items, index)) return [...items];
  return items.map((item, i) =>
    i === index
      ? { ...next, ...(item.caption && !next.caption ? { caption: item.caption } : {}) }
      : item,
  );
}

/**
 * The `alt` to render. Falls back to the caption, since an author who bothered
 * to describe an image in prose has already written its alternative text; an
 * empty string is the correct terminal fallback (decorative), not the filename.
 */
export function collectionItemAlt(item: CollectionItem): string {
  return item.alt ?? item.caption ?? "";
}

/** How many images the surplus badge stands in for. */
export function collectionSurplusCount(count: number): number {
  return Math.max(0, count - READER_VISIBLE_TILES);
}

export type CollectionLayout = "uniform" | "single" | "pair" | "featured";

/**
 * The editor always shows every slot, filled or not, so the 6-image cap is
 * visible rather than merely enforced. The reader has no empty slots to show,
 * so a collection too small for the featured skeleton splits evenly instead of
 * leaving holes in the grid.
 */
export function collectionLayout(
  count: number,
  context: "editor" | "reader",
): CollectionLayout {
  if (context === "editor") return "uniform";
  if (count >= READER_VISIBLE_TILES) return "featured";
  return count === 2 ? "pair" : "single";
}
