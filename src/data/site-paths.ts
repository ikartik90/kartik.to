// Non-post pages a link card may point to. Never add `/edit/*` (admin) or posts
// (they already have cards).

export interface SitePath {
  path: string;
  /** Short name for the link-card picker. */
  label: string;
  /** Public name: tab title, palette, llms.txt. */
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

export const SITE_PATHS: SitePath[] = Object.values(SITE_PAGES);

export function sitePathTitle(path: string): string | undefined {
  return SITE_PATHS.find((entry) => entry.path === path)?.title;
}
