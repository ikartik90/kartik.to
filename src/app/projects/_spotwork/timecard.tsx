"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  use,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { css } from "../../../../styled-system/css";
import { useControllable } from "./controllable";
import { ownPart, refuseOthers, useOwner } from "./slots";
import { CUSTOMER, PEOPLE, clock, type Tier } from "./data";
import { Avatar } from "./data-table";
import { TimePicker } from "./time-picker";
import { isoOf } from "./shifts";
import {
  SOURCES,
  dayTitle,
  hoursLabel,
  stamp,
  timeRange,
  worked,
  type Edit,
  type Hours,
  type Note,
  type Source,
  type Timecard as Card,
} from "./timesheet";
import { WorkerName } from "./profile-card";
import { Badge, Button, Checkbox, Dialog, Overlay, Divider, Field, LabelValuePair, Link, Pill, Spotscore, Stepper, TextArea, Typography, partition } from "./ui";
import { TabGroup } from "./tabs";
import { WorkerHoursDialog } from "./overlays";
import AddIcon from "./assets/add-small.svg";
import AlertIcon from "./assets/icons/large/warning.svg";
import ClockIcon from "./assets/icons/medium/clock.svg";
import NotesIcon from "./assets/notes.svg";
import SmallChevronDownIcon from "./assets/icons/small/chevron-down.svg";
import SmallChevronRightIcon from "./assets/icons/small/chevron-right.svg";
import ConfirmedIcon from "./assets/confirmed.svg";
import AbsentIcon from "./assets/absent.svg";

// SW Curie's timecard (20796:19496) and its Billable Duration cards (3703:6753): a worker's shift on a day, the hours
// it could bill, and which of them it does. Figma's "Spotter" is "worker" here.

const frameRaw = css.raw({
  display: "flex",
  flexDirection: "column",
  width: "var(--sw-width-overlay-large)",
  overflow: "hidden",
});

const workerStripStyle = css({
  display: "flex",
  flexShrink: 0,
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)",
  "& > div": { display: "flex", gap: "var(--sw-gap-xs)", paddingBlock: "var(--sw-padding-md)", paddingInline: "var(--sw-padding-sm)" },
  "& > div:first-child": { width: "15.5rem" },
  "& > div > div": { display: "flex", flexDirection: "column", justifyContent: "center", gap: "var(--sw-gap-xs)", minWidth: 0 },
  "& > div > div > :first-child": { display: "flex", alignItems: "center", height: "1.75rem" },
});

const bodyStyle = css({
  display: "flex",
  flexDirection: "column",
  flex: "1 1 auto",
  minHeight: 0,
  overflowY: "auto",
  overscrollBehavior: "contain",
  gap: "var(--sw-gap-xl)",
  padding: "var(--sw-padding-xl)",
  backgroundColor: "var(--sw-surface-subdued)",
  "& > div:first-child": { display: "flex", alignItems: "center", gap: "var(--sw-gap-xl)" },
  "& h3": { flex: "1 1 auto" },
});

export const cardStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
  padding: "var(--sw-padding-xl)",
  borderRadius: "var(--sw-radius-md)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
  textAlign: "start",
  cursor: "pointer",
  outline: "none",
  _focusVisible: { boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)" },
  "&[data-confirmed]": { cursor: "default" },
  "&[role=radio]:not([aria-checked=true], [data-confirmed]):hover": { backgroundColor: "var(--sw-hover-shade)" },
  // One not picked once the hours are confirmed.
  "&[data-confirmed]:not([aria-checked=true])": { backgroundColor: "var(--sw-surface-subdued)" },
  "&[aria-checked=true]": {
    boxShadow: "inset 0 0 0 1.5px var(--sw-border-selected)",
    outline: "2px solid var(--sw-outline-selected)",
    // Flush with the card: Panda's `outline: "none"` leaves a 2px offset.
    outlineOffset: "0",
    cursor: "default",
  },
  // Figma's Confirmed card.
  "&[aria-checked=true][data-confirmed]": {
    boxShadow: "inset 0 0 0 1.5px var(--sw-border-success)",
    outline: "2px solid var(--sw-outline-success)",
  },
  "&[data-form]": { cursor: "default" },
  "& > div:first-child": { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sw-gap-md)" },
});

const cardsStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-xl)" });

export const valuesStyle = css({ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "var(--sw-gap-xl)" });

const notesStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xs)",
  "& > button": { alignSelf: "flex-start" },
  "& > div": { display: "flex", flexDirection: "column", gap: "var(--sw-gap-md)" },
  "&[data-tone=warning] > div > div > p": { color: "var(--sw-glyph-warning)" },
});

// A rule above notes, in a column of their own so the rule keeps to the space before them.
const dividedNotesStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-md)" });

// Its byline's words and link sit abreast. Unread, a Badge Alert dot leads its first line, and every note beside an
// unread one keeps the dot's room.
const metadataStyle = css({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  "& > div": { display: "flex", alignItems: "flex-start", gap: "var(--sw-gap-xxs)", whiteSpace: "nowrap" },
  "&:has(> :only-child)": { paddingBlock: "var(--sw-padding-xxs)" },
  "*:has(> [data-unread]) > &": { paddingInlineStart: "calc(0.625rem + var(--sw-gap-md))" },
  "& > [data-dot]": {
    position: "absolute",
    insetBlockStart: "0.5rem",
    insetInlineStart: 0,
    width: "0.5rem",
    height: "0.5rem",
    borderRadius: "var(--sw-radius-full)",
    backgroundColor: "var(--sw-surface-badge-alert)",
  },
});

/**
 * Molecules/Card Content/Metadata: a slot for its note, if any, over its byline (who took the action, then when), each
 * a `Typography`; History Only without a note. `unread` marks a note not yet read.
 */
export function Metadata({ unread, children }: { unread?: boolean; children: ReactNode }) {
  return (
    <div className={metadataStyle} data-unread={unread ? "" : undefined}>
      {unread && <span data-dot="" role="img" aria-label="Unread" />}
      {children}
    </div>
  );
}

// The worker's own hours, or whichever were billed, that an adjustment starts from.
const referenceStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xs)",
  padding: "var(--sw-padding-md)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-warning)",
  color: "var(--sw-glyph-warning)",
  "& [data-pairs] span": { color: "var(--sw-glyph-warning)" },
});

const formRowStyle = css({ display: "flex", alignItems: "flex-start", gap: "var(--sw-gap-3xl)" });

// Its start, a dash and its end abreast, its time zone under them.
const timesStyle = css({
  display: "grid",
  gridTemplateColumns: "auto auto auto",
  alignItems: "flex-start",
  gap: "var(--sw-gap-xs)",
  "& > span:not(:last-child)": { display: "flex", alignItems: "center", height: "2.5rem", marginBlockStart: "var(--sw-margin-3xl)" },
  "& > :last-child": { gridColumn: "1 / -1" },
});

export const formFootStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingBlockStart: "var(--sw-padding-xl)",
  boxShadow: "inset 0 1px 0 var(--sw-border-subdued)",
  "& > div": { display: "flex", alignItems: "center", gap: "var(--sw-gap-xl)" },
});

const START_LABEL: Record<Source, [string, string]> = {
  checked: ["Check-in Time", "Check-out Time"],
  submitted: ["Shift Start Time", "Shift End Time"],
  adjusted: ["Adjusted Start Time", "Adjusted End Time"],
  posted: ["Shift Start Time", "Shift End Time"],
};

const MIN_HOURS = 3 * 60;
const MAX_HOURS = 14 * 60;

const minutesLabel = (minutes: number) => `${minutes} Minutes`;

function nowStamp() {
  const now = new Date();
  return stamp(isoOf(now), now.getHours() * 60 + now.getMinutes());
}

// The order of a timecard's cards after the one picked; an auto check-out is a check-in/out's.
const PRECEDENCE: (Source | "absent")[] = ["adjusted", "submitted", "absent", "checked", "posted"];

/** `cards` with `picked` first, the rest in their precedence. */
export const cardOrder = (cards: (Source | "absent")[], picked: Source | "absent" | null) =>
  [...cards].sort((a, b) => Number(b === picked) - Number(a === picked) || PRECEDENCE.indexOf(a) - PRECEDENCE.indexOf(b));

/** A Pill: a source's letter, or Absent's icon, and its name, or `children`. */
export function SourcePill({
  source,
  tone = "active",
  disabled,
  children,
}: {
  source: Source | "absent";
  tone?: "active" | "warning";
  disabled?: boolean;
  children?: ReactNode;
}) {
  return source === "absent" ? (
    <Pill state="alert" disabled={disabled}>
      <AbsentIcon aria-hidden />
      Absent
    </Pill>
  ) : (
    <Pill state={tone === "active" ? "affirmative" : tone} disabled={disabled}>
      <Badge inverted>{SOURCES[source].letter}</Badge>
      {children ?? SOURCES[source].label}
    </Pill>
  );
}

// The code view shows the pill it draws.
SourcePill.unwrap = SourcePill;

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <Pill state="success">
      <ConfirmedIcon aria-hidden />
      {children}
    </Pill>
  );
}

// Whether Notes & History's notes show, and how its toggle flips them.
const NotesContext = createContext<{ shown: boolean; flip: () => void } | null>(null);

/**
 * Molecules/Card Content/Notes & History: its `Metadata` under the `NotesAndHistory.Toggle` that opens and closes them,
 * open from the start with `defaultOpen`, or as `open` holds it; Warning's notes are in its colour. Without notes,
 * nothing.
 */
function NotesAndHistoryRoot({
  context,
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  context?: "warning";
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}) {
  const [own, setOwn] = useState(defaultOpen);
  const shown = open ?? own;
  refuseOthers(children, NotesAndHistoryToggle);
  const [[toggle], notes] = partition(children, NotesAndHistoryToggle);
  if (!notes.length || !toggle) return null;
  const flip = () => {
    setOwn(!shown);
    onOpenChange?.(!shown);
  };
  return (
    <NotesContext value={{ shown, flip }}>
      <div className={notesStyle} data-tone={context}>
        {toggle}
        {shown && <div>{notes}</div>}
      </div>
    </NotesContext>
  );
}
NotesAndHistoryRoot.displayName = "NotesAndHistory";

/** Opens and closes its notes: a `Link` whose chevron points down while they show. */
function NotesAndHistoryToggle({ children }: { children: ReactNode }) {
  const notes = useOwner(NotesContext, NotesAndHistoryToggle);
  return (
    <Link
      aria-expanded={notes.shown}
      onClick={(event) => {
        event.stopPropagation();
        notes.flip();
      }}
    >
      {children}
      {notes.shown ? <SmallChevronDownIcon aria-hidden /> : <SmallChevronRightIcon aria-hidden />}
    </Link>
  );
}
NotesAndHistoryToggle.displayName = "NotesAndHistory.Toggle";

export const NotesAndHistory = Object.assign(NotesAndHistoryRoot, { Toggle: ownPart(NotesAndHistoryToggle) });

/** `notes` under Notes & History's `label`led link; `divider` rules them off above, outside the component, in their `context`'s tone. */
export const notesAndHistory = (
  notes: Note[],
  { label = "Notes & History", divider, ...props }: { label?: string; divider?: boolean } & Omit<ComponentProps<typeof NotesAndHistory>, "children"> = {},
) => {
  const shown = (
    <NotesAndHistory {...props}>
      <NotesAndHistory.Toggle>
        <NotesIcon aria-hidden />
        {label}
      </NotesAndHistory.Toggle>
      {notes.map((note, i) => (
        <Metadata key={i}>
          {note.text && (
            <Typography tag="p" variant="body">
              {note.text}
            </Typography>
          )}
          <Typography tag="div" variant="metadata" color="subdued">
            {`${note.action} by`}
            <Link>{note.by}</Link>
            {`• ${note.at}`}
          </Typography>
        </Metadata>
      ))}
    </NotesAndHistory>
  );
  if (!divider || !notes.length) return shown;
  return (
    <div className={dividedNotesStyle}>
      <Divider tone={props.context} />
      {shown}
    </div>
  );
};

/** A source's hours as its four Label-value Pairs, the last named `billed`; an absence's, without hours, are dashes. */
export function hoursPairs(source: Source | "absent", hours?: Hours, billed = "Billable Duration") {
  const [start, end] = START_LABEL[source === "absent" ? "adjusted" : source];
  return [
    <LabelValuePair key="start">
      <Typography variant="metadata" color="subdued">{start}</Typography>
      <Typography variant="body">{hours ? clock(hours.start) : "-"}</Typography>
    </LabelValuePair>,
    <LabelValuePair key="end">
      <Typography variant="metadata" color="subdued">{end}</Typography>
      <Typography variant="body">{hours ? clock(hours.end) : "-"}</Typography>
    </LabelValuePair>,
    <LabelValuePair key="break">
      <Typography variant="metadata" color="subdued">Unpaid Break</Typography>
      <Typography variant="body">{hours ? minutesLabel(hours.unpaidBreak) : "-"}</Typography>
    </LabelValuePair>,
    <LabelValuePair key="billed">
      <Typography variant="metadata" color="subdued">{billed}</Typography>
      <Typography variant="body">{hoursLabel(hours ? worked(hours) : 0)}</Typography>
    </LabelValuePair>,
  ];
}

/**
 * Molecules/Overlay/Timesheet/Billable Duration Card: one of the hours the shift could bill, picked by a press (held
 * by `selected`, or by the card from `defaultSelected`). Its `Pill` (a SourcePill) heads it beside its status, its
 * Label-value Pairs sit in a row under them, and its notes under those. The card picked is outlined; once its hours
 * are `confirmed`, in success's colours, and the cards not picked are disabled, on Surface/Subdued, their pills disabled.
 */
function BillableDurationCardRoot({
  selected: held,
  defaultSelected = false,
  confirmed,
  onSelect,
  children,
}: {
  selected?: boolean;
  defaultSelected?: boolean;
  confirmed?: boolean;
  onSelect?: () => void;
  children: ReactNode;
}) {
  const [selected, setSelected] = useControllable(held, defaultSelected, onSelect);
  const [chips, others] = partition(children, SourcePill, Pill, CardSelected, CardConfirmed);
  const [pairs, rest] = partition(others, LabelValuePair);
  const disabled = confirmed && !selected;
  const select = () => !selected && !confirmed && setSelected(true);
  return (
    <div
      className={cardStyle}
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      tabIndex={0}
      data-confirmed={confirmed ? "" : undefined}
      onClick={select}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          select();
        }
      }}
    >
      <CardContext value={{ selected, confirmed: !!confirmed }}>
        <div>{disabled ? chips.map((chip) => (isValidElement<{ disabled?: boolean }>(chip) ? cloneElement(chip, { disabled }) : chip)) : chips}</div>
        {pairs.length > 0 && <div className={valuesStyle}>{pairs}</div>}
        {rest}
      </CardContext>
    </div>
  );
}
BillableDurationCardRoot.displayName = "BillableDurationCard";

/** Whether the card is picked, and confirmed. */
const CardContext = createContext({ selected: false, confirmed: false });

/** The success chip that marks the card picked, until it's confirmed. */
function CardSelected({ children }: { children: ReactNode }) {
  const { selected, confirmed } = use(CardContext);
  return selected && !confirmed && <StatusPill>{children}</StatusPill>;
}
CardSelected.displayName = "BillableDurationCard.Selected";

/** The success chip that marks the card picked and confirmed. */
function CardConfirmed({ children }: { children: ReactNode }) {
  const { selected, confirmed } = use(CardContext);
  return selected && confirmed && <StatusPill>{children}</StatusPill>;
}
CardConfirmed.displayName = "BillableDurationCard.Confirmed";

export const BillableDurationCard = Object.assign(BillableDurationCardRoot, {
  Selected: CardSelected,
  Confirmed: CardConfirmed,
});

/**
 * The hours an adjustment or an absence starts from, in a warning's box: its title, a `Typography`, over their
 * Label-value Pairs, then any notes.
 */
export function ReferenceHours({ children }: { children: ReactNode }) {
  const [titles, others] = partition(children, Typography);
  const [pairs, rest] = partition(others, LabelValuePair);
  return (
    <div className={referenceStyle}>
      {titles}
      <div className={valuesStyle} data-pairs="">
        {pairs}
      </div>
      {rest}
    </div>
  );
}

type FormState = {
  hours?: Hours;
  setHours: (hours: Hours) => void;
  from?: Hours;
  note: string;
  setNote: (note: string) => void;
  onSubmit?: (entry: { hours?: Hours; note: string }) => void;
};

const FormContext = createContext<FormState | null>(null);

/**
 * Atoms' Adjusted Hours or Absent card while it's being filled in, named by `label`: its `Head`, the hours it starts
 * from (its `ReferenceHours`, if any), its fields, then its `Footer`. Given the hours it adjusts `from`, its `Start`,
 * `End` and `Break` set them; its `Submit` hands them on with its `Note`.
 */
function TimecardFormRoot({
  label,
  from,
  onSubmit,
  children,
}: {
  label: string;
  from?: Hours;
  onSubmit?: FormState["onSubmit"];
  children: ReactNode;
}) {
  const [hours, setHours] = useState(from);
  const [note, setNote] = useState("");
  return (
    <FormContext value={{ hours, setHours, from, note, setNote, onSubmit }}>
      <div className={cardStyle} data-form="" role="group" aria-label={label}>
        {children}
      </div>
    </FormContext>
  );
}
TimecardFormRoot.displayName = "TimecardForm";

/** Its source chip, then the action that turns it into the other card. */
function Head({ children }: { children: ReactNode }) {
  useOwner(FormContext, Head);
  return <div>{children}</div>;
}
Head.displayName = "TimecardForm.Head";

/** Its `Times` beside its unpaid break's field. */
function Row({ children }: { children: ReactNode }) {
  useOwner(FormContext, Row);
  return <div className={formRowStyle}>{children}</div>;
}
Row.displayName = "TimecardForm.Row";

/** Its start's field, a dash and its end's field abreast, then its time zone under them. */
function Times({ children }: { children: ReactNode }) {
  useOwner(FormContext, Times);
  return <div className={timesStyle}>{children}</div>;
}
Times.displayName = "TimecardForm.Times";

/** The adjusted start, offered around the hours it adjusts. */
function Start() {
  const { hours, setHours, from } = useOwner(FormContext, Start);
  return <TimePicker value={hours!.start} around={from!.start} onChange={(start) => setHours({ ...hours!, start })} />;
}
Start.displayName = "TimecardForm.Start";

/** The adjusted end, each time with how long after its start it falls. */
function End() {
  const { hours, setHours } = useOwner(FormContext, End);
  return <TimePicker value={hours!.end} since={hours!.start} onChange={(end) => setHours({ ...hours!, end })} />;
}
End.displayName = "TimecardForm.End";

/** The adjusted unpaid break, in 15-minute steps. */
function Break() {
  const { hours, setHours } = useOwner(FormContext, Break);
  return <Stepper value={hours!.unpaidBreak} step={15} onChange={(unpaidBreak) => setHours({ ...hours!, unpaidBreak })} />;
}
Break.displayName = "TimecardForm.Break";

/** The card's note. */
function NoteField(props: Omit<ComponentProps<typeof TextArea>, "value" | "onChange">) {
  const { note, setNote } = useOwner(FormContext, NoteField);
  return <TextArea value={note} onChange={setNote} {...props} />;
}
NoteField.displayName = "TimecardForm.Note";

/** Its Cancel, then its `ForwardActions`. */
function Footer({ children }: { children: ReactNode }) {
  useOwner(FormContext, Footer);
  return <div className={formFootStyle}>{children}</div>;
}
Footer.displayName = "TimecardForm.Footer";

/** The billable duration it comes to, then its `Submit`. */
function ForwardActions({ children }: { children: ReactNode }) {
  useOwner(FormContext, ForwardActions);
  return <div>{children}</div>;
}
ForwardActions.displayName = "TimecardForm.ForwardActions";

/** The billable duration its hours come to. */
function Billed() {
  const { hours } = useOwner(FormContext, Billed);
  return hoursLabel(hours ? worked(hours) : 0);
}
Billed.displayName = "TimecardForm.Billed";

/** Hands on its hours and note; only once its hours bill within the allowed range. */
function Submit(props: Omit<ComponentProps<typeof Button>, "onClick">) {
  const { hours, note, onSubmit } = useOwner(FormContext, Submit);
  const billed = hours && worked(hours);
  const disabled = billed !== undefined && (billed < MIN_HOURS || billed > MAX_HOURS);
  return <Button disabled={disabled} onClick={() => onSubmit?.({ hours, note: note.trim() })} {...props} />;
}
Submit.displayName = "TimecardForm.Submit";

export const TimecardForm = Object.assign(TimecardFormRoot, {
  Head: ownPart(Head),
  Row: ownPart(Row),
  Times: ownPart(Times),
  Start: ownPart(Start),
  End: ownPart(End),
  Break: ownPart(Break),
  Note: ownPart(NoteField),
  Footer: ownPart(Footer),
  ForwardActions: ownPart(ForwardActions),
  Billed: ownPart(Billed),
  Submit: ownPart(Submit),
});

/** The adjusted card's fields: its times and break, the range they may bill, and its note. */
export const ADJUST_FIELDS = (
  <>
    <TimecardForm.Row>
      <TimecardForm.Times>
        <Field>
          <Field.Label>Shift Start Time</Field.Label>
          <TimecardForm.Start />
        </Field>
        <Typography variant="body" aria-hidden>
          –
        </Typography>
        <Field>
          <Field.Label>Shift End Time</Field.Label>
          <TimecardForm.End />
        </Field>
        <Typography variant="metadata" color="subdued">
          (UTC-4) Eastern Daylight Time
        </Typography>
      </TimecardForm.Times>
      <Field>
        <Field.Label>Unpaid Break</Field.Label>
        <TimecardForm.Break />
        <Field.HintText>In minutes</Field.HintText>
      </Field>
    </TimecardForm.Row>
    <Typography tag="p" variant="metadata" color="subdued">
      Adjusted billable duration can range between 3–14 hours. Want to enter a different time?{" "}
      <Link>Contact us.</Link>
    </Typography>
    <Field>
      <Field.Label>Note</Field.Label>
      <TimecardForm.Note />
    </Field>
    <Field orientation="horizontal">
      <Checkbox />
      <Field.Label>Add note to worker&apos;s profile</Field.Label>
    </Field>
  </>
);

/**
 * The day's timecards for one worker, a tab each, opening on `opened`'s. Picking, adjusting or marking absent stays in
 * the overlay until Confirm hours, which confirms it. Confirmed, it holds until Unconfirm hours, which opens it to
 * changes again. A `closed` week's holds for good, with no actions.
 */
export function TimecardOverlay({
  cards,
  opened,
  closed = false,
  height,
  onConfirm,
  onClose,
}: {
  cards: Card[];
  opened: string;
  closed?: boolean;
  height: number;
  onConfirm: (id: string, edit: Edit) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(opened);
  const card = cards.find((c) => c.id === tab)!;
  const person = PEOPLE[card.worker];
  return (
    <Overlay label={dayTitle(card.date)} onClose={onClose} height={height} css={frameRaw}>
      <Overlay.Header>
        <Typography variant="heading">{dayTitle(card.date)}</Typography>
        <Overlay.Close />
      </Overlay.Header>
      <TabGroup size="small" value={tab} onChange={setTab}>
        {cards.map((c) => (
          <TabGroup.Tab key={c.id} value={c.id}>
            <ClockIcon aria-hidden />
            {timeRange(c.posted)}
          </TabGroup.Tab>
        ))}
      </TabGroup>
      <div className={workerStripStyle}>
        <div>
          <Avatar src={person.face} size="medium" />
          <div>
            <WorkerName worker={person} />
            <Spotscore tier={person.profile.tier.toLowerCase() as Lowercase<Tier>}>{person.profile.score}</Spotscore>
          </div>
        </div>
        <div>
          <div>
            <Typography variant="body">{card.position}</Typography>
            <Typography variant="metadata" color="subdued">
              {card.shiftName}
            </Typography>
          </div>
        </div>
      </div>
      <TimecardBody key={card.id} card={card} closed={closed} onConfirm={(edit) => onConfirm(card.id, edit)} />
    </Overlay>
  );
}

function TimecardBody({ card, closed, onConfirm }: { card: Card; closed: boolean; onConfirm: (edit: Edit) => void }) {
  const [selected, setSelected] = useState(card.selected);
  const [adjusted, setAdjusted] = useState(card.adjusted);
  // An absence, once marked, stays a card to pick; `absent` is whether it's the one picked.
  const [marked, setMarked] = useState(card.absent);
  const [absent, setAbsent] = useState(card.absent);
  const [added, setAdded] = useState<Note[]>([]);
  const [form, setForm] = useState<"adjusted" | "absent" | null>(null);
  const [review, setReview] = useState(card.review);
  // Adjusting the hours a worker sent in starts from theirs.
  const [from, setFrom] = useState<Source | null>(null);
  const notes = [...card.notes, ...added];
  // Confirmed hours hold until they're unconfirmed; a closed week's, for good.
  const confirmed = !!card.confirmed || closed;
  const hoursOf = (source: Source) => (source === "adjusted" ? adjusted : card[source]);
  // Hours a worker sent in beside a check-in are a card of their own once they're answered, or past answering.
  const waiting = (source: Source) => source === "submitted" && review === "pending" && !closed;
  const sources = (["adjusted", "checked", "submitted", "posted"] as Source[]).filter((s) => hoursOf(s) && !waiting(s));
  // Adjustments' notes sit with the adjusted hours; the rest with the hours the worker gave, or their absence. Hours
  // sent in beside a check-in keep the worker's note, and its answer, with them.
  const home = marked ? "absent" : card.checked ? "checked" : card.submitted ? "submitted" : "adjusted";
  const theirs = (n: Note) => !!card.review && ["Submitted", "Approved", "Rejected"].includes(n.action);
  const notesOf = (source: Source | "absent") => [
    ...(source === "adjusted" ? notes.filter((n) => n.action === "Adjusted") : []),
    ...(source === "submitted" ? notes.filter(theirs) : []),
    ...(source === home ? notes.filter((n) => n.action !== "Adjusted" && !theirs(n)) : []),
  ];
  const pick = (source: Source) => {
    setSelected(source);
    setAbsent(false);
  };
  const fromSource: Source = from ?? (selected && hoursOf(selected) ? selected : "posted");
  const stopAdjusting = () => {
    setForm(null);
    setFrom(null);
  };
  const reference = (
    <ReferenceHours>
      <Typography variant="body">{`${SOURCES[fromSource].label.replace(/ Hours$/, "")} Hours`}</Typography>
      {hoursPairs(fromSource, hoursOf(fromSource)!)}
    </ReferenceHours>
  );
  const answer = (next: "reviewed" | "rejected", action: string) => {
    setReview(next);
    setAdded([...added, { action, by: CUSTOMER, at: nowStamp() }]);
  };

  return (
    <>
      <div className={bodyStyle}>
        <div>
          <Typography tag="h3" variant="heading">
            Billable duration
          </Typography>
          {review !== "pending" && !closed && (
            <Button size="small" emphasis="secondary" disabled={!!form || confirmed} onClick={() => setForm("adjusted")}>
              <AddIcon aria-hidden />
              Add adjusted hours...
            </Button>
          )}
        </div>
        {review === "pending" && !form && card.submitted && !closed && (
          <WorkerHoursDialog label="Approve worker submitted hours?">
            <AlertIcon aria-hidden />
            <WorkerHoursDialog.Content>
              <Typography tag="h4" variant="heading">
                Approve worker submitted hours?
              </Typography>
              <Typography tag="p" variant="body">
                The worker submitted the following adjusted hours for this shift:
              </Typography>
              <WorkerHoursDialog.Hours>{hoursPairs("submitted", card.submitted, "Shift Duration")}</WorkerHoursDialog.Hours>
              {notesAndHistory(notesOf("submitted"), {
                label: `${notesOf("submitted").length} ${notesOf("submitted").length === 1 ? "note" : "notes"}`,
                context: "warning",
                defaultOpen: true,
                divider: true,
              })}
            </WorkerHoursDialog.Content>
            <Dialog.ActionBar>
              <Button emphasis="tertiary" tone="warning" onClick={() => answer("rejected", "Rejected")}>
                Reject hours
              </Button>
              <Dialog.ForwardActions>
                <Button
                  emphasis="tertiary"
                  tone="warning"
                  onClick={() => {
                    setFrom("submitted");
                    setForm("adjusted");
                  }}
                >
                  Adjust hours...
                </Button>
                <Button
                  emphasis="secondary"
                  tone="warning"
                  onClick={() => {
                    answer("reviewed", "Approved");
                    pick("submitted");
                  }}
                >
                  Approve hours
                </Button>
              </Dialog.ForwardActions>
            </Dialog.ActionBar>
          </WorkerHoursDialog>
        )}
        <div role="radiogroup" aria-label="Billable duration" className={cardsStyle}>
          {form === "adjusted" && (
            <TimecardForm
              label="Adjusted Hours"
              from={hoursOf(fromSource)!}
              onSubmit={({ hours, note }) => {
                setAdjusted(hours!);
                pick("adjusted");
                stopAdjusting();
                if (review === "pending") setReview("reviewed");
                setAdded([...added, { text: note || undefined, action: "Adjusted", by: CUSTOMER, at: nowStamp() }]);
              }}
            >
              <TimecardForm.Head>
                <SourcePill source="adjusted" />
                <Button size="small" emphasis="secondary" tone="destructive" onClick={() => setForm("absent")}>
                  Mark absent
                </Button>
              </TimecardForm.Head>
              {reference}
              {ADJUST_FIELDS}
              <TimecardForm.Footer>
                <Button emphasis="tertiary" onClick={stopAdjusting}>
                  Cancel
                </Button>
                <TimecardForm.ForwardActions>
                  <LabelValuePair>
                    <Typography variant="metadata" color="subdued">Adjusted Billable Duration</Typography>
                    <Typography variant="body">
                      <TimecardForm.Billed />
                    </Typography>
                  </LabelValuePair>
                  <TimecardForm.Submit emphasis="secondary">Adjust hours</TimecardForm.Submit>
                </TimecardForm.ForwardActions>
              </TimecardForm.Footer>
            </TimecardForm>
          )}
          {form === "absent" && (
            <TimecardForm
              label="Absent"
              onSubmit={({ note }) => {
                setMarked(true);
                setAbsent(true);
                stopAdjusting();
                if (review === "pending") setReview("reviewed");
                setAdded([...added, { text: note || undefined, action: "Marked absent", by: CUSTOMER, at: nowStamp() }]);
              }}
            >
              <TimecardForm.Head>
                <SourcePill source="absent" />
                <Button size="small" emphasis="secondary" onClick={() => setForm("adjusted")}>
                  Add adjusted hours
                </Button>
              </TimecardForm.Head>
              {card.submitted && (
                <ReferenceHours>
                  <Typography variant="body">{`${SOURCES.submitted.label} Hours`}</Typography>
                  {hoursPairs("submitted", card.submitted)}
                  {notesAndHistory(notesOf("submitted"), {
                    label: `${notesOf("submitted").length} ${notesOf("submitted").length === 1 ? "note" : "notes"}`,
                    context: "warning",
                    divider: true,
                  })}
                </ReferenceHours>
              )}
              <Field>
                <Field.Label>Note</Field.Label>
                <TimecardForm.Note size="medium" />
              </Field>
              <Field orientation="horizontal">
                <Checkbox />
                <Field.Label>Add note to worker&apos;s profile</Field.Label>
              </Field>
              <TimecardForm.Footer>
                <Button emphasis="tertiary" onClick={stopAdjusting}>
                  Cancel
                </Button>
                <TimecardForm.ForwardActions>
                  <LabelValuePair>
                    <Typography variant="metadata" color="subdued">Adjusted Billable Duration</Typography>
                    <Typography variant="body">
                      <TimecardForm.Billed />
                    </Typography>
                  </LabelValuePair>
                  <TimecardForm.Submit emphasis="secondary" tone="destructive">
                    Mark absent
                  </TimecardForm.Submit>
                </TimecardForm.ForwardActions>
              </TimecardForm.Footer>
            </TimecardForm>
          )}
          {cardOrder([...sources, ...(marked ? ["absent" as const] : [])], absent ? "absent" : selected).map((source) => {
            const picked = source === "absent" ? absent : !absent && selected === source;
            return (
              <BillableDurationCard
                key={source}
                selected={picked}
                confirmed={confirmed}
                onSelect={() => (source === "absent" ? setAbsent(true) : pick(source))}
              >
                <SourcePill source={source} />
                <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
                <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
                {source === "absent" ? hoursPairs("absent") : hoursPairs(source, hoursOf(source)!)}
                {notesAndHistory(notesOf(source), { defaultOpen: picked, divider: true })}
              </BillableDurationCard>
            );
          })}
        </div>
      </div>
      {!closed && (
        <Overlay.ActionBar>
          <Overlay.Cancel>Close</Overlay.Cancel>
          <Overlay.ForwardActions>
            {confirmed ? (
              <Button emphasis="secondary" tone="destructive" onClick={() => onConfirm({ confirmed: false })}>
                Unconfirm hours
              </Button>
            ) : (
              <Button onClick={() => onConfirm({ selected: absent ? null : selected, adjusted, review, absent, confirmed: true, notes: added })}>
                Confirm hours
              </Button>
            )}
          </Overlay.ForwardActions>
        </Overlay.ActionBar>
      )}
    </>
  );
}
