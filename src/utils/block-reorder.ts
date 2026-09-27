// Blocks sit in one column in document order; a slot is a gap between two of them, 0 above the first.

export interface BlockBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** The block under a point: its box, `reach` further left for its handle, and half of each gap to a neighbour. */
export function blockAt(
  boxes: readonly BlockBox[],
  x: number,
  y: number,
  reach: number,
): number | null {
  const index = boxes.findIndex((box, i) => {
    const above = boxes[i - 1];
    const below = boxes[i + 1];
    const top = above ? (above.bottom + box.top) / 2 : box.top;
    const bottom = below ? (box.bottom + below.top) / 2 : box.bottom;
    return x >= box.left - reach && x <= box.right && y >= top && y <= bottom;
  });
  return index < 0 ? null : index;
}

/** Past every block whose middle is above `y`. */
export function dropSlot(
  boxes: readonly Pick<BlockBox, "top" | "bottom">[],
  y: number,
): number {
  return boxes.filter((box) => (box.top + box.bottom) / 2 < y).length;
}

/** Where the block at `from` lands when dropped into `slot`; null in the two slots beside it. */
export function slotIndex(from: number, slot: number): number | null {
  if (slot === from || slot === from + 1) return null;
  return slot < from ? slot : slot - 1;
}

export function slotLineY(
  boxes: readonly Pick<BlockBox, "top" | "bottom">[],
  slot: number,
  gap: number,
): number {
  const above = boxes[slot - 1];
  const below = boxes[slot];
  if (!above) return below.top - gap / 2;
  if (!below) return above.bottom + gap / 2;
  return (above.bottom + below.top) / 2;
}
