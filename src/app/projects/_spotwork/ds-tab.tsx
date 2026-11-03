"use client";

import { TILES } from "./check-ins-dashboard";
import { AUTHORED_NOW, rowsFor, tiles } from "./dashboard";
import { each } from "./ds-code";
import { Variants, defineStory, type Story } from "./ds-story";
import { Div } from "./ds-tailwind";
import { TabCard, TabGroup } from "./tabs";
import { Typography } from "./ui";
import FlagCaIcon from "./assets/flag-ca.svg";
import PlannerIcon from "./assets/tab-planner.svg";
import SummaryIcon from "./assets/tab-summary.svg";

// SW Curie's Tab page (3438:2814): its tab group, whose large tabs are Molecules/Tab Cards (`TabCard`) and small ones
// Atoms/Tabs (`TabGroup.Tab`). Figma's large group opens on its first tab, the small one on its second.

// Canada's Missing and Late Check-Ins tiles, counted from the Check-ins dashboard's day.
const COUNTS = tiles(rowsFor(AUTHORED_NOW).today.filter((row) => row.country === "ca"));
const TABS = TILES.filter((tile) => tile.slice === "missing" || tile.slice === "late").map((tile) => ({
  slice: tile.slice,
  label: tile.label,
  count: COUNTS[tile.slice].count,
  unread: COUNTS[tile.slice].badge,
  change: tile.badge!.label,
  tone: tile.badge!.tone,
}));

const largeTabs = () =>
  each(TABS, "tiles", (tile) => (
    <TabCard key={tile.slice} value={tile.slice}>
      <FlagCaIcon aria-hidden />
      <Typography variant="body">{tile.label}</Typography>
      <Typography variant="heading">{tile.count}</Typography>
      <TabCard.Change tone={tile.tone}>
        <Typography variant="badge">{tile.unread}</Typography>
        {tile.change}
      </TabCard.Change>
    </TabCard>
  ));

const TODAY = tiles(rowsFor(AUTHORED_NOW).today);

/** The Check-ins dashboard's six tabs, counted from its day, as it opens. */
export const dashboardTabs = () => (
  <TabGroup label="Check-Ins" defaultValue="missing">
    {TILES.map((tile) => (
      <TabCard key={tile.slice} value={tile.slice}>
        <Typography variant="body">{tile.label}</Typography>
        <Typography variant="heading">{TODAY[tile.slice].count}</Typography>
        {tile.badge && TODAY[tile.slice].badge > 0 && (
          <TabCard.Change tone={tile.badge.tone}>
            <Typography variant="badge">{TODAY[tile.slice].badge}</Typography>
            {tile.badge.label}
          </TabCard.Change>
        )}
      </TabCard>
    ))}
  </TabGroup>
);

// The Shift Planner's sheet's tabs.
const smallTabs = () => [
  <TabGroup.Tab key="planner" value="planner">
    <PlannerIcon aria-hidden />
    Shift planner
  </TabGroup.Tab>,
  <TabGroup.Tab key="summary" value="summary">
    <SummaryIcon aria-hidden />
    Shift summary
  </TabGroup.Tab>,
];

// Figma's Tab Group/Large and Tab Group/Small as one group, at Figma's widths.
const TAB_GROUP = defineStory({
  id: "Tab Group",
  figma: "Molecules/Tab Group",
  examples: [
    {
      layout: "scroll",
      render: () => (
        <Div tw="w-[62rem] shrink-0">
          <TabGroup label="Check-Ins" defaultValue="missing">
            {largeTabs()}
          </TabGroup>
        </Div>
      ),
    },
    {
      title: "Size",
      render: () => (
        <Variants>
          <Div tw="w-[62rem]">
            <TabGroup size="large" label="Check-Ins" defaultValue="missing">
              {largeTabs()}
            </TabGroup>
          </Div>
          <Div tw="w-[46.75rem]">
            <TabGroup size="small" label="Shift" defaultValue="summary">
              {smallTabs()}
            </TabGroup>
          </Div>
        </Variants>
      ),
    },
  ],
});

export const TAB_STORIES: Story[] = [TAB_GROUP];
