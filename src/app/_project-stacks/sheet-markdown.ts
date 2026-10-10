import type { MediaNode } from "@/domain/nodes";
import { CHECK_INS } from "./check-ins-content";
import { NORTH_STAR, openCard, SPOTWORK } from "./data";
import type { Feature } from "./feature-grid";
import type { Metric } from "./metric-card";
import { ONBOARDING } from "./onboarding-content";
import { fewest, SHIFT } from "./shift-content";

// A sheet's words as Markdown, for agents, in the sheet's order. Its wireframes and drawings are left out; its demos
// and figures are named where they stand.

/** `*`s mark what the sheet highlights. */
const strong = (text: string) => text.replace(/\*([^*]+)\*/g, "**$1**");

const head = (caption: string, statement: string) => [`## ${caption}`, `### ${statement}`];
const list = (items: { title: string; body: string }[]) =>
  items.map(({ title, body }) => `- **${title}**: ${strong(body)}`).join("\n");
const points = (features: Feature[]) => list(features);
const paragraphs = (text: string) => text.split("\n\n").map(strong);
const card = ({ title, text }: { title: string; text: string }) => [`## ${title}`, ...paragraphs(text)];
const clip = ({ alt, src }: MediaNode) => `[Video: ${alt}](${src})`;

const DEMO = "_Interactive demo on the page_";
const figure = (label: string) => `_Figure on the page: ${label}_`;

function metric({ value, label, trend, change, detail }: Metric) {
  const moved = change && [trend, change].filter(Boolean).join(" ");
  return [`## ${[`${value} ${label}`, moved].filter(Boolean).join(", ")}`, ...(detail ? [strong(detail)] : [])];
}

function closing(outcome: Metric, takeaway: { eyebrow: string; heading: string; paragraphs: string[] }) {
  return [...metric(outcome), ...head(takeaway.eyebrow, takeaway.heading), ...takeaway.paragraphs.map(strong)];
}

/** The table's fewest clicks in each row strong, as the sheet highlights them. */
function comparisonTable({ head: columns, rows }: { head: string[]; rows: string[][] }) {
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return [
    line(columns),
    line(columns.map(() => "---")),
    ...rows.map(([prompt, ...cells]) => {
      const best = fewest(cells);
      return line([prompt, ...cells.map((cell, i) => (best[i] ? `**${cell}**` : cell))]);
    }),
  ].join("\n");
}

function shiftBlocks() {
  const { clips, stakes, gap, northStar, cards, conceptTesting, concepts, comparison, outcome, takeaway } = SHIFT;
  const judged = comparison.head.slice(-comparison.verdicts.length);
  return [
    ...clips.map(clip),
    ...head(stakes.eyebrow, stakes.heading),
    strong(stakes.body),
    points(stakes.reasons),
    ...head(gap.eyebrow, gap.heading),
    points(gap.points),
    DEMO,
    ...head(NORTH_STAR, northStar),
    ...card(cards.steps),
    ...card(cards.positions),
    ...card(cards.edit),
    ...head(conceptTesting.eyebrow, conceptTesting.heading),
    ...[concepts.recurrence, concepts.drag].flatMap(({ title, text }) => [`#### ${title}`, ...paragraphs(text)]),
    DEMO,
    `#### ${comparison.heading}`,
    comparisonTable(comparison),
    comparison.note,
    judged
      .map((column, i) => `- ${column}: ${comparison.verdicts[i][0].toUpperCase()}${comparison.verdicts[i].slice(1)}`)
      .join("\n"),
    ...closing(outcome, takeaway),
  ];
}

function onboardingBlocks() {
  const { clips, stakes, gap, northStar, cards, outcome, takeaway } = ONBOARDING;
  return [
    ...clips.map(clip),
    ...head(stakes.eyebrow, stakes.heading),
    strong(stakes.body),
    points(stakes.reasons),
    ...head(gap.eyebrow, gap.heading),
    list(gap.items.map(({ text, caption }) => ({ title: text, body: caption }))),
    figure(gap.label),
    ...head(NORTH_STAR, northStar),
    ...card(cards.activations),
    ...card(cards.workflows),
    ...card(cards.inviteLinks),
    ...closing(outcome, takeaway),
  ];
}

function checkInsBlocks() {
  const { clips, stakes, gap, northStar, cards, signals, traceability, outcome, takeaway } = CHECK_INS;
  return [
    ...clips.map(clip),
    ...head(stakes.eyebrow, stakes.heading),
    strong(stakes.body),
    points(stakes.reasons),
    ...head(gap.eyebrow, gap.heading),
    list(gap.stages.map(({ stage, title, body }) => ({ title: `${stage}: ${title}`, body }))),
    ...head(NORTH_STAR, northStar),
    ...card(cards.checkIns),
    ...card(cards.timecards),
    ...card(cards.offApp),
    ...head(signals.eyebrow, signals.heading),
    DEMO,
    ...head(traceability.eyebrow, traceability.heading),
    ...card(cards.dashboard),
    ...closing(outcome, takeaway),
  ];
}

const SHEETS: Record<string, () => string[]> = {
  "shift-scheduling": shiftBlocks,
  onboarding: onboardingBlocks,
  "check-ins": checkInsBlocks,
};

/** The Markdown copy of a project's sheet (`/projects/<id>.md`); none for a project without one. */
export function projectMarkdown(id: string): string | null {
  const card = openCard(id);
  const blocks = card && SHEETS[card.id];
  if (!card || !blocks) return null;
  return `${[`# ${card.title}`, `## ${card.sentence}`, SPOTWORK.headline, ...blocks()].join("\n\n")}\n`;
}
