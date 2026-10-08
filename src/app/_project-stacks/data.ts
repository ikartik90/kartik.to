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
