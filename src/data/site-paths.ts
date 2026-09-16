// ---------------------------------------------------------------------------
// Where a link card may point INSIDE this site.
//
// A written list rather than a crawl of the router, because the question is not
// "what routes exist" — it is "what is worth putting a card on the homepage
// for", and those are two different sets. `/edit/*` is admin surface and must
// never be offered; `/writing/*` and `/work/*` are the posts, and every
// published one of them ALREADY has a card on this grid. A link card pointing at
// an article would be that article twice over in the same listing, and the
// picker, which offers nothing but this list, is what keeps that out.
// `InternalPathSchema` checks a stored path's shape and deliberately not its
// membership here.
//
// What is left is the pages that are not posts and have no card of their own:
// the playgrounds. That is what the link card was added for.
//
// Each page has TWO names, written here once so no surface drifts from the
// rest. `title` is the public one — the browser tab and a search result (the
// route's own metadata), the palette row, the line in `llms.txt`, and the name
// a card with no words is announced by (`linkCardTitle`). `label` is short, and
// it appears in one place: the link-card picker in the rail, where the rows
// only have to tell each other apart.
// ---------------------------------------------------------------------------

export interface SitePath {
  path: string;
  /** The picker's row. */
  label: string;
  /** What everyone else reads. */
  title: string;
}

export const SITE_PAGES = {
  shader: {
    path: "/playground/shader",
    label: "Shader Playground",
    title: "Waveform Studio",
  },
  calchemy: {
    path: "/playground/calchemy",
    label: "Calchemy Playground",
    title: "Calchemy: Natural-Language Date Parser",
  },
  icons: {
    path: "/playground/icons",
    label: "Icons Playground",
    title: "Crest Icons: 300+ Handcrafted SVG Icons",
  },
} satisfies Record<string, SitePath>;

/** Every page, in the order the picker lists them. */
export const SITE_PATHS: SitePath[] = Object.values(SITE_PAGES);

/** The public name of the page at `path`, if this list holds it. */
export function sitePathTitle(path: string): string | undefined {
  return SITE_PATHS.find((entry) => entry.path === path)?.title;
}
