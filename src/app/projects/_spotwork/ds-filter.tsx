"use client";

import { DateSelector } from "./dashboard-menus";
import { Variants, defineStory } from "./ds-story";
import { Div } from "./ds-tailwind";
import { BulkSelect, RangeSelector, RangeType } from "./filters";
import { Typography } from "./ui";

// SW Curie's Filter page (1362:1818), in Figma's words: the parts only filters use. Its dropdown, multi-select, date
// picker, inline input, context search, checkbox, radio switch, switch, segmented control and calendar are those Form
// components' small size. A part whose panel runs past its floor or cell sits atop room for it.

const DISCRETE_BARS = [15, 35, 22, 5];
const CONTINUOUS_BARS = [
  20, 13, 35, 32, 35, 43, 24, 36, 30, 40, 33, 25, 44, 49, 45, 47, 36, 14, 44, 30, 48, 38, 5, 42, 49, 47, 39, 42, 32, 45,
  22, 35, 46, 26, 32, 11, 43, 36, 28, 48, 3, 12, 23,
];

/** A Data Viz of a bar per height. */
const dataViz = (heights: number[]) => (
  <RangeType.DataViz>
    {heights.map((height, i) => (
      <RangeType.Bar key={i} height={height} />
    ))}
  </RangeType.DataViz>
);

const RANGE_TYPE = defineStory({
  id: "Range Type",
  figma: "Molecules/Range Type",
  examples: [
    {
      render: () => (
        <RangeType type="discrete" min={1} max={5} defaultValue={[2, 3]}>
          {dataViz(DISCRETE_BARS)}
        </RangeType>
      ),
    },
    {
      title: "Data range type",
      render: () => (
        <Variants>
          <RangeType type="discrete" min={1} max={5} defaultValue={[2, 3]}>
            {dataViz(DISCRETE_BARS)}
          </RangeType>
          <RangeType type="continuous" min={1} max={5} defaultValue={[1.9, 3.1]}>
            {dataViz(CONTINUOUS_BARS)}
          </RangeType>
        </Variants>
      ),
    },
  ],
});

const rangeSelector = (props: { disabled?: boolean; defaultOpen?: boolean }) => (
  <RangeSelector min={1} max={5} defaultValue={[2, 3]} {...props}>
    <Typography variant="metadata">Rating</Typography>
  </RangeSelector>
);

const RANGE_SELECTOR = defineStory({
  id: "Range Selector",
  figma: "Molecules/Range Selector",
  examples: [
    { render: () => rangeSelector({}) },
    {
      title: "State",
      render: () => (
        <Variants>
          {rangeSelector({})}
          {rangeSelector({ disabled: true })}
          {rangeSelector({ defaultOpen: true })}
        </Variants>
      ),
    },
  ],
});

// A large bulk select's items take Body words.
const bulkItems = (variant: "metadata" | "body") =>
  ["Offered", "Accepted", "Waitlist"].map((option) => (
    <BulkSelect.Item key={option}>
      <Typography variant={variant}>{option}</Typography>
    </BulkSelect.Item>
  ));
const bulkOptions = bulkItems("metadata");

const BULK_SELECT = defineStory({
  id: "Bulk Select",
  figma: "Atoms/Filter/Bulk Select",
  examples: [
    { render: () => <BulkSelect>{bulkOptions}</BulkSelect> },
    {
      title: "State",
      render: () => (
        <Variants>
          <BulkSelect>{bulkOptions}</BulkSelect>
          <BulkSelect defaultOpen>{bulkOptions}</BulkSelect>
        </Variants>
      ),
    },
    {
      title: "Size",
      render: () => (
        <Variants>
          <BulkSelect size="large">{bulkItems("body")}</BulkSelect>
          <BulkSelect>{bulkOptions}</BulkSelect>
        </Variants>
      ),
    },
    {
      title: "Is subtle",
      render: () => (
        <Variants>
          <BulkSelect>{bulkOptions}</BulkSelect>
          <BulkSelect subtle>{bulkOptions}</BulkSelect>
        </Variants>
      ),
    },
  ],
});

/** The Timesheets filter's day: today between its chevrons, over its month once open. */
export const dateSelector = (props: { defaultOpen?: boolean }) => (
  <DateSelector defaultDay="today" {...props}>
    <DateSelector.Previous aria-label="Previous day" />
    <DateSelector.Date />
    <DateSelector.Next aria-label="Next day" />
    <DateSelector.Calendar today="2023-11-03" />
  </DateSelector>
);

const DATE_SELECTOR = defineStory({
  id: "Date Selector",
  figma: "Molecules/Filter/Date Selector",
  examples: [
    { render: () => <Div tw="h-[17.5rem]">{dateSelector({})}</Div> },
    {
      title: "State",
      render: () => (
        <Variants>
          <Div tw="h-[17.5rem]">{dateSelector({})}</Div>
          <Div tw="h-[17.5rem]">{dateSelector({ defaultOpen: true })}</Div>
        </Variants>
      ),
    },
  ],
});

export const FILTER_STORIES = [
  RANGE_TYPE,
  RANGE_SELECTOR,
  BULK_SELECT,
  DATE_SELECTOR,
];
