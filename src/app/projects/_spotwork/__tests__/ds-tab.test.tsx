import { cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TAB_STORIES } from "../ds-tab";
import { renderStories } from "./story-harness";

afterEach(cleanup);

const selected = (preview: HTMLElement) => within(preview).getAllByRole("tab").map((tab) => tab.getAttribute("aria-selected"));

describe("the Tab page's examples", () => {
  it("lists the tab group alone, Molecules/Tab Cards and Atoms/Tabs now its parts", () => {
    renderStories(TAB_STORIES);
    expect([...document.querySelectorAll("[data-ds-story]")].map((story) => story.getAttribute("aria-label"))).toEqual([
      "Tab Group",
    ]);
  });

  it("shows each by its Figma properties", () => {
    const { titles } = renderStories(TAB_STORIES);
    expect(titles("Tab Group")).toEqual(["Size"]);
  });

  it("opens large on its first tab and small on its second, each picking the tab pressed", async () => {
    const { user, preview } = renderStories(TAB_STORIES);
    expect(selected(preview("Tab Group"))).toEqual(["true", "false"]);
    await user.click(within(preview("Tab Group")).getAllByRole("tab")[1]);
    expect(selected(preview("Tab Group"))).toEqual(["false", "true"]);

    const [large, small] = within(preview("Tab Group", "Size")).getAllByRole("tablist");
    expect(selected(large)).toEqual(["true", "false"]);
    expect(selected(small)).toEqual(["false", "true"]);
    expect(within(small).getAllByRole("tab")[0].textContent).toBe("Shift planner");
    await user.click(within(small).getAllByRole("tab")[0]);
    expect(selected(small)).toEqual(["true", "false"]);
  });

  it("writes the tab group as the code that draws it, its tiles read from the dashboard's day", () => {
    const { code } = renderStories(TAB_STORIES);
    expect(code("Tab Group")).toBe(
      [
        'import { FlagCaIcon } from "@/components/icons"',
        'import { TabCard } from "@/components/ui/tab-card"',
        'import { TabGroup } from "@/components/ui/tab-group"',
        'import { Typography } from "@/components/ui/typography"',
        'import type { Tile } from "@/domain/tile"',
        "",
        "export function TabGroupDemo({ tiles }: { tiles: Tile[] }) {",
        "  return (",
        '    <div className="w-[62rem] shrink-0">',
        '      <TabGroup label="Check-Ins" defaultValue="missing">',
        "        {tiles.map((tile) => (",
        "          <TabCard key={tile.slice} value={tile.slice}>",
        "            <FlagCaIcon aria-hidden />",
        '            <Typography variant="body">{tile.label}</Typography>',
        '            <Typography variant="heading">{tile.count}</Typography>',
        "            <TabCard.Change tone={tile.tone}>",
        '              <Typography variant="badge">{tile.unread}</Typography>',
        "              {tile.change}",
        "            </TabCard.Change>",
        "          </TabCard>",
        "        ))}",
        "      </TabGroup>",
        "    </div>",
        "  )",
        "}",
      ].join("\n"),
    );
  });
});
