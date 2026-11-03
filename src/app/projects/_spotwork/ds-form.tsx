"use client";

import type { ComponentProps, ReactNode } from "react";
import { PHONES } from "./dashboard-overlays";
import { DAY, PEOPLE } from "./data";
import { Avatar } from "./data-table";
import { Dropdown, ListItem } from "./dropdown";
import { BulkSelect } from "./filters";
import { PopoverMenu } from "./navigation";
import { datum, each } from "./ds-code";
import { FORM_MORE_STORIES } from "./ds-form-more";
import { Variants, defineStory } from "./ds-story";
import { Div } from "./ds-tailwind";
import { Multiselect } from "./multiselect";
import { FormNav, STEPS } from "./new-shift";
import { PILL } from "./choices-field";
import { CHOICES, keyOf, tagsOf } from "./presets";
import { Calendar, CalendarStrip, DatePicker } from "./shift-calendar";
import { TEMPLATES, weekOf } from "./shifts";
import { TagsField } from "./tags-field";
import { TimePicker } from "./time-picker";
import { Search, TypeAhead } from "./search";
import { Sidebar } from "./sidebar";
import { Badge, Checkbox, Chip, Field, Pill, RadioButton, SegmentedControl, Stepper, Switch, TextArea, TextInput, Typography, type Tone, type TypographyVariant } from "./ui";
import AlertIcon from "./assets/icons/small/alert.svg";
import SuccessIcon from "./assets/icons/small/success.svg";
import MenuNotesIcon from "./assets/menu-notes.svg";
import ClockIcon from "./assets/icons/medium/clock.svg";
import CheckInIcon from "./assets/icons/medium/check-in.svg";
import ShiftsIcon from "./assets/icons/medium/shifts.svg";
import KebabIcon from "./assets/icons/medium/kebab-menu.svg";
import MenuPinIcon from "./assets/menu-pin.svg";
import ChevronLeftIcon from "./assets/icons/medium/chevron-left.svg";
import ChevronRightIcon from "./assets/icons/medium/chevron-right.svg";

// SW Curie's Form page (392:354): its components by Figma's properties, drawn with the app's own form parts and
// Figma's placeholder words.

const TODAY = "2023-11-10";
const FIRST = "2023-11-01";
const PICKED = "2023-11-12";
// A shift on weekdays for two weeks.
const SCHEDULED = ["06", "07", "08", "09", "10", "13", "14", "15", "16", "17"].map((day) => `2023-11-${day}`);
// Figma's filter's range, November 12 to December 6, 2023.
const RANGE = { start: PICKED, end: "2023-12-06" };

// Workers to look up, as the Check-ins page knows them: a face, a name and a phone number.
const WORKERS = Object.values(PEOPLE).slice(0, 6);

/** Atoms/Form/Checkbox, or Atoms/Form/Radio Button: its states, each shown picked, and its sizes. */
function choiceStory(radio: boolean) {
  const name = radio ? "Radio Button" : "Checkbox";
  const Choice = radio ? RadioButton : Checkbox;
  // The New Shift form's Temp to hire, or the Editing Repeating Shift dialog's first reach.
  const label = radio ? "This shift only (September 24, 2025)" : "Temp to hire";
  const hint = !radio && <Field.HintText>This indicates that you are looking to hire workers full-time</Field.HintText>;
  return defineStory({
    id: name,
    figma: `Atoms/Form/${name}`,
    examples: [
      {
        render: () => (
          <Field orientation="horizontal">
            <Choice defaultChecked />
            <Field.Content>
              <Field.Label>{label}</Field.Label>
              {hint}
            </Field.Content>
          </Field>
        ),
      },
      {
        title: "State",
        render: () => (
          <Variants>
            <Field orientation="horizontal">
              <Choice defaultChecked />
              <Field.Content>
                <Field.Label>{label}</Field.Label>
                {hint}
              </Field.Content>
            </Field>
            <Field orientation="horizontal">
              <Choice defaultChecked disabled />
              <Field.Content>
                <Field.Label>{label}</Field.Label>
                {hint}
              </Field.Content>
            </Field>
            <Field orientation="horizontal" tone="warning">
              <Choice defaultChecked />
              <Field.Content>
                <Field.Label>{label}</Field.Label>
                {hint}
              </Field.Content>
            </Field>
            <Field orientation="horizontal" tone="alert">
              <Choice defaultChecked />
              <Field.Content>
                <Field.Label>{label}</Field.Label>
                {hint}
              </Field.Content>
            </Field>
          </Variants>
        ),
      },
      {
        // Small is Atoms/Filter/Checkbox, or the round Atoms/Filter/Radio Switch.
        title: "Size",
        render: () => (
          <Variants>
            <Field orientation="horizontal">
              <Choice defaultChecked />
              <Field.Label>{label}</Field.Label>
            </Field>
            <Field orientation="horizontal">
              <Choice defaultChecked size="small" />
              <Field.Label>{label}</Field.Label>
            </Field>
          </Variants>
        ),
      },
    ],
  });
}

// Figma's field width, which a field fills; held open, with room under it for what it opens.
const fieldWidth = "w-[21.25rem]";
const openField = "w-[21.25rem] pb-[15rem]";
// A type-ahead's list runs to 300.
const openSearch = "w-[21.25rem] pb-[18.75rem]";

const SWITCH = defineStory({
  id: "Switch",
  figma: "Atoms/Form/Switch",
  examples: [
    {
      render: () => (
        <Div tw={fieldWidth}>
          <Field orientation="horizontal">
            <Switch defaultChecked />
            <Field.Content>
              <Field.Label>This is an off-site role</Field.Label>
              <Field.HintText>Off-site roles are roles where the worker is required to leave the job-site during their shift, for example, driving or driver&apos;s assistant roles</Field.HintText>
            </Field.Content>
          </Field>
        </Div>
      ),
    },
    {
      title: "Is disabled",
      render: () => (
        <Variants>
          <Div tw={fieldWidth}>
            <Field orientation="horizontal">
              <Switch defaultChecked />
              <Field.Content>
                <Field.Label>This is an off-site role</Field.Label>
                <Field.HintText>Off-site roles are roles where the worker is required to leave the job-site during their shift, for example, driving or driver&apos;s assistant roles</Field.HintText>
              </Field.Content>
            </Field>
          </Div>
          <Div tw={fieldWidth}>
            <Field orientation="horizontal">
              <Switch defaultChecked disabled />
              <Field.Content>
                <Field.Label>This is an off-site role</Field.Label>
                <Field.HintText>Off-site roles are roles where the worker is required to leave the job-site during their shift, for example, driving or driver&apos;s assistant roles</Field.HintText>
              </Field.Content>
            </Field>
          </Div>
        </Variants>
      ),
    },
    {
      // Small is Atoms/Filter/Switch.
      title: "Size",
      render: () => (
        <Variants>
          <Div tw={fieldWidth}>
            <Field orientation="horizontal">
              <Switch defaultChecked />
              <Field.Label>This is an off-site role</Field.Label>
            </Field>
          </Div>
          <Div tw={fieldWidth}>
            <Field orientation="horizontal">
              <Switch defaultChecked size="small" />
              <Field.Label>This is an off-site role</Field.Label>
            </Field>
          </Div>
        </Variants>
      ),
    },
  ],
});

const TEXT_INPUT = defineStory({
  id: "Text Input",
  figma: "Molecules/Form/Text Input",
  examples: [
    {
      render: () => (
        <Div tw={fieldWidth}>
          <Field>
            <Field.Label>Report To</Field.Label>
            <TextInput defaultValue="Yousuf Hamedani" />
            <Field.HintText>This is who the workers would report to when they arrive on the site</Field.HintText>
          </Field>
        </Div>
      ),
    },
    {
      title: "State",
      render: () => (
        <Variants>
          <Div tw={fieldWidth}>
            <Field>
              <Field.Label>Report To</Field.Label>
              <TextInput defaultValue="Yousuf Hamedani" />
              <Field.HintText>This is who the workers would report to when they arrive on the site</Field.HintText>
            </Field>
          </Div>
          <Div tw={fieldWidth}>
            <Field tone="alert">
              <Field.Label>Report To</Field.Label>
              <TextInput defaultValue="Yousuf Hamedani" />
              <Field.HintText>This is who the workers would report to when they arrive on the site</Field.HintText>
            </Field>
          </Div>
          <Div tw={fieldWidth}>
            <Field tone="warning">
              <Field.Label>Report To</Field.Label>
              <TextInput defaultValue="Yousuf Hamedani" />
              <Field.HintText>This is who the workers would report to when they arrive on the site</Field.HintText>
            </Field>
          </Div>
          <Div tw={fieldWidth}>
            <Field disabled>
              <Field.Label>Report To</Field.Label>
              <TextInput defaultValue="Yousuf Hamedani" />
              <Field.HintText>This is who the workers would report to when they arrive on the site</Field.HintText>
            </Field>
          </Div>
        </Variants>
      ),
    },
    {
      // Figma's Has Prefix and Has Suffix: the unit the value is typed in.
      title: "Prefix & suffix",
      render: () => (
        <Variants>
          <Div tw="w-[8.75rem]">
            <Field>
              <Field.Label>Hourly Wage</Field.Label>
              <TextInput defaultValue="23.00">
                <TextInput.Prefix>CAD</TextInput.Prefix>
              </TextInput>
              <Field.HintText>Minimum hourly wage: CAD 23.00</Field.HintText>
            </Field>
          </Div>
          <Div tw="w-[8.75rem]">
            <Field>
              <Field.Label>Range</Field.Label>
              <TextInput defaultValue="5">
                <TextInput.Suffix>km</TextInput.Suffix>
              </TextInput>
            </Field>
          </Div>
        </Variants>
      ),
    },
    {
      // Small, Figma's Inline Input: a table cell's or a filter's.
      title: "Size",
      render: () => (
        <Variants>
          <Div tw={fieldWidth}>
            <Field>
              <Field.Label>Report To</Field.Label>
              <TextInput defaultValue="Yousuf Hamedani" />
            </Field>
          </Div>
          <TextInput size="small" defaultValue="1.9" />
        </Variants>
      ),
    },
  ],
});

const TEXT_AREA = defineStory({
  id: "Text Area",
  figma: "Molecules/Form/Text Area",
  examples: [
    {
      render: () => (
        <Div tw={fieldWidth}>
          <Field>
            <Field.Label>Note</Field.Label>
            <TextArea defaultValue="Tried contacting on cell. No response. Will retry in 15." />
          </Field>
        </Div>
      ),
    },
    {
      title: "State",
      render: () => (
        <Variants>
          <Div tw={fieldWidth}>
            <Field>
              <Field.Label>Note</Field.Label>
              <TextArea defaultValue="Tried contacting on cell. No response. Will retry in 15." />
            </Field>
          </Div>
          <Div tw={fieldWidth}>
            <Field tone="alert">
              <Field.Label>Note</Field.Label>
              <TextArea defaultValue="Tried contacting on cell. No response. Will retry in 15." />
            </Field>
          </Div>
          <Div tw={fieldWidth}>
            <Field tone="warning">
              <Field.Label>Note</Field.Label>
              <TextArea defaultValue="Tried contacting on cell. No response. Will retry in 15." />
            </Field>
          </Div>
          <Div tw={fieldWidth}>
            <Field disabled>
              <Field.Label>Note</Field.Label>
              <TextArea defaultValue="Tried contacting on cell. No response. Will retry in 15." />
            </Field>
          </Div>
        </Variants>
      ),
    },
    {
      title: "Is resizable",
      render: () => (
        <Variants>
          <Div tw={fieldWidth}>
            <Field>
              <Field.Label>Note</Field.Label>
              <TextArea defaultValue="Tried contacting on cell. No response. Will retry in 15." />
            </Field>
          </Div>
          <Div tw={fieldWidth}>
            <Field>
              <Field.Label>Note</Field.Label>
              <TextArea fixed defaultValue="Tried contacting on cell. No response. Will retry in 15." />
            </Field>
          </Div>
        </Variants>
      ),
    },
  ],
});

// Figma's statuses, each tinted, after its letter badge or icon: the check-ins filter's.
const STATUSES: { value: string; label: string; tone: Tone; icon: ReactNode }[] = [
  { value: "upcoming", label: "Upcoming", tone: "disabled", icon: <Badge state="disabled">U</Badge> },
  { value: "posted", label: "Posted Hours", tone: "active", icon: <Badge state="active">P</Badge> },
  { value: "checked", label: "Checked In/Out", tone: "active", icon: <Badge state="active">C</Badge> },
  { value: "flagged", label: "Worker Submitted", tone: "warning", icon: <Badge state="warning">S</Badge> },
  { value: "submitted", label: "Worker Submitted", tone: "active", icon: <Badge state="active">S</Badge> },
  { value: "adjusted", label: "Adjusted Hours", tone: "active", icon: <Badge state="active">A</Badge> },
  { value: "absent", label: "Absent", tone: "alert", icon: <AlertIcon aria-hidden /> },
  { value: "confirmed", label: "Confirmed", tone: "success", icon: <SuccessIcon aria-hidden /> },
];

const statusItems = () =>
  STATUSES.map((status) => (
    <Dropdown.Item key={status.value} value={status.value} tone={status.tone}>
      <Typography variant="metadata">
        {status.icon}
        {status.label}
      </Typography>
    </Dropdown.Item>
  ));

// Send Message's sending numbers.
const dropdownItems = (variant: TypographyVariant = "bodyLarge") =>
  PHONES.map((phone) => (
    <Dropdown.Item key={phone} value={phone}>
      <Typography variant={variant}>{phone}</Typography>
    </Dropdown.Item>
  ));

const DROPDOWN = defineStory({
  id: "Dropdown",
  figma: "Molecules/Form/Dropdown",
  examples: [
    {
      render: () => (
        <Div tw={fieldWidth}>
          <Field>
            <Field.Label>Sending Phone Number</Field.Label>
            <Dropdown defaultValue={PHONES[0]}>{dropdownItems()}</Dropdown>
          </Field>
        </Div>
      ),
    },
    {
      title: "State",
      render: () => (
        <Variants>
          <Div tw={fieldWidth}>
            <Field>
              <Field.Label>Sending Phone Number</Field.Label>
              <Dropdown defaultValue={PHONES[0]}>{dropdownItems()}</Dropdown>
            </Field>
          </Div>
          <Div tw={fieldWidth}>
            <Field tone="alert">
              <Field.Label>Sending Phone Number</Field.Label>
              <Dropdown defaultValue={PHONES[0]}>{dropdownItems()}</Dropdown>
            </Field>
          </Div>
          <Div tw={fieldWidth}>
            <Field tone="warning">
              <Field.Label>Sending Phone Number</Field.Label>
              <Dropdown defaultValue={PHONES[0]}>{dropdownItems()}</Dropdown>
            </Field>
          </Div>
          <Div tw={fieldWidth}>
            <Field disabled>
              <Field.Label>Sending Phone Number</Field.Label>
              <Dropdown defaultValue={PHONES[0]}>{dropdownItems()}</Dropdown>
            </Field>
          </Div>
          <Div tw={openField}>
            <Field>
              <Field.Label>Sending Phone Number</Field.Label>
              <Dropdown defaultValue={PHONES[0]} defaultOpen>{dropdownItems()}</Dropdown>
            </Field>
          </Div>
        </Variants>
      ),
    },
    {
      // Small, a filter's or a table cell's.
      title: "Size",
      render: () => (
        <Variants>
          <Div tw={fieldWidth}>
            <Field>
              <Field.Label>Sending Phone Number</Field.Label>
              <Dropdown defaultValue={PHONES[0]}>{dropdownItems()}</Dropdown>
            </Field>
          </Div>
          <Dropdown size="small" defaultValue={PHONES[0]}>
            {dropdownItems("metadata")}
          </Dropdown>
        </Variants>
      ),
    },
    {
      title: "Multiple",
      render: () => (
        <Div tw="h-[17.5rem]">
          <Dropdown size="small" multiple defaultValue={["posted", "absent"]} defaultOpen>
            <Typography variant="metadata">Status</Typography>
            {statusItems()}
          </Dropdown>
        </Div>
      ),
    },
  ],
});

// Figma's Dropdown List Item, the type-ahead's suggestion, a filter's item and a menu's as one list item: its avatar,
// words and caption slots.
const LIST_ITEM = defineStory({
  id: "List Item",
  figma: "Atoms/Form/Dropdown List Item",
  examples: [
    {
      render: () => (
        <Div tw={fieldWidth}>
          {datum(WORKERS[0], "worker", (worker) => (
            <ListItem>
              <Avatar src={worker.face} size="medium" />
              <Typography variant="bodyLarge">{worker.name}</Typography>
              <Typography variant="metadata" color="subdued">{worker.profile.phone}</Typography>
            </ListItem>
          ))}
        </Div>
      ),
    },
    {
      title: "State",
      render: () => (
        <Variants>
          <Div tw={fieldWidth}>
            <ListItem>
              <Typography variant="bodyLarge">Florida, USA (305) 703-0177</Typography>
            </ListItem>
          </Div>
          <Div tw={fieldWidth}>
            <ListItem data-hover="">
              <Typography variant="bodyLarge">Florida, USA (305) 703-0177</Typography>
            </ListItem>
          </Div>
          <Div tw={fieldWidth}>
            <ListItem defaultSelected>
              <Typography variant="bodyLarge">Florida, USA (305) 703-0177</Typography>
            </ListItem>
          </Div>
        </Variants>
      ),
    },
    {
      // Small is a filter's.
      title: "Size",
      render: () => (
        <Variants>
          <Div tw={fieldWidth}>
            <ListItem>
              <Typography variant="bodyLarge">Florida, USA (305) 703-0177</Typography>
            </ListItem>
          </Div>
          <Div tw={fieldWidth}>
            <ListItem size="small">
              <Typography variant="metadata">CCLS</Typography>
            </ListItem>
          </Div>
        </Variants>
      ),
    },
    {
      group: "Usage",
      title: "Dropdown item",
      render: () => (
        <Div tw={openField}>
          <Field>
            <Field.Label>Sending Phone Number</Field.Label>
            <Dropdown defaultValue={PHONES[0]} defaultOpen>
              {dropdownItems()}
            </Dropdown>
          </Field>
        </Div>
      ),
    },
    {
      group: "Usage",
      title: "Type-ahead item",
      render: () => (
        <Div tw={openSearch}>
          <Field>
            <Field.Label>Find a worker</Field.Label>
            <TypeAhead defaultQuery="Ma" defaultOpen>
              {suggestions()}
            </TypeAhead>
          </Field>
        </Div>
      ),
    },
    {
      group: "Usage",
      title: "Popover menu item",
      render: () => (
        <PopoverMenu.Root defaultOpen>
          <PopoverMenu.Trigger aria-label="More actions">
            <KebabIcon aria-hidden />
          </PopoverMenu.Trigger>
          <PopoverMenu label="More actions">
            <PopoverMenu.Item>
              <MenuNotesIcon aria-hidden />
              <Typography variant="body">Add note</Typography>
            </PopoverMenu.Item>
            <PopoverMenu.Item>
              <MenuPinIcon aria-hidden />
              <Typography variant="body">View location</Typography>
            </PopoverMenu.Item>
          </PopoverMenu>
        </PopoverMenu.Root>
      ),
    },
    {
      group: "Usage",
      title: "Bulk select item",
      render: () => (
        <BulkSelect defaultOpen>
          {["Offered", "Accepted", "Waitlist"].map((option) => (
            <BulkSelect.Item key={option}>
              <Typography variant="metadata">{option}</Typography>
            </BulkSelect.Item>
          ))}
        </BulkSelect>
      ),
    },
    {
      group: "Usage",
      title: "Sidebar item",
      render: () => (
        <Sidebar label="Main" defaultValue="Timesheets">
          <Sidebar.Item value="Check-ins">
            <CheckInIcon aria-hidden />
            <Typography variant="body">Check-ins</Typography>
          </Sidebar.Item>
          <Sidebar.Item value="Shifts">
            <ShiftsIcon aria-hidden />
            <Typography variant="body">Shifts</Typography>
          </Sidebar.Item>
          <Sidebar.Item value="Timesheets">
            <ClockIcon aria-hidden />
            <Typography variant="body">Timesheets</Typography>
          </Sidebar.Item>
        </Sidebar>
      ),
    },
  ],
});

const DATE_PICKER = defineStory({
  id: "Date Picker",
  figma: "Molecules/Form/Date Picker",
  examples: [
    {
      render: () => (
        <Field>
          <Field.Label>Shift Date</Field.Label>
          <DatePicker defaultValue={PICKED} today={TODAY} from={FIRST} />
          <Field.HintText>mm/dd/yyyy</Field.HintText>
        </Field>
      ),
    },
    {
      title: "State",
      render: () => (
        <Variants>
          <Field>
            <Field.Label>Shift Date</Field.Label>
            <DatePicker defaultValue={PICKED} today={TODAY} from={FIRST} />
            <Field.HintText>mm/dd/yyyy</Field.HintText>
          </Field>
          <Field tone="alert">
            <Field.Label>Shift Date</Field.Label>
            <DatePicker defaultValue={PICKED} today={TODAY} from={FIRST} />
            <Field.HintText>mm/dd/yyyy</Field.HintText>
          </Field>
          <Field tone="warning">
            <Field.Label>Shift Date</Field.Label>
            <DatePicker defaultValue={PICKED} today={TODAY} from={FIRST} />
            <Field.HintText>mm/dd/yyyy</Field.HintText>
          </Field>
          <Field disabled>
            <Field.Label>Shift Date</Field.Label>
            <DatePicker defaultValue={PICKED} today={TODAY} from={FIRST} />
            <Field.HintText>mm/dd/yyyy</Field.HintText>
          </Field>
          <Div tw="pb-[21.25rem]">
            <Field>
              <Field.Label>Shift Date</Field.Label>
              <DatePicker defaultValue={PICKED} today={TODAY} from={FIRST} defaultOpen />
              <Field.HintText>mm/dd/yyyy</Field.HintText>
            </Field>
          </Div>
        </Variants>
      ),
    },
    {
      // Small, a filter's or a table cell's.
      title: "Size",
      render: () => (
        <Variants>
          <Field>
            <Field.Label>Shift Date</Field.Label>
            <DatePicker defaultValue={PICKED} today={TODAY} from={FIRST} />
          </Field>
          <DatePicker size="small" defaultValue={PICKED} today={TODAY} from={FIRST} />
        </Variants>
      ),
    },
    {
      // A range, from its presets of the last few days or picked end to end.
      title: "Select",
      render: () => (
        <Variants>
          <DatePicker size="small" defaultValue={PICKED} today={TODAY} from={FIRST} />
          <Div tw="h-[17.5rem]">
            <DatePicker size="small" select="range" defaultValue={RANGE} today={TODAY} defaultOpen>
              <DatePicker.Preset days={7}>
                <Typography variant="metadata">Last 7 days</Typography>
              </DatePicker.Preset>
              <DatePicker.Preset days={14}>
                <Typography variant="metadata">Last 14 days</Typography>
              </DatePicker.Preset>
            </DatePicker>
          </Div>
        </Variants>
      ),
    },
  ],
});

type CalendarProps = Omit<ComponentProps<typeof Calendar>, "today" | "children">;

/** A month in its parts, as the Date Picker opens it. */
const calendar = (props: CalendarProps = {}) => (
  <Calendar defaultPicked={[PICKED]} today={TODAY} from={FIRST} {...props}>
    <Calendar.PeriodList>
      <Calendar.Prev>
        <ChevronLeftIcon aria-hidden />
      </Calendar.Prev>
      <Calendar.Period>
        <Calendar.Month />
        <Calendar.Week>
          <Calendar.Day />
        </Calendar.Week>
        <Calendar.Grid>
          <Calendar.Date />
        </Calendar.Grid>
      </Calendar.Period>
      <Calendar.Next>
        <ChevronRightIcon aria-hidden />
      </Calendar.Next>
    </Calendar.PeriodList>
  </Calendar>
);

const CALENDAR = defineStory({
  id: "Calendar",
  figma: "Atoms/Form/Date Picker View",
  examples: [
    { render: () => calendar() },
    {
      title: "View type",
      render: () => (
        <Variants>
          {calendar()}
          {calendar({ defaultView: "month" })}
        </Variants>
      ),
    },
    {
      // Small is Atoms/Filter/Date Picker View.
      title: "Size",
      render: () => (
        <Variants>
          {calendar()}
          {calendar({ size: "small" })}
        </Variants>
      ),
    },
    {
      // The shift form's three months, where a press picks a day and a drag picks every day it covers.
      title: "Drag to select",
      render: () => (
        <Div tw="w-[62rem]">
          <CalendarStrip defaultValue={SCHEDULED} today="2023-11-01" first="2023-11-01" />
        </Div>
      ),
    },
    {
      // Day Selector, Week Selector and Custom.
      title: "Date range type",
      render: () => (
        <Variants>
          {calendar({ select: "day" })}
          {calendar({ select: "week", defaultPicked: weekOf(PICKED) })}
          {calendar({ select: "range", defaultPicked: [PICKED, "2023-11-22"] })}
        </Variants>
      ),
    },
  ],
});

/** A check-in's time zone under its time, and how far off its shift's start it came. */
const timeHint = (
  <Field.HintText>
    (UTC-4) Eastern Daylight Time
    <Chip size="small" state="warning">-13m (-1 Day)</Chip>
  </Field.HintText>
);

// 11:47 PM, the Timesheet's early check-in.
const CHECK_IN = 23 * 60 + 47;

// A 3:00 PM shift's start.
const SHIFT_START = 15 * 60;

const TIME_PICKER = defineStory({
  id: "Time Picker",
  figma: "Molecules/Form/Time Picker v2",
  examples: [
    {
      render: () => (
        <Field>
          <Field.Label>Check-in Time</Field.Label>
          <TimePicker defaultValue={CHECK_IN} />
          {timeHint}
        </Field>
      ),
    },
    {
      title: "State",
      render: () => (
        <Variants>
          <Field>
            <Field.Label>Check-in Time</Field.Label>
            <TimePicker defaultValue={CHECK_IN} />
            {timeHint}
          </Field>
          <Field tone="alert">
            <Field.Label>Check-in Time</Field.Label>
            <TimePicker defaultValue={CHECK_IN} />
            <Field.HintText>Enter a time like 3:07 PM</Field.HintText>
          </Field>
          <Field tone="warning">
            <Field.Label>Check-in Time</Field.Label>
            <TimePicker defaultValue={CHECK_IN} />
            {timeHint}
          </Field>
          <Field disabled>
            <Field.Label>Check-in Time</Field.Label>
            <TimePicker defaultValue={CHECK_IN} />
            {timeHint}
          </Field>
          <Div tw="pb-[13.75rem]">
            <Field>
              <Field.Label>Check-in Time</Field.Label>
              <TimePicker defaultValue={CHECK_IN} defaultOpen />
              {timeHint}
            </Field>
          </Div>
        </Variants>
      ),
    },
    {
      // A shift's end, each time with how long after its start it falls.
      title: "Time difference",
      render: () => (
        <Div tw="pb-[15.25rem]">
          <Field>
            <Field.Label>Shift End</Field.Label>
            <TimePicker since={SHIFT_START} defaultValue={DAY} defaultOpen />
          </Field>
        </Div>
      ),
    },
  ],
});

/** The workers as suggestions, each with its face and phone number. */
const suggestions = () =>
  each(WORKERS, "workers", (worker) => (
    <TypeAhead.Item key={worker.id} value={worker.id}>
      <Avatar src={worker.face} size="medium" />
      <Typography variant="bodyLarge">{worker.name}</Typography>
      <Typography variant="metadata" color="subdued">{worker.profile.phone}</Typography>
    </TypeAhead.Item>
  ));

/** The templates' tags as a small type-ahead's suggestions. */
const tagSuggestions = () =>
  each(tagsOf(TEMPLATES), "tags", (tag) => (
    <TypeAhead.Item key={tag} value={tag}>
      <Typography variant="metadata">{tag}</Typography>
    </TypeAhead.Item>
  ));

// Its large box is the type-ahead's, without suggestions; its small size is Atoms/Context Search.
export const SEARCH = defineStory({
  id: "Search",
  figma: "Atoms/Context Search",
  examples: [
    {
      render: () => (
        <Div tw={fieldWidth}>
          <Search />
        </Div>
      ),
    },
    {
      title: "Size",
      render: () => (
        <Variants>
          <Div tw={fieldWidth}>
            <Search />
          </Div>
          <Div tw="w-[9.75rem]">
            <Search size="small" placeholder="Search..." boxed fill />
          </Div>
        </Variants>
      ),
    },
  ],
});

// Suggests the workers as it's typed in.
const TYPE_AHEAD = defineStory({
  id: "Type-ahead",
  figma: "Molecules/Form/Type-ahead Search v2",
  examples: [
    {
      render: () => (
        <Div tw={fieldWidth}>
          <Field>
            <Field.Label>Find a worker</Field.Label>
            <TypeAhead defaultValue={WORKERS[0].id}>
              {suggestions()}
            </TypeAhead>
            <Field.HintText>Look workers up by their name or phone number</Field.HintText>
          </Field>
        </Div>
      ),
    },
    {
      title: "State",
      render: () => (
        <Variants>
          <Div tw={fieldWidth}>
            <Field>
              <Field.Label>Find a worker</Field.Label>
              <TypeAhead defaultValue={WORKERS[0].id}>
                {suggestions()}
              </TypeAhead>
              <Field.HintText>Look workers up by their name or phone number</Field.HintText>
            </Field>
          </Div>
          <Div tw={fieldWidth}>
            <Field tone="alert">
              <Field.Label>Find a worker</Field.Label>
              <TypeAhead defaultValue={WORKERS[0].id}>
                {suggestions()}
              </TypeAhead>
              <Field.HintText>Look workers up by their name or phone number</Field.HintText>
            </Field>
          </Div>
          <Div tw={fieldWidth}>
            <Field tone="warning">
              <Field.Label>Find a worker</Field.Label>
              <TypeAhead defaultValue={WORKERS[0].id}>
                {suggestions()}
              </TypeAhead>
              <Field.HintText>Look workers up by their name or phone number</Field.HintText>
            </Field>
          </Div>
          <Div tw={fieldWidth}>
            <Field disabled>
              <Field.Label>Find a worker</Field.Label>
              <TypeAhead defaultValue={WORKERS[0].id}>
                {suggestions()}
              </TypeAhead>
              <Field.HintText>Look workers up by their name or phone number</Field.HintText>
            </Field>
          </Div>
          <Div tw={openSearch}>
            <Field>
              <Field.Label>Find a worker</Field.Label>
              <TypeAhead defaultQuery="Ma" defaultOpen>
                {suggestions()}
              </TypeAhead>
              <Field.HintText>Look workers up by their name or phone number</Field.HintText>
            </Field>
          </Div>
        </Variants>
      ),
    },
    {
      title: "Size",
      render: () => (
        <Variants>
          <Div tw={fieldWidth}>
            <Field>
              <Field.Label>Find a worker</Field.Label>
              <TypeAhead defaultValue={WORKERS[0].id}>
                {suggestions()}
              </TypeAhead>
            </Field>
          </Div>
          <TypeAhead size="small" aria-label="Tag name" defaultValue="Warehouse">
            {tagSuggestions()}
          </TypeAhead>
        </Variants>
      ),
    },
    // Small, a table cell's, offering to create a tag from what's typed.
    {
      title: "Create option",
      render: () => (
        <Div tw="h-[5.75rem]">
          <TypeAhead size="small" creates="tag" aria-label="Tag name" defaultQuery="Forklift" defaultOpen>
            {tagSuggestions()}
          </TypeAhead>
        </Div>
      ),
    },
  ],
});

// As the template preset form lays it out, its column's width; two skills and a requirement of each kind.
const multiselectWidth = "w-[36.5rem]";
const SAMPLE = [
  ...CHOICES.filter(({ kind }) => kind === "skill").slice(0, 2),
  ...(["equipment", "physical", "certificates", "conditions"] as const).map((kind) => CHOICES.find((choice) => choice.kind === kind)!),
];
// A team's mandatory requirements in its templates' form.
const LOCKED = SAMPLE.slice(2, 4).map(keyOf);
const multiselectOf = (tone?: "warning" | "alert", locked: string[] = []) => (
  <Div tw={multiselectWidth}>
    <Field tone={tone}>
      <Field.Label>Skills & requirements</Field.Label>
      <Multiselect placeholder="Find a skill or requirement..." defaultValue={locked}>
        {SAMPLE.map((choice) => (
          <Multiselect.Option key={keyOf(choice)} value={keyOf(choice)} disabled={locked.includes(keyOf(choice))}>
            {choice.name}
            <Pill>{PILL[choice.kind]}</Pill>
          </Multiselect.Option>
        ))}
      </Multiselect>
      <Field.HintText>Select at least one skill</Field.HintText>
    </Field>
  </Div>
);

const MULTISELECT = defineStory({
  id: "Multiselect",
  figma: "Atoms/Form/Multiselect",
  examples: [
    { render: () => multiselectOf() },
    {
      title: "State",
      render: () => (
        <Variants>
          {multiselectOf()}
          {multiselectOf("alert")}
          {multiselectOf("warning")}
        </Variants>
      ),
    },
    // A team's mandatory requirements, picked and kept in its templates' form.
    { title: "Disabled option", render: () => multiselectOf(undefined, LOCKED) },
  ],
});

// A template's tags, offering the company's other templates' tags as they're typed.
const tagsField = (props: { disabled?: boolean }) => (
  <Div tw={fieldWidth}>
    <Field {...props}>
      <Field.Label>Tags</Field.Label>
      <TagsField options={tagsOf(TEMPLATES)} defaultValue={["Licensed", "Warehouse"]} />
      <Field.HintText>Optional</Field.HintText>
    </Field>
  </Div>
);

const TAGS_FIELD = defineStory({
  id: "Tags Field",
  figma: "Molecules/Form/Tags Field",
  examples: [
    { render: () => tagsField({}) },
    {
      title: "State",
      render: () => (
        <Variants>
          {tagsField({})}
          {tagsField({ disabled: true })}
        </Variants>
      ),
    },
  ],
});

const HINT_TEXT = defineStory({
  id: "Hint Text",
  figma: "Atoms/Hint Text",
  examples: [
    {
      render: () => (
        <Field>
          <Field.HintText>
            (UTC-4) Eastern Daylight Time
            <Chip size="small" state="warning">-13m (-1 Day)</Chip>
          </Field.HintText>
        </Field>
      ),
    },
    {
      // Autowidth, Wrapping, Warning and Alert.
      title: "Type",
      render: () => (
        <Variants>
          <Field>
            <Field.HintText>
              (UTC-4) Eastern Daylight Time
              <Chip size="small" state="warning">-13m (-1 Day)</Chip>
            </Field.HintText>
          </Field>
          <Field>
            <Field.HintText>This is who the workers would report to when they arrive on the site</Field.HintText>
          </Field>
          <Field>
            <Field.HintText tone="warning">15 minutes late</Field.HintText>
          </Field>
          <Field>
            <Field.HintText tone="alert">Enter a time like 3:07 PM</Field.HintText>
          </Field>
        </Variants>
      ),
    },
  ],
});

const STEPPER = defineStory({
  id: "Stepper",
  figma: "Atoms/Form/Stepper",
  examples: [
    {
      render: () => (
        <Field>
          <Field.Label>Unpaid Break</Field.Label>
          <Stepper defaultValue={30} step={15} />
          <Field.HintText>In minutes</Field.HintText>
        </Field>
      ),
    },
    {
      title: "State",
      render: () => (
        <Variants>
          <Field>
            <Field.Label>Unpaid Break</Field.Label>
            <Stepper defaultValue={30} step={15} />
            <Field.HintText>In minutes</Field.HintText>
          </Field>
          <Field tone="alert">
            <Field.Label>Unpaid Break</Field.Label>
            <Stepper defaultValue={30} step={15} />
            <Field.HintText>In minutes</Field.HintText>
          </Field>
          <Field tone="warning">
            <Field.Label>Unpaid Break</Field.Label>
            <Stepper defaultValue={30} step={15} />
            <Field.HintText>In minutes</Field.HintText>
          </Field>
        </Variants>
      ),
    },
  ],
});

// Figma's Atoms/Form/Segment is a SegmentedControl.Segment: the New Shift form's break types.
const segments = () => [
  <SegmentedControl.Segment key="paid" value="paid">
    Paid
  </SegmentedControl.Segment>,
  <SegmentedControl.Segment key="unpaid" value="unpaid">
    Unpaid
  </SegmentedControl.Segment>,
];

export const SEGMENTED_CONTROL = defineStory({
  id: "Segmented Control",
  figma: "Molecules/Form/Segmented Control",
  examples: [
    {
      render: () => (
        <Field>
          <Field.Label>Break Type</Field.Label>
          <SegmentedControl defaultValue="unpaid">{segments()}</SegmentedControl>
        </Field>
      ),
    },
    {
      // Hug Contents, and Fill Container across Figma's width.
      title: "Segment layout",
      render: () => (
        <Variants>
          <Field>
            <Field.Label>Break Type</Field.Label>
            <SegmentedControl defaultValue="unpaid">{segments()}</SegmentedControl>
          </Field>
          <Div tw="w-[48rem]">
            <Field>
              <Field.Label>Break Type</Field.Label>
              <SegmentedControl defaultValue="unpaid" layout="fill">{segments()}</SegmentedControl>
            </Field>
          </Div>
        </Variants>
      ),
    },
    {
      // Small is Molecules/Filter/Segmented Control.
      title: "Size",
      render: () => (
        <Variants>
          <SegmentedControl defaultValue="unpaid" aria-label="Break Type">
            {segments()}
          </SegmentedControl>
          <SegmentedControl defaultValue="unpaid" size="small" aria-label="Break Type">
            {segments()}
          </SegmentedControl>
        </Variants>
      ),
    },
  ],
});

// A form's steps as the New Shift form has them: the first done, the second in progress, the last to come.
export const FORM_NAVIGATION = defineStory({
  id: "Form Navigation",
  figma: "Atoms/Form/Form Navigation",
  examples: [
    {
      render: () => (
        <Div tw="w-[36.5rem]">
          <FormNav>
            {STEPS.map((title, i) => (
              <FormNav.Step key={title} state={i === 0 ? "complete" : i === 1 ? "in progress" : undefined}>
                <Typography variant="metadata" color="subdued">{`Step ${i + 1}`}</Typography>
                <Typography variant="subheading">{title}</Typography>
              </FormNav.Step>
            ))}
          </FormNav>
        </Div>
      ),
    },
    {
      // Pending, In Progress, Complete and Alert.
      title: "State",
      render: () => (
        <Variants>
          {([undefined, "in progress", "complete", "alert"] as const).map((state) => (
            <Div key={state ?? "pending"} tw="w-[12.5rem]">
              <FormNav>
                <FormNav.Step state={state}>
                  <Typography variant="metadata" color="subdued">Step 1</Typography>
                  <Typography variant="subheading">Personal information</Typography>
                </FormNav.Step>
              </FormNav>
            </Div>
          ))}
        </Variants>
      ),
    },
  ],
});

// The page's fields, then ds-form-more's pills and codes, then the rest.
export const FORM_STORIES = [
  choiceStory(true),
  TEXT_INPUT,
  TEXT_AREA,
  DROPDOWN,
  TYPE_AHEAD,
  DATE_PICKER,
  CALENDAR,
  TIME_PICKER,
  MULTISELECT,
  TAGS_FIELD,
  ...FORM_MORE_STORIES,
  STEPPER,
  SEGMENTED_CONTROL,
];

// The form's building blocks other components are made of.
export const FORM_PRIMITIVES = [choiceStory(false), SWITCH, LIST_ITEM, HINT_TEXT];
