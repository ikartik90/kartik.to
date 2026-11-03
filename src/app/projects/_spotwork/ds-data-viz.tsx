"use client";

import { PEOPLE } from "./data";
import { noShowRisk } from "./dashboard";
import { RiskMatrix } from "./data-table";
import { BarChart, ProgressBar, StackedBarChart, type ChartType } from "./data-viz";
import { datum, each } from "./ds-code";
import { Variants, defineStory } from "./ds-story";
import { Div } from "./ds-tailwind";
import { NoShowRisk } from "./risk-chart";
import type { Icon } from "./sidebar";
import { Card, Checkbox, Chip, Field, Tooltip, Typography } from "./ui";
import NewWorkerIcon from "./assets/risk-new-worker.svg";
import FlaggedMessageIcon from "./assets/risk-flagged-message.svg";
import AbsentLastShiftIcon from "./assets/risk-abnormal-last-shift.svg";
import LocationDisabledIcon from "./assets/risk-location-disabled.svg";

// SW Curie's Data Viz page (1643:1436): its components drawn live from the data of Figma's charts.

// Figma's last 100 shifts, by status.
const CATEGORIES = [
  { label: "On Time", count: 59 },
  { label: "Late", count: 27 },
  { label: "Cancelled Late", count: 6 },
  { label: "Absent", count: 8 },
];

const LEGEND_UNITS = CATEGORIES.map(({ label, count }) => (
  <StackedBarChart.LegendUnit key={label}>
    <Typography variant="metadata" color="subdued">
      {label}
    </Typography>
    <Chip size="small" state="affirmative">{count}</Chip>
  </StackedBarChart.LegendUnit>
));

const SEGMENTS = CATEGORIES.map(({ label, count }) => <StackedBarChart.Segment key={label} count={count} />);

// A posted shift's places, filled to each of Figma's Progress ranges.
const SHIFTS = [
  { title: "Holiday Special All Days", filled: 7, total: 30 },
  { title: "Weekdays AM", filled: 15, total: 30 },
  { title: "Weekend Day Shift", filled: 24, total: 30 },
  { title: "Morning Shift (M/W/F)", filled: 30, total: 30 },
];

/** A shift's places filled, as the Shifts page counts them. */
const progressBar = (shift: (typeof SHIFTS)[number]) => (
  <ProgressBar value={shift.filled} max={shift.total}>
    <Typography variant="metadata" color="subdued">
      {shift.filled}/{shift.total}
    </Typography>
    <Typography variant="metadata" color="subdued">
      Filled
    </Typography>
  </ProgressBar>
);

const PROGRESS_BAR = defineStory({
  id: "Progress Bar",
  figma: "Atoms/Progress Bar",
  examples: [
    { render: () => datum(SHIFTS[0], "shift", progressBar) },
    {
      title: "Progress",
      render: () => <Variants>{each(SHIFTS, "shifts", progressBar)}</Variants>,
    },
  ],
});

/**
 * Figma's chart of the last 100 shifts in `type`'s fills, under the Spotscore pill's score out of 100 unless `max` is
 * off, its legend at `legend`.
 */
export const spotscoreChart = (
  type: ChartType,
  { score = "98", max = "100" as string | false, legend = "below" as "below" | "beside" } = {},
) => (
  <StackedBarChart type={type} legend={legend}>
    <StackedBarChart.Metric>
      <StackedBarChart.Value>
        <Typography variant="title">{score}</Typography>
        {max && (
          <Typography variant="metadata" color="subdued">
            {`out of ${max}`}
          </Typography>
        )}
      </StackedBarChart.Value>
      <StackedBarChart.Bar>{SEGMENTS}</StackedBarChart.Bar>
    </StackedBarChart.Metric>
    <StackedBarChart.Legend>{LEGEND_UNITS}</StackedBarChart.Legend>
  </StackedBarChart>
);

/** `spotscoreChart` at the width of the card it's drawn for. */
const spotscore = (...args: Parameters<typeof spotscoreChart>) => <Div tw="w-[18.75rem]">{spotscoreChart(...args)}</Div>;

const STACKED_BAR_CHART = defineStory({
  id: "Stacked Bar Chart",
  figma: "Atoms/Data Viz/Stacked Bar Chart",
  examples: [
    { render: () => spotscore("status") },
    {
      title: "Type",
      render: () => (
        <Variants>
          {spotscore("status")}
          {spotscore("monochrome")}
        </Variants>
      ),
    },
    {
      title: "Show max value",
      render: () => (
        <Variants>
          {spotscore("status")}
          {spotscore("status", { max: false })}
        </Variants>
      ),
    },
    {
      title: "Legend position",
      render: () => (
        <Variants>
          {spotscore("status")}
          {spotscore("status", { legend: "beside" })}
        </Variants>
      ),
    },
  ],
});

// A customer's spending over six weeks.
export const WEEKS = [
  { week: 39, dates: "Sep 20–26", amount: 10472.36 },
  { week: 40, dates: "Sep 27–Oct 3", amount: 12016.42 },
  { week: 41, dates: "Oct 4–10", amount: 11248.17 },
  { week: 42, dates: "Oct 11–17", amount: 12016.85 },
  { week: 43, dates: "Oct 18–24", amount: 9640.29 },
  { week: 44, dates: "Oct 25–31", amount: 8332.64 },
];

const [SPENT, CENTS] = WEEKS.reduce((total, { amount }) => total + amount, 0)
  .toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  .split(".");

/**
 * The six weeks' spending: what was spent over them, beside a segment for each week, against its scale unless `scale`
 * is off, each week's tooltip its dates and amount; with `current`, the last week subdued, as the week still running.
 */
export const spendingChart = ({ scale = true, current = false } = {}) => (
  <BarChart scale={scale} unit={scale ? "Week" : undefined}>
    <BarChart.Metric>
      <BarChart.Value>
        <Typography variant="title">
          {SPENT}
          <Typography variant="metadata" color="subdued">{`.${CENTS} CAD`}</Typography>
        </Typography>
        <Typography variant="metadata" color="subdued">Sep 20–Oct 31</Typography>
      </BarChart.Value>
      <BarChart.Bar>
        {WEEKS.map(({ week, dates, amount }, i) => (
          <BarChart.Segment key={week} value={amount} label={`${week}`} subdued={current && i === WEEKS.length - 1}>
            <Tooltip above>
              <span>{dates}</span>
              <span>{`${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} CAD`}</span>
            </Tooltip>
          </BarChart.Segment>
        ))}
      </BarChart.Bar>
    </BarChart.Metric>
  </BarChart>
);

/** `spendingChart` at the width of the KPI card it's drawn for. */
const spending = (...args: Parameters<typeof spendingChart>) => <Div tw="w-[19.5rem]">{spendingChart(...args)}</Div>;

const BAR_CHART = defineStory({
  id: "Bar Chart",
  figma: "Atoms/Data Viz/Bar Chart",
  examples: [
    { render: () => spending() },
    {
      title: "Show scale",
      render: () => (
        <Variants>
          {spending()}
          {spending({ scale: false })}
        </Variants>
      ),
    },
  ],
});

const SIGNALS: { label: string; icon: Icon }[] = [
  { label: "Location Disabled", icon: LocationDisabledIcon },
  { label: "Absent Last Shift", icon: AbsentLastShiftIcon },
  { label: "Flagged Message", icon: FlaggedMessageIcon },
  { label: "New Worker", icon: NewWorkerIcon },
];

/** Figma's four signals, each a metric named by its tooltip. */
export const METRICS = SIGNALS.map(({ label, icon: Glyph }) => (
  <RiskMatrix.Metric key={label}>
    <Glyph aria-hidden />
    <Tooltip>{label}</Tooltip>
  </RiskMatrix.Metric>
));

const WORKER = PEOPLE.brittany;

/** Brittany's no-show risk, as her name's card charts it, or with `details` as the side sheet's Risk factor card lists it. */
const spiderChart = (details?: boolean) =>
  datum(WORKER, "worker", (worker) => (
    <NoShowRisk
      name={worker.name}
      readings={noShowRisk(WORKER)}
      details={details}
      heading={details ? "Risk factor" : undefined}
      action={
        details && (
          <Field orientation="horizontal">
            <Checkbox />
            <Field.Label>Acknowledge Risk</Field.Label>
          </Field>
        )
      }
    />
  ));

/** The side sheet's Risk factor card. */
export const riskFactorCard = () => <Card>{spiderChart(true)}</Card>;

const RISK_MATRIX = defineStory({
  id: "Risk Matrix",
  figma: "Molecules/Cell Content/Main Content/Risk Matrix",
  examples: [{ render: () => <RiskMatrix>{METRICS}</RiskMatrix> }],
});

// A worker's no-show risk: the Check-ins dashboard's side sheet lists it as the worker's risk factors.
const SPIDER_CHART = defineStory({
  id: "Spider Chart",
  figma: "Molecules/Data Viz/Spider Chart",
  examples: [
    { render: () => <Div tw="w-[40rem]">{spiderChart(true)}</Div> },
    {
      // The worker's card beside their name in a table; the side sheet's Risk factor card, its factors in full.
      title: "Details",
      render: () => (
        <Variants>
          {spiderChart()}
          <Div tw="w-[40rem]">{spiderChart(true)}</Div>
        </Variants>
      ),
    },
  ],
});

export const DATA_VIZ_STORIES = [PROGRESS_BAR, STACKED_BAR_CHART, BAR_CHART, SPIDER_CHART, RISK_MATRIX];
