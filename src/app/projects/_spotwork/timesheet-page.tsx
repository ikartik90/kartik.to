"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { css } from "../../../../styled-system/css";
import { pageTopRaw } from "./sidebar";
import { SNACKS } from "./copy";
import { PEOPLE, type Day, type Shift, type Tier } from "./data";
import { addDays, monthSpans, weekLabel, weekOf, type Iso } from "./shifts";
import {
  SOURCES,
  TIMESHEET_WORKERS,
  billable,
  closed,
  confirm,
  dayTotal,
  hoursLabel,
  hoursOf,
  merge,
  openWeek,
  shiftStatus,
  shownHours,
  summarize,
  summaryText,
  timeLines,
  timecards,
  totalLabel,
  unconfirm,
  type Edits,
  type OffAppShift,
  type Timecard,
} from "./timesheet";
import { TimecardOverlay } from "./timecard";
import { OffAppCard, OffAppShiftOverlay } from "./off-app-shift";
import { DateSelector } from "./dashboard-menus";
import { Dropdown } from "./dropdown";
import { WorkerName } from "./profile-card";
import { ActionStack, Avatar, Table } from "./data-table";
import { TeamData } from "./team-loading";
import { Search } from "./search";
import {
  Badge,
  Button,
  Chip,
  Pill,
  Presence,
  Spotscore,
  Tooltip,
  Typography,
  columnHeadRaw,
  hatchStyle,
  selectedCellRaw,
  sheetSlotRaw,
  weekMonthsStyle,
  weekSearchRaw,
  type ChipState,
} from "./ui";
import ConfirmedIcon from "./assets/confirmed.svg";
import TickIcon from "./assets/tick-large.svg";
import AbsentIcon from "./assets/absent.svg";
import InProgressIcon from "./assets/in-progress.svg";
import UndoIcon from "./assets/undo.svg";

// SW Curie's Timesheet (21543:50964; with off-app shifts, 21543:52696): a week of the Check-ins page's workers' hours,
// each day's to open as its timecard, each row's to confirm at once. Its header is the app's other tables': one row
// inside the outline, the search in the Worker column's. Figma's "Spotter" is "worker" here.

/** The page's width at 1440, and the narrowest its table takes before the app scales down. */
export const TIMESHEET_WIDTH = 1440;
export const TIMESHEET_MIN_WIDTH = 75 + 200 + 7 * 125 + 200;

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Status = ReturnType<typeof shiftStatus>;
const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "inProgress", label: "In Progress" },
  { value: "absent", label: "Absent" },
  { value: "checked", label: SOURCES.checked.label },
  { value: "submitted", label: SOURCES.submitted.label },
  { value: "confirmed", label: "Confirmed" },
];

const pageStyle = css(pageTopRaw, {
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-3xl)",
  paddingBlockEnd: "var(--sw-padding-3xl)",
  paddingInline: "2.25rem",
});

const headStyle = css({ display: "flex", alignItems: "center", justifyContent: "space-between" });

const sectionStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-xl)" });

const offAppStyle = css({ display: "flex", flexWrap: "wrap", gap: "var(--sw-gap-xl)" });

const toolsStyle = css({ display: "flex", alignItems: "center", justifyContent: "space-between" });

const COLUMNS = "12.5rem repeat(7, minmax(0, 1fr)) 12.5rem";

const clippedRaw = css.raw({ overflow: "hidden" });

// Over both lines, its label level with the days'.
const actionsHeadRaw = css.raw({
  gridColumn: "9",
  gridRow: "1 / span 2",
  alignItems: "flex-end",
  height: "auto",
  paddingInline: "var(--sw-padding-none)",
  borderStartEndRadius: "var(--sw-radius-md)",
  boxShadow: "inset 1px 0 0 var(--sw-border-subdued)",
});

const columnLabelStyle = css(columnHeadRaw);

// A day's cell, and the total's: white, the body's on the Subdued surface once the week's hours close (`data-closed`), the
// total till then on the Disabled surface while it has none; days with worker-submitted hours are hatched. The column lines sit where the header's
// do, or the two miss by a pixel: the worker's column draws its right edge, each day after the first and the total
// their left.
const dayRaw = css.raw({
  backgroundColor: "var(--sw-surface-default)",
  "&:not(:last-child)": { boxShadow: "none" },
  "[role=row] > & + &": { boxShadow: "inset 1px 0 0 var(--sw-border-subdued)" },
  "&[data-closed]:not([data-selected])": { backgroundColor: "var(--sw-surface-subdued)" },
});

// A day's shifts, edge to edge: one alone fills its day; of two, the first takes the lines down to its times and the
// second the rest, standing further off. While its timecards are open (`data-selected`) the whole cell is selected.
const shiftsRaw = css.raw(dayRaw, selectedCellRaw, {
  paddingBlock: "var(--sw-padding-none)",
  paddingInline: "var(--sw-padding-none)",
  "&[data-selected]": { backgroundColor: "var(--sw-surface-selected)" },
  "& > [data-lead]": { display: "contents" },
  "& > [data-lead]:has(+ [data-shift]) > [data-shift]": { gridRow: "1 / 4", paddingBlockEnd: "var(--sw-padding-none)" },
  "& > [data-lead]:has(> [data-shift]) + [data-shift]": { gridRow: "4 / -1", marginBlockStart: 0 },
  "& > [data-lead] + [data-shift] > :first-child": { gridRow: "1" },
  "& > [data-lead] + [data-shift] > :last-child": { gridRow: "2" },
  // A day's only shift puts "(+1 day)" on the row's next line, so the worker's picture spans just its chip and times.
  "& > [data-lead]:only-child > [data-shift] > [data-times]": { gridRow: "3 / span 2", gridTemplateRows: "subgrid" },
});

// A timecard's shift across the row's lines, its chip as tall as the total's button so the times under it meet the
// total's summary. A button once it has hours, opening its timecard.
const shiftStyle = css(sheetSlotRaw, {
  display: "grid",
  gridRow: "1 / -1",
  gridTemplateRows: "subgrid",
  gridTemplateColumns: "minmax(0, 1fr)",
  alignItems: "center",
  justifyItems: "start",
  justifySelf: "stretch",
  paddingBlock: "var(--sw-padding-md)",
  paddingInline: "var(--sw-padding-sm)",
  textAlign: "start",
  outline: "none",
  _focusVisible: { boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)" },
  "& > *": { maxWidth: "100%" },
  "& > :first-child": { gridRow: "2" },
  "& > :last-child": {
    gridRow: "3",
    minWidth: 0,
    marginBlockStart: "var(--sw-gap-xs)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

// Its start, then its end with "(+1 day)" under it.
const timesStyle = css({
  display: "grid",
  gridTemplateColumns: "auto auto",
  justifyContent: "start",
  "& > span:last-child": { display: "contents" },
  "& > span:last-child > *": { gridColumn: "2" },
  "& > span:last-child > * + *": { gridRow: "2" },
});

const totalRaw = css.raw(dayRaw, {
  "& > [data-lead] > div": { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sw-gap-md)" },
});

const emptyStyle = css({ gridColumn: "1 / -1", paddingBlock: "var(--sw-padding-3xl)", textAlign: "center" });

/**
 * A timecard's Duration Chip, and what its shift's button reads once it has hours: its hours and where they came from,
 * confirmed, absent, under way or to come. Disabled once its week is `closed`.
 */
function durationOf(card: Timecard, closed: boolean): { chip: ReactNode; label?: string } {
  if (card.state === "upcoming")
    return {
      chip: (
        <Chip disabled>
          <Badge inverted>U</Badge>
          Upcoming
        </Chip>
      ),
    };
  if (card.state === "inProgress")
    return {
      chip: (
        <Chip disabled>
          <InProgressIcon aria-hidden />
          In Progress
        </Chip>
      ),
    };
  // An icon leads it as it is, a source's letter in a Badge.
  const chip = (state: ChipState, label: string, lead: ReactNode, text: string) => ({
    label,
    chip: (
      <Chip state={state} disabled={closed}>
        {lead}
        {text}
      </Chip>
    ),
  });
  if (card.absent) return chip("alert", "Absent", <AbsentIcon aria-hidden />, "Absent");
  const hours = hoursLabel(shownHours(card));
  if (card.confirmed) return chip("success", `Confirmed ${hours}`, <ConfirmedIcon aria-hidden />, hours);
  if (card.review === "pending")
    return chip("warning", `${SOURCES.submitted.label} ${hours}`, <Badge inverted>{SOURCES.submitted.letter}</Badge>, hours);
  const source = SOURCES[card.selected!];
  return chip("affirmative", `${source.label} ${hours}`, <Badge inverted>{source.letter}</Badge>, hours);
}

/** A timecard's shift in its day: its chip, then its times; one button opening it once it has hours. */
function Shift({ card, closed, onOpen }: { card: Timecard; closed: boolean; onOpen: () => void }) {
  const shown =
    card.review === "pending" && !card.confirmed
      ? card.submitted!
      : card.state === "done" && !card.absent && card.selected
        ? card[card.selected]!
        : card.posted;
  const [start, end, next] = timeLines(shown);
  const { chip, label } = durationOf(card, closed);
  const lines = (
    <>
      {chip}
      <Typography variant="metadata" color="subdued" className={timesStyle} data-times="">
        <Typography variant="metadata">{`${start}–`}</Typography>
        <span>
          <Typography variant="metadata">{end}</Typography>
          {next && <Typography variant="metadata">{next}</Typography>}
        </span>
      </Typography>
    </>
  );
  return label ? (
    <button type="button" className={shiftStyle} aria-label={label} onClick={onOpen} data-shift="" data-status={shiftStatus(card)}>
      {lines}
    </button>
  ) : (
    <div className={shiftStyle} data-shift="">
      {lines}
    </div>
  );
}

/** A worker's week: its hours to confirm, or confirmed, under them its summary; `closed`, past undoing. */
function TotalCell({
  cards,
  closed,
  onConfirm,
  onUndo,
}: {
  cards: Timecard[];
  closed: boolean;
  onConfirm: () => void;
  onUndo: () => void;
}) {
  const total = summarize(cards);
  const shut = closed ? "" : undefined;
  if (total.status === "none") return <Table.Cell css={totalRaw} empty={!closed} data-closed={shut} />;
  const confirmed = total.status === "confirmed";
  return (
    <ActionStack.Provider done={confirmed} onDoneChange={(done) => (done ? onConfirm() : onUndo())}>
      <Table.Cell css={totalRaw} data-closed={shut}>
        <ActionStack>
          <ActionStack.Pending>
            <ActionStack.Secondary>
              <ActionStack.Complete>
                <Button size="small" emphasis="secondary">
                  <TickIcon aria-hidden />
                  {`Confirm ${hoursLabel(total.pending)}`}
                </Button>
              </ActionStack.Complete>
            </ActionStack.Secondary>
          </ActionStack.Pending>
          <ActionStack.Done>
            <ActionStack.Status>
              <Pill state="success" disabled={closed}>
                <ConfirmedIcon aria-hidden />
                Confirmed
              </Pill>
              {!closed && (
                <ActionStack.Undo>
                  <Button size="icon" tone="destructive" aria-label="Undo confirmation">
                    <UndoIcon aria-hidden />
                    <Tooltip>Undo confirmation</Tooltip>
                  </Button>
                </ActionStack.Undo>
              )}
            </ActionStack.Status>
          </ActionStack.Done>
        </ActionStack>
        <ActionStack.Pending>
          <Typography variant="metadata" color="subdued">
            {summaryText(total)}
          </Typography>
        </ActionStack.Pending>
        <ActionStack.Done>
          <Typography variant="metadata" color="subdued">
            {totalLabel(total.confirmed)}
          </Typography>
        </ActionStack.Done>
      </Table.Cell>
    </ActionStack.Provider>
  );
}

export function TimesheetPage({
  admin = false,
  today,
  days,
  edits,
  onEdits,
  offApp,
  onOffApp,
  onSnack,
  layer,
  height,
}: {
  /** Spotwork admins add off-app shifts; companies don't. */
  admin?: boolean;
  today: Iso;
  /** The Check-ins page's shifts, as they stand. */
  days: Record<Day, Shift[]>;
  edits: Edits;
  onEdits: (edits: Edits) => void;
  offApp: OffAppShift[];
  onOffApp: (shifts: OffAppShift[]) => void;
  onSnack?: (message: string) => void;
  /** Where the overlays hang: the app's overlay layer. */
  layer: HTMLElement | null;
  height: number;
}) {
  const [weekStart, setWeekStart] = useState(() => openWeek(today)[0]);
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [opened, setOpened] = useState<Timecard | null>(null);
  const [adding, setAdding] = useState<OffAppShift | "new" | null>(null);
  const week = weekOf(weekStart);
  const weekClosed = closed(week, new Date());
  const cards = timecards(today, days, week, edits);
  const typed = search.trim().toLowerCase();
  const rows = TIMESHEET_WORKERS.map((worker) => ({ person: PEOPLE[worker], cards: cards.filter((c) => c.worker === worker) }))
    .filter(({ person }) => !typed || person.name.toLowerCase().includes(typed))
    .filter(({ cards: own }) => !statuses.length || own.some((card) => statuses.includes(shiftStatus(card))));
  const sameDay = opened ? cards.filter((c) => c.worker === opened.worker && c.date === opened.date) : [];

  return (
    <div className={pageStyle} role="main">
      <div className={headStyle}>
        <Typography tag="h1" variant="title">Timesheet</Typography>
        {admin && (
          <Button emphasis="secondary" onClick={() => setAdding("new")}>
            Add off-app shift...
          </Button>
        )}
      </div>

      {admin && offApp.length > 0 && (
        <section className={sectionStyle} aria-label="Off-app shifts">
          <Typography tag="h2" variant="heading">Off-app shifts</Typography>
          <TeamData>
            <div className={offAppStyle}>
              {offApp.map((shift) => (
                <OffAppCard
                  key={shift.id}
                  shift={shift}
                  onEdit={() => setAdding(shift)}
                  onDelete={() => {
                    onOffApp(offApp.filter((s) => s.id !== shift.id));
                    onSnack?.(SNACKS.offAppDeleted);
                  }}
                />
              ))}
            </div>
          </TeamData>
        </section>
      )}

      <section className={sectionStyle} aria-label="Regular shifts">
        {admin && offApp.length > 0 && <Typography tag="h2" variant="heading">Regular shifts</Typography>}
        <div className={toolsStyle}>
          <Dropdown size="small" multiple value={statuses} onChange={setStatuses}>
            <Typography variant="metadata">Status</Typography>
            {STATUS_OPTIONS.map(({ value, label }) => (
              <Dropdown.Item key={value} value={value}>
                <Typography variant="metadata">{label}</Typography>
              </Dropdown.Item>
            ))}
          </Dropdown>
          <DateSelector>
            <DateSelector.Previous aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))} />
            <DateSelector.Date aria-label={`Week of ${weekLabel(week)}`} onClick={() => setWeekStart(openWeek(today)[0])}>
              {weekLabel(week)}
            </DateSelector.Date>
            <DateSelector.Next aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))} />
          </DateSelector>
        </div>

        <Table aria-label="Timesheet" columns={COLUMNS} outline css={clippedRaw}>
          <Table.Head>
            <Table.Row style={{ gridTemplateRows: "2rem 2rem" }}>
              <Table.Cell search aria-label="Worker" css={weekSearchRaw}>
                <Search size="small" placeholder="Find a worker..." value={search} onChange={(event) => setSearch(event.target.value)} />
              </Table.Cell>
              <div className={weekMonthsStyle} aria-hidden>
                {monthSpans(week).map(({ name, span }) => (
                  <Typography key={name} variant="metadata" style={{ gridRow: 1, gridColumn: `span ${span}` }}>
                    {name}
                  </Typography>
                ))}
              </div>
              {week.map((date, i) => (
                <Table.Cell key={date} active={date === today} style={{ gridRow: 2, gridColumn: i + 2 }}>
                  <Typography variant="metadata">{Number(date.slice(8))}</Typography>
                  <Typography variant="metadata">{WEEKDAY_SHORT[i]}</Typography>
                </Table.Cell>
              ))}
              <Table.Cell css={actionsHeadRaw}>
                <Typography variant="metadata" className={columnLabelStyle}>Actions</Typography>
              </Table.Cell>
            </Table.Row>
          </Table.Head>
          <TeamData>
            <Table.Body>
              {rows.map(({ person, cards: own }) => (
                <Table.Row key={person.id}>
                  <Table.Cell header fill>
                    <Avatar src={person.face} />
                    <WorkerName worker={person} />
                    <Spotscore tier={person.profile.tier.toLowerCase() as Lowercase<Tier>}>
                      {person.profile.score}
                    </Spotscore>
                  </Table.Cell>
                  {week.map((date) => {
                    const on = own.filter((c) => c.date === date);
                    return (
                      <Table.Cell
                        key={date}
                        css={shiftsRaw}
                        className={on.some((card) => shiftStatus(card) === "submitted") ? hatchStyle : undefined}
                        data-date={date}
                        data-closed={weekClosed ? "" : undefined}
                        data-selected={on.some((card) => card.id === opened?.id) ? "" : undefined}
                      >
                        {on.map((card) => (
                          <Shift key={card.id} card={card} closed={weekClosed} onOpen={() => setOpened(card)} />
                        ))}
                      </Table.Cell>
                    );
                  })}
                  <TotalCell
                    cards={own}
                    closed={weekClosed}
                    onConfirm={() => {
                      onEdits(confirm(own, edits));
                      onSnack?.(SNACKS.confirmed(hoursOf(summarize(own).pending)));
                    }}
                    onUndo={() => {
                      onEdits(unconfirm(own, edits));
                      onSnack?.(SNACKS.unconfirmed(hoursOf(summarize(own).confirmed)));
                    }}
                  />
                </Table.Row>
              ))}
              {!rows.length && (
                <Typography tag="p" variant="body" color="subdued" className={emptyStyle}>No workers match</Typography>
              )}
            </Table.Body>
          </TeamData>
          {rows.length > 0 && (
            <Table.Foot>
              <Table.Row>
                <Table.Cell fill>
                  <Typography variant="bodyStrong">Total hours</Typography>
                </Table.Cell>
                {week.map((date) => (
                  <Table.Cell key={date} css={dayRaw} data-date={date}>
                    {date <= today && (
                      <Typography variant="bodyStrong">
                        {hoursLabel(dayTotal(rows.flatMap(({ cards: own }) => own.filter((card) => card.date === date))))}
                      </Typography>
                    )}
                  </Table.Cell>
                ))}
                <Table.Cell css={totalRaw}>
                  <Typography variant="bodyStrong">
                    {`${hoursLabel(summarize(rows.flatMap(({ cards: own }) => own)).confirmed)} confirmed`}
                  </Typography>
                </Table.Cell>
              </Table.Row>
            </Table.Foot>
          )}
        </Table>
      </section>

      {layer &&
        createPortal(
          <>
          <Presence>
            {opened && sameDay.length > 0 && (
              <TimecardOverlay
                key={`${opened.worker}:${opened.date}`}
                cards={sameDay}
                opened={opened.id}
                closed={weekClosed}
                height={height}
                onClose={() => setOpened(null)}
                onConfirm={(id, edit) => {
                  const notes = [...(edits[id]?.notes ?? []), ...(edit.notes ?? [])];
                  onEdits(merge(edits, { [id]: { ...edit, notes } }));
                  const card = { ...sameDay.find((c) => c.id === id)!, ...edit };
                  onSnack?.(
                    card.absent
                      ? edit.confirmed ? SNACKS.absenceConfirmed : SNACKS.absenceUnconfirmed
                      : (edit.confirmed ? SNACKS.confirmed : SNACKS.unconfirmed)(hoursOf(billable(card))),
                  );
                  // Unconfirmed, it stays open to change.
                  if (edit.confirmed) setOpened(null);
                }}
              />
            )}
          </Presence>
          <Presence>
            {adding && (
              <OffAppShiftOverlay
                key={adding === "new" ? "new" : adding.id}
                today={today}
                height={height}
                editing={adding === "new" ? undefined : adding}
                onCancel={() => setAdding(null)}
                onSave={(shift) => {
                  onOffApp(
                    adding === "new"
                      ? [{ ...shift, id: `off-app-${Date.now()}` }, ...offApp]
                      : offApp.map((s) => (s.id === adding.id ? { ...shift, id: s.id } : s)),
                  );
                  onSnack?.(adding === "new" ? SNACKS.offAppAdded : SNACKS.offAppUpdated);
                  setAdding(null);
                }}
              />
            )}
          </Presence>
          </>,
          layer,
        )}
    </div>
  );
}
