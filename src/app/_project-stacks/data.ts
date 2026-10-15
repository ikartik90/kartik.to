// The homepage's project section: an outcome headline over a carousel of cards, each opening a sheet.

export interface ProjectCard {
  id: string;
  title: string;
  sentence: string;
  /** Its sheet isn't ready: the card is left out of the carousel. */
  soon?: boolean;
  /** A post's address the sheet stands in for: canonical at the project's, and replaced in llms.txt and the sitemap. */
  replaces?: string;
}

export interface ProjectSection {
  headline: string;
  cards: ProjectCard[];
}

export const SPOTWORK: ProjectSection = {
  headline: "At Spotwork, I led the rebuild of the staffing platform, doubling daily shift postings in eight months.",
  cards: [
    {
      id: "check-ins",
      title: "Check-ins and time tracking",
      sentence: "Rebuilt check-ins and time tracking, cutting attendance disputes by 65%",
    },
    {
      id: "onboarding",
      title: "Company onboarding",
      sentence: "Redesigned company onboarding, lifting fifth‑shift retention by 16 points",
    },
    {
      id: "shift-scheduling",
      title: "Shift scheduling",
      sentence: "Made posted schedules extendable and cut scheduling clicks by 81%",
      replaces: "/work/redesigning-shift-scheduling",
    },
    {
      id: "design-system",
      title: "Design system",
      sentence: "Set up a design system that sped up releases by 40%",
      soon: true,
    },
  ],
};

/** The caption over each sheet's North Star. */
export const NORTH_STAR = "North Star";

/** The cards whose sheets are ready, the carousel's, each opening at `/projects/<id>`. */
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
