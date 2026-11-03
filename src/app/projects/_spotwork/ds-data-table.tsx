"use client";

import type { ComponentProps, ReactNode } from "react";
import { addedOnText, companyLine, phoneText, prospectsFrom } from "./activations";
import { LOGOS, PEOPLE, clock, type Tier } from "./data";
import { AUTHORED_NOW, late, rowsFor, shiftTimes } from "./dashboard";
import { ActionStack, Avatar, RiskMatrix, Table, Tags } from "./data-table";
import { ProgressBar } from "./data-viz";
import { datum } from "./ds-code";
import { METRICS } from "./ds-data-viz";
import { Variants, defineStory } from "./ds-story";
import { Div } from "./ds-tailwind";
import { Search } from "./search";
import { tagsOf } from "./presets";
import { TEMPLATES, cellTime, entryOn, fillTone, seedSeries } from "./shifts";
import { Badge, Button, Checkbox, Chip, Link, Pill, STATUS_PILL, Spotscore, Tooltip, Typography } from "./ui";
import ArriveIcon from "./assets/arrive.svg";
import ConfirmedIcon from "./assets/confirmed.svg";
import TickIcon from "./assets/tick-large.svg";
import DistanceIcon from "./assets/icons/small/distance.svg";
import NotesIcon from "./assets/notes.svg";
import CheckInIcon from "./assets/icons/small/check-in.svg";
import SmallCrossIcon from "./assets/icons/small/cross.svg";
import KebabIcon from "./assets/icons/medium/kebab-menu.svg";
import UndoIcon from "./assets/icons/medium/undo.svg";

// SW Curie's Data Table page (663:1458): the app's tables, the Table Cell, the components its slots take, then the
// avatar, in Figma's words. Figma's "Spotter" is "worker" here.

// A worker, as the store holds them.
const WORKER = PEOPLE.brittany;


// The Cell Blueprint is 220 wide; a layout wider than its 205 of content widens it by the cell's padding.
const CELL = "13.75rem";

const CONFIRMED = (
  <Pill state="success">
    <ConfirmedIcon aria-hidden />
    Confirmed
  </Pill>
);

const UNDO = (
  <Button size="icon" tone="destructive" aria-label="Undo confirmation">
    <UndoIcon aria-hidden />
    <Tooltip>Undo confirmation</Tooltip>
  </Button>
);

const CHECK_IN_ACTION = (
  <Button size="small" emphasis="secondary">
    <CheckInIcon aria-hidden />
    Check-in...
  </Button>
);

const MARK_ABSENT_ACTION = (
  <Button size="small" emphasis="secondary" tone="destructive">
    <SmallCrossIcon aria-hidden />
    Mark absent...
  </Button>
);

const CONFIRM_ACTION = (
  <Button size="small" emphasis="secondary">
    <TickIcon aria-hidden />
    Confirm 40.00 h
  </Button>
);

const MORE_ACTIONS = (
  <Button size="icon" aria-label="More actions">
    <KebabIcon aria-hidden />
    <Tooltip>More actions</Tooltip>
  </Button>
);

// Parts side by side on one of a cell's lines.
export const ABREAST = "flex items-start gap-(--sw-gap-xs)";

/** `cells` alone in a row of a table `columns` wide, in its body or its `head`. */
export function alone(columns: string, cells: ReactNode, head?: boolean) {
  const Section = head ? Table.Head : Table.Body;
  return (
    <Table columns={columns}>
      <Section>
        <Table.Row>{cells}</Table.Row>
      </Section>
    </Table>
  );
}

/** A column's head: its words. */
const columnHead = (label: string) => (
  <Table.Cell>
    <Typography variant="metadata">{label}</Typography>
  </Table.Cell>
);

/** A day's head: its date, then its weekday; `active`, today's. */
const dayHead = (date: string, weekday: string, active?: boolean) => (
  <Table.Cell active={active}>
    <Typography variant="metadata">{date}</Typography>
    <Typography variant="metadata">{weekday}</Typography>
  </Table.Cell>
);

const TIER = WORKER.profile.tier.toLowerCase() as Lowercase<Tier>;

// The Check-ins dashboard's late check-in, as its status cell writes it.
const LATE = rowsFor(AUTHORED_NOW).today.find((row) => row.status === "lateCheckIn")!;
const LATENESS = late(LATE, AUTHORED_NOW);

// A day of the Shifts page's week, as its scheduled shift's cell counts it.
const [SERIES] = seedSeries("2023-10-20");
const ENTRY = entryOn(SERIES, SERIES.dates[0])!;
const SCHEDULED = {
  title: SERIES.title,
  time: cellTime(SERIES.start, SERIES.end),
  ...ENTRY,
  tone: fillTone(ENTRY.filled, ENTRY.total),
};

// A day's column on the Shifts page.
const DAY = "10.25rem";

const TAG = (
  <Chip state="affirmative">
    Licensed
    <Chip.Remove />
  </Chip>
);

/** The worker's cell, its avatar beside their name, pool and phone. */
const workerCell = (ahead?: boolean) =>
  datum(WORKER, "worker", (worker) => (
    <Table.Cell ahead={ahead}>
      <Avatar src={worker.face} />
      <Typography variant="body">{worker.name}</Typography>
      <Chip size="small" state="affirmative">{worker.profile.pool}</Chip>
      <Typography variant="metadata" color="subdued">
        {worker.profile.phone}
      </Typography>
    </Table.Cell>
  ));

// A prospect on the Companies page, as its row writes them.
const ANIKA = prospectsFrom(new Date(2026, 9, 14, 9)).find((prospect) => prospect.name === "Anika Septimus")!;
const PROSPECT = {
  name: ANIKA.name,
  designation: ANIKA.designation,
  phone: phoneText(ANIKA),
  email: ANIKA.email,
  company: ANIKA.company,
  details: companyLine(ANIKA),
  added: addedOnText(ANIKA.added),
  source: ANIKA.source,
};

// The Check-ins dashboard's table: a worker's check-in under its head.
const CHECK_INS_TABLE = (
  <Table columns="2.75rem 13.75rem 13.75rem 15.75rem 13.75rem 19rem" outline>
    <Table.Head>
      <Table.Row>
        <Table.Cell>
          <Checkbox aria-label="Select all" />
        </Table.Cell>
        <Table.Cell search aria-label="Worker">
          <Search size="small" placeholder="Find a check-in..." />
        </Table.Cell>
        {columnHead("Shift information")}
        {columnHead("Check-in status")}
        {columnHead("Risk factor")}
        {columnHead("Actions")}
      </Table.Row>
    </Table.Head>
    <Table.Body>
      {datum(WORKER, "worker", (worker) => (
        <Table.Row>
          <Table.Cell>
            <Checkbox aria-label={worker.name} />
          </Table.Cell>
          <Table.Cell>
            <Avatar src={worker.face} />
            <Typography variant="body">{worker.name}</Typography>
            <Typography variant="metadata" color="subdued">
              {worker.profile.phone}
            </Typography>
          </Table.Cell>
          <Table.Cell>
            <Typography variant="body">Warehouse Associate</Typography>
            <Typography variant="metadata" color="subdued">
              General Labourer
            </Typography>
            <Typography variant="metadata" color="subdued">
              CCLS First Gulf
            </Typography>
          </Table.Cell>
          <Table.Cell>
            <Pill {...STATUS_PILL.lateCheckIn}>
              <ArriveIcon aria-hidden />
              Late Check-In
            </Pill>
            <Typography variant="metadata" color="subdued">
              {shiftTimes(LATE)}
            </Typography>
            <Div tw={ABREAST}>
              <Typography variant="metadata" color="subdued">
                {clock(LATE.checkIn!)}
              </Typography>
              <Chip size="small" state={LATENESS.tone}>{LATENESS.text}</Chip>
              <Typography variant="metadata" color="subdued">
                {`–In Progress ${LATE.zone}`}
              </Typography>
            </Div>
          </Table.Cell>
          <Table.Cell>
            <RiskMatrix>{METRICS.slice(0, 2)}</RiskMatrix>
            <Link>
              <DistanceIcon aria-hidden />
              On Site
            </Link>
          </Table.Cell>
          <Table.Cell>
            <ActionStack>
              <ActionStack.Secondary>
                {CHECK_IN_ACTION}
                {MARK_ABSENT_ACTION}
              </ActionStack.Secondary>
              {MORE_ACTIONS}
            </ActionStack>
            <Div tw={ABREAST}>
              <Link>
                <NotesIcon aria-hidden />2 notes
              </Link>
              <Chip size="small" state="alert">1 Unread</Chip>
            </Div>
          </Table.Cell>
        </Table.Row>
      ))}
    </Table.Body>
  </Table>
);

// The Timesheet: a worker's day done, the next to come, their week's hours to confirm, and each day's hours below.
const TIMESHEET_TABLE = (
  <Table columns="13.75rem repeat(2, 8.5rem) 13.75rem" outline>
    <Table.Head>
      <Table.Row>
        <Table.Cell search aria-label="Worker">
          <Search size="small" placeholder="Find a worker..." />
        </Table.Cell>
        {dayHead("15", "Mon")}
        {dayHead("16", "Tue")}
        {columnHead("Actions")}
      </Table.Row>
    </Table.Head>
    <Table.Body>
      {datum(WORKER, "worker", (worker) => (
        <Table.Row>
          <Table.Cell header fill>
            <Avatar src={worker.face} />
            <Typography variant="body">{worker.name}</Typography>
            <Spotscore tier={TIER}>
              {worker.profile.score}
            </Spotscore>
          </Table.Cell>
          <Table.Cell>
            <Chip state="affirmative" aria-label="Checked In/Out 8.00 h">
              <Badge inverted>C</Badge>
              8.00 h
            </Chip>
            <Typography variant="metadata" color="subdued">
              9:00 AM–5:30 PM
            </Typography>
          </Table.Cell>
          <Table.Cell>
            <Chip disabled>
              <Badge inverted>U</Badge>
              Upcoming
            </Chip>
          </Table.Cell>
          <ActionStack.Provider>
            <Table.Cell>
              <ActionStack>
                <ActionStack.Pending>
                  <ActionStack.Secondary>
                    <ActionStack.Complete>
                      <Button size="small" emphasis="secondary">
                        <TickIcon aria-hidden />
                        Confirm 8.00 h
                      </Button>
                    </ActionStack.Complete>
                  </ActionStack.Secondary>
                </ActionStack.Pending>
                <ActionStack.Done>
                  <ActionStack.Status>
                    {CONFIRMED}
                    <ActionStack.Undo>{UNDO}</ActionStack.Undo>
                  </ActionStack.Status>
                </ActionStack.Done>
              </ActionStack>
              <ActionStack.Pending>
                <Typography variant="metadata" color="subdued">
                  1 Shift
                </Typography>
              </ActionStack.Pending>
              <ActionStack.Done>
                <Typography variant="metadata" color="subdued">
                  8 Hours
                </Typography>
              </ActionStack.Done>
            </Table.Cell>
          </ActionStack.Provider>
        </Table.Row>
      ))}
    </Table.Body>
    <Table.Foot>
      <Table.Row>
        <Table.Cell fill>
          <Typography variant="bodyStrong">Total hours</Typography>
        </Table.Cell>
        <Table.Cell>
          <Typography variant="bodyStrong">8.00 h</Typography>
        </Table.Cell>
        <Table.Cell />
        <Table.Cell empty />
      </Table.Row>
    </Table.Foot>
  </Table>
);

// The Shifts page: a template's row, a day's scheduled shift with its places filled, and a day to come.
const SHIFTS_TABLE = (
  <Table columns="12.5rem repeat(2, 10.25rem)" outline>
    <Table.Head>
      <Table.Row>
        <Table.Cell search>
          <Search size="small" aria-label="Find a worker" placeholder="Find a worker..." />
        </Table.Cell>
        {dayHead("15", "Mon")}
        {dayHead("16", "Tue")}
      </Table.Row>
    </Table.Head>
    <Table.Body>
      <Table.Row>
        <Table.Cell header fill>
          <Typography variant="body">Forklift Operator</Typography>
          <Div tw={ABREAST}>
            <Chip size="small" state="affirmative">Licensed</Chip>
            <Chip size="small" state="affirmative">Warehouse</Chip>
            <Chip size="small" state="affirmative">+2</Chip>
          </Div>
        </Table.Cell>
        {datum(SCHEDULED, "shift", (shift) => (
          <Table.Cell>
            <Typography variant="body">{shift.title}</Typography>
            <Typography variant="metadata" color="subdued">
              {shift.time}
            </Typography>
            <ProgressBar fill value={shift.filled} max={shift.total} tone={shift.tone}>
              <Typography variant="metadata" color="subdued">
                {shift.filled}/{shift.total}
              </Typography>
              <Typography variant="metadata" color="subdued">
                Filled
              </Typography>
            </ProgressBar>
          </Table.Cell>
        ))}
        <Table.Cell />
      </Table.Row>
    </Table.Body>
  </Table>
);

// The Companies page: a prospect, approved, under its head, its columns sorting.
const ACTIVATIONS_TABLE = datum(PROSPECT, "prospect", (prospect) => (
  <Table columns="13.75rem 13.75rem 18.75rem 12.5rem 16rem" outline>
    <Table.Head>
      <Table.Row>
        <Table.Cell search sortable aria-label="Company">
          <Search size="small" placeholder="Find a company..." />
        </Table.Cell>
        <Table.Cell sortable>
          <Typography variant="metadata">Owner</Typography>
        </Table.Cell>
        {columnHead("Contact information")}
        <Table.Cell sortable>
          <Typography variant="metadata">Added on</Typography>
        </Table.Cell>
        {columnHead("Status")}
      </Table.Row>
    </Table.Head>
    <Table.Body>
      <Table.Row>
        <Table.Cell>
          <Typography variant="body">{prospect.company}</Typography>
          <Typography variant="metadata" color="subdued">
            {prospect.details}
          </Typography>
        </Table.Cell>
        <Table.Cell>
          <Typography variant="body">{prospect.name}</Typography>
          <Typography variant="metadata" color="subdued">
            {prospect.designation}
          </Typography>
        </Table.Cell>
        <Table.Cell>
          <Typography variant="body">{prospect.phone}</Typography>
          <Typography variant="metadata" color="subdued">
            {prospect.email}
          </Typography>
        </Table.Cell>
        <Table.Cell>
          <Typography variant="body">{prospect.added}</Typography>
          <Typography variant="metadata" color="subdued">
            {prospect.source}
          </Typography>
        </Table.Cell>
        <Table.Cell>
          <ActionStack>
            <ActionStack.Status>
              <Pill state="affirmative">
                <ConfirmedIcon aria-hidden />
                Approved
              </Pill>
              {MORE_ACTIONS}
            </ActionStack.Status>
          </ActionStack>
          <Link>
            <NotesIcon aria-hidden />
            Add note
          </Link>
        </Table.Cell>
      </Table.Row>
    </Table.Body>
  </Table>
));

// The app's tables, each its head over a row as its page composes them; the Check-ins dashboard's first.
const TABLE = defineStory({
  id: "Table",
  figma: "Data Table",
  examples: [
    { layout: "scroll", render: () => CHECK_INS_TABLE },
    { title: "Timesheet", layout: "scroll", render: () => TIMESHEET_TABLE },
    { title: "Shifts", layout: "scroll", render: () => SHIFTS_TABLE },
    { title: "Companies", layout: "scroll", render: () => ACTIVATIONS_TABLE },
  ],
});

/** A timesheet row's Total cell, its hours confirmed from the start with `defaultDone`. */
const timesheetTotal = (defaultDone: boolean) =>
  alone(
    "15.75rem",
    <ActionStack.Provider defaultDone={defaultDone}>
      <Table.Cell>
        <ActionStack>
          <ActionStack.Pending>
            <ActionStack.Secondary>
              <ActionStack.Complete>{CONFIRM_ACTION}</ActionStack.Complete>
            </ActionStack.Secondary>
          </ActionStack.Pending>
          <ActionStack.Done>
            <ActionStack.Status>
              {CONFIRMED}
              <ActionStack.Undo>{UNDO}</ActionStack.Undo>
            </ActionStack.Status>
          </ActionStack.Done>
        </ActionStack>
        <ActionStack.Pending>
          <Typography variant="metadata" color="subdued">
            5 Shifts • 2 Adjusted
          </Typography>
        </ActionStack.Pending>
        <ActionStack.Done>
          <Typography variant="metadata" color="subdued">
            40 Hours
          </Typography>
        </ActionStack.Done>
      </Table.Cell>
    </ActionStack.Provider>,
  );

// Figma's Cell Blueprint in a table's body, and Atoms/Table Header in its head: a slot for an avatar and its parts,
// each on a line of the row's; in the head, a column's words, a context search or a day.
const TABLE_CELL = defineStory({
  id: "Table Cell",
  figma: "Molecules/Cell Blueprint/Thumbnail & Content",
  examples: [
    { render: () => alone(CELL, workerCell()) },
    {
      // A day still to come sits on the page's grey; a cell with nothing in it on the Disabled surface.
      title: "State",
      render: () => (
        <Variants>
          {alone(CELL, workerCell())}
          {alone(CELL, workerCell(true))}
          {alone(CELL, <Table.Cell empty />)}
        </Variants>
      ),
    },
    {
      // In the head: a column's words; a context search (Check-ins, Companies); a day of the week (Timesheet, Shifts).
      title: "Type",
      render: () => (
        <Variants>
          {alone(CELL, columnHead("Shift information"), true)}
          {alone(
            CELL,
            <Table.Cell search aria-label="Worker">
              <Search size="small" placeholder="Find a check-in..." />
            </Table.Cell>,
            true,
          )}
          {alone(DAY, dayHead("15", "Mon"), true)}
        </Variants>
      ),
    },
    {
      // Today's day.
      title: "Is active",
      render: () => (
        <Variants>
          {alone(DAY, dayHead("15", "Mon"), true)}
          {alone(DAY, dayHead("15", "Mon", true), true)}
        </Variants>
      ),
    },
    {
      title: "Is sortable",
      render: () => (
        <Variants>
          {alone(
            CELL,
            <Table.Cell sortable>
              <Typography variant="metadata">Company</Typography>
            </Table.Cell>,
            true,
          )}
          {alone(
            CELL,
            <Table.Cell sortable defaultSort="ascending">
              <Typography variant="metadata">Company</Typography>
            </Table.Cell>,
            true,
          )}
        </Variants>
      ),
    },
    {
      // Figma's Tags: small chips, each removed by its cross, and Add; and the small type-ahead Add opens with its Save.
      title: "Tags",
      render: () => (
        <Variants>
          {alone(
            "26rem",
            <Table.Cell>
              <Tags options={tagsOf(TEMPLATES)}>
                {TAG}
                {TAG}
                {TAG}
              </Tags>
            </Table.Cell>,
          )}
          {alone(
            "26rem",
            <Table.Cell>
              <Tags options={tagsOf(TEMPLATES)} defaultAdding>
                {TAG}
                {TAG}
                {TAG}
              </Tags>
            </Table.Cell>,
          )}
        </Variants>
      ),
    },
    {
      // Figma's Action Stack: a row's actions; then a timesheet row's hours, confirmed by its Confirm and taken back by
      // its Undo, still to confirm and confirmed.
      title: "Action stack",
      render: () => (
        <Variants>
          {alone(
            "19rem",
            <Table.Cell>
              <ActionStack>
                <ActionStack.Secondary>
                  {CHECK_IN_ACTION}
                  {MARK_ABSENT_ACTION}
                </ActionStack.Secondary>
                {MORE_ACTIONS}
              </ActionStack>
            </Table.Cell>,
          )}
          {timesheetTotal(false)}
          {timesheetTotal(true)}
        </Variants>
      ),
    },
  ],
});

// Figma's Images/Placeholder/Face/Female, /Male and /No Picture and /Company as one avatar: a picture, initials
// without one, or a company's logo, the Business icon without one.
/** The worker's avatar, their picture read from their record. */
const avatar = (props: Omit<ComponentProps<typeof Avatar>, "src" | "children">) =>
  datum(WORKER, "worker", (worker) => <Avatar src={worker.face} {...props} />);

export const AVATAR = defineStory({
  id: "Avatar",
  figma: "Images/Placeholder/Face",
  examples: [
    { render: () => avatar({ size: "medium" }) },
    {
      title: "Picture",
      render: () => (
        <Variants>
          {avatar({ size: "medium" })}
          <Avatar size="medium">BP</Avatar>
          {datum({ name: "Bolt", logo: LOGOS.Bolt }, "company", (company) => <Avatar type="company" src={company.logo} />)}
          <Avatar type="company" />
        </Variants>
      ),
    },
    {
      title: "Type",
      render: () => (
        <Variants>
          {avatar({})}
          {datum({ name: "Bolt", logo: LOGOS.Bolt }, "company", (company) => <Avatar type="company" src={company.logo} />)}
        </Variants>
      ),
    },
    {
      title: "Size",
      render: () => (
        <Variants>
          {avatar({ size: "large" })}
          {avatar({})}
          {avatar({ size: "medium" })}
          {avatar({ size: "inline" })}
        </Variants>
      ),
    },
  ],
});

export const DATA_TABLE_STORIES = [TABLE, TABLE_CELL];
