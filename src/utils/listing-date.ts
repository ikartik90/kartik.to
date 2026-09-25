/** Shared by the homepage grid and the OG card, so both write the date alike. */
export function listingDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
