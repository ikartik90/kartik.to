// Pins are absolute seats, not sort keys: publishing more cards never moves a pinned one.

export interface GridPlaceable {
  gridIndex?: number | null;
  publishedAt?: Date | null;
}

function byNewestFirst(a: GridPlaceable, b: GridPlaceable): number {
  const at = a.publishedAt?.getTime();
  const bt = b.publishedAt?.getTime();
  if (at == null) return bt == null ? 0 : 1;
  if (bt == null) return -1;
  return bt - at;
}

/** Keeps every card: a pin past the end clamps to the last seat; a colliding pin takes the next free one. */
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

  // Stable sorts, so a collision resolves by input order.
  pinned.sort((a, b) => (a.gridIndex ?? 0) - (b.gridIndex ?? 0));
  loose.sort(byNewestFirst);

  const seats: (T | undefined)[] = new Array(total);

  for (const p of pinned) {
    let seat = Math.min(p.gridIndex ?? 0, total - 1);
    while (seat < total && seats[seat] !== undefined) seat++;
    if (seat >= total) seat = seats.findIndex((s) => s === undefined);
    seats[seat] = p;
  }

  let next = 0;
  for (let i = 0; i < total; i++) {
    if (seats[i] === undefined) seats[i] = loose[next++];
  }

  // Every seat is filled by a pin or a loose item, so none is undefined.
  return seats as T[];
}
