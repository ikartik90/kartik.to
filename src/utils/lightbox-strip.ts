/** Screens from the centre; `toward` is the side a swipe heads for. */
export type StripSlot = number | "toward";

export interface Leaving {
  index: number;
  slot: number;
}

/**
 * A strip on the move: where it last rested, null while the lightbox opens, and the items still
 * on their way out.
 */
export interface Transit {
  rest: number | null;
  leaving: Leaving[];
}

export const OPENING: Transit = { rest: null, leaving: [] };

function neighbours(index: number, count: number): [number, StripSlot][] {
  if (count === 2) return [[1 - index, "toward"]];
  if (count < 2) return [];
  return [
    [(index - 1 + count) % count, -1],
    [(index + 1) % count, 1],
  ];
}

/**
 * The items the strip renders, in index order; a null slot holds one out of sight. On the move,
 * opening included, it mounts nothing new but the item arriving, since a mount costs frames.
 */
export function stripSlots(
  index: number,
  count: number,
  transit: Transit | null,
): { index: number; slot: StripSlot | null }[] {
  const slots = new Map<number, StripSlot | null>([[index, 0]]);
  for (const item of transit?.leaving ?? []) {
    if (item.index !== index) slots.set(item.index, item.slot);
  }
  const taken = new Set(transit?.leaving.map((item) => item.slot));
  const mounted = !transit
    ? null
    : transit.rest === null
      ? new Set<number>()
      : new Set([transit.rest, ...neighbours(transit.rest, count).map(([at]) => at)]);
  for (const [neighbour, slot] of neighbours(index, count)) {
    if (slots.has(neighbour) || (mounted && !mounted.has(neighbour))) continue;
    slots.set(neighbour, typeof slot === "number" && taken.has(slot) ? null : slot);
  }
  return [...slots]
    .map(([at, slot]) => ({ index: at, slot }))
    .sort((a, b) => a.index - b.index);
}

/** The strip once `from` steps to `to`: what is still leaving moves a screen further along. */
export function stepTransit(
  transit: Transit | null,
  from: number,
  to: number,
  step: 1 | -1,
): Transit {
  return {
    rest: transit ? transit.rest : from,
    leaving: [
      ...(transit?.leaving ?? [])
        .filter((item) => item.index !== to && item.index !== from)
        .map((item) => ({ index: item.index, slot: item.slot - step })),
      { index: from, slot: -step },
    ],
  };
}
