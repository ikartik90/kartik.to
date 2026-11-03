import { projectCard } from "@/data/project-cards";
import { aboutOf, ABOUT, type Fact, type Story } from "./about-stories";
import type { Metric } from "./metric-card";

// A project's story as Markdown, for agents: its card, then its About sheet's cards in order. Its demos are named
// where they stand.

/** `*`s mark what the sheet highlights. */
const strong = (text: string) => text.replace(/\*([^*]+)\*/g, "**$1**");

function metric({ value, label, trend, change, detail }: Metric) {
  const moved = change && [trend, change].filter(Boolean).join(" ");
  return [`## ${[`${value} ${label}`, moved].filter(Boolean).join(", ")}`, ...(detail ? [strong(detail)] : [])];
}

const fact = (each: Fact) => `- **${each.label}**: ${"list" in each ? each.list.join(", ") : each.value}`;

export function projectMarkdown(id: string): string | null {
  const card = projectCard(id);
  const story = aboutOf(id);
  if (!card || !story) return null;
  const { sections, outcome, facts }: { sections: Story[]; outcome?: Metric; facts: Fact[] } = ABOUT[story];
  const blocks = [
    `# ${card.title}`,
    card.sentence,
    ...sections.flatMap(({ label, heading, body, demos = [] }) => [
      ...(label ? [`## ${label}`, `### ${heading}`] : [`## ${heading}`]),
      ...body.map(strong),
      ...demos.map((demo) => `_Interactive demo on the page: ${demo.label}_`),
    ]),
    ...(outcome ? metric(outcome) : []),
    facts.map(fact).join("\n"),
  ];
  return `${blocks.join("\n\n")}\n`;
}
