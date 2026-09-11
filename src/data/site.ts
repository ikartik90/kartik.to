/**
 * What the site calls itself, wherever it has to say so out loud.
 *
 * Its own module because both the root layout and every post's metadata state
 * them — Next replaces the `openGraph` and `twitter` objects wholesale rather
 * than merging a page's into the layout's, so a post that says anything about
 * its card has to say all of it. Two literals would be two names for one site.
 */
export const SITE_NAME = "kartik.to";

export const SITE_DESCRIPTION = "Kartik Iyer's digital design portfolio and blog.";

export const SITE_LOCALE = "en_US";
