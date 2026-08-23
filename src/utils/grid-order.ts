// ---------------------------------------------------------------------------
// The order the grid renders in: pinned cards at the positions they were given,
// everything else flowing chronologically around them.
//
// The point of a pin is that it does not move. Position 3 is position 3 whether
// the grid holds four cards or forty — publishing two more projects must not
// slide a pinned card to 5. That rules out the obvious implementation, sorting
// by an index that unpinned items also carry: any such sort makes a pin's
// position a function of how many things sort above it, which is precisely the
// property a pin exists to deny.
//
// So the pins are SEATED first, into a board of fixed size, and the unpinned
// are poured into whatever is left. `gridIndex` is read as an absolute seat
// number, not as a sort key.
//
// This takes the two fields it reads and nothing else — no `Post`, no
// `Component` — because it has to order a mixed feed of both, and the day a
// third kind of card joins them it should not need editing. Both records
// already expose exactly this shape.
// ---------------------------------------------------------------------------

export interface GridPlaceable {
  /** A seat number. `null`/absent means "wherever chronology puts me". */
  gridIndex?: number | null;
  /** Undated items sort last — a draft has no place in a timeline. */
  publishedAt?: Date | null;
}

/** Newest first, with the undated pushed to the back rather than to the front. */
function byNewestFirst(a: GridPlaceable, b: GridPlaceable): number {
  const at = a.publishedAt?.getTime();
  const bt = b.publishedAt?.getTime();
  if (at == null) return bt == null ? 0 : 1;
  if (bt == null) return -1;
  return bt - at;
}

/**
 * Seat the pinned, pour in the rest.
 *
 * Total length is preserved exactly: nothing is dropped and no hole is left,
 * whatever the pins ask for. Two cases make that non-trivial, and both are
 * decided here rather than guarded against upstream:
 *
 *   • A pin past the end (index 99 in a grid of three) clamps to the last seat.
 *     Rejecting it would mean a card vanishing from the page because a number
 *     went stale, which is a worse failure than it sitting last.
 *
 *   • Two pins claiming one seat. `GridIndexSchema` deliberately allows this and
 *     prices it as cosmetic and self-healing, but cosmetic still has to resolve
 *     to SOMETHING deterministic — the loser takes the next free seat, so the
 *     collision costs one position rather than a disappeared card.
 *
 * Returns a new array; the input is not touched.
 */
export function orderGridItems<T extends GridPlaceable>(
  items: readonly T[],
): T[] {
  const total = items.length;
  if (total === 0) return [];

  const pinned: T[] = [];
  const loose: T[] = [];
  for (const it of items) {
    if (typeof it.gridIndex === "number") pinned.push(it);
    else loose.push(it);
  }

  // Ascending, so an earlier pin claims its seat before a later one can be
  // bumped into it. Both sorts are stable, which is what makes a collision
  // resolve by input order rather than by chance.
  pinned.sort((a, b) => (a.gridIndex ?? 0) - (b.gridIndex ?? 0));
  loose.sort(byNewestFirst);

  const seats: (T | undefined)[] = new Array(total);

  for (const p of pinned) {
    let seat = Math.min(p.gridIndex ?? 0, total - 1);
    while (seat < total && seats[seat] !== undefined) seat++;
    // Everything from the requested seat to the end was taken — wrap and take
    // the first free seat instead. Reachable only under collisions, and the
    // alternative is dropping the card.
    if (seat >= total) seat = seats.findIndex((s) => s === undefined);
    seats[seat] = p;
  }

  let next = 0;
  for (let i = 0; i < total; i++) {
    if (seats[i] === undefined) seats[i] = loose[next++];
  }

  // Sound by counting: `pinned.length + loose.length === total`, every pin
  // takes exactly one free seat, and the loop above fills every seat still
  // empty. No seat can remain undefined.
  return seats as T[];
}
