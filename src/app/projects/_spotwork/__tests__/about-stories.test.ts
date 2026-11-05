import { describe, expect, it } from "vitest";
import { CHECK_INS, DESIGN_SYSTEM as DESIGN_SYSTEM_SHEET, LIVE_HEADS } from "../sheet-words";
import { ABOUT, type Story } from "../about-stories";
import { GUIDELINE_SECTIONS, SIDEBAR } from "../copy";

const length = (text: string) => text.replace(/[*`]/g, "").length;

const { heads } = DESIGN_SYSTEM_SHEET;

const merged = (card: Story) =>
  [LIVE_HEADS.timesheet.eyebrow, CHECK_INS.traceability.eyebrow, heads.tokens.eyebrow, heads.components.eyebrow, SIDEBAR.eyebrows.onboarding].includes(
    card.label ?? "",
  );

const lead = (card: Story) =>
  [SIDEBAR.headings.checkIns, SIDEBAR.headings.designSystem, SIDEBAR.headings.activationAndRetention].includes(
    card.heading,
  );

const uncapped = (card: Story) => card.heading === SIDEBAR.headings.flexibility;

const cards: Story[] = Object.values(ABOUT).flatMap((about) => about.sections);

describe("the About sheet's stories", () => {
  it("keep every card's words to 338 characters, but the merged cards, the Flexibility card and the projects' leads", () => {
    const cap = 338;
    const over = cards
      .filter((card) => !merged(card) && !lead(card) && !uncapped(card))
      .filter((card) => length(card.body.join("\n\n")) > cap)
      .map((card) => card.heading);
    expect(over).toEqual([]);
  });

  it("keep the cards that merge sections to 400 characters each, but Onboarding: Invoice, Traceability, Tokens and Components", () => {
    const merges = cards.filter(merged);
    expect(merges).toHaveLength(5);
    for (const card of merges.filter((card) => card.label !== SIDEBAR.eyebrows.onboarding))
      expect(length(card.body.join("\n\n"))).toBeLessThanOrEqual(400);
  });

  it("aim every link's target at a group of the Guidelines", () => {
    const groups = GUIDELINE_SECTIONS.flatMap((section) => section.groups.map((group) => group.title));
    const targets = cards.flatMap((card) => card.links ?? []).flatMap((link) => (link.target ? [link.target] : []));
    expect(targets).toHaveLength(2);
    expect(targets.filter((target) => !groups.includes(target))).toEqual([]);
  });

  it("keep every demo's label to 30 characters, which fit one line beside its Play", () => {
    const over = cards.flatMap((card) => card.demos ?? []).filter((demo) => demo.label.length > 30);
    expect(over).toEqual([]);
  });

  it("keep every card's heading to three lines: no longer than the longest that wraps to three at the card's width", () => {
    const longest = "Rolled out and maintained a design system that cut release cycle time by 38% in a year".length;
    const over = cards
      .filter((card) => card.heading.length > longest)
      .map((card) => card.heading);
    expect(over).toEqual([]);
  });
});
