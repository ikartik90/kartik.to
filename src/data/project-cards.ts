// The homepage's projects: a card each, opening Spotwork's prototype over the page at `/projects/<id>`.

export interface ProjectCard {
  id: string;
  title: string;
  sentence: string;
}

export const PROJECT_CARDS: ProjectCard[] = [
  {
    id: "design-system",
    title: "Design system",
    sentence: "Rolled out and maintained a design system that helped us ship 1.5× as many releases",
  },
  {
    id: "check-ins",
    title: "Check-ins and time tracking",
    sentence: "Cut attendance disputes from 90 a week to 31 by geofencing check-ins and time tracking",
  },
  {
    id: "activation-and-retention",
    title: "Activation and retention",
    sentence: "Took tenth‑shift retention from 62% to 78% with pre-boarding and schedule extension",
  },
];

// Projects that had addresses of their own before another's story took them in.
const MOVED = new Map([
  ["onboarding", "activation-and-retention"],
  ["shift-scheduling", "activation-and-retention"],
]);

/** `base`: the path the homepage is served under, as `/dive` serves the review copy. */
export const projectPath = (id: string, base = "") => `${base}/projects/${id}`;

/** Its card as a link preview, baked by `scripts/bake-project-previews.ts` into `public/`. */
export const projectPreviewPath = (id: string) => `/og/projects/${id}.png`;

export const projectCard = (id: string) => PROJECT_CARDS.find((card) => card.id === id);

/** The project pages built ahead, as `generateStaticParams` gives them. */
export const projectParams = () => PROJECT_CARDS.map(({ id }) => ({ id }));

/** The project an old project's address now opens. */
export const movedTo = (id: string) => MOVED.get(id);

/** The projects as llms.txt and the sitemap list them. */
export const LISTED_PROJECTS = PROJECT_CARDS.map(({ id, title, sentence }) => ({
  title,
  summary: sentence,
  path: projectPath(id),
}));
