"use client";

import Image from "next/image";
import {
  createContext,
  isValidElement,
  use,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { css, cx } from "../../../../styled-system/css";
import { useControllable } from "./controllable";
import { GeofenceMap } from "./geofence-map";
import { tagsOf } from "./presets";
import { TypeAhead } from "./search";
import { TagsField } from "./tags-field";
import { useTemplates } from "./templates";
import {
  WEEKDAYS,
  addDays,
  addMonths,
  clockTime,
  repeatDates,
  repeatOf,
  repeatSummary,
  weekdayOf,
  type Iso,
  type Posting,
  type Template,
} from "./shifts";
import { CalendarStrip, DatePicker, SchedulingCalendar } from "./shift-calendar";
import { ownPart, partsOf, restOf, useOwner } from "./slots";
import { TimePicker } from "./time-picker";
import { Button, Card, Checkbox, Chip, Disclosure, Divider, Overlay, Field, FieldContext, LabelValuePair, Link, PLACEHOLDER, SegmentedControl, Stepper, Switch, Tags, TextInput, Tooltip, Typography, addressStyle, alertIf, formOverlayRaw, mapStyle, pairsStyle, summarySectionStyle, type FieldTone } from "./ui";
import mapToronto from "./assets/map-toronto.png";
import OpenIcon from "./assets/open-separately.svg";
import PinIcon from "./assets/pin-small.svg";
import AddIcon from "./assets/add-small.svg";
import InfoIcon from "./assets/info.svg";
import EditIcon from "./assets/edit.svg";
import EditSmallIcon from "./assets/icons/small/edit.svg";

// SW Curie's New Shift overlay in the overlay's three versions of the Shift scheduling project:
// - final: three steps (22385:100726), the shift's dates on a drag-to-select calendar, its details, then a review;
// - recurrence: the same steps, the dates as a first shift repeated weekly until a date (22082:62259);
// - old: the single form it replaced (22297:53056), a day at a time on one month.
// Figma's "Spotter" is "worker" here.

export type Version = "final" | "recurrence" | "old";

export const STEPS = ["Shift planning", "Shift information", "Review shift summary"];
const TITLE = "Day Shift M/W/F";
const TIME_ZONE = "Eastern Daylight Time (UTC-4)";
const BREAK_STEP = 15;

/** What the old design's Edit unlocks. */
type Detail = "address" | "unit" | "directions" | "wage" | "tags";

interface Draft {
  title: string;
  template: string | null;
  workers: number;
  reportTo: string;
  billTo: string;
  tempToHire: boolean;
  mustWorkAll: boolean;
  privateJob: boolean;
  dates: Iso[];
  first: Iso | null;
  repeat: boolean;
  weekdays: number[];
  until: Iso | null;
  start: number;
  end: number;
  breakMinutes: number;
  paidBreak: boolean;
  spotFill: boolean;
  /** The old design's template defaults, unlocked by Edit. */
  editing: boolean;
  overrides: Partial<Pick<Template, Detail>>;
}

const DRAFT: Draft = {
  title: "",
  template: null,
  workers: 1,
  reportTo: "Yousuf Hamedani",
  billTo: "",
  tempToHire: false,
  mustWorkAll: false,
  privateJob: false,
  dates: [],
  first: null,
  repeat: false,
  weekdays: [],
  until: null,
  start: 9 * 60,
  end: 17 * 60,
  breakMinutes: 30,
  paidBreak: true,
  spotFill: true,
  editing: false,
  overrides: {},
};

const datesOf = (draft: Draft, version: Version) =>
  version !== "recurrence"
    ? draft.dates
    : draft.first
      ? repeatDates({
          first: draft.first,
          weekdays: draft.repeat ? draft.weekdays : [],
          until: draft.repeat ? draft.until : null,
        })
      : [];

/** The draft's dates in the form `to` picks them, from the form `from` left them in. */
function carried(draft: Draft, from: Version, to: Version): Draft {
  if ((from === "recurrence") === (to === "recurrence")) return draft;
  if (from === "recurrence") return { ...draft, dates: datesOf(draft, from) };
  const repeat = repeatOf(draft.dates);
  return {
    ...draft,
    first: repeat?.first ?? null,
    repeat: !!repeat?.weekdays.length,
    weekdays: repeat?.weekdays ?? [],
    until: repeat?.until ?? null,
  };
}

const frameRaw = css.raw(formOverlayRaw, { width: "var(--sw-width-overlay-large)" });

// Atoms/Form/Form Navigation: a tab per step, its rule blue once reached.
const stepsStyle = css({
  display: "flex",
  alignItems: "flex-end",
  gap: "var(--sw-gap-md)",
  flexShrink: 0,
  "& > button": {
    display: "flex",
    flexDirection: "column",
    gap: "var(--sw-gap-xxs)",
    flex: "1 1 0",
    minWidth: "11rem",
    paddingBlock: "var(--sw-padding-md) var(--sw-padding-lg)",
    textAlign: "start",
    boxShadow: "inset 0 -2px 0 var(--sw-border-default)",
    cursor: "pointer",
    _disabled: { cursor: "default" },
  },
  "& > button > [data-typography]:last-child": { color: "var(--sw-glyph-disabled)" },
  "& > button[data-reached]": { boxShadow: "inset 0 -2px 0 var(--sw-border-selected)" },
  "& > button[data-reached]:not([aria-current=step]) > [data-typography]:last-child": {
    color: "var(--sw-glyph-default)",
  },
  "& > button[aria-current=step] > [data-typography]:last-child": { color: "var(--sw-glyph-selected)" },
  "& > button[data-tone=alert]": { boxShadow: "inset 0 -2px 0 var(--sw-border-alert)" },
  "& > button[data-tone=alert] > [data-typography]:last-child": { color: "var(--sw-glyph-alert)" },
});

// Under an overlay's header, the room round its form's steps.
export const stepBarStyle = css({ marginBlockStart: "var(--sw-margin-xl)", paddingInline: "var(--sw-padding-xl)" });

const FormNavContext = createContext<object | null>(null);
const IN_FORM_NAV = {};

/** A form's steps, its `Step`s side by side; what holds it gives it its room. */
function FormNavRoot({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <FormNavContext value={IN_FORM_NAV}>
      <div className={cx(stepsStyle, className)} {...props}>
        {children}
      </div>
    </FormNavContext>
  );
}

/**
 * Atoms/Form/Form Navigation: a step's number over its title, each a `Typography`, in Figma's State; the title, last,
 * takes the state's colour. A pending step can't be gone to.
 */
function FormNavStep({
  state = "pending",
  children,
  ...props
}: Omit<ComponentProps<"button">, "children" | "disabled"> & {
  state?: "pending" | "in progress" | "complete" | "alert";
  children: ReactNode;
}) {
  useOwner(FormNavContext, FormNavStep);
  return (
    <button
      type="button"
      data-reached={state === "in progress" || state === "complete" ? "" : undefined}
      aria-current={state === "in progress" ? "step" : undefined}
      data-tone={state === "alert" ? "alert" : undefined}
      disabled={state === "pending"}
      {...props}
    >
      {children}
    </button>
  );
}

FormNavRoot.displayName = "FormNav";
FormNavStep.displayName = "FormNav.Step";

export const FormNav = Object.assign(FormNavRoot, { Step: ownPart(FormNavStep) });

const bodyStyle = css({
  position: "relative",
  flex: "1 1 auto",
  minHeight: 0,
  overflowX: "hidden",
  overflowY: "auto",
  overscrollBehavior: "contain",
  paddingInline: "var(--sw-padding-xl)",
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" },
});

// The step on show sets the height; the others sit beside it, a step apart and cut to the body's height so they
// scroll it no further, and slide in turn.
const panelStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
  width: "100%",
  paddingBlock: "var(--sw-padding-xl)",
  transition: "transform 400ms cubic-bezier(0.22, 1, 0.36, 1)",
  _motionReduce: { transition: "none" },
  "&[data-away]": {
    position: "absolute",
    insetBlock: 0,
    insetInlineStart: "1rem",
    width: "calc(100% - 2rem)",
    overflow: "hidden",
  },
  "&[data-gap=wide]": { gap: "var(--sw-gap-xxl)" },
  "&[data-review]": { gap: "var(--sw-gap-none)", paddingBlockStart: "var(--sw-padding-3xl)" },
});

export { bodyStyle as stepsBodyStyle, panelStyle as stepPanelStyle };

const rowStyle = css({ display: "flex", alignItems: "flex-start", gap: "var(--sw-gap-xxl)", "& > [data-grow]": { flex: "1 1 auto" } });

const columnStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-xl)" });

/** Molecules/Form/Type-ahead Search v2: the company's templates, or `templates`, narrowed to what's typed. */
export function TemplateField({
  value,
  templates,
  tone,
  onChange,
}: {
  value: string | null;
  templates?: Template[];
  tone?: FieldTone;
  onChange: (id: string | null) => void;
}) {
  const company = useTemplates();
  return (
    <Field tone={tone}>
      <Field.Label>Template</Field.Label>
      <TypeAhead value={value} onChange={onChange}>
        {(templates ?? company).map((template) => (
          <TypeAhead.Item key={template.id} value={template.id}>
            <Typography variant="bodyLarge">{template.name}</Typography>
          </TypeAhead.Item>
        ))}
      </TypeAhead>
      <Field.HintText>Select the template for your shift</Field.HintText>
    </Field>
  );
}

const addressRowStyle = css({ display: "flex", alignItems: "flex-start", gap: "var(--sw-gap-xl)" });

const mapColumnStyle = css({
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: "var(--sw-gap-md)",
  flexShrink: 0,
  alignSelf: "stretch",
  width: "12.5rem",
});

/**
 * The Template Lookup Card: what the template brings with it, which the form no longer asks for. `brief`, as the
 * Off-App Shift form has it, without the details link or tags.
 */
export function TemplateCard({ template, brief }: { template: Template; brief?: boolean }) {
  return (
    <Card>
      <Card.Header>
        <Typography tag="h3" variant="heading">{template.name}</Typography>
        {!brief && (
          <Link>
            View template details
            <OpenIcon aria-hidden />
          </Link>
        )}
      </Card.Header>
      <AddressLocation>
        <Typography variant="body">{template.address}</Typography>
        <Typography variant="body">{template.unit}</Typography>
        <Typography tag="p" variant="metadata" color="subdued">{template.directions}</Typography>
        <LabelValuePair>
          <Typography variant="metadata" color="subdued">Hourly Wage</Typography>
          <Typography variant="body">{template.wage}</Typography>
        </LabelValuePair>
        {template.place && (
          <AddressLocation.Map>
            <GeofenceMap place={template.place} value={template.geofence} entrance={template.entrance} size="small" editable={false} />
          </AddressLocation.Map>
        )}
        {!brief && template.tags.length > 0 && (
          <AddressLocation.Aside>
            <LabelValuePair>
              <Typography variant="metadata" color="subdued">Tags</Typography>
              <Tags tags={template.tags} />
            </LabelValuePair>
          </AddressLocation.Aside>
        )}
      </AddressLocation>
    </Card>
  );
}

// The code view shows the composition.
TemplateCard.unwrap = TemplateCard;

/** Under the map of an Address & Location. */
function AddressLocationAside({ children }: { children: ReactNode }) {
  return children;
}

/** The map an Address & Location shows in place of its picture. */
function AddressLocationMap({ children }: { children: ReactNode }) {
  return children;
}

/**
 * Atoms/Address & Location: its address lines (`body` Typographies, the address over its unit), then its arrival
 * instructions and whatever else it's given (Has Hourly Wage's), beside its map (its `Map` in place of the picture),
 * its `Aside` under the map.
 */
function AddressLocationRoot({ children }: { children: ReactNode }) {
  const isLine = (child: ReactNode) =>
    isValidElement<{ variant?: string }>(child) && child.type === Typography && child.props.variant === "body";
  const rest = restOf(children, AddressLocationAside, AddressLocationMap);
  return (
    <div className={addressRowStyle}>
      <div className={addressStyle}>
        <div>{rest.filter(isLine)}</div>
        {rest.filter((child) => !isLine(child))}
      </div>
      <div className={mapColumnStyle}>
        {partsOf(children, AddressLocationMap)[0] ?? (
          <div className={mapStyle}>
            <Image src={mapToronto} alt="" width={482} height={295} />
            <PinIcon aria-hidden />
          </div>
        )}
        {partsOf(children, AddressLocationAside)}
      </div>
    </div>
  );
}

AddressLocationRoot.displayName = "AddressLocation";
AddressLocationAside.displayName = "AddressLocation.Aside";
AddressLocationMap.displayName = "AddressLocation.Map";

export const AddressLocation = Object.assign(AddressLocationRoot, { Aside: AddressLocationAside, Map: AddressLocationMap });

function BreakType({
  paid,
  onChange,
  disabled,
  wide,
}: {
  paid: boolean;
  onChange: (paid: boolean) => void;
  disabled?: boolean;
  wide?: boolean;
}) {
  return (
    <Field disabled={disabled}>
      <Field.Label>Break Type</Field.Label>
      <SegmentedControl value={paid ? "paid" : "unpaid"} onChange={(to) => onChange(to === "paid")} wide={wide}>
        <SegmentedControl.Segment value="paid">Paid</SegmentedControl.Segment>
        <SegmentedControl.Segment value="unpaid">Unpaid</SegmentedControl.Segment>
      </SegmentedControl>
    </Field>
  );
}

const timesStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xs)",
  "& > div": { display: "flex", alignItems: "flex-start", gap: "var(--sw-gap-xs)" },
  "& > div > span": {
    display: "flex",
    alignItems: "center",
    height: "2.5rem",
    marginBlockStart: "var(--sw-margin-3xl)",
  },
});

function Times({ draft, set, disabled }: { draft: Draft; set: (patch: Partial<Draft>) => void; disabled?: boolean }) {
  return (
    <div className={timesStyle}>
      <div>
        <Field disabled={disabled}>
          <Field.Label>Shift Start Time</Field.Label>
          <TimePicker value={draft.start} around={draft.start} onChange={(start) => set({ start })} />
        </Field>
        <Typography variant="body" aria-hidden>–</Typography>
        <Field disabled={disabled}>
          <Field.Label>Shift End Time</Field.Label>
          <TimePicker value={draft.end} since={draft.start} onChange={(end) => set({ end })} />
        </Field>
      </div>
      <Typography variant="metadata" color="subdued">{TIME_ZONE}</Typography>
    </div>
  );
}

function Breaks({ draft, set, disabled, wide }: { draft: Draft; set: (patch: Partial<Draft>) => void; disabled?: boolean; wide?: boolean }) {
  return (
    <div className={rowStyle}>
      <Field disabled={disabled}>
        <Field.Label>Break</Field.Label>
        <Stepper value={draft.breakMinutes} step={BREAK_STEP} onChange={(breakMinutes) => set({ breakMinutes })} />
        <Field.HintText>In minutes</Field.HintText>
      </Field>
      <BreakType paid={draft.paidBreak} disabled={disabled} wide={wide} onChange={(paidBreak) => set({ paidBreak })} />
    </div>
  );
}

function Crew({ draft, set }: { draft: Draft; set: (patch: Partial<Draft>) => void }) {
  return (
    <div className={rowStyle}>
      <Field>
        <Field.Label>No. of Workers</Field.Label>
        <Stepper value={draft.workers} min={1} onChange={(workers) => set({ workers })} />
      </Field>
      <Field className={css({ flex: "1 1 auto" })}>
        <Field.Label>Report To</Field.Label>
        <TextInput value={draft.reportTo} onChange={(reportTo) => set({ reportTo })} />
        <Field.HintText>This is who the workers would report to when they arrive on the site</Field.HintText>
      </Field>
    </div>
  );
}

const askStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  height: "1.75rem",
  "& > button > svg": { color: "var(--sw-glyph-button-secondary-affirmative-default)" },
});

const optionsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
  paddingBlockStart: "var(--sw-padding-xl)",
});

function InformationStep({
  draft,
  set,
  version,
  tried,
  onAddTemplate,
}: {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  version: Version;
  tried: boolean;
  onAddTemplate?: () => void;
}) {
  const template = useTemplates().find((t) => t.id === draft.template);
  return (
    <>
      <Field tone={alertIf(tried, !draft.title.trim())}>
        <Field.Label>Shift Title</Field.Label>
        <TextInput value={draft.title} autofill={TITLE} onChange={(title) => set({ title })} />
        <Field.HintText>
          Shift title helps distinguish between the shifts related to a template, e.g., Weekend night shift, Weekday
          shift, Holiday special, etc. This won&apos;t be visible to the applicants.
        </Field.HintText>
      </Field>
      <TemplateField value={draft.template} tone={alertIf(tried, !draft.template)} onChange={(id) => set({ template: id })} />
      {template && <TemplateCard template={template} />}
      <div className={askStyle}>
        <Typography variant="body">Don’t see the template you are looking for on the list?</Typography>
        <Button size="small" emphasis="secondary" onClick={onAddTemplate}>
          <AddIcon aria-hidden />
          Add new template...
        </Button>
      </div>
      {version === "final" && (
        <>
          <Crew draft={draft} set={set} />
          <Field orientation="horizontal">
            <Switch checked={draft.spotFill} onChange={(spotFill) => set({ spotFill })} />
            <Field.Content>
              <Field.Label>{SPOTFILL.label}</Field.Label>
              <Field.HintText>{SPOTFILL.hint}</Field.HintText>
            </Field.Content>
          </Field>
          <Divider />
        </>
      )}
      <Disclosure show="More options" hide="Fewer options">
        <div className={optionsStyle}>
          <Field>
            <Field.Label>Bill To/Job Code</Field.Label>
            <TextInput value={draft.billTo} onChange={(billTo) => set({ billTo })} />
            <Field.HintText>Optional</Field.HintText>
          </Field>
          <Field orientation="horizontal">
            <Checkbox checked={draft.tempToHire} onChange={(tempToHire) => set({ tempToHire })} />
            <Field.Content>
              <Field.Label>Temp to hire</Field.Label>
              <Field.HintText>This indicates that you are looking to hire workers full-time</Field.HintText>
            </Field.Content>
          </Field>
          <Field orientation="horizontal">
            <Checkbox checked={draft.mustWorkAll} onChange={(mustWorkAll) => set({ mustWorkAll })} />
            <Field.Content>
              <Field.Label>Must work all days</Field.Label>
              <Field.HintText>Candidates must be available for work on all posted days</Field.HintText>
            </Field.Content>
          </Field>
          <Field orientation="horizontal">
            <Checkbox checked={draft.privateJob} onChange={(privateJob) => set({ privateJob })} />
            <Field.Content>
              <Field.Label>Private job</Field.Label>
              <Field.HintText>Private jobs are only visible to your worker pool</Field.HintText>
            </Field.Content>
          </Field>
        </div>
      </Disclosure>
    </>
  );
}

const calendarGroupStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-xs)" });

const scheduleRowStyle = css({ display: "flex", alignItems: "flex-start", gap: "var(--sw-gap-3xl)" });

/** The final version's words, which Edit Schedule shares. */
export const DRAG_HINT = "Click and drag to select multiple shift dates simultaneously";
export const SPOTFILL = {
  label: "Auto-send offers with SpotFill™",
  hint: "SpotFill automatically picks the best candidates for the job from your worker pool.\nIf the workers in your pool don't meet the criteria, we send you one of our top workers.",
};

function DragPlanningStep({ draft, set, today, tried }: { draft: Draft; set: (patch: Partial<Draft>) => void; today: Iso; tried: boolean }) {
  const tone = alertIf(tried, draft.dates.length === 0);
  return (
    <>
      <Field tone={tone}>
        <Field.Label>Scheduling calendar</Field.Label>
        <CalendarStrip value={draft.dates} today={today} first={today} tone={tone} onChange={(dates) => set({ dates })} />
        <Field.HintText>{DRAG_HINT}</Field.HintText>
      </Field>
      <div className={scheduleRowStyle}>
        <Times draft={draft} set={set} />
        <Breaks draft={draft} set={set} />
      </div>
    </>
  );
}

const repeatStyle = css({
  display: "flex",
  flexDirection: "column",
  borderRadius: "var(--sw-radius-md)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
  "& > div:first-child": { paddingBlock: "var(--sw-padding-sm)", paddingInline: "var(--sw-padding-xl)" },
  "& > div:nth-child(2)": {
    display: "flex",
    flexDirection: "column",
    gap: "var(--sw-gap-xl)",
    padding: "var(--sw-padding-xl)",
    boxShadow: "inset 0 1px 0 var(--sw-border-subdued)",
  },
});

// Repeat Every Week On's Atoms/Form/Week Day Select buttons (4492:6176): picked (`aria-pressed`), a warning or, in an
// Alert field, an alert (`data-tone`), and either one disabled.
const weekdaysStyle = css({
  display: "flex",
  gap: "var(--sw-gap-md)",
  "& > button[data-tone=warning]": {
    backgroundColor: "var(--sw-surface-warning)",
    boxShadow: "inset 0 0 0 1.5px var(--sw-border-warning)",
    color: "var(--sw-glyph-warning)",
  },
  "& > button[data-tone=alert]": {
    backgroundColor: "var(--sw-surface-alert)",
    boxShadow: "inset 0 0 0 1.5px var(--sw-border-alert)",
    color: "var(--sw-glyph-alert)",
  },
  "& > button:disabled": {
    backgroundColor: "var(--sw-surface-disabled)",
    boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
    color: "var(--sw-glyph-disabled)",
    cursor: "default",
  },
  "& > button:disabled[aria-pressed=true]": {
    backgroundColor: "var(--sw-surface-inverted-disabled-selected)",
    boxShadow: "none",
  },
  "& > button": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "2.5rem",
    height: "2.5rem",
    borderRadius: "var(--sw-radius-full)",
    backgroundColor: "var(--sw-surface-default)",
    boxShadow: "inset 0 0 0 1px var(--sw-border-default)",
    cursor: "pointer",
  },
  "& > button[aria-pressed=true]": {
    backgroundColor: "var(--sw-surface-selected)",
    boxShadow: "inset 0 0 0 1.5px var(--sw-border-selected)",
    color: "var(--sw-glyph-selected)",
  },
  "& > button[aria-pressed=true]:hover:not(:disabled)": {
    backgroundImage: "linear-gradient(var(--sw-surface-hover) 0 0)",
    backgroundBlendMode: "multiply",
  },
});

type WeekDayState = { value: number[]; onChange: (days: number[]) => void; disabled?: boolean; alert?: boolean };

const WeekDayContext = createContext<WeekDayState | null>(null);

/** The days of the week picked, its `Day`s pressed for them; in a `Field`, named by its `Label`. */
function WeekDaySelectRoot({
  value: held,
  defaultValue = [],
  onChange: heard,
  disabled,
  children,
}: {
  value?: number[];
  defaultValue?: number[];
  onChange?: (days: number[]) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [value, onChange] = useControllable(held, defaultValue, heard);
  const field = use(FieldContext);
  return (
    <WeekDayContext value={{ value, onChange, disabled: disabled ?? field.disabled, alert: field.tone === "alert" }}>
      <div
        className={weekdaysStyle}
        role="group"
        aria-labelledby={field.labelId}
        aria-describedby={field.hintId}
      >
        {children}
      </div>
    </WeekDayContext>
  );
}

/** Atoms/Form/Week Day Select: a day of the week (0 for Sunday), Selected while it's picked. */
function WeekDaySelectDay({
  value: day,
  tone,
  ...props
}: Omit<ComponentProps<"button">, "value" | "onClick" | "color"> & { value: number; tone?: "warning" }) {
  const { value, onChange, disabled, alert } = useOwner(WeekDayContext, WeekDaySelectDay);
  const on = value.includes(day);
  return (
    <Typography
      tag="button"
      variant="bodyLarge"
      type="button"
      aria-pressed={on}
      data-tone={tone ?? (alert ? "alert" : undefined)}
      disabled={disabled}
      onClick={() => onChange(on ? value.filter((d) => d !== day) : [...value, day].toSorted((a, b) => a - b))}
      {...props}
    />
  );
}

WeekDaySelectRoot.displayName = "WeekDaySelect";
WeekDaySelectDay.displayName = "WeekDaySelect.Day";

export const WeekDaySelect = Object.assign(WeekDaySelectRoot, { Day: ownPart(WeekDaySelectDay) });

const summaryStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--sw-gap-xxs)",
  padding: "var(--sw-padding-xxs)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-info)",
  "& > svg": { flexShrink: 0 },
  "& strong": { color: "var(--sw-glyph-default)" },
});

function RepeatPlanningStep({ draft, set, today, tried }: { draft: Draft; set: (patch: Partial<Draft>) => void; today: Iso; tried: boolean }) {
  const from = draft.first ?? today;
  // Repeat opens as the live form's does: on the shift's own weekday, until six days after it.
  const opening = (first: Iso | null): Partial<Draft> =>
    first ? { weekdays: draft.weekdays.length ? draft.weekdays : [weekdayOf(first)], until: draft.until ?? addDays(first, 6) } : {};
  return (
    <>
      <div className={rowStyle}>
        <Field tone={alertIf(tried, !draft.first)}>
          <Field.Label>Shift Date</Field.Label>
          <DatePicker value={draft.first} today={today} onChange={(first) => set({ first, ...(draft.repeat && opening(first)) })} />
          <Field.HintText>mm/dd/yyyy</Field.HintText>
        </Field>
        <Times draft={draft} set={set} />
      </div>
      <div className={repeatStyle}>
        <div>
          <Field orientation="horizontal">
            <Switch checked={draft.repeat} onChange={(repeat) => set({ repeat, ...(repeat && opening(draft.first)) })} />
            <Field.Label>Repeat this shift on other days</Field.Label>
          </Field>
        </div>
        {draft.repeat && (
          <div>
            <div className={scheduleRowStyle}>
              <Field tone={alertIf(tried, draft.weekdays.length === 0)}>
                <Field.Label>Repeat Every Week On</Field.Label>
                <WeekDaySelect value={draft.weekdays} onChange={(weekdays) => set({ weekdays })}>
                  {WEEKDAYS.map((name, weekday) => (
                    <WeekDaySelect.Day key={name} value={weekday} aria-label={name}>
                      {name[0]}
                    </WeekDaySelect.Day>
                  ))}
                </WeekDaySelect>
              </Field>
              <Field tone={alertIf(tried, !draft.until)}>
                <Field.Label>Until</Field.Label>
                <DatePicker value={draft.until} today={today} from={from} onChange={(until) => set({ until })} />
                <Field.HintText>mm/dd/yyyy</Field.HintText>
              </Field>
            </div>
            {draft.first && draft.until && draft.weekdays.length > 0 && (
              <div className={summaryStyle}>
                <InfoIcon aria-hidden />
                <Typography tag="p" variant="metadata" color="subdued">
                  {repeatSummary({ first: draft.first, weekdays: draft.weekdays, until: draft.until }).map((part, i) =>
                    part.strong ? (
                      <Typography key={i} tag="strong" variant="metadataStrong">{part.text}</Typography>
                    ) : (
                      part.text
                    ),
                  )}
                </Typography>
              </div>
            )}
          </div>
        )}
      </div>
      <Breaks draft={draft} set={set} />
      <Crew draft={draft} set={set} />
    </>
  );
}

const pillsStyle = css({ display: "flex", flexWrap: "wrap", gap: "var(--sw-gap-xl)" });

function ReviewStep({
  draft,
  dates,
  today,
  onEdit,
}: {
  draft: Draft;
  dates: Iso[];
  today: Iso;
  onEdit: (step: number) => void;
}) {
  const template = useTemplates().find((t) => t.id === draft.template);
  const pills = [
    draft.tempToHire && "Temp to Hire",
    draft.mustWorkAll && "Must Work All Days",
    draft.privateJob && "Private Job",
  ].filter(Boolean) as string[];
  return (
    <>
      <Typography tag="h3" variant="heading">Review shift summary</Typography>
      <section className={summarySectionStyle} aria-label="Shift information">
        <div>
          <Typography tag="h4" variant="subheading">Shift information</Typography>
          <Button size="icon" aria-label="Edit basic information" onClick={() => onEdit(1)}>
            <EditIcon aria-hidden />
            <Tooltip>Edit basic information</Tooltip>
          </Button>
        </div>
        <LabelValuePair>
          <Typography variant="metadata" color="subdued">Shift Title</Typography>
          <Typography variant="body">{draft.title}</Typography>
        </LabelValuePair>
        {template && <TemplateCard template={template} />}
        {pills.length > 0 && (
          <div className={pillsStyle}>
            {pills.map((pill) => (
              <Chip size="small" key={pill} state="affirmative">
                {pill}
              </Chip>
            ))}
          </div>
        )}
        <div className={pairsStyle}>
          <LabelValuePair>
            <Typography variant="metadata" color="subdued">No. of Workers</Typography>
            <Typography variant="body">{draft.workers}</Typography>
          </LabelValuePair>
          <LabelValuePair>
            <Typography variant="metadata" color="subdued">Reporting To</Typography>
            <Typography variant="body">{draft.reportTo}</Typography>
          </LabelValuePair>
        </div>
      </section>
      <section className={summarySectionStyle} aria-label="Shift plan">
        <div>
          <Typography tag="h4" variant="subheading">Shift plan</Typography>
          <Button size="icon" aria-label="Edit shift plan" onClick={() => onEdit(0)}>
            <EditIcon aria-hidden />
            <Tooltip>Edit shift plan</Tooltip>
          </Button>
        </div>
        <CalendarStrip value={dates} today={today} first={addMonths(dates[0] ?? today, -1)} />
        <div className={pairsStyle}>
          <LabelValuePair>
            <Typography variant="metadata" color="subdued">Shift Time</Typography>
            <Typography variant="body">{`${clockTime(draft.start)}—${clockTime(draft.end)}`}</Typography>
          </LabelValuePair>
          <LabelValuePair>
            <Typography variant="metadata" color="subdued">{draft.paidBreak ? "Paid Break" : "Unpaid Break"}</Typography>
            <Typography variant="body">{`${draft.breakMinutes} minutes`}</Typography>
          </LabelValuePair>
        </div>
      </section>
    </>
  );
}

const oldTopStyle = css({
  display: "grid",
  gridTemplateColumns: "20.25rem 20.5rem",
  gap: "var(--sw-gap-xxl)",
  alignItems: "start",
});

const defaultsStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--sw-gap-xs)",
  paddingBlock: "var(--sw-padding-xs) var(--sw-padding-md)",
  paddingInline: "var(--sw-padding-md) var(--sw-padding-xs)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-info)",
  "& > svg": { flexShrink: 0, marginBlockStart: "var(--sw-margin-xs)" },
  "& > div": { display: "flex", flexDirection: "column", flex: "1 1 auto" },
  "& > div > span:first-child": { lineHeight: "1.75rem" },
});

const growStyle = css({ flex: "1 1 auto" });

function OldForm({ draft, set, today, tried }: { draft: Draft; set: (patch: Partial<Draft>) => void; today: Iso; tried: boolean }) {
  const templates = useTemplates();
  const template = templates.find((t) => t.id === draft.template);
  const locked = !draft.editing;
  const value = (key: Exclude<Detail, "tags">) => draft.overrides[key] ?? template?.[key] ?? "";
  const override = (key: Exclude<Detail, "tags">) => (text: string) => set({ overrides: { ...draft.overrides, [key]: text } });
  return (
    <>
      <div className={oldTopStyle}>
        <div className={columnStyle}>
          <Field tone={alertIf(tried, !draft.title.trim())}>
            <Field.Label>Shift Title</Field.Label>
            <TextInput value={draft.title} autofill={TITLE} onChange={(title) => set({ title })} />
          </Field>
          <Field>
            <Field.Label>No. of Workers</Field.Label>
            <Stepper value={draft.workers} min={1} onChange={(workers) => set({ workers })} />
          </Field>
          <Field>
            <Field.Label>Report To</Field.Label>
            <TextInput value={draft.reportTo} onChange={(reportTo) => set({ reportTo })} />
          </Field>
          <Field>
            <Field.Label>Bill To</Field.Label>
            <TextInput value={draft.billTo} onChange={(billTo) => set({ billTo })} />
            <Field.HintText>Optional</Field.HintText>
          </Field>
          <Field orientation="horizontal">
            <Switch checked={draft.tempToHire} onChange={(tempToHire) => set({ tempToHire })} />
            <Field.Label>This is a Temp-to-Hire position</Field.Label>
          </Field>
        </div>
        <div className={calendarGroupStyle}>
          <Typography variant="body" color="subdued">Scheduling calendar</Typography>
          <SchedulingCalendar value={draft.dates} today={today} tone={alertIf(tried, draft.dates.length === 0)} onChange={(dates) => set({ dates })} />
          <Field tone={alertIf(tried, draft.dates.length === 0)}>
            <Field.HintText>Select the days on which you want to post a shift</Field.HintText>
          </Field>
        </div>
      </div>
      <TemplateField value={draft.template} tone={alertIf(tried, !draft.template)} onChange={(id) => set({ template: id, overrides: {} })} />
      <div className={defaultsStyle}>
        <InfoIcon aria-hidden />
        <div>
          <Typography variant="body">Default job template</Typography>
          <Typography variant="metadata" color="subdued">
            The following information is attached to the template you’ve selected. If you need to change any information
            click Edit. Changes will only affect this job posting.
          </Typography>
        </div>
        <Button size="small" emphasis="tertiary" aria-pressed={draft.editing} onClick={() => set({ editing: !draft.editing })}>
          <EditSmallIcon aria-hidden />
          Edit
        </Button>
      </div>
      <div className={rowStyle}>
        <Times draft={draft} set={set} disabled={locked} />
        <Breaks draft={draft} set={set} disabled={locked} wide />
      </div>
      <div className={rowStyle}>
        <Field disabled={locked} className={growStyle}>
          <Field.Label>Location</Field.Label>
          <TextInput value={value("address")} onChange={override("address")} />
        </Field>
        <Field disabled={locked} className={css({ width: "7.5rem", flexShrink: 0 })}>
          <Field.Label>Unit</Field.Label>
          <TextInput value={value("unit")} onChange={override("unit")} />
        </Field>
      </div>
      <div className={rowStyle}>
        <Field disabled={locked} className={css({ width: "8.75rem", flexShrink: 0 })}>
          <Field.Label>Hourly Wage</Field.Label>
          <TextInput value={value("wage").replace("CAD ", "")} onChange={(text) => override("wage")(`CAD ${text}`)}>
            <TextInput.Prefix>CAD</TextInput.Prefix>
          </TextInput>
        </Field>
        <Field disabled={locked} className={growStyle}>
          <Field.Label>Tags</Field.Label>
          <TagsField
            options={tagsOf(templates)}
            value={draft.overrides.tags ?? template?.tags ?? []}
            onChange={(tags) => set({ overrides: { ...draft.overrides, tags } })}
          />
        </Field>
      </div>
      <Field disabled={locked}>
        <Field.Label>Entrance Instructions</Field.Label>
        <TextInput multiline value={value("directions")} onChange={override("directions")} />
      </Field>
    </>
  );
}

export function NewShift({
  version,
  today,
  template,
  height,
  onPost,
  onCancel,
  onAddTemplate,
  placeholder,
}: {
  version: Version;
  today: Iso;
  /** The template it's posted from, already picked. */
  template?: string;
  /** The app's, which the overlay's scrim covers. */
  height: number;
  onPost: (posting: Posting) => void;
  onCancel: () => void;
  /** Add New Template's form; `pick` takes the template it creates. */
  onAddTemplate?: (pick: (id: string) => void) => void;
  /** Another project's form: past its title and actions, a placeholder. */
  placeholder?: boolean;
}) {
  const standIn = placeholder ? PLACEHOLDER : {};
  const [draft, setDraft] = useState(() => ({ ...DRAFT, template: template ?? null }));
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  // Another version takes the overlay over with everything filled in so far.
  const [shown, setShown] = useState(version);
  if (shown !== version) {
    setShown(version);
    setDraft((current) => carried(current, shown, version));
  }
  const dates = datesOf(draft, version);

  const described = !!draft.title.trim() && !!draft.template;
  const planned =
    dates.length > 0 && (version !== "recurrence" || !draft.repeat || (draft.weekdays.length > 0 && !!draft.until));
  const ready = [planned, described, described && planned];

  useEffect(() => {
    body.current?.scrollTo?.({ top: 0 });
  }, [step]);

  const go = (next: number) => {
    setStep(next);
    setReached((most) => Math.max(most, next));
  };
  // The steps whose Next (or Post shift) was pressed while they still lacked something; the old form is one step.
  const [tried, setTried] = useState<number[]>([]);
  const stop = (at: number) => {
    setTried((steps) => (steps.includes(at) ? steps : [...steps, at]));
    go(at);
  };
  const forward = () => {
    if (version === "old") return described && planned ? post() : stop(0);
    if (!ready[step]) return stop(step === 2 ? ready.indexOf(false) : step);
    if (step === 2) post();
    else go(step + 1);
  };
  const post = () =>
    onPost({
      template: draft.template!,
      title: draft.title.trim(),
      dates,
      start: draft.start,
      end: draft.end,
      workers: draft.workers,
      breakMinutes: draft.breakMinutes,
      paidBreak: draft.paidBreak,
      reportTo: draft.reportTo,
      spotFill: draft.spotFill,
    });

  const panels = [
    version === "recurrence" ? (
      <RepeatPlanningStep key="planning" draft={draft} set={set} today={today} tried={tried.includes(0)} />
    ) : (
      <DragPlanningStep key="planning" draft={draft} set={set} today={today} tried={tried.includes(0)} />
    ),
    <InformationStep
      key="information"
      draft={draft}
      set={set}
      version={version}
      tried={tried.includes(1)}
      onAddTemplate={onAddTemplate && (() => onAddTemplate((id) => set({ template: id })))}
    />,
    <ReviewStep key="review" draft={draft} dates={dates} today={today} onEdit={go} />,
  ];

  return (
    <Overlay label="New shift" onClose={onCancel} height={height} scrim="light" holds css={frameRaw}>
      <Overlay.Header>
        <Typography variant="heading">New shift</Typography>
        <Overlay.Close />
      </Overlay.Header>
      {version === "old" ? (
        <div ref={body} className={bodyStyle} {...standIn}>
          <div className={panelStyle}>
            <OldForm draft={draft} set={set} today={today} tried={tried.includes(0)} />
          </div>
        </div>
      ) : (
        <>
          <FormNav className={stepBarStyle} {...standIn}>
            {STEPS.map((title, i) => (
              <FormNav.Step
                key={title}
                state={i === step ? "in progress" : i <= reached && (i === 0 || ready[i - 1]) ? "complete" : "pending"}
                onClick={() => go(i)}
              >
                <Typography variant="metadata" color="subdued">{`Step ${i + 1}`}</Typography>
                <Typography variant="subheading">{title}</Typography>
              </FormNav.Step>
            ))}
          </FormNav>
          <div ref={body} className={bodyStyle} {...standIn}>
            {panels.map((panel, i) => (
              <div
                key={i}
                className={panelStyle}
                data-away={i === step ? undefined : ""}
                data-gap={i === 0 ? "wide" : undefined}
                data-review={i === 2 ? "" : undefined}
                style={{ transform: `translateX(calc(${i - step} * (100% + 1.25rem)))` }}
                aria-hidden={i !== step || undefined}
                inert={i !== step}
              >
                {i <= reached && panel}
              </div>
            ))}
          </div>
        </>
      )}
      <Overlay.ActionBar>
        <Overlay.Cancel />
        <Overlay.ForwardActions>
          {version !== "old" && step > 0 && (
            <Button emphasis="secondary" onClick={() => go(step - 1)}>
              Back
            </Button>
          )}
          <Button onClick={forward}>
            {version === "old" || step === 2 ? "Post shift" : "Next"}
          </Button>
        </Overlay.ForwardActions>
      </Overlay.ActionBar>
    </Overlay>
  );
}
