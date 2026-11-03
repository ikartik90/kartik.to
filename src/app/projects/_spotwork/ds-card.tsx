"use client";

import { InlineTableRecord, destructiveRecord, editButton, navigationRecord, switchRecord } from "./cards";
import { LOGOS, PEOPLE } from "./data";
import { Avatar } from "./data-table";
import { StackedBarChart } from "./data-viz";
import { datum } from "./ds-code";
import { spendingChart } from "./ds-data-viz";
import { Variants, defineStory } from "./ds-story";
import { Div } from "./ds-tailwind";
import { ShiftSummaryCard, type ShiftSummary } from "./form-organisms";
import { TemplateCard } from "./new-shift";
import { presetsSeed, type Preset } from "./presets";
import { PresetCard } from "./presets-page";
import { TEMPLATES, repeatDates } from "./shifts";
import { Badge, Button, Card, Chip, Divider, Pill, Switch, Tooltip, Typography } from "./ui";
import ArriveIcon from "./assets/arrive.svg";
import ConfirmedIcon from "./assets/confirmed.svg";
import ContactIcon from "./assets/icons/medium/contact.svg";
import EditIcon from "./assets/edit.svg";
import UndoIcon from "./assets/icons/medium/undo.svg";
import PreviewIcon from "./assets/icons/medium/preview.svg";

// SW Curie's Card page (3009:7365): Card's and Inline Table Record's layouts,
// each its own example drawn from their parts, with Figma's placeholder words.

const BRAMPTON = "CCLS, 250 First Gulf Boulevard, Brampton, ON";
// The employer, read from its record.
const COMPANY = { name: "Canada Cartage", logo: LOGOS["Canada Cartage"] };
const logo = () => datum(COMPANY, "company", (company) => <Avatar type="company" src={company.logo} />);

const JANITOR =
  "As a Janitor, you will be responsible for maintaining a clean and safe environment. Your attention to detail and dedication to cleanliness will contribute to the overall appearance and functionality of our facilities.";

const SUMMARY: ShiftSummary = {
  title: "Day Shift M/W/F",
  startDate: "10/24/2023",
  startTime: "9:00 AM",
  endDate: "10/24/2023",
  endTime: "5:00 PM",
  unpaidBreak: "30 Minutes",
  workers: "4",
  reportTo: "Yousuf Hamedani",
  dates: repeatDates({ first: "2023-10-24", weekdays: [1, 3, 5], until: "2023-11-12" }),
  today: "2023-10-20",
  tags: ["Temp to Hire", "Private Job"],
};

const contact = (
  <Button size="icon" aria-label="View contact info">
    <ContactIcon aria-hidden />
    <Tooltip>View contact info</Tooltip>
  </Button>
);

// Atoms/Badge in its tones' own colours, on a plain surface; a chip's is `inverted`, as the Chip page shows.
export const BADGE = defineStory({
  id: "Badge",
  figma: "Atoms/Badge",
  examples: [
    { render: () => <Badge>1</Badge> },
    {
      title: "State",
      render: () => (
        <Variants>
          <Badge state="active">1</Badge>
          <Badge state="success">1</Badge>
          <Badge state="warning">1</Badge>
          <Badge state="alert">1</Badge>
          <Badge state="disabled">1</Badge>
        </Variants>
      ),
    },
  ],
});

// A line between a card's or an overlay's parts, or a list's rows.
export const DIVIDER = defineStory({
  id: "Divider",
  figma: "Atoms/Divider",
  examples: [
    { render: () => <Div tw="w-[22.5rem]"><Divider /></Div> },
    {
      title: "Orientation",
      render: () => (
        <Variants>
          <Div tw="w-[22.5rem]">
            <Divider />
          </Div>
          <Div tw="flex h-[2.5rem]">
            <Divider orientation="vertical" />
          </Div>
        </Variants>
      ),
    },
    {
      title: "Tone",
      render: () => (
        <Variants>
          <Div tw="w-[22.5rem]">
            <Divider />
          </Div>
          <Div tw="w-[22.5rem]">
            <Divider tone="warning" />
          </Div>
          <Div tw="w-[22.5rem]">
            <Divider tone="alert" />
          </Div>
        </Variants>
      ),
    },
  ],
});

/** Figma's Team Record: picked from its name, with its contact details. */
function teamRecord(name: string, picking: { value?: string; defaultSelected?: boolean }) {
  return (
    <InlineTableRecord key={picking.value} {...picking}>
      <InlineTableRecord.Cell fill selects>
        <Typography variant="body">{name}</Typography>
        <InlineTableRecord.Selected>
          <Pill state="success">
            <ConfirmedIcon aria-hidden />
            Selected
          </Pill>
        </InlineTableRecord.Selected>
      </InlineTableRecord.Cell>
      <InlineTableRecord.Cell>{contact}</InlineTableRecord.Cell>
    </InlineTableRecord>
  );
}

// The presets page's cards: Forklift Operator, active, and a draft.
const [FORKLIFT, GROOMING] = ["Forklift Operator", "Grooming Agent"].map(
  (title) => presetsSeed().find((preset) => preset.title === title)!,
);

/** Figma's Positions Template Card: a company's template, with its count of shifts. */
const templateCard = (preset: Preset, shifts?: number) => (
  // Three across the presets page's 1365px.
  <Div tw="w-[27.75rem]">
    <PresetCard preset={preset} shifts={shifts} />
  </Div>
);

const TRANSFER = destructiveRecord(
  "Transfer workspace ownership",
  "You are currently the owner of this company workspace. If you no longer wish to remain the owner, you can hand over the ownership of this workspace to someone else. Ownership transfer cannot be undone.",
  "Transfer ownership",
);

// The Settings page's cards (12593:28010), each a Generic Card: a head over its records.
const PROFILE_CARD = (
  <Card>
    <Card.Header align="start">
      {datum(PEOPLE.brittany, "user", (user) => <Avatar src={user.face} />)}
      <Card.Content>
        <Typography tag="h3" variant="subheading">Brittany Pilz</Typography>
        <Typography tag="p" variant="metadata" color="subdued">britpilz@gmail.com</Typography>
      </Card.Content>
      {editButton("Edit profile")}
    </Card.Header>
    <Card.Records>{navigationRecord("Change password")}</Card.Records>
  </Card>
);

const VERIFICATION_CARD = (
  <Card>
    <Card.Header align="start">
      <Card.Content>
        <Typography tag="h3" variant="subheading">2-step verification</Typography>
        <Typography tag="p" variant="metadata" color="subdued">Enabled on (4xx) xxx-x566</Typography>
      </Card.Content>
      {editButton("Change verification phone")}
    </Card.Header>
    <Card.Records>{navigationRecord("Backup code")}</Card.Records>
  </Card>
);

const WORKSPACE_CARD = (
  <Card>
    <Card.Header align="start">
      {logo()}
      <Card.Content>
        <Typography tag="h3" variant="subheading">Canada Cartage</Typography>
        <Typography tag="p" variant="metadata" color="subdued">Created on Sep 23, 2022</Typography>
      </Card.Content>
      {editButton("Edit company")}
    </Card.Header>
    <Card.Records>
      {navigationRecord("Manage blocked workers", "2 workers blocked")}
      {TRANSFER}
    </Card.Records>
  </Card>
);

const TEAM_CARD = (
  <Card>
    <Card.Header align="start">
      {logo()}
      <Card.Content>
        <Typography tag="h3" variant="subheading">CCLS First Gulf</Typography>
        <Typography tag="p" variant="metadata" color="subdued">Toronto • (GMT-5) Eastern Standard Time (EST)</Typography>
      </Card.Content>
      {editButton("Edit team")}
    </Card.Header>
    <Card.Records>
      {switchRecord(
        "Enable Check-in Codes",
        <Switch size="small" defaultChecked />,
        "You will receive a code by email for workers to use when checking in and out.",
      )}
      {navigationRecord("Manage team members", "7 members")}
      {navigationRecord("Saved addresses", "3 addresses")}
      {navigationRecord("Mandatory requirements", "No requirement set")}
      {destructiveRecord(
        "Deactivate team",
        "Once you deactivate this team, no one can post shifts under the team or open the shifts already posted.",
        "Deactivate team",
      )}
    </Card.Records>
  </Card>
);

// Records alone: the admin's settings, each opening its own page.
const ADMIN_CARD = (
  <Card>
    <Card.Records>
      {navigationRecord("Take rates")}
      {navigationRecord("Minimum wages")}
      {navigationRecord("Skills & requirement")}
      {navigationRecord("Late cancellation policy")}
    </Card.Records>
  </Card>
);

/** A worker's document, a Generic Card with no records: its expiry, warning when it's near, and its approval. */
export const certificateCard = (name: string, expires: string, expiring?: boolean) => (
  <Card>
    <Card.Header align="start">
      <Card.Content>
        <Typography tag="h3" variant="subheading">{name}</Typography>
        <Div tw="flex">
          <Chip size="small" state={expiring ? "warning" : "affirmative"}>Expires {expires}</Chip>
        </Div>
        <Typography tag="p" variant="metadata" color="subdued">Approved on Sep 23, 2023</Typography>
      </Card.Content>
      <Button size="icon" aria-label="Preview">
        <PreviewIcon aria-hidden />
        <Tooltip>Preview</Tooltip>
      </Button>
    </Card.Header>
  </Card>
);

/** A change to one of a schedule's shifts; one still to come can be undone. */
const override = (date: string, action: string, undo?: boolean) => (
  <InlineTableRecord key={date}>
    <InlineTableRecord.Cell width={150}>
      <Typography variant="body">{date}</Typography>
    </InlineTableRecord.Cell>
    <InlineTableRecord.Cell width={150}>
      <Typography variant="body">{action}</Typography>
    </InlineTableRecord.Cell>
    <InlineTableRecord.Cell fill>
      <Typography variant="body">Dalton Davidson</Typography>
    </InlineTableRecord.Cell>
    {undo && (
      <InlineTableRecord.Cell>
        <Button size="icon" aria-label="Undo override">
          <UndoIcon aria-hidden />
          <Tooltip>Undo override</Tooltip>
        </Button>
      </InlineTableRecord.Cell>
    )}
  </InlineTableRecord>
);

/** A schedule's changelog: each of its shifts edited or cancelled on its own. */
const SHIFT_CHANGELOG = (
  <Card>
    <Card.Header>
      <Typography tag="h3" variant="subheading">Day Shift M/W/F</Typography>
    </Card.Header>
    <Card.Records>
      {override("10/24/2023", "Cancelled")}
      {override("11/03/2023", "Edited", true)}
      {override("11/06/2023", "Cancelled", true)}
    </Card.Records>
  </Card>
);

// The Check-ins page's spots this week, by what's become of them.
const SPOTS: [string, number][] = [
  ["Completed", 54],
  ["Absent", 3],
  ["Filled", 23],
  ["Vacant", 9],
];

/** The Check-ins page's KPI card of this week's spots, its legend beside them. */
const shiftsCard = () => (
  <Card>
    <Card.Header>
      <Typography tag="h3" variant="subheading">Shifts this week</Typography>
    </Card.Header>
    <StackedBarChart type="status" legend="beside">
      <StackedBarChart.Metric>
        <StackedBarChart.Value>
          <Typography variant="title">89</Typography>
          <Typography variant="metadata" color="subdued">spots</Typography>
        </StackedBarChart.Value>
        <StackedBarChart.Bar>
          {SPOTS.map(([label, count]) => (
            <StackedBarChart.Segment key={label} count={count} />
          ))}
        </StackedBarChart.Bar>
      </StackedBarChart.Metric>
      <StackedBarChart.Legend>
        {SPOTS.map(([label, count]) => (
          <StackedBarChart.LegendUnit key={label}>
            <Typography variant="metadata" color="subdued">{label}</Typography>
            <Chip size="small" state="affirmative">{count}</Chip>
          </StackedBarChart.LegendUnit>
        ))}
      </StackedBarChart.Legend>
    </StackedBarChart>
  </Card>
);

/** The Check-ins page's KPI card of the six weeks' spending, this week's still running. */
export const spendingCard = () => (
  <Card>
    <Card.Header>
      <Typography tag="h3" variant="subheading">Spending</Typography>
    </Card.Header>
    {spendingChart({ current: true })}
  </Card>
);

// Organisms/Card's layouts, each an example; a Generic Card first.
const CARD = defineStory({
  id: "Card",
  figma: "Organisms/Card",
  examples: [
    { render: () => <Div tw="w-(--sw-width-card)">{WORKSPACE_CARD}</Div> },
    {
      title: "Positions template card",
      render: () => (
        <Variants>
          {templateCard(FORKLIFT, 6)}
          {templateCard(GROOMING)}
        </Variants>
      ),
    },
    {
      title: "Generic card",
      render: () => (
        <Variants>
          <Div tw="w-(--sw-width-card)">{PROFILE_CARD}</Div>
          <Div tw="w-(--sw-width-card)">{VERIFICATION_CARD}</Div>
          <Div tw="w-(--sw-width-card)">{WORKSPACE_CARD}</Div>
          <Div tw="w-(--sw-width-card)">{TEAM_CARD}</Div>
          <Div tw="w-(--sw-width-card)">{ADMIN_CARD}</Div>
          <Div tw="w-(--sw-width-card)">{certificateCard("Passport", "Feb 3, 2026")}</Div>
          <Div tw="w-(--sw-width-card)">{certificateCard("Work Permit", "Nov 16, 2024", true)}</Div>
        </Variants>
      ),
    },
    {
      title: "Shift summary",
      render: () => (
        <Variants>
          <Div tw="w-(--sw-width-card)">
            <ShiftSummaryCard summary={SUMMARY} upcoming />
          </Div>
          <Div tw="w-(--sw-width-card)">
            <ShiftSummaryCard summary={SUMMARY} upcoming={false} />
          </Div>
        </Variants>
      ),
    },
    {
      title: "Shift changelog",
      render: () => <Div tw="w-(--sw-width-card)">{SHIFT_CHANGELOG}</Div>,
    },
    {
      title: "Position look-up card",
      render: () => (
        <Div tw="w-(--sw-width-card)">
          <TemplateCard template={TEMPLATES[0]} />
        </Div>
      ),
    },
    {
      title: "KPI card",
      render: () => (
        <Variants>
          {/* At the width each has on the Check-ins page. */}
          <Div tw="w-[21.5rem]">{shiftsCard()}</Div>
          <Div tw="w-[21.5rem]">{spendingCard()}</Div>
        </Variants>
      ),
    },
  ],
});

/** Check-in Status Record: a worker, read from their record, with their status and check-in's time. */
const CHECK_IN_RECORD = datum(PEOPLE.disha, "worker", (worker) => (
  <InlineTableRecord>
    <InlineTableRecord.Cell fill>
      <Avatar src={worker.face} size="inline" />
      <Typography variant="body">{worker.name}</Typography>
    </InlineTableRecord.Cell>
    <InlineTableRecord.Cell width={200}>
      <Pill state="affirmative">
        <ArriveIcon aria-hidden />
        Checked In
      </Pill>
    </InlineTableRecord.Cell>
    <InlineTableRecord.Cell align="end">
      <Typography variant="body">12:45 PM–12:00 AM (+1 Day)</Typography>
      <Button size="icon" aria-label="Edit check-in">
        <EditIcon aria-hidden />
        <Tooltip>Edit check-in</Tooltip>
      </Button>
    </InlineTableRecord.Cell>
  </InlineTableRecord>
));

// Molecules/Inline Table Record's records, each an example; Figma's Team Record first.
export const INLINE_TABLE_RECORD = defineStory({
  id: "Inline Table Record",
  figma: "Molecules/Inline Table Record",
  examples: [
    { layout: "fill", render: () => teamRecord(BRAMPTON, { defaultSelected: true }) },
    {
      title: "Team record",
      render: () => (
        <Variants>
          {teamRecord(BRAMPTON, { defaultSelected: true })}
          {teamRecord(BRAMPTON, {})}
        </Variants>
      ),
    },
    {
      title: "Settings record",
      render: () => (
        <Variants>
          <Div tw="w-[34.75rem]">{navigationRecord("Change password")}</Div>
          <Div tw="w-[34.75rem]">{switchRecord("2-step verification", <Switch size="small" defaultChecked />)}</Div>
          <Div tw="w-[34.75rem]">{TRANSFER}</Div>
        </Variants>
      ),
    },
    {
      title: "Check-in status record",
      render: () => <Div tw="w-[42.25rem]">{CHECK_IN_RECORD}</Div>,
    },
    {
      title: "Content record",
      render: () => (
        <Div tw="w-[34.75rem]">
          <InlineTableRecord>
            <InlineTableRecord.Cell fill>
              <Typography variant="body">Janitor</Typography>
              <Typography variant="metadata" color="subdued">Part Time • Apr 2023–Present</Typography>
              <InlineTableRecord.Description clamp>
                <Typography variant="metadata" color="subdued">{JANITOR}</Typography>
              </InlineTableRecord.Description>
            </InlineTableRecord.Cell>
          </InlineTableRecord>
        </Div>
      ),
    },
  ],
});

export const CARD_STORIES = [CARD];
