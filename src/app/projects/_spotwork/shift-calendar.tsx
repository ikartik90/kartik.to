"use client";

import {
  cloneElement,
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { css, cx } from "../../../../styled-system/css";
import { useDismiss } from "@/hooks/use-dismiss";
import { useControllable, useOpen } from "./controllable";
import { ListItem, moveFocus, useListKeys } from "./dropdown";
import { ownPart, partsOf, useOwner } from "./slots";
import {
  addDays,
  addMonths,
  dayTone,
  fieldDate,
  historyOf,
  longDate,
  monthOf,
  record,
  redo,
  toggle,
  undo,
  weekOf,
  type Iso,
} from "./shifts";
import {
  Button,
  FieldContext,
  Presence,
  Toolbar,
  Typography,
  boxStateRaw,
  enterRaw,
  panelStyle,
  selectStyle,
  tableOutlineStyle,
  useEscapeLayer,
  useField,
  revealInScroller,
  useHang,
} from "./ui";
import { DATE_PICKER } from "./copy";
import DateLeftIcon from "./assets/date-left.svg";
import CrossIcon from "./assets/icons/medium/cross.svg";
import ChevronUpIcon from "./assets/icons/medium/chevron-up.svg";
import ChevronDownIcon from "./assets/icons/medium/chevron-down.svg";
import ChevronLeftIcon from "./assets/icons/medium/chevron-left.svg";
import ChevronRightIcon from "./assets/icons/medium/chevron-right.svg";
import SmallChevronLeftIcon from "./assets/icons/small/chevron-left.svg";
import SmallChevronRightIcon from "./assets/icons/small/chevron-right.svg";
import DateRightIcon from "./assets/date-right.svg";
import CalendarIcon from "./assets/calendar.svg";
import SmallCalendarIcon from "./assets/icons/small/calendar.svg";

// SW Curie's Atoms/Form/Date Picker View, a compound `Calendar`, at the form's size (28px days, 16px apart), and the
// New Shift overlay's calendars built from it: the old design's month, the final version's three-month strip (drag to
// select, with undo and redo), and the recurrence concept's date fields.

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_WIDTH = 330;

// Large is the form's month (28px days, 16px apart); small a filter's (20px days, 10px apart, its picks outlined).
const viewStyle = css({
  flexShrink: 0,
  width: "var(--sw-width-calendar)",
  "&[data-size=small]": { width: "var(--sw-width-dropdown)" },
});

// What holds a month gives it its room round it, 330 across.
const monthRoomStyle = css({ padding: "var(--sw-padding-xl)" });

// Its arrows sit level with the month, at its two ends.
const periodListStyle = css({
  position: "relative",
  "& > [data-nav]": { position: "absolute", insetBlockStart: 0 },
  "& > [data-nav=prev]": { insetInlineStart: 0 },
  "& > [data-nav=next]": { insetInlineEnd: 0 },
  "[data-size=small] &": { "& > [data-nav] > svg": { width: "1.25rem", height: "1.25rem" } },
});

const periodStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-md)" });

const monthStyle = css({
  alignSelf: "center",
  display: "flex",
  alignItems: "center",
  height: "1.75rem",
  color: "var(--sw-glyph-default)",
});

const monthButtonStyle = css({ alignSelf: "center" });

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString("en-US", { month: "long" }));

const monthViewStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xs)",
  width: "var(--sw-width-calendar)",
  "& > div:first-child": {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "1.75rem",
  },
  "& h3": { color: "var(--sw-glyph-default)" },
  "& > div:first-child > button": { position: "absolute", insetInlineEnd: 0 },
  "& > div:last-child": { display: "flex", gap: "var(--sw-gap-md)", paddingInline: "var(--sw-padding-md)" },
});

const columnStyle = css({
  display: "flex",
  flex: "1 1 0",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--sw-gap-xs)",
  minWidth: 0,
  "& > [role=listbox]": { display: "flex", flexDirection: "column", alignItems: "center", width: "100%" },
  "& [role=option]": {
    width: "100%",
    maxWidth: "7.5rem",
    height: "1.75rem",
    borderRadius: "var(--sw-radius-xs)",
    color: "var(--sw-glyph-default)",
    textAlign: "center",
    "&:not([aria-selected=true]):hover": { backgroundColor: "var(--sw-hover-shade)" },
  },
  "&[data-column=year] [role=option]": { width: "3.75rem" },
  "& [role=option][aria-selected=true]": { backgroundColor: "var(--sw-surface-selected)", color: "var(--sw-glyph-selected)" },
});

const isoOfMonth = (year: number, month: number) => {
  const shifted = new Date(year, month, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-01`;
};

/** Atoms/Form/Date Picker View, its Month view: a month and a year, each stepped or picked from the five around it. */
function MonthYearView({ month, onChange, onClose }: { month: Iso; onChange: (month: Iso) => void; onClose: () => void }) {
  const [year, monthNumber] = month.split("-").map(Number);
  const index = monthNumber - 1;
  const around = [-2, -1, 0, 1, 2];
  return (
    <div className={monthViewStyle}>
      <div>
        <Typography tag="h3" variant="bodyLarge">{`${MONTHS[index]} ${year}`}</Typography>
        <Button size="icon" aria-label={DATE_PICKER.close} onClick={onClose}>
          <CrossIcon aria-hidden />
        </Button>
      </div>
      <div>
        <div className={columnStyle} data-column="month">
          <Button size="icon" aria-label={DATE_PICKER.previousMonth} onClick={() => onChange(isoOfMonth(year, index - 1))}>
            <ChevronUpIcon aria-hidden />
          </Button>
          <div role="listbox" aria-label="Month" onKeyDown={moveFocus}>
            {around.map((step) => {
              const at = (((index + step) % 12) + 12) % 12;
              return (
                <Typography
                  tag="button"
                  variant="bodyLarge"
                  key={step}
                  type="button"
                  role="option"
                  aria-selected={step === 0}
                  onClick={() => onChange(isoOfMonth(year, at))}
                >
                  {MONTHS[at]}
                </Typography>
              );
            })}
          </div>
          <Button size="icon" aria-label={DATE_PICKER.nextMonth} onClick={() => onChange(isoOfMonth(year, index + 1))}>
            <ChevronDownIcon aria-hidden />
          </Button>
          <Typography variant="metadata" color="subdued">
            Month
          </Typography>
        </div>
        <div className={columnStyle} data-column="year">
          <Button size="icon" aria-label={DATE_PICKER.previousYear} onClick={() => onChange(isoOfMonth(year - 1, index))}>
            <ChevronUpIcon aria-hidden />
          </Button>
          <div role="listbox" aria-label="Year" onKeyDown={moveFocus}>
            {around.map((step) => (
              <Typography
                tag="button"
                variant="bodyLarge"
                key={step}
                type="button"
                role="option"
                aria-selected={step === 0}
                onClick={() => onChange(isoOfMonth(year + step, index))}
              >
                {year + step}
              </Typography>
            ))}
          </div>
          <Button size="icon" aria-label={DATE_PICKER.nextYear} onClick={() => onChange(isoOfMonth(year + 1, index))}>
            <ChevronDownIcon aria-hidden />
          </Button>
          <Typography variant="metadata" color="subdued">
            Year
          </Typography>
        </div>
      </div>
    </div>
  );
}

const weekStyle = css({
  display: "flex",
  gap: "var(--sw-gap-xl)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-disabled)",
  "& > span": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "1.75rem",
    height: "1.75rem",
  },
  "& > span:first-child, & > span:last-child": { color: "var(--sw-glyph-subdued)" },
  "[data-size=small] &": { gap: "var(--sw-gap-md)", "& > span": { width: "1.25rem", height: "1.25rem" } },
});

const daysStyle = css({
  display: "flex",
  flexWrap: "wrap",
  alignContent: "flex-start",
  gap: "var(--sw-gap-xl)",
  "& > *": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "1.75rem",
    height: "1.75rem",
    borderRadius: "var(--sw-radius-xs)",
  },
  "& > [data-past]": { color: "var(--sw-glyph-placeholder)" },
  "& > [data-today]": { boxShadow: "inset 0 0 0 1px var(--sw-border-default)" },
  "& > button": { cursor: "pointer" },
  "& > button:not([aria-pressed=true], [data-picked], [data-tone])": { _hover: { backgroundColor: "var(--sw-hover-shade)" } },
  "& > [aria-pressed=true]:not([data-tone]), & > [data-picked]": {
    backgroundColor: "var(--sw-surface-selected)",
    color: "var(--sw-glyph-selected)",
  },
  // Where a press toggles a day, a picked one deepens under the pointer.
  "[data-toggle] &": {
    "& > [aria-pressed=true]:not([data-tone]):hover": {
      backgroundImage: "linear-gradient(var(--sw-surface-hover) 0 0)",
      backgroundBlendMode: "multiply",
    },
  },
  "& > [data-tone=regular]": {
    backgroundColor: "var(--sw-surface-success)",
    color: "var(--sw-glyph-success)",
  },
  "& > [data-tone=cancelled]": {
    backgroundColor: "var(--sw-surface-alert)",
    color: "var(--sw-glyph-alert)",
  },
  "& > [data-tone=added]": {
    backgroundColor: "var(--sw-surface-info)",
    color: "var(--sw-glyph-info)",
  },
  // Six weeks' room, the most a month spans, so the height holds from month to month.
  "[data-fixed] &": { minHeight: "calc(6 * 1.75rem + 5 * 1rem)" },
  "[data-size=small] &": {
    gap: "var(--sw-gap-md)",
    "& > *": { width: "1.25rem", height: "1.25rem" },
    "& > [data-weekend]": { color: "var(--sw-glyph-subdued)" },
    "& > [aria-pressed=true]": { boxShadow: "inset 0 0 0 1px var(--sw-border-selected)" },
  },
  // A band behind a week or range picked, fading `in` or `out` where the pick runs past the month.
  "&[data-select=week], &[data-select=range]": { position: "relative", isolation: "isolate" },
  "& > [data-band]": {
    position: "absolute",
    zIndex: -1,
    borderRadius: "var(--sw-radius-xxs)",
    backgroundColor: "var(--sw-surface-selected)",
  },
  "& > [data-band=in]": {
    backgroundColor: "transparent",
    backgroundImage: "linear-gradient(to left, var(--sw-surface-selected) 87.435%, transparent)",
  },
  "& > [data-band=out]": {
    backgroundColor: "transparent",
    backgroundImage: "linear-gradient(to right, var(--sw-surface-selected) 87.435%, transparent)",
  },
  "&[data-select=week] > [aria-pressed=true]": { backgroundColor: "transparent", boxShadow: "none" },
  "&[data-select=week] > [aria-pressed=true][data-today]": { boxShadow: "inset 0 0 0 1px var(--sw-border-selected)" },
  "&[data-select=range] > [aria-pressed=true]": { boxShadow: "none" },
  "&[data-select=range] > :is([aria-pressed=true], [data-today])": { borderRadius: "var(--sw-radius-xxs)" },
});

type Band = { row: number; left: number; width: number; fade?: "in" | "out" };

/**
 * One band per row of the month from `start` to `end`, `day` wide days `gap` apart, fading where the pick runs on into
 * the month before or after.
 */
function bandsOf(lead: number, days: Iso[], start: Iso, end: Iso, day: number, gap: number): Band[] {
  const cell = day + gap;
  const row = 7 * day + 6 * gap;
  const rows = new Map<number, number[]>();
  days.forEach((date, i) => {
    if (date < start || date > end) return;
    const at = lead + i;
    rows.set(Math.floor(at / 7), [...(rows.get(Math.floor(at / 7)) ?? []), at % 7]);
  });
  const lastRow = Math.floor((lead + days.length - 1) / 7);
  return [...rows].map(([line, columns]) => {
    const fadeIn = start < days[0] && line === 0;
    const fadeOut = end > days[days.length - 1] && line === lastRow;
    const left = Math.max(0, Math.min(...columns) * cell - (fadeIn ? gap * 2 : 0));
    const right = Math.min(row, Math.max(...columns) * cell + day + (fadeOut ? gap * 2 : 0));
    return { row: line, left, width: right - left, fade: fadeIn ? "in" : fadeOut ? "out" : undefined };
  });
}

/** What a press on `date` picks: the day, its week, or a range's end, the first press one end and the second the other. */
function pickOf(select: Select, picked: Iso[], date: Iso): Iso[] {
  if (select === "week") return weekOf(date);
  if (select === "range" && picked.length === 1) return [picked[0], date].sort();
  return [date];
}

type ViewType = "date" | "month";
type Select = "day" | "week" | "range";
type Size = "large" | "small";

type CalendarState = {
  size: Size;
  select: Select;
  label: string;
  lead: number;
  days: Iso[];
  picked: Iso[];
  today: Iso;
  from: Iso | null;
  to?: Iso;
  base?: Iso[];
  pick?: (date: Iso, event: ReactMouseEvent) => void;
  prev?: () => void;
  next?: () => void;
  openMonths?: () => void;
};

const CalendarContext = createContext<CalendarState | null>(null);
const useCalendar = (part: { displayName?: string }) => useOwner(CalendarContext, part);

/**
 * Atoms/Form/Date Picker View: one month, in its parts. Days before `from` (today unless null) or after `to` show but can't be picked, and
 * a calendar without `onPick` only shows what's picked. With `base`, a day it can pick is coloured by what picking does
 * to that schedule (`dayTone`), and the days gone are plain. With `onMonth`, its month opens the Month view, to pick
 * another month and year; `view` (Figma's View Type) holds it in one view or the other. Not given `month`, it holds its
 * own, from `defaultMonth`, steps it and opens the Month view; not given `picked`, it holds what's picked, from
 * `defaultPicked`. A press picks the day, its week or, a press for each end, a range, as `select` says.
 */
function CalendarRoot({
  month: heldMonth,
  defaultMonth,
  picked: heldPicked,
  defaultPicked = [],
  today,
  from = today,
  to,
  base,
  onPick,
  onPickedChange,
  select = "day",
  size = "large",
  onPrev,
  onNext,
  onMonth,
  view,
  defaultView = "date",
  onView,
  fixed,
  children,
}: {
  month?: Iso;
  defaultMonth?: Iso;
  picked?: Iso[];
  defaultPicked?: Iso[];
  today: Iso;
  from?: Iso | null;
  to?: Iso;
  base?: Iso[];
  onPick?: (date: Iso, event: ReactMouseEvent) => void;
  onPickedChange?: (picked: Iso[]) => void;
  select?: Select;
  size?: Size;
  onPrev?: () => void;
  onNext?: () => void;
  onMonth?: (month: Iso) => void;
  view?: ViewType;
  defaultView?: ViewType;
  onView?: (view: ViewType) => void;
  /** As tall as a six-week month, whatever this one spans. */
  fixed?: boolean;
  children: ReactNode;
}) {
  const [picked, setPicked] = useControllable(heldPicked, defaultPicked, onPickedChange);
  const [month, setMonth] = useControllable(heldMonth, defaultMonth ?? picked[0] ?? today);
  const [shown, show] = useControllable(view, defaultView, onView);
  const holds = heldMonth === undefined;
  const step = (by: number, then?: () => void) =>
    holds || then
      ? () => {
          setMonth(addMonths(month, by));
          then?.();
        }
      : undefined;
  const pickMonth =
    holds || onMonth
      ? (chosen: Iso) => {
          setMonth(chosen);
          onMonth?.(chosen);
        }
      : undefined;
  const pick =
    heldPicked === undefined || onPick || onPickedChange
      ? (date: Iso, event: ReactMouseEvent) => {
          setPicked(pickOf(select, picked, date));
          onPick?.(date, event);
        }
      : undefined;
  const state: CalendarState = {
    size,
    select,
    ...monthOf(month),
    picked,
    today,
    from,
    to,
    base,
    pick,
    prev: step(-1, onPrev),
    next: step(1, onNext),
    // Figma draws the Month view for the form's calendar only.
    openMonths: size === "large" && pickMonth ? () => show("month") : undefined,
  };
  return (
    <CalendarContext value={state}>
      <div className={viewStyle} data-size={size === "small" ? size : undefined} data-fixed={fixed ? "" : undefined}>
        {pickMonth && shown === "month" ? (
          <MonthYearView month={month} onChange={pickMonth} onClose={() => show("date")} />
        ) : (
          children
        )}
      </div>
    </CalendarContext>
  );
}
CalendarRoot.displayName = "Calendar";

function CalendarPeriodList({ children }: { children: ReactNode }) {
  useOwner(CalendarContext, CalendarPeriodList);
  return <div className={periodListStyle}>{children}</div>;
}
CalendarPeriodList.displayName = "Calendar.PeriodList";

function CalendarPrev({ children }: { children: ReactNode }) {
  const { prev } = useCalendar(CalendarPrev);
  return prev ? (
    <Button size="icon" data-nav="prev" aria-label={DATE_PICKER.previousMonth} onClick={prev}>
      {children}
    </Button>
  ) : null;
}
CalendarPrev.displayName = "Calendar.Prev";

function CalendarNext({ children }: { children: ReactNode }) {
  const { next } = useCalendar(CalendarNext);
  return next ? (
    <Button size="icon" data-nav="next" aria-label={DATE_PICKER.nextMonth} onClick={next}>
      {children}
    </Button>
  ) : null;
}
CalendarNext.displayName = "Calendar.Next";

function CalendarPeriod({ children }: { children: ReactNode }) {
  useOwner(CalendarContext, CalendarPeriod);
  return <div className={periodStyle}>{children}</div>;
}
CalendarPeriod.displayName = "Calendar.Period";

/** The month and year, which open the Month view where the calendar has one. */
function CalendarMonth() {
  const { label, openMonths, size } = useCalendar(CalendarMonth);
  const variant = size === "small" ? "metadata" : "bodyLarge";
  return openMonths ? (
    <Button size="small" emphasis="tertiary" className={monthButtonStyle} aria-label={DATE_PICKER.open(label)} onClick={openMonths}>
      {label}
    </Button>
  ) : (
    <Typography variant={variant} className={monthStyle}>
      {label}
    </Typography>
  );
}
CalendarMonth.displayName = "Calendar.Month";

/** The weekdays' letters, its `Calendar.Day` stamped for each. */
function CalendarWeek({ children }: { children: ReactElement<{ letter?: string }> }) {
  useOwner(CalendarContext, CalendarWeek);
  return (
    <div className={weekStyle} aria-hidden>
      {LETTERS.map((letter, i) => cloneElement(children, { key: i, letter }))}
    </div>
  );
}
CalendarWeek.displayName = "Calendar.Week";

function CalendarDay({ letter }: { letter?: string }) {
  const { size } = useCalendar(CalendarDay);
  return <Typography variant={size === "small" ? "metadata" : "bodyLarge"}>{letter}</Typography>;
}
CalendarDay.displayName = "Calendar.Day";

/** The month's days, its `Calendar.Date` stamped for each. */
function CalendarGrid({ children }: { children: ReactElement<{ date?: Iso }> }) {
  const { lead, days, picked, select, size } = useCalendar(CalendarGrid);
  const [start, end] = [picked[0], picked.at(-1)!];
  const bands =
    select !== "day" && picked.length > 1 ? bandsOf(lead, days, start, end, ...(size === "small" ? [20, 10] : [28, 16]) as [number, number]) : [];
  return (
    <div className={daysStyle} data-select={select === "day" ? undefined : select}>
      {bands.map((band) => (
        <span
          key={band.row}
          aria-hidden
          data-band={band.fade ?? ""}
          style={{ top: band.row * (size === "small" ? 30 : 44), left: band.left, width: band.width }}
        />
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <span key={`lead-${i}`} />
      ))}
      {days.map((date) => cloneElement(children, { key: date, date }))}
    </div>
  );
}
CalendarGrid.displayName = "Calendar.Grid";

function CalendarDate({ date }: { date?: Iso }) {
  const { picked, today, from, to, base, pick, size } = useCalendar(CalendarDate);
  if (!date) return null;
  const variant = size === "small" ? "metadata" : "bodyLarge";
  const column = new Date(`${date}T00:00`).getDay();
  const marks = {
    "data-today": date === today ? "" : undefined,
    "aria-current": date === today ? ("date" as const) : undefined,
    "data-weekend": column === 0 || column === 6 ? "" : undefined,
    "data-date": date,
  };
  const on = picked.includes(date);
  return pick && (from === null || date >= from) && (!to || date <= to) ? (
    <Typography
      tag="button"
      variant={variant}
      type="button"
      aria-label={longDate(date)}
      aria-pressed={on}
      data-tone={base && dayTone(base, picked, date)}
      onClick={(event) => pick(date, event)}
      {...marks}
    >
      {Number(date.slice(8))}
    </Typography>
  ) : (
    <Typography
      variant={variant}
      data-past={pick ? "" : undefined}
      data-picked={on && !base ? "" : undefined}
      {...marks}
    >
      {Number(date.slice(8))}
    </Typography>
  );
}
CalendarDate.displayName = "Calendar.Date";

export const Calendar = Object.assign(CalendarRoot, {
  PeriodList: ownPart(CalendarPeriodList),
  Prev: ownPart(CalendarPrev),
  Next: ownPart(CalendarNext),
  Period: ownPart(CalendarPeriod),
  Month: ownPart(CalendarMonth),
  Week: ownPart(CalendarWeek),
  Day: ownPart(CalendarDay),
  Grid: ownPart(CalendarGrid),
  Date: ownPart(CalendarDate),
});

// A month as the app's calendars show it.
const PERIOD = (
  <Calendar.Period>
    <Calendar.Month />
    <Calendar.Week>
      <Calendar.Day />
    </Calendar.Week>
    <Calendar.Grid>
      <Calendar.Date />
    </Calendar.Grid>
  </Calendar.Period>
);

const PERIOD_LIST = (
  <Calendar.PeriodList>
    <Calendar.Prev>
      <ChevronLeftIcon aria-hidden />
    </Calendar.Prev>
    {PERIOD}
    <Calendar.Next>
      <ChevronRightIcon aria-hidden />
    </Calendar.Next>
  </Calendar.PeriodList>
);

/** A small calendar's month, as the filters show it. */
export const SMALL_PERIOD_LIST = (
  <Calendar.PeriodList>
    <Calendar.Prev>
      <SmallChevronLeftIcon aria-hidden />
    </Calendar.Prev>
    {PERIOD}
    <Calendar.Next>
      <SmallChevronRightIcon aria-hidden />
    </Calendar.Next>
  </Calendar.PeriodList>
);

// The outline sits over the fades.
const stripStyle = cx(
  tableOutlineStyle,
  css({ display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "var(--sw-surface-default)" }),
);

// The middle month sits in the middle; its neighbours show their inner edges under the fades.
const viewportStyle = css({
  position: "relative",
  overflow: "hidden",
  touchAction: "none",
  userSelect: "none",
});

const trackStyle = css({
  display: "flex",
  width: "fit-content",
  marginInlineStart: "50%",
  transform: "translateX(-50%)",
});

// Panda's `backdropFilter` emits only the -webkit- form; the raw key is what Chromium reads.
const blurLight = { "-webkit-backdrop-filter": "blur(0.5px)", "backdrop-filter": "blur(0.5px)" };
const blurMedium = { "-webkit-backdrop-filter": "blur(1px)", "backdrop-filter": "blur(1px)" };
const blurStrong = { "-webkit-backdrop-filter": "blur(2px)", "backdrop-filter": "blur(2px)" };

// Each fade blurs harder towards the strip's edge: layers stacked, each stronger one masked to less of the fade.
const fadeStyle = css({
  position: "absolute",
  insetBlock: 0,
  display: "flex",
  alignItems: "center",
  width: "5.5rem",
  pointerEvents: "none",
  "& > button": { position: "relative", display: "flex", pointerEvents: "auto", cursor: "pointer" },
  "& > [data-blur]": { position: "absolute", inset: 0 },
  "& > [data-blur='1']": blurLight,
  "& > [data-blur='2']": blurMedium,
  "& > [data-blur='3']": blurStrong,
  "&[data-side=start]": {
    insetInlineStart: 0,
    paddingInlineStart: "var(--sw-padding-md)",
    backgroundImage: "linear-gradient(to right, var(--sw-surface-subdued), transparent)",
    "& > [data-blur='1']": { maskImage: "linear-gradient(to right, #000, transparent)" },
    "& > [data-blur='2']": { maskImage: "linear-gradient(to right, #000, transparent 66%)" },
    "& > [data-blur='3']": { maskImage: "linear-gradient(to right, #000, transparent 33%)" },
  },
  "&[data-side=end]": {
    insetInlineEnd: 0,
    justifyContent: "flex-end",
    paddingInlineEnd: "var(--sw-padding-md)",
    backgroundImage: "linear-gradient(to right, transparent, var(--sw-surface-subdued))",
    "& > [data-blur='1']": { maskImage: "linear-gradient(to left, #000, transparent)" },
    "& > [data-blur='2']": { maskImage: "linear-gradient(to left, #000, transparent 66%)" },
    "& > [data-blur='3']": { maskImage: "linear-gradient(to left, #000, transparent 33%)" },
  },
});

const BLURS = [1, 2, 3].map((layer) => <span key={layer} data-blur={layer} aria-hidden />);

const marqueeStyle = css({
  position: "absolute",
  backgroundColor: "color-mix(in srgb, var(--sw-colors-blue-ribbon-200) 25%, transparent)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-target)",
  pointerEvents: "none",
});

type Box = { left: number; top: number; width: number; height: number };
interface Gesture {
  x: number;
  y: number;
  base: Iso[];
  moved: boolean;
  /** What the drag has picked so far. */
  live: Iso[] | null;
  /** The day the press started on, which a press without a drag toggles. */
  start: Iso | null;
  view: DOMRect;
  scale: number;
  cells: { date: Iso; rect: DOMRect }[];
}

const moves = () => !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Three months side by side, opening on `first`. With `onChange` or `defaultValue`, a press toggles a day and a drag
 * toggles every day its rectangle covers, each undoable; given `value` alone, it shows what's picked. `base` and `footer` are Edit Schedule's.
 * In a `Field`, named by its `Label` and described by its hint.
 */
export function CalendarStrip({
  value = [],
  defaultValue,
  onChange,
  today,
  first: opening,
  base,
  footer,
  tone,
}: {
  value?: Iso[];
  defaultValue?: Iso[];
  onChange?: (dates: Iso[]) => void;
  today: Iso;
  first: Iso;
  base?: Iso[];
  footer?: ReactNode;
  /** Alert while a form needs a date picked and has none. */
  tone?: "alert";
}) {
  const [first, setFirst] = useState(opening);
  const editable = !!onChange || defaultValue !== undefined;
  const [history, setHistory] = useState(() => historyOf(defaultValue ?? value));
  const [live, setLive] = useState<Iso[] | null>(null);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const shown = editable ? (live ?? history.present) : value;
  const field = use(FieldContext);

  const commit = (next: typeof history) => {
    setHistory(next);
    onChange?.(next.present);
  };

  // The months slide a column's width towards where they're going.
  const show = (month: Iso) => {
    if (month === first) return;
    const by = month > first ? 1 : -1;
    setFirst(month);
    if (moves())
      track.current?.animate(
        [{ transform: `translateX(calc(-50% + ${(by * MONTH_WIDTH) / 16}rem))` }, { transform: "translateX(-50%)" }],
        { duration: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
  };

  const press = (event: ReactPointerEvent<HTMLDivElement>) => {
    const view = viewport.current;
    if (!editable || !view || event.button !== 0 || (event.target as Element).closest("[data-nav]")) return;
    const box = view.getBoundingClientRect();
    const day = (event.target as Element).closest<HTMLElement>("button[data-date]");
    gesture.current = {
      x: event.clientX,
      y: event.clientY,
      base: history.present,
      moved: false,
      live: null,
      start: day?.dataset.date ?? null,
      view: box,
      scale: box.width / view.offsetWidth || 1,
      cells: [...view.querySelectorAll<HTMLElement>("button[data-date]")].map((cell) => ({
        date: cell.dataset.date!,
        rect: cell.getBoundingClientRect(),
      })),
    };
    view.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const drag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (!g.moved && Math.hypot(event.clientX - g.x, event.clientY - g.y) < 4) return;
    g.moved = true;
    // Kept inside the calendar, whichever way the pointer strays.
    const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
    const x = clamp(event.clientX, g.view.left, g.view.right);
    const y = clamp(event.clientY, g.view.top, g.view.bottom);
    const [left, right] = [Math.min(g.x, x), Math.max(g.x, x)];
    const [top, bottom] = [Math.min(g.y, y), Math.max(g.y, y)];
    const covered = g.cells
      .filter(({ rect }) => rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top)
      .map(({ date }) => date);
    g.live = toggle(g.base, covered);
    setLive(g.live);
    setMarquee({
      left: (left - g.view.left) / g.scale,
      top: (top - g.view.top) / g.scale,
      width: (right - left) / g.scale,
      height: (bottom - top) / g.scale,
    });
  };

  const release = () => {
    const g = gesture.current;
    gesture.current = null;
    setMarquee(null);
    setLive(null);
    if (!g) return;
    if (g.moved && g.live) commit(record(history, g.live));
    else if (!g.moved && g.start) commit(record(history, toggle(g.base, [g.start])));
  };

  return (
    <div
      className={stripStyle}
      data-state={tone}
      role={field.field ? "group" : undefined}
      aria-labelledby={field.labelId}
      aria-describedby={field.hintId}
    >
      {editable && (
        <Toolbar
          end={
            <Button size="small" emphasis="secondary" onClick={() => show(opening)}>
              Today
            </Button>
          }
        >
          <Toolbar.History
            onUndo={history.past.length ? () => commit(undo(history)) : undefined}
            onRedo={history.future.length ? () => commit(redo(history)) : undefined}
          />
        </Toolbar>
      )}
      <div
        ref={viewport}
        className={viewportStyle}
        onPointerDown={press}
        onPointerMove={drag}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <div ref={track} className={trackStyle}>
          {[0, 1, 2].map((offset) => {
            const month = addMonths(first, offset);
            return (
              <div key={month} className={monthRoomStyle} data-toggle={editable ? "" : undefined}>
                <Calendar
                  fixed
                  month={month}
                  picked={shown}
                  today={today}
                  base={base}
                  // Pointer presses are the gesture's; this is the keyboard's Enter and Space.
                  onPick={editable ? (date, event) => event.detail === 0 && commit(record(history, toggle(history.present, [date]))) : undefined}
                >
                  {PERIOD}
                </Calendar>
              </div>
            );
          })}
        </div>
        <div className={fadeStyle} data-side="start">
          {BLURS}
          <button type="button" data-nav="" aria-label="Previous month" onClick={() => show(addMonths(first, -1))}>
            <DateLeftIcon aria-hidden />
          </button>
        </div>
        <div className={fadeStyle} data-side="end">
          {BLURS}
          <button type="button" data-nav="" aria-label="Next month" onClick={() => show(addMonths(first, 1))}>
            <DateRightIcon aria-hidden />
          </button>
        </div>
        {marquee && <div className={marqueeStyle} style={marquee} />}
      </div>
      {footer}
    </div>
  );
}

const dateAnchorStyle = css({ position: "relative", display: "flex", width: "9.25rem" });

const dateBoxStyle = css(boxStateRaw, {
  display: "flex",
  flex: "1 1 auto",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--sw-gap-md)",
  height: "2.5rem",
  paddingInline: "var(--sw-padding-md)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-default)",
  textAlign: "start",
  cursor: "pointer",
  "& > svg": { flexShrink: 0 },
  // The date keeps the default glyph while the box and its calendar take the state's colour.
  "&[data-state] > span": { color: "var(--sw-glyph-default)" },
  _disabled: {
    backgroundColor: "var(--sw-surface-disabled)",
    boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
    color: "var(--sw-glyph-disabled)",
    cursor: "default",
  },
});

// Its month, 4px under the box, or over it where `useFlip` puts it.
const datePopoverStyle = css(enterRaw, {
  position: "absolute",
  insetBlockStart: "calc(100% + 0.25rem)",
  insetInlineStart: 0,
  "&[data-side=above]": { insetBlockStart: "auto", insetBlockEnd: "calc(100% + 0.25rem)", "--entrance-from": "4px" },
  zIndex: 3,
  width: "20rem",
  padding: "var(--sw-padding-md)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)",
  outline: "2px solid var(--sw-outline-focus)",
});

// Small, Atoms/Filter's box as wide as what it shows, or across what holds it.
const smallAnchorStyle = css({ position: "relative", display: "flex", width: "fit-content", "&[data-fill]": { width: "100%" } });
const smallBoxStyle = css({ "&[data-fill]": { flex: "1 1 auto", justifyContent: "space-between" } });

// A range's presets, then Custom, ruled off; a custom range's small month.
const presetsStyle = css({ display: "flex", flexDirection: "column", width: "13.75rem" });
const customStyle = css({ borderBlockStart: "1px solid var(--sw-border-subdued)" });
const smallMonthStyle = css({ padding: "var(--sw-padding-md)" });

type Range = { start: Iso; end: Iso };

type DateBase = {
  /** Small, Atoms/Filter's 28px box over a small month (Molecules/Filter/Date Picker). */
  size?: "large" | "small";
  today: Iso;
  /** The first day it can pick: today unless given, or none for `null`. */
  from?: Iso | null;
  to?: Iso;
  disabled?: boolean;
  /** Opens showing, as the design system shows the Active state. */
  defaultOpen?: boolean;
  /** Small, across what holds it (a table cell's inline edit). */
  fill?: boolean;
  "aria-label"?: string;
  /** A range's `DatePicker.Preset`s, offered before a custom range. */
  children?: ReactNode;
};

type DayProps = DateBase & {
  select?: "day";
  value?: Iso | null;
  defaultValue?: Iso | null;
  onChange?: (date: Iso) => void;
  /** The view its month opens on: its days, or its month and year. */
  defaultView?: ViewType;
};

type RangeProps = DateBase & {
  select: "range";
  value?: Range;
  defaultValue?: Range;
  onChange?: (range: Range) => void;
};

/** A range picker's presets: their size, and picking the last few days. */
const PresetContext = createContext<{ size: Size; take: (days: number) => void } | null>(null);

/** A range of the last `days` days; its words are its `Typography`. */
function DatePickerPreset({ days, children }: { days: number; children: ReactNode }) {
  const preset = useOwner(PresetContext, DatePickerPreset);
  return (
    <ListItem size={preset.size} onClick={() => preset.take(days)}>
      {children}
    </ListItem>
  );
}
DatePickerPreset.displayName = "DatePicker.Preset";

/** "11/12/2023", as Figma's filter writes a date. */
const shortDate = (iso: Iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}/${iso.slice(0, 4)}`;

/** The box and the popover it opens, closed by Escape or a press outside; in a modal, over the dialog (`useHang`). */
function useDatePopover(defaultOpen: boolean) {
  const { open, setOpen, outside } = useOpen(defaultOpen);
  const root = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  const { side, style, hang, mark, ignore, scrim } = useHang(root, popover, open, { gap: 4 });
  useDismiss({ ref: root, onDismiss: close, enabled: open, dismissOnOutsidePointer: outside, ignoreSelector: ignore });
  useEscapeLayer(popover, open, close);
  return { open, setOpen, close, root, popover, side, style, hang, mark, scrim };
}

/**
 * SW Curie's Molecules/Form/Date Picker: the date as mm/dd/yyyy, picked on a month that opens under it, or over it
 * where there's no room below. It holds the day picked, from `defaultValue`, unless its owner holds `value`. With
 * `select="range"`, a range, from its `DatePicker.Preset`s or a custom pick of both ends; small, Atoms/Filter's.
 */
function DatePickerRoot(props: DayProps | RangeProps) {
  return props.select === "range" ? <RangePicker {...props} /> : <DayPicker {...props} />;
}

function DayPicker({
  value: held,
  defaultValue = null,
  onChange,
  today,
  from = today,
  to,
  size = "large",
  fill,
  disabled: off,
  defaultOpen = false,
  defaultView,
  "aria-label": label,
}: DayProps) {
  const [value, setValue] = useControllable<Iso | null>(held, defaultValue, (date) => {
    if (date) onChange?.(date);
  });
  const { open, setOpen, close, root, popover, side, style, hang, mark, scrim } = useDatePopover(defaultOpen);
  const field = useField({ active: open });
  const disabled = off ?? field.disabled;
  const small = size === "small";

  // Opened low in a page, it scrolls into view; one that starts open, or hangs over a modal, leaves its page where it is.
  const toggled = useRef(false);
  useEffect(() => {
    if (open && toggled.current && !scrim && popover.current) revealInScroller(popover.current);
  }, [open, popover, scrim]);

  return (
    <div
      ref={root}
      className={small ? smallAnchorStyle : dateAnchorStyle}
      data-anchor=""
      data-fill={fill ? "" : undefined}
      data-open={open ? "" : undefined}
    >
      <Typography
        tag="button"
        variant={small ? "metadata" : "bodyLarge"}
        type="button"
        id={field.id}
        className={small ? cx(selectStyle, smallBoxStyle) : dateBoxStyle}
        data-box=""
        data-fill={fill ? "" : undefined}
        data-state={disabled ? undefined : field.state}
        aria-label={label}
        aria-labelledby={field.labelId}
        aria-describedby={field.hintId}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => {
          toggled.current = true;
          setOpen(!open);
        }}
      >
        <span>{value ? (small ? shortDate(value) : fieldDate(value)) : ""}</span>
        {small ? <SmallCalendarIcon aria-hidden /> : <CalendarIcon aria-hidden />}
      </Typography>
      {hang(
        <Presence>
          {open && (
            <div
              ref={popover}
              className={small ? cx(panelStyle, smallMonthStyle) : datePopoverStyle}
              style={style}
              role="dialog"
              aria-label={label}
              aria-labelledby={field.labelId}
              data-hug={small ? "" : undefined}
              data-side={small ? undefined : side}
              {...mark}
              data-escape-layer=""
            >
              <Calendar
                size={size}
                defaultView={defaultView}
                defaultMonth={value ?? to ?? from ?? today}
                picked={value ? [value] : []}
                today={today}
                from={from}
                to={to}
                onPick={(date) => {
                  setValue(date);
                  close();
                }}
              >
                {small ? SMALL_PERIOD_LIST : PERIOD_LIST}
              </Calendar>
            </div>
          )}
        </Presence>,
      )}
    </div>
  );
}

function RangePicker({
  value: held,
  defaultValue,
  onChange,
  today,
  from = null,
  to,
  size = "large",
  fill,
  disabled: off,
  defaultOpen = false,
  "aria-label": label = "Date",
  children,
}: RangeProps) {
  const [value, setValue] = useControllable(held, defaultValue ?? { start: today, end: today }, onChange);
  const { open, setOpen, close, root, popover, side, style, hang, mark } = useDatePopover(defaultOpen);
  const field = useField({ active: open });
  const disabled = off ?? field.disabled;
  const small = size === "small";
  const presets = partsOf(children, DatePickerPreset);
  const [custom, setCustom] = useState(presets.length === 0);
  const [draft, setDraft] = useState<Iso | null>(null);
  const take = (next: Range) => {
    setValue(next);
    close();
  };
  const reopen = () => {
    setCustom(presets.length === 0);
    setDraft(null);
  };
  const presetList = useRef<HTMLDivElement>(null);
  const keys = useListKeys(presetList, open, () => {
    reopen();
    setOpen(true);
  });
  const words = small ? shortDate : fieldDate;
  return (
    <div
      ref={root}
      className={small ? smallAnchorStyle : dateAnchorStyle}
      data-anchor=""
      data-fill={fill ? "" : undefined}
      data-open={open ? "" : undefined}
    >
      <Typography
        tag="button"
        variant={small ? "metadata" : "bodyLarge"}
        type="button"
        id={field.id}
        className={small ? cx(selectStyle, smallBoxStyle) : dateBoxStyle}
        data-box=""
        data-fill={fill ? "" : undefined}
        data-state={disabled ? undefined : field.state}
        aria-label={`${words(value.start)} – ${words(value.end)}`}
        aria-describedby={field.hintId}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          reopen();
          setOpen(!open);
        }}
        onKeyDown={keys}
      >
        <span data-group="">
          <span>{words(value.start)}</span>
          <span>–</span>
          <span>{words(value.end)}</span>
        </span>
        {small ? <SmallCalendarIcon aria-hidden /> : <CalendarIcon aria-hidden />}
      </Typography>
      {hang(
        <Presence>
          {open && (
            <div
              ref={popover}
              className={small ? panelStyle : datePopoverStyle}
              style={style}
              role="dialog"
              aria-label={label}
              data-hug={small ? "" : undefined}
              data-side={small ? undefined : side}
              {...mark}
              data-escape-layer=""
            >
              {custom ? (
                <div className={small ? smallMonthStyle : undefined}>
                  <Calendar
                    size={size}
                    select="range"
                    today={today}
                    from={from}
                    to={to}
                    picked={draft ? [draft] : [value.start, value.end]}
                    onPickedChange={(next) => (next.length === 2 ? take({ start: next[0], end: next[1] }) : setDraft(next[0]))}
                  >
                    {small ? SMALL_PERIOD_LIST : PERIOD_LIST}
                  </Calendar>
                </div>
              ) : (
                <div ref={presetList} className={presetsStyle} role="listbox" aria-label="Date range">
                  <PresetContext value={{ size, take: (days) => take({ start: addDays(today, 1 - days), end: today }) }}>
                    {presets}
                  </PresetContext>
                  <ListItem size={size} className={customStyle} onClick={() => setCustom(true)}>
                    <Typography variant={small ? "metadata" : "bodyLarge"}>Custom</Typography>
                  </ListItem>
                </div>
              )}
            </div>
          )}
        </Presence>,
      )}
    </div>
  );
}

DatePickerRoot.displayName = "DatePicker";

export const DatePicker = Object.assign(DatePickerRoot, { Preset: ownPart(DatePickerPreset) });

const monthBoxStyle = css({
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
  "&[data-state=alert]": { boxShadow: "inset 0 0 0 1.5px var(--sw-border-alert)", outline: "2px solid var(--sw-outline-alert)" },
});

/** The old design's Scheduling Calendar: one month, a press toggling each day. */
export function SchedulingCalendar({
  value,
  onChange,
  today,
  tone,
}: {
  value: Iso[];
  onChange: (dates: Iso[]) => void;
  today: Iso;
  /** Alert while a form needs a date picked and has none. */
  tone?: "alert";
}) {
  const [month, setMonth] = useState(() => value[0] ?? today);
  return (
    <div className={cx(monthBoxStyle, monthRoomStyle)} data-state={tone}>
      <Calendar
        month={month}
        picked={value}
        today={today}
        onPrev={() => setMonth(addMonths(month, -1))}
        onNext={() => setMonth(addMonths(month, 1))}
        onPick={(date) => onChange(toggle(value, [date]))}
      >
        {PERIOD_LIST}
      </Calendar>
    </div>
  );
}
