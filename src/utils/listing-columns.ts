export type ListingColumns = 1 | 2 | 3;

/** A ceiling, chosen so a small set has no half-empty last row; the grid still steps down as space runs out. */
export function listingColumnsFor(count: number): ListingColumns {
  if (count <= 1) return 1;
  if (count === 2 || count === 4) return 2;
  return 3;
}

/** The widest span worth storing: CSS clamps to the columns on screen, so a 4 would render as 3. */
export const MAX_GRID_SPAN: ListingColumns = 3;
