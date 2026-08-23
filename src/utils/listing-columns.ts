export type ListingColumns = 1 | 2 | 3;

/**
 * How many columns a listing of `count` cards wants at its widest.
 *
 * Not a constant three: a grid whose last row is half-empty reads as a set with
 * something missing from it, so a small set picks the count that divides it
 * evenly instead. One card takes the grid whole, two and four split it in half,
 * three fills a row exactly, and past four the remainder stops being legible as
 * a gap — a three-up grid is simply what a listing looks like.
 *
 * This is the CEILING, not the answer: the grid still steps down to two columns
 * and then one as the space runs out (see `ProjectsSection`).
 */
export function listingColumnsFor(count: number): ListingColumns {
  if (count <= 1) return 1;
  if (count === 2 || count === 4) return 2;
  return 3;
}

/**
 * The widest a single card may be told to span.
 *
 * The same three the function above tops out at, and stated here rather than in
 * the validator that enforces it because the two facts are one fact: a card
 * cannot be wider than the grid, and the grid's width is decided in this file.
 * The CSS clamps a span down to however many columns are actually on screen
 * (`min(var(--span), var(--columns))` in the `masonryGrid` recipe), so this is
 * the ceiling on what is worth STORING — a stored 4 would render as 3 and read
 * back as a width the grid never drew.
 */
export const MAX_GRID_SPAN: ListingColumns = 3;
