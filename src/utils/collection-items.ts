import {
  COLLECTION_MAX_ITEMS,
  DEFAULT_MEDIA_FIT,
  type BackgroundEffect,
  type MediaNode,
} from "@/domain/nodes";

// Index 0 is the featured item; there is no flag. Out-of-range indices are
// no-ops, since a removal can land between a render and a click.

const READER_VISIBLE_TILES = 3;

const inRange = (items: readonly MediaNode[], index: number) =>
  Number.isInteger(index) && index >= 0 && index < items.length;

export function swapItems(
  items: readonly MediaNode[],
  a: number,
  b: number,
): MediaNode[] {
  const next = [...items];
  if (!inRange(items, a) || !inRange(items, b) || a === b) return next;
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export function featureItem(
  items: readonly MediaNode[],
  index: number,
): MediaNode[] {
  return swapItems(items, index, 0);
}

export function removeItem(
  items: readonly MediaNode[],
  index: number,
): MediaNode[] {
  if (!inRange(items, index)) return [...items];
  return items.filter((_, i) => i !== index);
}

export function setItemCaption(
  items: readonly MediaNode[],
  index: number,
  caption: string | undefined,
): MediaNode[] {
  if (!inRange(items, index)) return [...items];
  const trimmed = caption?.trim();
  return items.map((item, i) => {
    if (i !== index) return item;
    const { caption: _dropped, ...rest } = item;
    return trimmed ? { ...rest, caption: trimmed } : rest;
  });
}

export function setItemBackgroundEffect(
  items: readonly MediaNode[],
  index: number,
  effect: BackgroundEffect | undefined,
): MediaNode[] {
  if (!inRange(items, index)) return [...items];
  return items.map((item, i) => {
    if (i !== index) return item;
    const { backgroundEffect: _dropped, ...rest } = item;
    return effect ? { ...rest, backgroundEffect: effect } : rest;
  });
}

export type MediaLayoutPatch = Partial<
  Pick<MediaNode, "objectFit" | "padding" | "borderRadius">
>;

export function setItemLayout(
  items: readonly MediaNode[],
  index: number,
  patch: MediaLayoutPatch,
): MediaNode[] {
  if (!inRange(items, index)) return [...items];
  return items.map((item, i) => {
    if (i !== index) return item;
    const {
      objectFit: _fit,
      padding: _padding,
      borderRadius: _radius,
      ...rest
    } = { ...item, ...patch };
    const objectFit = patch.objectFit ?? item.objectFit;
    const padding = patch.padding ?? item.padding;
    const borderRadius = patch.borderRadius ?? item.borderRadius;
    return {
      ...rest,
      ...(objectFit && objectFit !== DEFAULT_MEDIA_FIT ? { objectFit } : {}),
      ...(padding ? { padding } : {}),
      ...(borderRadius ? { borderRadius } : {}),
    };
  });
}

export function appendItems(
  items: readonly MediaNode[],
  added: readonly MediaNode[],
): MediaNode[] {
  return [...items, ...added].slice(0, COLLECTION_MAX_ITEMS);
}

// Slot-owned, so they survive a replace. Never add `kind`: it describes the file,
// and inheriting it would leave an `<img>` pointed at a dropped-in clip.
const SLOT_OWNED_PROPERTIES = [
  "caption",
  "objectFit",
  "padding",
  "borderRadius",
  "backgroundEffect",
] as const satisfies readonly (keyof MediaNode)[];

/** Swaps the media in one slot, keeping the slot-owned properties `next` doesn't set. */
export function replaceItem(
  items: readonly MediaNode[],
  index: number,
  next: MediaNode,
): MediaNode[] {
  if (!inRange(items, index)) return [...items];
  return items.map((item, i) =>
    i === index
      ? SLOT_OWNED_PROPERTIES.reduce<MediaNode>(
          (merged, key) =>
            merged[key] === undefined && item[key] !== undefined
              ? { ...merged, [key]: item[key] }
              : merged,
          next,
        )
      : item,
  );
}

/** Falls back to the caption, then "" (decorative), never the filename. */
export function collectionItemAlt(item: MediaNode): string {
  return item.alt ?? item.caption ?? "";
}

export function collectionSurplusCount(count: number): number {
  return Math.max(0, count - READER_VISIBLE_TILES);
}

export type CollectionLayout = "uniform" | "single" | "pair" | "featured";

export function collectionLayout(
  count: number,
  context: "editor" | "reader",
): CollectionLayout {
  if (context === "editor") return "uniform";
  if (count >= READER_VISIBLE_TILES) return "featured";
  return count === 2 ? "pair" : "single";
}
