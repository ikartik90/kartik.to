"use client";

import Image from "next/image";
import { useId, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { css, cx } from "../../../../styled-system/css";
import { hstack } from "../../../../styled-system/patterns";
import { bookingOn, dayKey, offerActions, plannerRows, sendOffers, withdrawOffers, type Booking, type Filter, type Offers, type Row, type Show } from "./planner";
import { addMonths, clockTime, longDate, monthName, weekOf, weekdayOf, type Iso, type Series } from "./shifts";
import { SNACKS } from "./copy";
import { useTemplates } from "./templates";
import { GeofenceMap } from "./geofence-map";
import { CalendarStrip } from "./shift-calendar";
import { EditSchedule } from "./edit-schedule";
import { Search } from "./search";
import { BulkSelect } from "./filters";
import { partsOf, restOf } from "./slots";
import { Button, Checkbox, Chip, Field, LabelValuePair, Presence, SegmentedControl, Tooltip, Typography, addressStyle, hatchStyle, mapStyle, pairsStyle, selectedCellRaw, SideSheet, stickyHeadStyle, summarySectionStyle, tableFrameStyle, tableScrollerRaw, useEscapeLayer } from "./ui";
import { Avatar, Table, initialsOf } from "./data-table";
import { TabGroup } from "./tabs";
import mapToronto from "./assets/map-toronto.png";
import PlannerIcon from "./assets/tab-planner.svg";
import SummaryIcon from "./assets/tab-summary.svg";
import EditIcon from "./assets/edit.svg";
import MapPinIcon from "./assets/map-pin.svg";
import DoubleTickIcon from "./assets/double-tick.svg";
import CancellationIcon from "./assets/cancellation.svg";
import TickIcon from "./assets/tick-large.svg";

// SW Curie's Shift Planner side sheet: a shift's people on each of its days (22217:158037) and its summary
// (22084:95693); in the final version, Edit Schedule opens over it (22221:176638). Figma's "Spotter" is "worker" here.

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** A day column's width, in rem. */
const DAY_WIDTH = 5.25;

// Isolated, so the planner's sticky cells stay under Edit Schedule.
const isolatedStyle = css({ isolation: "isolate" });

const plannerStyle = css({
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
  minHeight: 0,
  paddingBlock: "var(--sw-padding-xxl)",
  paddingInline: "var(--sw-padding-xl)",
});

const filtersStyle = css({ display: "flex", alignItems: "center", gap: "var(--sw-gap-md)", flexShrink: 0 });

// Over everything in the body while its subtle bulk select shows, which runs past the column: while pointed at,
// focused or open, and until its box has folded back.
const overWorkerRaw = css.raw({
  transition: "z-index 0s 300ms",
  "&:hover, &:focus-within, &:has([aria-expanded=true])": { zIndex: 4, transitionDelay: "0s" },
});

// Over the line across its row, which would show what passes under it, so it draws that line across itself.
const lineRaw = css.raw({
  "[role=row] + [role=row] > &": {
    backgroundImage: "linear-gradient(var(--sw-border-subdued) 1px, var(--sw-surface-default) 1px)",
  },
});

// The head's checkboxes and search hold at the scroller's start over both its lines, ruled below as the days' heads are;
// the search beside too, as the worker's column is.
const startHeadRaw = css.raw({
  position: "sticky",
  zIndex: 1,
  gridRow: "1 / span 2",
  alignItems: "flex-end",
  height: "auto",
  paddingBlock: "var(--sw-padding-xs)",
  backgroundColor: "var(--sw-surface-default)",
  "&:not(:last-child)": { boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)" },
});

const pickHeadRaw = css.raw(startHeadRaw, overWorkerRaw, {
  insetInlineStart: 0,
  gridColumn: 1,
  paddingInline: "var(--sw-padding-xs) var(--sw-padding-none)",
  borderStartStartRadius: "var(--sw-radius-md)",
});

const searchHeadRaw = css.raw(startHeadRaw, {
  insetInlineStart: "2.25rem",
  gridColumn: 2,
  paddingInline: "var(--sw-padding-xxs) var(--sw-padding-3xl)",
  "&:not(:last-child)": { boxShadow: "inset -1px -1px 0 var(--sw-border-subdued)" },
});

// The outline over the head while focus lifts it, but for the search's cell while the search has focus, its ring whole.
const plannerFrameStyle = cx(
  tableFrameStyle,
  css({
    "&:focus-within::after": { zIndex: 8 },
    "&:has(input:focus)::after": {
      clipPath: "polygon(0 0, 2.25rem 0, 2.25rem 4rem, 19.5rem 4rem, 19.5rem 0, 100% 0, 100% 100%, 0 100%)",
    },
  }),
);

// Each month's name holds at the scroller's start while its days pass under it.
const monthStyle = css({
  gridRow: 1,
  display: "flex",
  alignItems: "center",
  whiteSpace: "nowrap",
  boxShadow: "inset -1px -1px 0 var(--sw-border-subdued), inset 0 1px 0 var(--sw-border-subdued)",
  "& > span": { position: "sticky", insetInlineStart: "19.5rem", paddingInline: "var(--sw-padding-xxl)" },
});

// A day's header, ruled below, and beside at its week's end.
const dayHeadRaw = css.raw({
  gridRow: 2,
  height: "auto",
  paddingBlock: "var(--sw-padding-xs)",
  paddingInline: "var(--sw-padding-lg)",
  boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)",
  "&:not(:last-child)": { boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)" },
  "&[data-week-end], &[data-week-end]:not(:last-child)": { boxShadow: "inset -1px -1px 0 var(--sw-border-subdued)" },
});


const rowRaw = css.raw({ height: "4.75rem" });

const pickRaw = css.raw(overWorkerRaw, lineRaw, {
  position: "sticky",
  insetInlineStart: 0,
  zIndex: 3,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  paddingBlock: "var(--sw-padding-none)",
  paddingInline: "var(--sw-padding-xs) var(--sw-padding-none)",
  backgroundColor: "var(--sw-surface-default)",
  "& > [data-lead]": { display: "contents" },
  "&:not(:last-child)": { boxShadow: "none" },
});

// The worker's cell holds at the scroller's start beside the checkboxes, over the days' selections.
const workerCellRaw = css.raw(lineRaw, {
  position: "sticky",
  insetInlineStart: "2.25rem",
  zIndex: 3,
  paddingInline: "var(--sw-padding-xxs) var(--sw-padding-sm)",
  backgroundColor: "var(--sw-surface-default)",
});

// A worker's day, divided from the next only at its week's end.
const dayRaw = css.raw({
  "&:not(:last-child)": { boxShadow: "none" },
  "&[data-week-end], &[data-week-end]:not(:last-child)": { boxShadow: "inset -1px 0 0 var(--sw-border-subdued)" },
});

// Overlay/Shift Planner/Applicant Selector, at the planner's 84 × 76: a worker's day across its cell, its icon over its
// word, outside the row's lines. Days gone are grey, whatever they hold.
const selectorRaw = css.raw(selectedCellRaw, {
  display: "flex",
  minWidth: "5.25rem",
  minHeight: "4.75rem",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--sw-gap-xs)",
  paddingBlock: "var(--sw-padding-none)",
  paddingInline: "var(--sw-padding-none)",
  "& > [data-lead]": { display: "contents" },
  "& > :not([data-avatar]) ~ :not([data-avatar], :has(> [data-escape-layer]))": { marginBlockStart: 0 },
  "& > [data-lead] > span": { display: "flex", alignItems: "center", height: "1.75rem" },
  "&[data-booking=booked]": { backgroundColor: "var(--sw-surface-success)", color: "var(--sw-glyph-success)" },
  "&[data-booking=cancelled]": { backgroundColor: "var(--sw-surface-alert)", color: "var(--sw-glyph-alert)" },
  "&[data-booking=offered]": { backgroundColor: "var(--sw-surface-info)", color: "var(--sw-glyph-info)" },
  "&[data-booking=waitlisted]": { backgroundColor: "var(--sw-surface-default)", color: "var(--sw-glyph-default)" },
  "&[data-past], &[data-past][data-booking]": { backgroundColor: "var(--sw-surface-subdued)", color: "var(--sw-glyph-disabled)" },
  // A day with nothing booked takes Hover; a booked one keeps its colours and shows its mark.
  "&[data-selectable]:not([data-selected], [data-booking]):hover": { backgroundColor: "var(--sw-hover-shade)" },
  "& > [data-mark], & > [data-lead] > [data-mark]": {
    position: "absolute",
    insetBlockStart: "var(--sw-padding-xxs)",
    insetInlineEnd: "var(--sw-padding-xxs)",
    pointerEvents: "none",
  },
  "&[data-selectable]:not([data-selected]) > [data-mark], &[data-selectable]:not([data-selected]) > [data-lead] > [data-mark]": {
    visibility: "hidden",
  },
  "&[data-selectable]:not([data-selected]):is(:hover, :has(> [data-select]:focus-visible)) > [data-mark], &[data-selectable]:not([data-selected]):is(:hover, :has(> [data-select]:focus-visible)) > [data-lead] > [data-mark]":
    { visibility: "visible" },
  "& > [data-select]": {
    position: "absolute",
    inset: 0,
    padding: 0,
    border: "none",
    background: "none",
    cursor: "pointer",
    _focusVisible: { outline: "2px solid var(--sw-outline-focus)", outlineOffset: "-2px" },
  },
});

const BOOKING: Record<NonNullable<Booking>, { label: string; icon: ReactNode }> = {
  booked: { label: "Booked", icon: <DoubleTickIcon key="icon" aria-hidden /> },
  cancelled: { label: "Cancelled", icon: <CancellationIcon key="icon" aria-hidden /> },
  offered: { label: "Offered", icon: <TickIcon key="icon" aria-hidden /> },
  waitlisted: { label: "Waitlisted", icon: <TickIcon key="icon" aria-hidden /> },
};

// What a bulk select picks a worker's days by: nothing booked, or each booking, in the Applicant Selector's words.
const PICKS: { booking: Booking; label: string }[] = [
  { booking: null, label: "Available" },
  ...(["offered", "waitlisted", "booked", "cancelled"] as const).map((booking) => ({ booking, label: BOOKING[booking].label })),
];

const bookingOf = (label: string) => PICKS.find((pick) => pick.label === label)!.booking;

/** What's booked on a day as its Applicant Selector shows it: its icon, then its word. */
export const bookingParts = (booking: Booking) =>
  booking && [
    BOOKING[booking].icon,
    <Typography key="word" variant="metadata">
      {BOOKING[booking].label}
    </Typography>,
  ];

/**
 * Overlay/Shift Planner/Applicant Selector: a table cell, a worker's day in the Shift Planner, in the colours of what's
 * `booking`ed on it, grey once gone; its icon over its word, a `Typography`. While `selected`, it's bordered and marked
 * at its top end, and one box with the selected neighbours it's `joined` to. With `onSelect`, it's a button named by
 * `label` that shows its mark subdued while pointed at. It takes what any of its table's cells takes.
 */
export function ApplicantSelector({
  booking,
  past,
  selected,
  joined,
  onSelect,
  label,
  css: own,
  className,
  children,
  ...props
}: ComponentProps<typeof Table.Cell> & {
  booking: Booking;
  past?: boolean;
  selected?: boolean;
  joined?: ("top" | "right" | "bottom" | "left")[];
  onSelect?: () => void;
  label?: string;
}) {
  const icon = restOf(children, Typography);
  return (
    <Table.Cell
      {...props}
      css={css.raw(selectorRaw, own)}
      className={cx(booking === "waitlisted" && hatchStyle, className)}
      data-booking={booking ?? undefined}
      data-past={past ? "" : undefined}
      data-selected={selected ? "" : undefined}
      data-joined={joined?.length ? joined.join(" ") : undefined}
      data-selectable={onSelect ? "" : undefined}
    >
      {icon.length > 0 && <span>{icon}</span>}
      {partsOf(children, Typography)}
      {(selected || onSelect) && (
        <span data-mark="" aria-hidden inert>
          <Checkbox size="small" checked={!!selected} />
        </span>
      )}
      {onSelect && <button type="button" data-select="" aria-label={label} aria-pressed={!!selected} onClick={onSelect} />}
    </Table.Cell>
  );
}

const SHOWS: { show: Show; label: string }[] = [
  { show: "all", label: "All" },
  { show: "candidates", label: "Candidates" },
  { show: "offered", label: "Offered" },
  { show: "booked", label: "Booked" },
];


function PlannerTab({
  series,
  today,
  glimpse,
  onOffers,
  onSnack,
}: {
  series: Series;
  today: Iso;
  /** Its workers and days, before what's booked on them is in. */
  glimpse?: boolean;
  onOffers?: (offers: Offers) => void;
  onSnack?: (message: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>({ show: "all", publicApplicants: true, search: "" });
  const [selected, setSelected] = useState<string[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<HTMLDivElement | null>(null);
  const [room, setRoom] = useState(0);
  const rows = plannerRows(series, today, filter);
  const dates = series.dates;
  const columns = `2.25rem 17.25rem repeat(${dates.length}, ${DAY_WIDTH}rem)`;
  const weekEnd = (i: number) => i === dates.length - 1 || weekOf(dates[i])[0] !== weekOf(dates[i + 1])[0];
  const bookingFor = (row: Row, date: Iso) => bookingOn(series, row, date, today);
  // The days still to come of `shown`, or only those holding `booking`.
  const daysOf = (shown: Row[], booking?: Booking) =>
    shown.flatMap((row) =>
      dates
        .filter((date) => date >= today && (booking === undefined || bookingFor(row, date) === booking))
        .map((date) => dayKey(row, date)),
    );
  const pick = (shown: Row[], days: string[]) => {
    const theirs = new Set(daysOf(shown));
    setSelected([...selected.filter((day) => !theirs.has(day)), ...days]);
  };
  const chosen = new Set(selected);
  const isChosen = (r: number, c: number) => r >= 0 && r < rows.length && c >= 0 && c < dates.length && chosen.has(dayKey(rows[r], dates[c]));
  const toggle = (day: string) => setSelected(chosen.has(day) ? selected.filter((one) => one !== day) : [...selected, day]);
  const actions = offerActions(series, today, selected);
  const act = (changed: Offers, snack: string) => {
    onOffers?.(changed);
    setSelected([]);
    onSnack?.(snack);
  };
  const send = () => {
    const sent = sendOffers(series, today, selected);
    const waitlisted = selected.filter((day) => sent[day] !== series.offers?.[day] && sent[day] === "waitlisted").length;
    act(sent, SNACKS.offersSent(actions.send - waitlisted, waitlisted));
  };
  // The sides a selected day meets other selected days on, so they share one selection.
  const joinsOf = (r: number, c: number) =>
    (["top", "right", "bottom", "left"] as const).filter(
      (side) => ({ top: isChosen(r - 1, c), right: isChosen(r, c + 1), bottom: isChosen(r + 1, c), left: isChosen(r, c - 1) })[side],
    );
  // Only what the days still to come of `shown` hold.
  const bulkSelect = (shown: Row[], label?: string) => (
    <BulkSelect
      size="large"
      subtle
      aria-label={label}
      checked={daysOf(shown).some((day) => chosen.has(day))}
      onCheck={(on) => pick(shown, on ? daysOf(shown) : [])}
      onPick={(value) => pick(shown, daysOf(shown, bookingOf(value)))}
    >
      {PICKS.filter(({ booking }) => daysOf(shown, booking).length > 0).map(({ label }) => (
        <BulkSelect.Item key={label} value={label}>
          <Typography variant="body">{label}</Typography>
        </BulkSelect.Item>
      ))}
    </BulkSelect>
  );
  const months = dates.reduce<{ name: string; span: number }[]>((all, date) => {
    const name = monthName(date);
    if (all.at(-1)?.name === name) all.at(-1)!.span += 1;
    else all.push({ name, span: 1 });
    return all;
  }, []);

  // Opens on this week, the days gone just off the start.
  useLayoutEffect(() => {
    const ahead = series.dates.findIndex((date) => date >= weekOf(today)[0]);
    if (scroller.current) scroller.current.scrollLeft = (ahead < 0 ? series.dates.length : ahead) * DAY_WIDTH * parseFloat(getComputedStyle(document.documentElement).fontSize);
  }, [series.id, series.dates, today]);

  // The floating action bar's height at the table's end, so its last row scrolls clear of the bar, only while the
  // rows would otherwise run under it, and until the bar has sunk away.
  const acting = selected.length > 0;
  useLayoutEffect(() => {
    const [table, box, over] = [scroller.current, frame.current, bar];
    if (!table || !box || !over) return setRoom(0);
    const measure = () => {
      const shown = Math.min(table.scrollHeight - (parseFloat(getComputedStyle(table).paddingBlockEnd) || 0), box.offsetHeight);
      const gap = parseFloat(getComputedStyle(box.parentElement!).paddingBlockEnd);
      setRoom(box.offsetTop + shown > over.offsetTop - gap ? over.offsetHeight : 0);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(over);
    observer.observe(box.parentElement!);
    return () => observer.disconnect();
  }, [bar, rows.length]);

  return (
    <>
      <div className={plannerStyle}>
        <div className={filtersStyle}>
          <SegmentedControl
            value={filter.show}
            onChange={(show) => setFilter({ ...filter, show })}
            size="small"
            aria-label="Show"
          >
            {SHOWS.map(({ show, label }) => (
              <SegmentedControl.Segment key={show} value={show}>
                {label}
              </SegmentedControl.Segment>
            ))}
          </SegmentedControl>
          <Field orientation="horizontal">
            <Checkbox
              size="small"
              checked={filter.publicApplicants}
              onChange={(publicApplicants) => setFilter({ ...filter, publicApplicants })}
            />
            <Field.Label>Show public applicants</Field.Label>
          </Field>
        </div>
        <div ref={frame} className={plannerFrameStyle}>
          <Table
            ref={scroller}
            aria-label="Shift planner"
            columns={columns}
            css={tableScrollerRaw}
            style={room ? { paddingBlockEnd: room } : undefined}
          >
            <Table.Head className={stickyHeadStyle}>
              <Table.Row style={{ gridTemplateRows: "1.75rem 2.25rem" }}>
                <Table.Cell css={pickHeadRaw}>{bulkSelect(rows)}</Table.Cell>
                <Table.Cell search css={searchHeadRaw}>
                  <Search
                    size="small"
                    aria-label="Find a worker"
                    placeholder="Find a worker..."
                    value={filter.search}
                    onChange={(event) => setFilter({ ...filter, search: event.target.value })}
                  />
                </Table.Cell>
                {months.map(({ name, span }, i) => (
                  <Typography
                    key={name}
                    tag="div"
                    variant="metadata"
                    color="placeholder" className={monthStyle}
                    aria-hidden
                    style={{ gridColumn: `${3 + months.slice(0, i).reduce((sum, m) => sum + m.span, 0)} / span ${span}` }}
                  >
                    <Typography variant="metadata">{name}</Typography>
                  </Typography>
                ))}
                {dates.map((date, i) => (
                  <Table.Cell
                    key={date}
                    css={dayHeadRaw}
                    active={date === today}
                    data-week-end={weekEnd(i) ? "" : undefined}
                    style={{ gridColumn: i + 3 }}
                  >
                    <Typography variant="metadata">{date.slice(8)}</Typography>
                    <Typography variant="metadata">{WEEKDAY_SHORT[weekdayOf(date)]}</Typography>
                  </Table.Cell>
                ))}
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {rows.map((row, r) => (
                <Table.Row key={row.person.id} css={rowRaw}>
                  <Table.Cell css={pickRaw}>{bulkSelect([row], row.person.name)}</Table.Cell>
                  <Table.Cell header css={workerCellRaw}>
                    <Avatar src={row.person.face}>{initialsOf(row.person.name)}</Avatar>
                    <Typography variant="body">{row.person.name}</Typography>
                    <div className={hstack({ gap: "var(--sw-gap-xs)", alignItems: "flex-start" })}>
                      {row.person.pool && <Chip size="small" state="success">Worker Pool</Chip>}
                      {row.person.applicant && <Chip size="small" state="affirmative">Applicant</Chip>}
                    </div>
                  </Table.Cell>
                  {dates.map((date, i) => {
                    const booking = glimpse ? null : bookingFor(row, date);
                    const ahead = date >= today;
                    const pickable = ahead && !glimpse;
                    return (
                      <ApplicantSelector
                        key={date}
                        booking={booking}
                        past={!ahead}
                        selected={isChosen(r, i)}
                        joined={isChosen(r, i) ? joinsOf(r, i) : undefined}
                        onSelect={pickable ? () => toggle(dayKey(row, date)) : undefined}
                        label={pickable ? longDate(date) : undefined}
                        css={dayRaw}
                        data-week-end={weekEnd(i) ? "" : undefined}
                      >
                        {bookingParts(booking)}
                      </ApplicantSelector>
                    );
                  })}
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </div>
      <Presence>
        {acting && (
          <SideSheet.ActionBar floating ref={setBar}>
            <SideSheet.Cancel onClick={() => setSelected([])} />
            <SideSheet.ForwardActions>
              {actions.withdraw > 0 && (
                <Button
                  emphasis="secondary"
                  tone="destructive"
                  onClick={() => act(withdrawOffers(series, today, selected), SNACKS.offersWithdrawn(actions.withdraw))}
                >
                  Withdraw offers
                </Button>
              )}
              {actions.send > 0 && <Button onClick={send}>Send offers</Button>}
            </SideSheet.ForwardActions>
          </SideSheet.ActionBar>
        )}
      </Presence>
    </>
  );
}

const summaryStyle = css({
  flex: "1 1 auto",
  minHeight: 0,
  overflowY: "auto",
  overscrollBehavior: "contain",
  paddingBlock: "var(--sw-padding-xl)",
  paddingInline: "var(--sw-padding-xl)",
  "& > div": { display: "flex", flexDirection: "column", maxWidth: "var(--sw-width-card)", marginInline: "auto" },
});

const informationStyle = css({ display: "flex", alignItems: "flex-start", gap: "var(--sw-gap-xl)" });

function SummaryTab({ series, today, onEdit }: { series: Series; today: Iso; onEdit?: () => void }) {
  const template = useTemplates().find((t) => t.id === series.template)!;
  const ahead = series.dates.find((date) => date >= today);
  return (
    <div className={summaryStyle}>
      <div>
        <Typography tag="h3" variant="heading">{series.title}</Typography>
        <section className={summarySectionStyle} aria-label="Shift plan">
          <div>
            <Typography tag="h4" variant="subheading">Shift plan</Typography>
            <Button size="icon" aria-label="Edit shift plan" onClick={onEdit}>
              <EditIcon aria-hidden />
              <Tooltip>Edit shift plan</Tooltip>
            </Button>
          </div>
          <CalendarStrip value={series.dates} today={today} first={addMonths(ahead ?? today, -1)} />
          <div className={pairsStyle}>
            <LabelValuePair>
              <Typography variant="metadata" color="subdued">Shift Time</Typography>
              <Typography variant="body">{`${clockTime(series.start)}—${clockTime(series.end)}`}</Typography>
            </LabelValuePair>
            <LabelValuePair>
              <Typography variant="metadata" color="subdued">{series.paidBreak ? "Paid Break" : "Unpaid Break"}</Typography>
              <Typography variant="body">{`${series.breakMinutes ?? 30} minutes`}</Typography>
            </LabelValuePair>
            <LabelValuePair>
              <Typography variant="metadata" color="subdued">No. of Workers</Typography>
              <Typography variant="body">{series.workers}</Typography>
            </LabelValuePair>
            <LabelValuePair>
              <Typography variant="metadata" color="subdued">Reporting To</Typography>
              <Typography variant="body">{series.reportTo ?? "Yousuf Hamedani"}</Typography>
            </LabelValuePair>
          </div>
        </section>
        <section className={summarySectionStyle} aria-label="Shift information">
          <div>
            <Typography tag="h4" variant="subheading">Shift information</Typography>
            <Button size="icon" aria-label="Edit basic information">
              <EditIcon aria-hidden />
              <Tooltip>Edit basic information</Tooltip>
            </Button>
          </div>
          <div className={pairsStyle}>
            <LabelValuePair>
              <Typography variant="metadata" color="subdued">Position Title</Typography>
              <Typography variant="body">{template.name}</Typography>
            </LabelValuePair>
            <LabelValuePair>
              <Typography variant="metadata" color="subdued">Hourly Wage</Typography>
              <Typography variant="body">{template.wage}</Typography>
            </LabelValuePair>
          </div>
          <div className={informationStyle}>
            <div className={addressStyle} data-size="large">
              <Typography tag="div" variant="body">
                <span>{template.address}</span>
                <span>{template.unit}</span>
              </Typography>
              <Typography tag="p" variant="metadata" color="subdued">{template.directions}</Typography>
            </div>
            {template.place ? (
              <GeofenceMap place={template.place} value={template.geofence} entrance={template.entrance} size="large" editable={false} />
            ) : (
              <div className={mapStyle} data-size="large">
                <Image src={mapToronto} alt="" width={723} height={444} />
                <MapPinIcon aria-hidden />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

type Tab = "planner" | "summary";

const panelStyle = css({ display: "flex", flex: "1 1 auto", flexDirection: "column", minHeight: 0 });

export function ShiftPlanner({
  series,
  today,
  height,
  layer,
  onReschedule,
  onOffers,
  onSnack,
  onClose,
}: {
  series: Series;
  today: Iso;
  /** The app's, which the sheet runs down. */
  height: number;
  /** Where Edit Schedule hangs: the app's overlay layer. */
  layer: HTMLElement;
  /** The final version's Edit Schedule; without it, the sheet has none. */
  onReschedule?: (dates: Iso[], spotFill: boolean) => void;
  /** Send offers' and Withdraw offers' save: the shift's offers after it. */
  onOffers?: (offers: Offers) => void;
  onSnack?: (message: string) => void;
  onClose: () => void;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("planner");
  const [editing, setEditing] = useState(false);
  const id = useId();
  const template = useTemplates().find((t) => t.id === series.template)!;
  useEscapeLayer(sheet, true, onClose);

  const edit = onReschedule && (() => setEditing(true));
  const tabs: { tab: Tab; label: string; icon: ReactNode }[] = [
    { tab: "planner", label: "Shift planner", icon: <PlannerIcon aria-hidden /> },
    { tab: "summary", label: "Shift summary", icon: <SummaryIcon aria-hidden /> },
  ];
  const tabPanel = (glimpse: boolean) => (
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} className={panelStyle}>
      {tab === "planner" ? (
        <PlannerTab series={series} today={today} glimpse={glimpse} onOffers={onOffers} onSnack={onSnack} />
      ) : (
        <SummaryTab series={series} today={today} onEdit={edit} />
      )}
    </div>
  );

  return (
    <SideSheet
      size="large"
      onClose={onClose}
      ref={sheet}
      className={isolatedStyle}
      style={{ height }}
      label={template.name}
      data-escape-layer=""
    >
      <SideSheet.Header>
        <Typography variant="heading">{template.name}</Typography>
        {edit && (
          <SideSheet.SheetActions>
            <Button size="small" emphasis="secondary" onClick={edit}>
              Edit schedule...
            </Button>
          </SideSheet.SheetActions>
        )}
        <SideSheet.Close />
        <Typography variant="metadata" color="subdued">{series.title}</Typography>
      </SideSheet.Header>
      <TabGroup size="small" value={tab} onChange={setTab}>
        {tabs.map(({ tab: value, label, icon }) => (
          <TabGroup.Tab key={value} value={value} id={`${id}-${value}`} aria-controls={`${id}-panel`}>
            {icon}
            {label}
          </TabGroup.Tab>
        ))}
      </TabGroup>
      <SideSheet.Deferred fallback={tabPanel(true)}>{tabPanel(false)}</SideSheet.Deferred>
      {createPortal(
        <Presence>
          {editing && onReschedule && (
            <EditSchedule
              series={series}
              position={template.name}
              today={today}
              height={height}
              onCancel={() => setEditing(false)}
              onSave={(dates, spotFill) => {
                onReschedule(dates, spotFill);
                setEditing(false);
              }}
            />
          )}
        </Presence>,
        layer,
      )}
    </SideSheet>
  );
}
