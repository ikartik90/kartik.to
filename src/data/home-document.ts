import type { Document } from "@/domain/post";

// ---------------------------------------------------------------------------
// What the homepage says before anyone has edited it.
//
// The page is an ordinary document — text, furniture, more text — so that it
// can be written the way every other page is. This is only its starting state,
// used until a `PAGE` post with the slug `home` exists to override it, and it
// reproduces exactly what the page held when it was three hardcoded sections:
// the intro lines, the row of social icons, and the grid.
//
// It lives as data rather than as JSX because the moment the page became a
// document, its initial content became content — the thing an editor opens and
// changes, not a component tree.
// ---------------------------------------------------------------------------

export const DEFAULT_HOME_DOCUMENT: Document = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      align: "center",
      children: [
        {
          type: "text",
          text: "Hi, I'm Kartik. As a design systems and prototyping specialist of 12 years, I design to help startups achieve product-market-fit and hypergrowth. I invest care into the details that make software feel considered.",
        },
      ],
    },
    { type: "social_links" },
    { type: "project_grid" },
  ],
};
