// The homepage's project section: an outcome headline over a carousel of cards, each opening a sheet.

export type CardFigure = "design-system" | "shift-scheduling" | "check-ins" | "onboarding";

export interface ProjectCard {
  id: string;
  title: string;
  sentence: string;
  /** The line figure covering the card's face, under its heading. */
  figure: CardFigure;
  /** Its sheet isn't ready: the card says "Coming this week" and doesn't open. */
  soon?: boolean;
  /** A post's address the sheet stands in for: canonical at the project's, and replaced in llms.txt and the sitemap. */
  replaces?: string;
}

export interface ProjectSection {
  headline: string;
  cards: ProjectCard[];
}

export const SPOTWORK: ProjectSection = {
  headline:
    "At Spotwork, I led the rebuild of the staffing management platform from the ground up and doubled daily shifts in eight months.",
  cards: [
    {
      id: "shift-scheduling",
      title: "Shift scheduling",
      sentence: "Made posted schedules extendable and cut scheduling clicks by 81%",
      figure: "shift-scheduling",
      replaces: "/work/redesigning-shift-scheduling",
    },
    {
      id: "onboarding",
      title: "Company onboarding",
      sentence: "Redesigned company onboarding, lifting fifth‑shift retention by 16 points",
      figure: "onboarding",
    },
    {
      id: "check-ins",
      title: "Check-ins and time tracking",
      sentence: "Rebuilt check-ins and time tracking, cutting attendance disputes by 65%",
      figure: "check-ins",
      soon: true,
    },
    {
      id: "design-system",
      title: "Design system",
      sentence: "Set up a design system that sped up releases by 40%",
      figure: "design-system",
      soon: true,
    },
  ],
};

/** The caption over each sheet's North Star. */
export const NORTH_STAR = "North Star";

/** The cards whose sheets are ready, each opening at `/projects/<id>`. */
export const OPEN_CARDS = SPOTWORK.cards.filter((card) => !card.soon);

/** `base`: the path the homepage is served under, as `/dive` serves the review copy. */
export const projectPath = (id: string, base = "") => `${base}/projects/${id}`;

/** Its card as a link preview, baked by `scripts/bake-project-previews.ts` into `public/`. */
export const projectPreviewPath = (id: string) => `/og/projects/${id}.png`;

export const openCard = (id: string) => OPEN_CARDS.find((card) => card.id === id);

/** A post's canonical address: the project's, for a post its sheet replaces. */
export const canonicalPath = (path: string) => {
  const card = OPEN_CARDS.find((c) => c.replaces === path);
  return card ? projectPath(card.id) : path;
};

/** The open cards as llms.txt and the sitemap list them. */
export const LISTED_PROJECTS = OPEN_CARDS.map(({ id, title, sentence, replaces }) => ({
  title,
  summary: sentence,
  path: projectPath(id),
  replaces,
}));
