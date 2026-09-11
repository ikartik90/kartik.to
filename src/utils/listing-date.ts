/**
 * How a date is written on a listing — the line above an article's name on its
 * card, and the same line in the picture a shared link turns into.
 *
 * Its own module because it now has two readers on opposite sides of the app:
 * the homepage grid builds it from the database, and the Open Graph card builds
 * it from a post the image route loaded for itself. One of them formatting
 * "Sep 10, 2026" while the other formatted "10 September 2026" would be two
 * renderings of one card.
 */
export function listingDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
