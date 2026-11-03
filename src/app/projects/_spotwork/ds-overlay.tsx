"use client";

import { cloneElement, useState, type ComponentProps, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { css } from "../../../../styled-system/css";
import { AUTHORED_NOW, rowsFor } from "./dashboard";
import { PEOPLE, clock, type Tier } from "./data";
import { Avatar } from "./data-table";
import { datum } from "./ds-code";
import { alone } from "./ds-data-table";
import { Reserve, Variants, defineStory, type Example, type Story } from "./ds-story";
import { Div } from "./ds-tailwind";
import { WorkerHoursDialog } from "./overlays";
import type { Booking } from "./planner";
import { ApplicantSelector, bookingParts } from "./shift-planner";
import { TEMPLATES } from "./shifts";
import { ProfileCard } from "./profile-card";
import { TimePicker } from "./time-picker";
import {
  ADJUST_FIELDS,
  BillableDurationCard,
  Metadata,
  ReferenceHours,
  SourcePill,
  TimecardForm,
  notesAndHistory,
} from "./timecard";
import type { Note } from "./timesheet";
import { Button, Card, Checkbox, Chip, Dialog, Divider, Field, LabelValuePair, Link, Overlay, Pill, Presence, RadioButton, RadioGroup, STATUS_PILL, SideSheet, Spotscore, Tags, TextArea, Typography } from "./ui";
import OpenSeparatelyIcon from "./assets/icons/medium/open-separately.svg";
import ArriveIcon from "./assets/arrive.svg";
import CheckOutIcon from "./assets/icons/small/check-out.svg";
import ChevronLeftIcon from "./assets/icons/small/chevron-left.svg";
import WarningIcon from "./assets/icons/small/warning.svg";
import AlertIcon from "./assets/icons/large/warning.svg";

// SW Curie's Overlay page (3683:4750), in the order Figma lays it out. Figma's "Spotter" is "worker".

type TriggeredProps = {
  /** The button that opens it, its label ending in "..." as an action opening an overlay's does. */
  trigger: ReactElement<ComponentProps<typeof Button>>;
  children: ReactElement<{ onClose?: () => void }>;
};

const triggeredStyle = css({ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sw-gap-xl)" });

/** Its overlay, which its parts close, over the `trigger` that opens and closes it; its place held while it's shut. */
function Triggered({ trigger, children }: TriggeredProps) {
  const [open, setOpen] = useState(true);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [held, setHeld] = useState<CSSProperties>();
  const toggle = (next: boolean) => {
    if (!next && slot) setHeld({ minWidth: slot.offsetWidth, minHeight: slot.offsetHeight });
    setOpen(next);
  };
  return (
    <div className={triggeredStyle}>
      <div ref={setSlot} style={held}>
        <Presence>{open && cloneElement(children, { onClose: () => toggle(false) })}</Presence>
      </div>
      {cloneElement(trigger, { "aria-expanded": open, onClick: () => toggle(!open) })}
    </div>
  );
}

// The code view shows the overlay alone.
Triggered.unwrap = ({ children }: TriggeredProps) => children;

/** Overlay Header as the app's overlays draw it, at an overlay's width. */
const header = (children: ReactNode) => <Div tw="w-[38.5rem]">{children}</Div>;

// The app's: an overlay's title alone, a worker's or a schedule's under it, and a sheet's Edit Schedule beside its title.
const OVERLAY_HEADER = defineStory({
  id: "Overlay Header",
  figma: "Molecules/Overlay/Overlay Header",
  examples: [
    {
      render: () =>
        header(
          <Overlay.Header>
            <Typography variant="heading">New shift</Typography>
            <Overlay.Close />
          </Overlay.Header>,
        ),
    },
    {
      title: "Subheading",
      render: () =>
        header(
          <Overlay.Header>
            <Typography variant="heading">Edit schedule</Typography>
            <Overlay.Close />
            <Typography variant="metadata" color="subdued">
              Forklift Operator • Day Shift M/W/F
            </Typography>
          </Overlay.Header>,
        ),
    },
    {
      title: "Sheet actions",
      render: () =>
        header(
          <SideSheet.Header>
            <Typography variant="heading">Forklift Operator</Typography>
            <SideSheet.SheetActions>
              <Button size="small" emphasis="secondary">
                Edit schedule...
              </Button>
            </SideSheet.SheetActions>
            <SideSheet.Close />
            <Typography variant="metadata" color="subdued">Day Shift M/W/F</Typography>
          </SideSheet.Header>,
        ),
    },
  ],
});

/** The Shift Planner's change summary: what's still to save, over how many it assigns. */
const unsavedChanges = (
  <Overlay.ChangeSummary>
    <LabelValuePair>
      <Typography variant="metadata" color="subdued">
        Unsaved Changes
      </Typography>
      <Typography variant="body">1 Assigned</Typography>
    </LabelValuePair>
  </Overlay.ChangeSummary>
);

/** Molecules/Overlay/Action Bar at an overlay's width, its Forward Actions ending on `action`. */
const actionBar = (action: string, summary?: ReactNode) => (
  <Div tw="w-[38.5rem]">
    <Overlay.ActionBar>
      <Overlay.Cancel />
      <Overlay.ForwardActions>
        {summary}
        <Button>{action}</Button>
      </Overlay.ForwardActions>
    </Overlay.ActionBar>
  </Div>
);

export const ACTION_BAR = defineStory({
  id: "Action Bar",
  figma: "Molecules/Overlay/Action Bar",
  examples: [
    { render: () => actionBar("Update offers", unsavedChanges) },
    {
      title: "Change summary",
      render: () => (
        <Variants>
          {actionBar("Check in")}
          {actionBar("Update offers", unsavedChanges)}
        </Variants>
      ),
    },
  ],
});

export const LABEL_VALUE_PAIR = defineStory({
  id: "Label-value Pair",
  figma: "Atoms/Card Content/Label-value Pair",
  examples: [
    {
      // A template's title, as New Template Preset's review reads it.
      render: () =>
        datum(TEMPLATES[0], "template", (template) => (
          <LabelValuePair>
            <Typography variant="metadata" color="subdued">
              Template Title
            </Typography>
            <Typography variant="body">{template.name}</Typography>
          </LabelValuePair>
        )),
    },
    {
      // A template's tags, as the Template Lookup Card reads them.
      title: "Tags",
      render: () =>
        datum(TEMPLATES[0], "template", (template) => (
          <LabelValuePair>
            <Typography variant="metadata" color="subdued">
              Tags
            </Typography>
            <Tags tags={template.tags} />
          </LabelValuePair>
        )),
    },
  ],
});

export const METADATA = defineStory({
  id: "Metadata",
  figma: "Molecules/Card Content/Metadata",
  examples: [
    {
      render: () => (
        <Div tw="w-[22.5rem]">
          <Metadata>
            <Typography tag="p" variant="body">
              Adjusted time to resolve disputed hours. Closing timecard.
            </Typography>
            <Typography tag="div" variant="metadata" color="subdued">
              Added by
              <Link>Shonda Williams</Link>
              • Sep 24, 2023, 9:15 AM
            </Typography>
          </Metadata>
        </Div>
      ),
    },
  ],
});

// Molecules/Card Content/Notes & History's notes: Default's three, and Warning's first two.
const NOTES: Note[] = [
  { text: "Adjusted time to resolve disputed hours. Closing timecard.", action: "Adjusted", by: "Mariana Gonzalez", at: "Sep 24, 2023, 9:15 AM" },
  { action: "Adjusted", by: "William Denver", at: "Sep 23, 2023, 3:15 PM" },
  {
    text: "Worker showed up without equipment marked mandatory for the job",
    action: "Marked absent",
    by: "Daniella Patrick",
    at: "Sep 24, 2023, 9:15 AM",
  },
];
const WARNING_NOTES: Note[] = [
  NOTES[0],
  {
    text: "Couldn't find the floor manager in time to get the check-in code.",
    action: "Adjusted",
    by: "William Denver",
    at: "Sep 23, 2023, 3:15 PM",
  },
];

/** Notes & History, in the room it takes open, so opening and closing it moves nothing. */
const notes = (open: boolean) => (
  <Reserve
    largest={
      <Div tw="w-[37.5rem]">
        {notesAndHistory(NOTES, { defaultOpen: true })}
      </Div>
    }
  >
    <Div tw="w-[37.5rem]">
      {notesAndHistory(NOTES, { defaultOpen: open })}
    </Div>
  </Reserve>
);

export const NOTES_AND_HISTORY = defineStory({
  id: "Notes & History",
  figma: "Molecules/Card Content/Notes & History",
  examples: [
    { render: () => notes(false) },
    {
      title: "State",
      render: () => (
        <Variants>
          {notes(false)}
          {notes(true)}
        </Variants>
      ),
    },
    {
      title: "Context",
      render: () => (
        <Variants>
          {notes(true)}
          <Reserve
            largest={
              <Div tw="w-[37.5rem]">
                {notesAndHistory(WARNING_NOTES, { label: "1 note", context: "warning", defaultOpen: true })}
              </Div>
            }
          >
            <Div tw="w-[37.5rem]">
              {notesAndHistory(WARNING_NOTES, { label: "1 note", context: "warning", defaultOpen: true })}
            </Div>
          </Reserve>
        </Variants>
      ),
    },
  ],
});

const CHECK_IN_TIME = (
  <Field>
    <Field.Label>Check-in Time</Field.Label>
    <TimePicker defaultValue={11} />
    <Field.HintText tone="warning">11 minutes late</Field.HintText>
  </Field>
);

const NEVER_SHOWED_UP = (
  <Div tw="flex flex-col gap-(--sw-gap-xl)">
    <Divider />
    <Div tw="flex items-center justify-between gap-(--sw-gap-md)">
      <Typography variant="body">Worker never showed up for their shift?</Typography>
      <Button size="small" emphasis="secondary" tone="destructive">
        Mark absent
      </Button>
    </Div>
    <Divider />
  </Div>
);

const UNTRACKED = (
  <Field orientation="horizontal">
    <Checkbox defaultChecked />
    <Field.Content>
      <Field.Label>Do not track this action</Field.Label>
      <Field.HintText>This action will not be visible under notes and history on timesheet</Field.HintText>
    </Field.Content>
  </Field>
);

/** Organisms/Overlay/Manual Check-in. */
export const CHECK_IN = (
  <Overlay label="Check in" inline>
    <Overlay.Header>
      <Typography variant="heading">Check in</Typography>
      <Overlay.Close />
    </Overlay.Header>
    <Overlay.Body>
      <Div tw="flex items-start gap-(--sw-gap-xxl)">
        {CHECK_IN_TIME}
        <Div tw="mt-(--sw-margin-3xl) flex h-[2.5rem] flex-auto items-center gap-(--sw-gap-xl)">
          <Divider orientation="vertical" />
          <Div tw="flex flex-auto items-center justify-between">
            <Typography variant="body">Has the worker left?</Typography>
            <Button size="small" emphasis="secondary">
              <CheckOutIcon aria-hidden />
              Check-out
            </Button>
          </Div>
        </Div>
      </Div>
      <Field orientation="horizontal">
        <Checkbox />
        <Field.Label>Excuse late check-in</Field.Label>
      </Field>
      <Field>
        <Field.Label>Notes</Field.Label>
        <TextArea />
      </Field>
      {NEVER_SHOWED_UP}
      {UNTRACKED}
    </Overlay.Body>
    <Overlay.ActionBar>
      <Overlay.Cancel />
      <Overlay.ForwardActions>
        <Button>Check in</Button>
      </Overlay.ForwardActions>
    </Overlay.ActionBar>
  </Overlay>
);

const MANUAL_CHECK_IN = defineStory({
  id: "Manual Check-in",
  figma: "Organisms/Overlay/Manual Check-in",
  examples: [
    { render: () => <Triggered trigger={<Button emphasis="secondary">Check in...</Button>}>{CHECK_IN}</Triggered> },
  ],
});

/** A check-in's notes, the newest first, over a field for another. */
export const CHECK_IN_NOTES = (
  <Overlay label="Notes" inline>
    <Overlay.Header>
      <Typography variant="heading">Notes</Typography>
      <Overlay.Close />
    </Overlay.Header>
    <Div tw="flex flex-col gap-(--sw-gap-md) px-(--sw-padding-xl) py-(--sw-padding-md)">
      <Metadata unread>
        <Typography tag="p" variant="body">
          Worker texted that he&apos;s on his way.
        </Typography>
        <Typography tag="div" variant="metadata" color="subdued">
          By
          <Link>Michael M.</Link>
          • Sep 24, 2023, 9:40 AM
        </Typography>
      </Metadata>
      <Metadata>
        <Typography tag="p" variant="body">
          Tried contacting on cell. No response. Will retry in 15.
        </Typography>
        <Typography tag="div" variant="metadata" color="subdued">
          By
          <Link>Michael M.</Link>
          • Sep 24, 2023, 9:15 AM
        </Typography>
      </Metadata>
    </Div>
    <Divider />
    <Overlay.Body>
      <Field>
        <Field.Label>Notes</Field.Label>
        <TextArea />
      </Field>
    </Overlay.Body>
    <Overlay.ActionBar>
      <Overlay.Cancel />
      <Overlay.ForwardActions>
        <Button>Add note</Button>
      </Overlay.ForwardActions>
    </Overlay.ActionBar>
  </Overlay>
);

const NOTES_OVERLAY = defineStory({
  id: "Notes",
  figma: "Molecules/Overlay/Notes",
  examples: [
    {
      render: () => (
        <Triggered trigger={<Button emphasis="secondary">Notes...</Button>}>
          {CHECK_IN_NOTES}
        </Triggered>
      ),
    },
  ],
});

const MARK_ABSENT = defineStory({
  id: "Mark Absent",
  figma: "Molecules/Overlay/Mark Absent",
  examples: [
    {
      render: () => (
        <Triggered trigger={<Button emphasis="secondary" tone="destructive">Mark absent...</Button>}>
          <Overlay label="Mark absent" inline>
            <Overlay.Header>
              <Typography variant="heading">Mark absent</Typography>
              <Overlay.Close />
            </Overlay.Header>
            <Overlay.Body>
              <Div tw="flex">
                <Link>
                  <ChevronLeftIcon aria-hidden />
                  Back to check-in
                </Link>
              </Div>
              <Field orientation="horizontal">
                <Checkbox />
                <Field.Label>Excuse absence</Field.Label>
              </Field>
              <Field>
                <Field.Label>Notes</Field.Label>
                <TextArea />
              </Field>
              <Div tw="flex flex-col gap-(--sw-gap-sm) rounded-(--sw-radius-xs) bg-(--sw-surface-alert) p-(--sw-padding-md)">
                <Div tw="flex flex-col gap-(--sw-gap-xs)">
                  <Div tw="flex items-center gap-(--sw-gap-xs) px-(--sw-padding-xxs) text-(--sw-glyph-alert)">
                    <WarningIcon aria-hidden />
                    <Typography variant="bodyStrong">Danger zone</Typography>
                  </Div>
                  <Divider tone="alert" />
                </Div>
                <Field orientation="horizontal">
                  <Checkbox />
                  <Field.Content>
                    <Field.Label>Block this worker</Field.Label>
                    <Field.HintText>This worker will be removed and prevented from applying to all future shifts at your company.</Field.HintText>
                  </Field.Content>
                </Field>
              </Div>
              <Div tw="flex flex-col gap-(--sw-gap-xl)">
                <Divider />
                {UNTRACKED}
              </Div>
            </Overlay.Body>
            <Overlay.ActionBar>
              <Overlay.Cancel />
              <Overlay.ForwardActions>
                <Button tone="destructive">Mark absent</Button>
              </Overlay.ForwardActions>
            </Overlay.ActionBar>
          </Overlay>
        </Triggered>
      ),
    },
  ],
});

// A worker's card, read from their record; it floats on an overlay's surface.
export const PROFILE_OVERVIEW_CARD = defineStory({
  id: "Profile Overview Card",
  figma: "Molecules/Overlay/Profile Overview Card",
  examples: [
    {
      render: () => (
        <Div tw="rounded-(--sw-radius-md) bg-(--sw-surface-default) shadow-(--sw-overlay-shadow)">
          {datum(PEOPLE.angel, "worker", (worker) => (
            <ProfileCard>
              <ProfileCard.Header>
                <Avatar src={worker.face} />
                <Typography variant="heading">{worker.name}</Typography>
                <Spotscore tier={worker.profile.tier.toLowerCase() as Lowercase<Tier>}>
                  {worker.profile.score}
                </Spotscore>
                <Chip size="small" state="affirmative">{worker.profile.pool}</Chip>
              </ProfileCard.Header>
              <ProfileCard.Details>
                <LabelValuePair>
                  <Typography variant="metadata" color="subdued">Phone Number</Typography>
                  <Typography variant="body">{worker.profile.phone}</Typography>
                </LabelValuePair>
                <Div tw="flex flex-col items-start">
                  <LabelValuePair>
                    <Typography variant="metadata" color="subdued">Location</Typography>
                    <Typography variant="body">{worker.profile.location}</Typography>
                  </LabelValuePair>
                  <Link>View location</Link>
                </Div>
                <LabelValuePair>
                  <Typography variant="metadata" color="subdued">Total Shifts Completed</Typography>
                  <Typography variant="body">{worker.profile.shifts}</Typography>
                </LabelValuePair>
              </ProfileCard.Details>
              <Button emphasis="tertiary">
                View complete profile
                <OpenSeparatelyIcon aria-hidden />
              </Button>
            </ProfileCard>
          ))}
        </Div>
      ),
    },
  ],
});

type Hours = [start: string, end: string, unpaidBreak: string, billed: string];

/** A card's hours as its four Label-value Pairs, the first with its time difference, if any. */
const pairs = ([start, end]: [string, string], values: Hours, difference?: string, billed = "Billable Duration") => [
  <LabelValuePair key="start">
    <Typography variant="metadata" color="subdued">{start}</Typography>
    <Typography variant="body">{values[0]}</Typography>
    {difference && <Chip size="small" state="warning">{difference}</Chip>}
  </LabelValuePair>,
  <LabelValuePair key="end">
    <Typography variant="metadata" color="subdued">{end}</Typography>
    <Typography variant="body">{values[1]}</Typography>
  </LabelValuePair>,
  <LabelValuePair key="break">
    <Typography variant="metadata" color="subdued">Unpaid Break</Typography>
    <Typography variant="body">{values[2]}</Typography>
  </LabelValuePair>,
  <LabelValuePair key="billed">
    <Typography variant="metadata" color="subdued">{billed}</Typography>
    <Typography variant="body">{values[3]}</Typography>
  </LabelValuePair>,
];

const SHIFT_TIMES: [string, string] = ["Shift Start Time", "Shift End Time"];
const ADJUSTED_TIMES: [string, string] = ["Adjusted Start Time", "Adjusted End Time"];
const SHIFT_HOURS: Hours = ["12:00 AM", "8:00 AM", "30 Minutes", "7 Hours 30 Minutes"];

// The worker's own note on the hours they submitted.
const SUBMITTED_NOTE: Note[] = [
  {
    text: "Couldn't find the floor manager in time to get the check-in code.",
    action: "Submitted",
    by: "Shonda Williams",
    at: "Sep 23, 2023, 3:15 PM",
  },
];

// In the timecard overlay's body, as wide as it is inside its padding.
export const WORKER_HOURS_DIALOG = defineStory({
  id: "Worker Hours Dialog",
  figma: "Molecules/Dialog/Worker Submitted Hours",
  examples: [
    {
      render: () => (
        <Div tw="w-[42.25rem]">
          <WorkerHoursDialog label="Approve worker submitted hours?">
            <AlertIcon aria-hidden />
            <WorkerHoursDialog.Content>
              <Typography tag="h2" variant="heading">
                Approve worker submitted hours?
              </Typography>
              <Typography tag="p" variant="body">
                The worker submitted the following adjusted hours for this shift:
              </Typography>
              <WorkerHoursDialog.Hours>{pairs(SHIFT_TIMES, SHIFT_HOURS, undefined, "Shift Duration")}</WorkerHoursDialog.Hours>
              {notesAndHistory(SUBMITTED_NOTE, { label: "1 note", context: "warning", defaultOpen: true, divider: true })}
            </WorkerHoursDialog.Content>
            <Dialog.ActionBar>
              <Button emphasis="tertiary" tone="warning">
                Reject hours
              </Button>
              <Dialog.ForwardActions>
                <Button emphasis="tertiary" tone="warning">
                  Adjust hours...
                </Button>
                <Button emphasis="secondary" tone="warning">
                  Approve hours
                </Button>
              </Dialog.ForwardActions>
            </Dialog.ActionBar>
          </WorkerHoursDialog>
        </Div>
      ),
    },
  ],
});

// The Overlay page's confirmations (22552:57291, 22552:62864, 25131:35941): what a change to a repeating shift reaches,
// asked before it's made, as one Confirmation Dialog.
const EDIT_REPEATING_SHIFT = (
  <Dialog label="Editing repeating shift" inline>
    <Dialog.Header>
      <Typography variant="heading">Editing repeating shift</Typography>
    </Dialog.Header>
    <Dialog.Body>
      <Typography tag="p" variant="body">
        This is a recurring series of shifts. What would you like to edit?
      </Typography>
      <RadioGroup aria-label="What would you like to edit?" defaultValue="this">
        <Field orientation="horizontal">
          <RadioButton value="this" />
          <Field.Label>This shift only (September 24, 2025)</Field.Label>
        </Field>
        <Field orientation="horizontal">
          <RadioButton value="all" />
          <Field.Label>All 30 upcoming shifts</Field.Label>
        </Field>
      </RadioGroup>
    </Dialog.Body>
    <Dialog.ActionBar>
      <Dialog.Cancel />
      <Dialog.ForwardActions>
        <Button>Edit</Button>
      </Dialog.ForwardActions>
    </Dialog.ActionBar>
  </Dialog>
);

const DELETE_REPEATING_SHIFT = (
  <Dialog label="Deleting repeating shift" inline>
    <Dialog.Header>
      <Typography variant="heading">Deleting repeating shift</Typography>
    </Dialog.Header>
    <Dialog.Body>
      <Typography tag="p" variant="body">
        This is a recurring series of shifts. What would you like to delete?
      </Typography>
      <RadioGroup aria-label="What would you like to delete?" defaultValue="this">
        <Field orientation="horizontal">
          <RadioButton value="this" />
          <Field.Label>This shift only (September 24, 2025)</Field.Label>
        </Field>
        <Field orientation="horizontal">
          <RadioButton value="all" />
          <Field.Label>All 30 upcoming shifts</Field.Label>
        </Field>
      </RadioGroup>
    </Dialog.Body>
    <Dialog.ActionBar>
      <Dialog.Cancel />
      <Dialog.ForwardActions>
        <Button tone="destructive">Delete</Button>
      </Dialog.ForwardActions>
    </Dialog.ActionBar>
  </Dialog>
);

// Figma's second Delete Repeating Shift Dialog, named by its title.
const DELETE_SERIES = (
  <Dialog label="Deleting series of shifts" inline>
    <Dialog.Header>
      <Typography variant="heading">Deleting series of shifts</Typography>
    </Dialog.Header>
    <Dialog.Body>
      <Typography tag="p" variant="body">
        This will cancel all upcoming shifts in this series and withdraw any sent or accepted offers. This action
        cannot be undone. Are you sure you want to continue?
      </Typography>
      <Field orientation="horizontal">
        <Checkbox />
        <Field.Label>Also delete all edited shifts in this series</Field.Label>
      </Field>
    </Dialog.Body>
    <Dialog.ActionBar>
      <Dialog.Cancel />
      <Dialog.ForwardActions>
        <Button tone="destructive">Delete all shifts</Button>
      </Dialog.ForwardActions>
    </Dialog.ActionBar>
  </Dialog>
);

const EDIT_TRIGGER = <Button emphasis="secondary">Edit repeating shift...</Button>;

export const CONFIRMATION_DIALOG = defineStory({
  id: "Confirmation Dialog",
  figma: "Edit Repeating Shift Dialog",
  examples: [
    { render: () => <Triggered trigger={EDIT_TRIGGER}>{EDIT_REPEATING_SHIFT}</Triggered> },
    {
      title: "Delete repeating shift",
      render: () => (
        <Triggered trigger={<Button emphasis="secondary" tone="destructive">Delete repeating shift...</Button>}>
          {DELETE_REPEATING_SHIFT}
        </Triggered>
      ),
    },
    {
      title: "Delete series of shifts",
      render: () => (
        <Triggered trigger={<Button emphasis="secondary" tone="destructive">Delete series of shifts...</Button>}>
          {DELETE_SERIES}
        </Triggered>
      ),
    },
  ],
});

const CARD_NOTES = notesAndHistory(NOTES, { divider: true });
const POSTED = pairs(SHIFT_TIMES, SHIFT_HOURS);
const CHECKED = pairs(["Check-in Time", "Check-out Time"], ["11:47 PM", "8:00 AM", "30 Minutes", "7 Hours 43 Minutes"], "-13m (-1 Day)");
const ADJUSTED = pairs(ADJUSTED_TIMES, ["12:15 AM", "7:50 AM", "30 Minutes", "7 Hours 05 Minutes"]);
const ABSENT = pairs(ADJUSTED_TIMES, ["-", "-", "-", "0 Hours 00 Minutes"]);

// In progress, the hours the adjustment or the absence starts from, with their notes.
const SUBMITTED = (
  <ReferenceHours>
    <Typography variant="body">Worker Submitted Hours</Typography>
    {pairs(SHIFT_TIMES, SHIFT_HOURS)}
    {notesAndHistory(SUBMITTED_NOTE, { label: "1 note", context: "warning", divider: true })}
  </ReferenceHours>
);

// The hours the adjustment's pickers start from, as Figma's In Progress card shows them.
const ADJUSTING = { start: 9 * 60, end: 17 * 60, unpaidBreak: 30 };

/** A card, or a card being filled in, at Figma's width. */
const sized = (card: ReactNode) => <Div tw="w-[42.25rem]">{card}</Div>;

/** The Posted Hours card, picked, its notes shut or, with `notesOpen`, open. */
export const postedHoursCard = (notesOpen?: boolean) =>
  sized(
    <BillableDurationCard defaultSelected>
      <SourcePill source="posted" />
      <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
      <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
      {POSTED}
      {notesOpen ? notesAndHistory(NOTES, { divider: true, defaultOpen: true }) : CARD_NOTES}
    </BillableDurationCard>,
  );

/** One of Figma's Time Categories, a card in each of the States it draws it in. */
const category = (title: string, render: () => ReactNode): Example => ({ title, render });

export const BILLABLE_DURATION_CARD = defineStory({
  id: "Billable Duration Card",
  figma: "Molecules/Overlay/Timesheet/Billable Duration Card",
  examples: [
    { render: () => postedHoursCard() },
    category("Posted Hours", () => (
      <Variants>
        {postedHoursCard()}
        {sized(
          <BillableDurationCard>
            <SourcePill source="posted" />
            <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
            <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
            {POSTED}
            {CARD_NOTES}
          </BillableDurationCard>,
        )}
      </Variants>
    )),
    category("Checked In/Out", () => (
      <Variants>
        {sized(
          <BillableDurationCard defaultSelected>
            <SourcePill source="checked" />
            <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
            <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
            {CHECKED}
            {CARD_NOTES}
          </BillableDurationCard>,
        )}
        {sized(
          <BillableDurationCard>
            <SourcePill source="checked" />
            <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
            <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
            {CHECKED}
            {CARD_NOTES}
          </BillableDurationCard>,
        )}
      </Variants>
    )),
    category("Auto-checked Out", () => (
      <Variants>
        {sized(
          <BillableDurationCard defaultSelected>
            <SourcePill source="checked" tone="warning">
              Auto-checked Out
            </SourcePill>
            {CHECKED}
            {CARD_NOTES}
          </BillableDurationCard>,
        )}
        {sized(
          <BillableDurationCard>
            <SourcePill source="checked" tone="warning">
              Auto-checked Out
            </SourcePill>
            {CHECKED}
            {CARD_NOTES}
          </BillableDurationCard>,
        )}
      </Variants>
    )),
    category("Worker Submitted", () => (
      <Variants>
        {sized(
          <BillableDurationCard defaultSelected>
            <SourcePill source="submitted" />
            <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
            <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
            {POSTED}
            {CARD_NOTES}
          </BillableDurationCard>,
        )}
        {sized(
          <BillableDurationCard>
            <SourcePill source="submitted" tone="warning" />
            <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
            <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
            {POSTED}
            {CARD_NOTES}
          </BillableDurationCard>,
        )}
      </Variants>
    )),
    category("Adjusted Hours", () => (
      <Variants>
        {sized(
          <TimecardForm label="Adjusted Hours" from={ADJUSTING}>
            <TimecardForm.Head>
              <SourcePill source="adjusted" />
              <Button size="small" emphasis="secondary" tone="destructive">
                Mark absent
              </Button>
            </TimecardForm.Head>
            {SUBMITTED}
            {ADJUST_FIELDS}
            <TimecardForm.Footer>
              <Button emphasis="tertiary">Cancel</Button>
              <TimecardForm.ForwardActions>
                <LabelValuePair>
                  <Typography variant="metadata" color="subdued">
                    Adjusted Billable Duration
                  </Typography>
                  <Typography variant="body">
                    <TimecardForm.Billed />
                  </Typography>
                </LabelValuePair>
                <TimecardForm.Submit emphasis="secondary">Adjust hours</TimecardForm.Submit>
              </TimecardForm.ForwardActions>
            </TimecardForm.Footer>
          </TimecardForm>,
        )}
        {sized(
          <BillableDurationCard defaultSelected>
            <SourcePill source="adjusted" />
            <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
            <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
            {ADJUSTED}
            {CARD_NOTES}
          </BillableDurationCard>,
        )}
        {sized(
          <BillableDurationCard defaultSelected confirmed>
            <SourcePill source="adjusted" />
            <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
            <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
            {ADJUSTED}
            {CARD_NOTES}
          </BillableDurationCard>,
        )}
      </Variants>
    )),
    category("Absent", () => (
      <Variants>
        {sized(
          <TimecardForm label="Absent">
            <TimecardForm.Head>
              <SourcePill source="absent" />
              <Button size="small" emphasis="secondary">
                Add adjusted hours
              </Button>
            </TimecardForm.Head>
            {SUBMITTED}
            <Field>
              <Field.Label>Note</Field.Label>
              <TimecardForm.Note size="medium" />
            </Field>
            <Field orientation="horizontal">
              <Checkbox />
              <Field.Label>Add note to worker&apos;s profile</Field.Label>
            </Field>
            <TimecardForm.Footer>
              <Button emphasis="tertiary">Cancel</Button>
              <TimecardForm.ForwardActions>
                <LabelValuePair>
                  <Typography variant="metadata" color="subdued">
                    Adjusted Billable Duration
                  </Typography>
                  <Typography variant="body">0 Hours 00 Minutes</Typography>
                </LabelValuePair>
                <TimecardForm.Submit emphasis="secondary" tone="destructive">
                  Mark absent
                </TimecardForm.Submit>
              </TimecardForm.ForwardActions>
            </TimecardForm.Footer>
          </TimecardForm>,
        )}
        {sized(
          <BillableDurationCard defaultSelected>
            <SourcePill source="absent" />
            <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
            <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
            {ABSENT}
            {CARD_NOTES}
          </BillableDurationCard>,
        )}
        {sized(
          <BillableDurationCard>
            <SourcePill source="absent" />
            <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
            <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
            {ABSENT}
            {CARD_NOTES}
          </BillableDurationCard>,
        )}
      </Variants>
    )),
  ],
});

/** A worker's day with what's booked on it, in a row of its own. */
const applicantSelector = (booking: Booking, past?: boolean, selected?: boolean) =>
  alone(
    "5.25rem",
    <ApplicantSelector booking={booking} past={past} selected={selected}>
      {bookingParts(booking)}
    </ApplicantSelector>,
  );

// As the Shift Planner draws a worker's day: nothing booked, each booking, a day gone, grey whatever it holds, and one
// selected.
export const APPLICANT_SELECTOR = defineStory({
  id: "Applicant Selector",
  figma: "Overlay/Shift Planner/Applicant Selector",
  examples: [
    { render: () => applicantSelector("offered") },
    {
      title: "State",
      render: () => (
        <Variants>
          {applicantSelector(null)}
          {applicantSelector("offered")}
          {applicantSelector("waitlisted")}
          {applicantSelector("booked")}
          {applicantSelector("cancelled")}
          {applicantSelector("booked", true)}
        </Variants>
      ),
    },
    {
      title: "Is selected",
      render: () => (
        <Variants>
          {applicantSelector("offered")}
          {applicantSelector("offered", false, true)}
        </Variants>
      ),
    },
  ],
});

// The Check-ins dashboard's late check-in, as its side sheet heads it.
const LATE = rowsFor(AUTHORED_NOW).today.find((row) => row.status === "lateCheckIn")!;

const SMALL_SHEET = datum(LATE, "row", (row) => (
  <SideSheet size="small" label={row.worker.name} inline>
    <SideSheet.Header>
      <Typography variant="heading">{row.worker.name}</Typography>
      <SideSheet.Close />
      <Typography variant="metadata" color="subdued">
        {row.position}
      </Typography>
    </SideSheet.Header>
    <Div tw="flex flex-col gap-(--sw-gap-xl) px-(--sw-padding-xl) py-(--sw-padding-xxl)">
      <Card>
        <Card.Header>
          <Card.Content>
            <Typography tag="h3" variant="heading">
              Check-in status
            </Typography>
          </Card.Content>
        </Card.Header>
        <Div tw="flex items-center gap-(--sw-gap-md)">
          <Pill {...STATUS_PILL.lateCheckIn}>
            <ArriveIcon aria-hidden />
            Late Check-In
          </Pill>
          <Typography variant="body">{`${clock(LATE.checkIn!)}–In progress (${LATE.zone})`}</Typography>
        </Div>
      </Card>
    </Div>
  </SideSheet>
));

const LARGE_SHEET = datum(TEMPLATES[0], "template", (template) => (
  <SideSheet size="large" label={template.name} inline>
    <SideSheet.Header>
      <Typography variant="heading">{template.name}</Typography>
      <SideSheet.SheetActions>
        <Button size="small" emphasis="secondary">
          Edit schedule...
        </Button>
      </SideSheet.SheetActions>
      <SideSheet.Close />
      <Typography variant="metadata" color="subdued">
        Day Shift M/W/F
      </Typography>
    </SideSheet.Header>
    <SideSheet.Body>
      <LabelValuePair>
        <Typography variant="metadata" color="subdued">
          Template Title
        </Typography>
        <Typography variant="body">{template.name}</Typography>
      </LabelValuePair>
      <LabelValuePair>
        <Typography variant="metadata" color="subdued">
          Tags
        </Typography>
        <Tags tags={template.tags} />
      </LabelValuePair>
    </SideSheet.Body>
  </SideSheet>
));

// Small, the Check-ins dashboard's worker; Large, a shift's or a template's, as wide as the 1216 frame.
const SIDE_SHEET = defineStory({
  id: "Side Sheet",
  figma: "Organisms/Overlay/Side Sheet",
  examples: [
    { render: () => SMALL_SHEET },
    {
      title: "Size",
      layout: "scroll",
      render: () => (
        <Div tw="flex flex-col items-start gap-(--sw-gap-3xl)">
          {SMALL_SHEET}
          {LARGE_SHEET}
        </Div>
      ),
    },
  ],
});

export const OVERLAY_STORIES: Story[] = [
  OVERLAY_HEADER,
  ACTION_BAR,
  MANUAL_CHECK_IN,
  NOTES_OVERLAY,
  MARK_ABSENT,
  SIDE_SHEET,
];
