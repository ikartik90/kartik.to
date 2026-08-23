/** Which of a card's two gutters an insertion control sits in. */
export type GridInsertSide = "before" | "after";

/**
 * The gutter the cursor is already next to, of the two a card has.
 *
 * Edit mode hangs an [+] in both gutters of every card, and showing both at
 * once is clutter: the cursor can only be on its way to one of them, and the
 * other is a second identical button the eye has to dismiss. So the card offers
 * the near one and keeps the far one out of the way.
 *
 * Decided against the card's own midpoint, and deliberately with nothing else
 * in it — no dead zone, no hysteresis. A card is at most a few hundred pixels
 * wide, the swap happens under a cursor that is crossing the middle of it, and
 * a band in there would only mean a stretch of card where neither gutter
 * answers.
 */
export function nearerInsertSide(
  clientX: number,
  cell: { left: number; width: number },
): GridInsertSide {
  return clientX < cell.left + cell.width / 2 ? "before" : "after";
}
