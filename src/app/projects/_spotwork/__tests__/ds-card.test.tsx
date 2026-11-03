import { cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BADGE, CARD_STORIES, DIVIDER, INLINE_TABLE_RECORD } from "../ds-card";
import { renderStories } from "./story-harness";

afterEach(cleanup);

// Listed under Status, Card, Data Table and Primitives.
const STORIES = [BADGE, ...CARD_STORIES, DIVIDER, INLINE_TABLE_RECORD];

const BRAMPTON = "CCLS, 250 First Gulf Boulevard, Brampton, ON";

describe("the Card page's examples", () => {
  it("keeps the page's components, in its order", () => {
    renderStories(STORIES);
    expect([...document.querySelectorAll("[data-ds-story]")].map((story) => story.getAttribute("aria-label"))).toEqual([
      "Badge",
      "Card",
      "Divider",
      "Inline Table Record",
    ]);
  });

  it("shows each of Figma's layouts and records as an example of its own", () => {
    const { titles } = renderStories(STORIES);
    expect(titles("Badge")).toEqual(["State"]);
    expect(titles("Divider")).toEqual(["Orientation", "Tone"]);
    expect(titles("Card")).toEqual([
      "Positions template card",
      "Generic card",
      "Shift summary",
      "Shift changelog",
      "Position look-up card",
      "KPI card",
    ]);
    expect(titles("Inline Table Record")).toEqual([
      "Team record",
      "Settings record",
      "Check-in status record",
      "Content record",
    ]);
  });

  it("shows the Settings page's cards as Generic Cards, in Figma's words", () => {
    const { preview } = renderStories(STORIES);
    const cards = preview("Card", "Generic card");
    expect([...cards.querySelectorAll("[data-card-content] > :first-child")].map((title) => title.textContent)).toEqual([
      "Brittany Pilz",
      "2-step verification",
      "Canada Cartage",
      "CCLS First Gulf",
      "Passport",
      "Work Permit",
    ]);
    expect(within(cards).getAllByRole("button", { name: "Transfer ownership" })).toHaveLength(1);
    expect(cards.textContent).not.toMatch(/String Value|spotter/i);
  });

  it("shows the Check-ins page's KPI cards side by side, each holding a chart under what it charts", () => {
    const { preview, code } = renderStories(STORIES);
    const cells = [...preview("Card", "KPI card").querySelectorAll("[data-cell]")];
    expect(cells.map((cell) => cell.querySelectorAll("[data-card]").length)).toEqual([1, 1]);
    const [stacked, bars] = cells.map((cell) => cell.querySelector("[data-card]")!);
    expect([stacked, bars].map((card) => card.querySelector(":scope > [data-card-header]")?.textContent)).toEqual(["Shifts this week", "Spending"]);
    expect(stacked.querySelectorAll("[data-segment]")).toHaveLength(4);
    // As on the Check-ins page, its legend listed down beside its metric, and this week's bar subdued.
    expect(stacked.querySelector("[data-legend]")?.getAttribute("data-legend")).toBe("beside");
    expect([...bars.querySelectorAll<HTMLElement>("[data-segment]")].map((bar) => bar.style.backgroundColor).slice(-2)).toEqual([
      "var(--sw-glyph-data-viz-shade-3)",
      "var(--sw-glyph-data-viz-shade-5)",
    ]);
    expect(bars.querySelectorAll("[data-segment]")).toHaveLength(6);
    // Each a Card holding its chart's parts, the spending's value its bar chart's own.
    const snippet = code("Card", "KPI card");
    expect(snippet).not.toMatch(/KpiCard|chart=/);
    expect(snippet.match(/^\s*<Card>$/gm)).toHaveLength(2);
    const spending = snippet.slice(snippet.indexOf("Spending"));
    expect(spending).not.toContain("StackedBarChart");
    expect(spending).toMatch(/<BarChart\.Metric>\s*<BarChart\.Value>/);
  });

  it("shows the presets page's template cards, a schedule's calendar and its changelog", () => {
    const { preview } = renderStories(STORIES);
    const templates = within(preview("Card", "Positions template card"));
    expect(templates.getAllByRole("heading").map((heading) => heading.textContent)).toEqual(["Forklift Operator", "Grooming Agent"]);
    expect(templates.getByText("Draft")).toBeTruthy();
    expect(templates.getAllByRole("button", { name: "Post new shift..." })).toHaveLength(1);
    const summary = preview("Card", "Shift summary");
    expect(within(summary).queryByText("Repeat Every Week On")).toBeNull();
    expect(within(summary).getAllByRole("button", { name: "Next month" })).toHaveLength(2);
    expect(within(preview("Card", "Shift changelog")).getAllByRole("button", { name: "Undo override" })).toHaveLength(2);
  });

  it("picks a team record, switches a setting and opens a description by themselves", async () => {
    const { preview, user } = renderStories(STORIES);
    const teams = within(preview("Inline Table Record", "Team record")).getAllByRole("button", { name: /Brampton/ });
    expect(teams.map((team) => team.getAttribute("aria-pressed"))).toEqual(["true", "false"]);
    await user.click(teams[1]);
    expect(teams.map((team) => team.getAttribute("aria-pressed"))).toEqual(["true", "true"]);

    const setting = within(preview("Inline Table Record", "Settings record")).getByRole("switch", { name: "2-step verification" });
    expect(setting.getAttribute("aria-checked")).toBe("true");
    await user.click(setting);
    expect(setting.getAttribute("aria-checked")).toBe("false");

    const content = within(preview("Inline Table Record", "Content record"));
    await user.click(content.getByRole("button", { name: "Show more" }));
    expect(content.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("writes each example as the code that draws it", () => {
    const { code } = renderStories(STORIES);
    expect(code("Inline Table Record")).toBe(
      [
        'import { ConfirmedIcon, ContactIcon } from "@/components/icons"',
        'import { Button } from "@/components/ui/button"',
        'import { InlineTableRecord } from "@/components/ui/inline-table-record"',
        'import { Pill } from "@/components/ui/pill"',
        'import { Tooltip } from "@/components/ui/tooltip"',
        'import { Typography } from "@/components/ui/typography"',
        "",
        "export function InlineTableRecordDemo() {",
        "  return (",
        "    <InlineTableRecord defaultSelected>",
        "      <InlineTableRecord.Cell fill selects>",
        '        <Typography variant="body">',
        `          ${BRAMPTON}`,
        "        </Typography>",
        "        <InlineTableRecord.Selected>",
        '          <Pill state="success">',
        "            <ConfirmedIcon aria-hidden />",
        "            Selected",
        "          </Pill>",
        "        </InlineTableRecord.Selected>",
        "      </InlineTableRecord.Cell>",
        "      <InlineTableRecord.Cell>",
        '        <Button size="icon" aria-label="View contact info">',
        "          <ContactIcon aria-hidden />",
        "          <Tooltip>View contact info</Tooltip>",
        "        </Button>",
        "      </InlineTableRecord.Cell>",
        "    </InlineTableRecord>",
        "  )",
        "}",
      ].join("\n"),
    );
    expect(code("Card")).toContain("Canada Cartage");
    expect(code("Card")).not.toMatch(/Card\.Toggle|defaultExpanded/);
    expect(code("Badge")).toContain("<Badge>1</Badge>");
    expect(code("Badge", "State")).toContain('<Badge state="alert">1</Badge>');
  });
});
