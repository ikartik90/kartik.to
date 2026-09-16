// The slugs of the `PAGE` posts the site knows by name. Plain constants in a
// module of their own, so the machine-readable index (`site-index.ts`) can tell
// them apart without importing the database client.

/** The slug the homepage's own record uses. Never appears in a reading URL. */
export const HOME_SLUG = "home";

/** The About page's record, read at `/about` and edited at `/edit/about`. */
export const ABOUT_SLUG = "about";
