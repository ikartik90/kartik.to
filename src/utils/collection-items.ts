import {
  COLLECTION_MAX_ITEMS,
  DEFAULT_MEDIA_FIT,
  type BackgroundEffect,
  type CollectionItem,
} from "@/domain/nodes";

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

/**
 * Sets — or, with `undefined`, removes — the Paper shader painted behind one
 * image. Like a blank caption, "no effect" is the ABSENT key rather than a
 * stored `undefined`, so a collection nobody has styled serializes exactly as
 * it did before the feature existed.
 *
 * The effect is replaced wholesale, never merged: the panel edits a complete
 * parameter set and hands back a complete one, so a partial write here could
 * only ever mean a bug upstream.
 */
export function setItemBackgroundEffect(
  items: readonly CollectionItem[],
  index: number,
  effect: BackgroundEffect | undefined,
): CollectionItem[] {
  if (!inRange(items, index)) return [...items];
  return items.map((item, i) => {
    if (i !== index) return item;
    const { backgroundEffect: _dropped, ...rest } = item;
    return effect ? { ...rest, backgroundEffect: effect } : rest;
  });
}

/** How the media sits in its frame — the panel's top section (Figma 885:1963). */
export type MediaLayoutPatch = Partial<
  Pick<CollectionItem, "objectFit" | "padding" | "borderRadius">
>;

/**
 * Patches one image's fit and/or inset. A PATCH rather than a wholesale write,
 * unlike the background effect above: the two controls are independent rows
 * that commit separately, so each hands back only what it owns and the other's
 * value has to survive.
 *
 * A value equal to the default DROPS its key, exactly as a blank caption does.
 * That is what keeps the round trip clean — set a picture to `contain` and back
 * to `cover` and it serializes as it did before the control existed, instead of
 * accumulating a `"objectFit": "cover"` on every image anyone ever clicked.
 *
 * `borderRadius` is the exception and passes straight through, zero included:
 * there, absent means "leave the surface's own corner" and zero means "square
 * this object", so dropping a zero would silently restore the corner the author
 * had just taken off. It rides in `rest` below rather than being handled — the
 * two named keys are exactly the two with a droppable default.
 */
export function setItemLayout(
  items: readonly CollectionItem[],
  index: number,
  patch: MediaLayoutPatch,
): CollectionItem[] {
  if (!inRange(items, index)) return [...items];
  return items.map((item, i) => {
    if (i !== index) return item;
    const {
      objectFit: _fit,
      padding: _padding,
      ...rest
    } = { ...item, ...patch };
    const objectFit = patch.objectFit ?? item.objectFit;
    const padding = patch.padding ?? item.padding;
    return {
      ...rest,
      ...(objectFit && objectFit !== DEFAULT_MEDIA_FIT ? { objectFit } : {}),
      ...(padding ? { padding } : {}),
    };
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
 * Everything that belongs to the SLOT rather than to the file sitting in it:
 * the annotation, and every property the media panel writes. All of it is work
 * the author did against that position in the grid — a fit chosen so the tile
 * crops well, an inset and a corner tuned against its neighbours, a shader
 * picked to sit behind it — so it outlives the picture it was applied to.
 *
 * `src` and `alt` are pointedly NOT here. Those describe the FILE: a new
 * picture arrives with its own source and its own description, and inheriting
 * the old one's alt would leave the page announcing a photo it is no longer
 * showing.
 */
const SLOT_OWNED_PROPERTIES = [
  "caption",
  "objectFit",
  "padding",
  "borderRadius",
  "backgroundEffect",
] as const satisfies readonly (keyof CollectionItem)[];

/**
 * Swaps the media in one slot, keeping everything the author applied to that
 * slot — see `SLOT_OWNED_PROPERTIES` — unless the incoming item states a value
 * of its own, which wins.
 *
 * Absence is tested rather than falsiness, because two of these carry a
 * meaningful zero: `borderRadius: 0` is a deliberately squared object, not a
 * missing corner, and a truthiness check would quietly restore the rounding the
 * author had just taken off.
 */
export function replaceItem(
  items: readonly CollectionItem[],
  index: number,
  next: CollectionItem,
): CollectionItem[] {
  if (!inRange(items, index)) return [...items];
  return items.map((item, i) =>
    i === index
      ? SLOT_OWNED_PROPERTIES.reduce<CollectionItem>(
          (merged, key) =>
            merged[key] === undefined && item[key] !== undefined
              ? { ...merged, [key]: item[key] }
              : merged,
          next,
        )
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
