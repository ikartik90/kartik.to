// ---------------------------------------------------------------------------
// Where a link card may point INSIDE this site.
//
// A written list rather than a crawl of the router, because the question is not
// "what routes exist" — it is "what is worth putting a card on the homepage
// for", and those are two different sets. `/edit/*` is admin surface and must
// never be offered; `/writing/*` and `/work/*` are the posts, and every
// published one of them ALREADY has a card on this grid. A link card pointing at
// an article would be that article twice over in the same listing, which is
// precisely the case the picker exists to keep out — see `SitePathSchema`.
//
// What is left is the pages that are not posts and have no card of their own:
// the playgrounds. That is what the link card was added for.
//
// The labels are the picker's rows and the fallback name of a card carrying no
// words of its own (`linkCardTitle`), so they read as destinations rather than
// as route segments.
// ---------------------------------------------------------------------------

export interface SitePath {
  path: string;
  label: string;
}

export const SITE_PATHS: SitePath[] = [
  { path: "/playground/shader", label: "Shader Playground" },
  { path: "/playground/calchemy", label: "Calchemy Playground" },
];

/** The destination's own name, for a card that shows no words over it. */
export function sitePathLabel(path: string): string | undefined {
  return SITE_PATHS.find((entry) => entry.path === path)?.label;
}
