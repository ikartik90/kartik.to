import { CHECK_INS as HOME, DESIGN_SYSTEM as DESIGN_SYSTEM_SHEET, LIVE_HEADS, LIVE_INTRO } from "./sheet-words";
import type { Metric } from "./metric-card";
import { SIDEBAR } from "./copy";

// The About sheet's story for each project that has one: its homepage sheet's sections in the live takes' order, but
// for Check-ins' Traceability card before its Invoice card, then the sheet's outcome, then a card of the sheet's role and year. A card runs no longer than 338 characters,
// taking its own words (`SIDEBAR.bodies`) where its section's run longer, and its heading wraps to three lines at most
// (`SIDEBAR.headings`). The Flexibility card also holds the Check-ins page's row, the Invoice card the Timecards and
// Off-app rows, and the Traceability card the dashboard's and the worker risk signals rows. The design system's Tokens
// card also holds its OKLCH and rem rows, and its Components card the compound components and className rows.
// Activation and retention has no sheet of its own: a lead, then a card each for Onboarding and Shift scheduling, all in
// the copywriter's words, then Check-ins' role and 2024. Onboarding merges the Activation and Preset templates cards.

/** A demo a card plays: what it shows, the version it opens on, and its `name` among that version's demos. */
export type Demo = { label: string; version: string; name?: string };

/** A page of the design system's site a card opens: a page's id or a group of components, and a Guidelines group. */
export type Link = { label: string; page: string; target?: string };

/** A row for the sheet's roles, as a list, or its year. */
export type Fact = { label: string; list: string[] } | { label: string; value: string };

/** A card: its section's eyebrow if the sheet gives one, its heading, its paragraphs, its demos and its links. */
export type Story = { label?: string; heading: string; body: string[]; demos?: Demo[]; links?: Link[] };

type About = { sections: Story[]; outcome?: Metric; facts: Fact[] };

const paragraphs = (text: string) => text.split("\n\n");

const head = ({ eyebrow, heading, body }: { eyebrow: string; heading: string; body: string }): Story => ({
  label: eyebrow,
  heading,
  body: paragraphs(body),
});

const factsOf = ({ role, year }: { role: { pills: string[] }; year: { value: string } }): Fact[] => [
  { label: SIDEBAR.facts.role, list: role.pills },
  { label: SIDEBAR.facts.year, value: year.value },
];

const { bodies, demos, links } = SIDEBAR;

const { intro, heads } = DESIGN_SYSTEM_SHEET;

export const ABOUT = {
  "check-ins": {
    sections: [
      { heading: SIDEBAR.headings.checkIns, body: paragraphs(bodies.checkIns) },
      {
        ...head(LIVE_HEADS.checkIns),
        heading: SIDEBAR.headings.flexibility,
        body: paragraphs(bodies.flexibility),
        demos: [
          { label: demos.flexibility, version: "company" },
          { label: demos.geofence, version: "company", name: "geofence" },
        ],
      },
      {
        label: HOME.traceability.eyebrow,
        heading: SIDEBAR.headings.traceability,
        body: paragraphs(bodies.traceability),
        demos: [
          { label: demos.traceability, version: "admin" },
          { label: demos.riskSignals, version: "admin", name: "risk" },
        ],
      },
      {
        ...head(LIVE_HEADS.timesheet),
        heading: SIDEBAR.headings.invoice,
        body: paragraphs(bodies.invoice),
        demos: [{ label: demos.invoice, version: "company", name: "timesheet" }],
      },
    ],
    outcome: HOME.outcome,
    facts: factsOf(LIVE_INTRO),
  },
  "design-system": {
    sections: [
      { heading: SIDEBAR.headings.designSystem, body: paragraphs(bodies.designSystem) },
      {
        ...head(heads.tokens),
        body: paragraphs(bodies.tokens),
        links: [
          { label: links.guideline, page: "guidelines", target: "Design" },
          { label: links.tokens, page: "colors" },
        ],
      },
      {
        ...head(heads.components),
        heading: SIDEBAR.headings.components,
        body: paragraphs(bodies.components),
        links: [
          { label: links.engineering, page: "guidelines", target: "Design engineering" },
          { label: links.components, page: "Primitives" },
        ],
      },
    ],
    outcome: DESIGN_SYSTEM_SHEET.outcome,
    facts: factsOf(intro),
  },
  "activation-and-retention": {
    sections: [
      { heading: SIDEBAR.headings.activationAndRetention, body: paragraphs(bodies.activationAndRetention) },
      {
        label: SIDEBAR.eyebrows.onboarding,
        heading: SIDEBAR.headings.onboarding,
        body: paragraphs(bodies.onboarding),
        demos: [{ label: demos.onboarding, version: "activation" }],
      },
      {
        label: SIDEBAR.eyebrows.shiftScheduling,
        heading: SIDEBAR.headings.shiftScheduling,
        body: paragraphs(bodies.shiftScheduling),
        demos: [
          { label: demos.final, version: "final" },
          { label: demos.recurrence, version: "recurrence" },
          { label: demos.old, version: "old" },
        ],
      },
    ],
    facts: factsOf({ role: LIVE_INTRO.role, year: { value: "2024" } }),
  },
} satisfies Record<string, About>;

export type AboutProject = keyof typeof ABOUT;

/** The project's own story, if it has one. */
export const aboutOf = (project: string): AboutProject | undefined =>
  project in ABOUT ? (project as AboutProject) : undefined;
