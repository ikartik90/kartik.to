// ---------------------------------------------------------------------------
// The full-screen prototypes under `/lab`, as the ⌘K palette lists them.
//
// Kept apart from `SITE_PATHS` on purpose: that list also feeds the sitemap,
// `llms.txt` and the link-card picker, and a lab prototype stays out of all
// three (see `src/app/lab/__tests__/unlisted.test.ts`). The palette is the one
// place it is offered, among the projects, until its article is published.
// ---------------------------------------------------------------------------

export interface LabPage {
  path: string;
  /** The palette row, and the page's own title. */
  title: string;
}

export const LAB_PAGES = {
  reviewCriteria: {
    path: "/lab/ai-application-review-criteria",
    title: "AI application review criteria",
  },
} satisfies Record<string, LabPage>;
