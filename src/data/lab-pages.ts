// Kept out of `SITE_PATHS` on purpose: lab pages stay unlisted (see lab/__tests__/unlisted.test.ts).

export interface LabPage {
  path: string;
  title: string;
}

export const LAB_PAGES = {
  reviewCriteria: {
    path: "/lab/ai-application-review-criteria",
    title: "AI application review criteria",
  },
} satisfies Record<string, LabPage>;
