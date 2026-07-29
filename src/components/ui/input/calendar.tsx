"use client";

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useMemo,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Temporal } from "@js-temporal/polyfill";
import { cx } from "../../../../styled-system/css";
import { calendar } from "../../../../styled-system/recipes";
import {
  buildCalendarPeriods,
  monthsBetween,
  type CalendarCell,
  type CalendarMonth,
  type WeekdayHeaderCell,
  type WeekdayKey,
} from "@/utils/calendar-month";
import { Field, useField, type FieldSearchProps } from "./field";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Calendar — the composable grid behind the Date input's popover.
//
//   <Calendar value={date} onValueChange={setDate} months={3}>
//     <Field.Search />
//     <Calendar.PeriodList>
//       <Button variant="icon"><ChevronLeft/></Button>
//       <Calendar.Period>                                {/* one template, cloned per month */}
//         <Calendar.Month />
//         <Calendar.Week><Calendar.Day/></Calendar.Week>   {/* cloned per weekday */}
//         <Calendar.Grid><Calendar.Date/></Calendar.Grid>  {/* cloned per day     */}
//       </Calendar.Period>
//       <Button variant="icon"><ChevronRight/></Button>
//     </Calendar.PeriodList>
//   </Calendar>
//
// The root owns Temporal month math + selection and hands each part what it
// needs through context. Cloning is the idiom at every level: `PeriodList`
// clones its single `Period` template once per visible month (and its two
// icon-`Button` chevrons into prev/next), and inside each `Period` the
// `Week`/`Grid` clone their own single child once per header/day cell. A
// `Period` publishes its month on a second context, so the parts below it read
// THEIR month rather than the root's — which is what makes one template render
// April, May and June without any of them taking a prop.
//
// `months` (default 1) sets the range size, and the chevrons page a whole range
// at a time. Every day cell surfaces its state (aria-selected, data-state=today,
// data-outside, :disabled) AND identity (data-weekday, data-weekend) as
// attributes, so the look is fully re-skinnable off selectors.
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]; // prettier-ignore

const WEEKDAY_NARROW: Record<WeekdayKey, string> = {
  sun: "S", mon: "M", tue: "T", wed: "W", thu: "T", fri: "F", sat: "S",
}; // prettier-ignore

const WEEKDAY_LONG: Record<WeekdayKey, string> = {
  sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday",
  thu: "Thursday", fri: "Friday", sat: "Saturday",
}; // prettier-ignore

/** How a `Calendar.Month` renders its label. */
export type MonthFormat = "full" | "narrow";

/** "July 2026" / "Jul 2026" — the two `monthFormat`s, from a first-of-month. */
function monthLabel(
  start: Temporal.PlainDate,
  format: MonthFormat = "full",
): string {
  const name = MONTH_NAMES[start.month - 1];
  return `${format === "narrow" ? name.slice(0, 3) : name} ${start.year}`;
}

type CalendarStyles = ReturnType<typeof calendar>;

type CalendarContextValue = {
  styles: CalendarStyles;
  today: Temporal.PlainDate;
  selected: Temporal.PlainDate | null;
  min?: Temporal.PlainDate;
  max?: Temporal.PlainDate;
  /** First-of-month for the FIRST month of the visible range. */
  view: Temporal.PlainDate;
  /** How many months the range spans — what one chevron press pages by. */
  months: number;
  /** The date the search currently resolves to — Enter's pending target. */
  query: Temporal.PlainDate | null;
  /**
   * The single roving-tabindex anchor across the whole range
   * (query ▸ selected ▸ today ▸ first-of-range).
   */
  activeDate: Temporal.PlainDate;
  /** One entry per visible month, in order. */
  periods: CalendarMonth[];
  select: (date: Temporal.PlainDate) => void;
  prevPage: () => void;
  nextPage: () => void;
};

const CalendarContext = createContext<CalendarContextValue | null>(null);

function useCalendar(component: string): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error(`${component} must be used within <Calendar>.`);
  return ctx;
}

// The month a `Calendar.Period` is rendering, published so the parts beneath it
// (Month / Week / Grid) read THEIR month instead of the root's — the whole
// reason one Period template can render a three-month range.
const CalendarPeriodContext = createContext<CalendarMonth | null>(null);

function usePeriod(component: string): CalendarMonth {
  const period = useContext(CalendarPeriodContext);
  if (!period)
    throw new Error(`${component} must be used within <Calendar.Period>.`);
  return period;
}

function isDisabled(
  date: Temporal.PlainDate,
  min?: Temporal.PlainDate,
  max?: Temporal.PlainDate,
): boolean {
  if (min && Temporal.PlainDate.compare(date, min) < 0) return true;
  if (max && Temporal.PlainDate.compare(date, max) > 0) return true;
  return false;
}

export interface CalendarProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /** Controlled selection. */
  value?: Temporal.PlainDate | null;
  /** Initial selection when uncontrolled. */
  defaultValue?: Temporal.PlainDate | null;
  /** Fired with the picked date. */
  onValueChange?: (date: Temporal.PlainDate) => void;
  /** Lower/upper selectable bounds (inclusive). */
  min?: Temporal.PlainDate;
  max?: Temporal.PlainDate;
  /** Which weekday sits in column 0. Defaults to Sunday. */
  weekStartsOn?: WeekdayKey;
  /**
   * How many consecutive months the range shows, starting at the view — one
   * `Calendar.Period` each. The chevrons page a whole range at a time, so
   * `months={3}` steps Apr–Jun ▸ Jul–Sep. Defaults to 1.
   */
  months?: number;
  /**
   * Parses a dropped-in `Field.Search`'s raw query into a date to navigate to
   * (e.g. `parseCalendarDate("DD/MM/YYYY")`). The box stays dumb — it emits the
   * raw string and the Calendar interprets it here, the mirror of OptionList's
   * `filter`. Omit it and typing navigates nowhere (a bare search is inert).
   */
  queryParser?: (query: string) => Temporal.PlainDate | null;
  /**
   * Retint for the surface it sits on. `default` = standalone; `onBrand` = the
   * Date input popover's brand-tinted surface (palette inverts).
   */
  tone?: "default" | "onBrand";
  /** Override "today" — primarily for tests/deterministic rendering. */
  today?: Temporal.PlainDate;
  children: ReactNode;
}

function CalendarRoot({
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  weekStartsOn = "sun",
  months = 1,
  queryParser,
  tone = "default",
  today: todayProp,
  className,
  children,
  ...rest
}: CalendarProps) {
  // This interactive calendar is always a field control (inline, or the Date
  // input's popover), so it hard-consumes the field wiring like Switch does —
  // but as a compound group it associates via aria-labelledby/-describedby
  // (a <div role="group"> is not a labelable `htmlFor` target). Display-only
  // calendars (availability/event/heatmap) are a separate component.
  const { labelId, hasLabel, hintId, hasHint } = useField("Calendar");
  const styles = calendar({ tone });
  const today = todayProp ?? Temporal.Now.plainDateISO();

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<Temporal.PlainDate | null>(
    defaultValue ?? null,
  );
  const selected = isControlled ? (value ?? null) : internal;

  const [view, setView] = useState<Temporal.PlainDate>(() =>
    (value ?? defaultValue ?? today).with({ day: 1 }),
  );

  const periods = useMemo(
    () => buildCalendarPeriods(view, { months, weekStartsOn }),
    [view, months, weekStartsOn],
  );

  // What the search currently resolves to, if anything — see `goToQuery` below.
  const [query, setQuery] = useState<Temporal.PlainDate | null>(null);

  const inView = (d: Temporal.PlainDate) => {
    const offset = monthsBetween(view, d);
    return offset >= 0 && offset < Math.max(1, months);
  };
  // A resolving query outranks the selection: it's what Enter would commit, so
  // it's also where a Tab into the grid should land.
  const activeDate =
    query && inView(query)
      ? query
      : selected && inView(selected)
        ? selected
        : inView(today)
          ? today
          : view;

  // Page the range onto `date` only if it isn't already on screen. Clicking a
  // day in the third visible month must not shuffle the grid out from under the
  // pointer; an off-range date pages so it lands in the FIRST slot.
  const reveal = (date: Temporal.PlainDate) => {
    if (!inView(date)) setView(date.with({ day: 1 }));
  };

  const select = (date: Temporal.PlainDate) => {
    if (isDisabled(date, min, max)) return;
    if (!isControlled) setInternal(date);
    onValueChange?.(date);
    reveal(date);
  };

  // One chevron press moves a whole range, so the months on screen never repeat
  // between pages (Apr–Jun ▸ Jul–Sep, not Apr–Jun ▸ May–Jul).
  const stride = Math.max(1, months);

  const ctx: CalendarContextValue = {
    styles,
    today,
    selected,
    min,
    max,
    view,
    months: stride,
    query,
    activeDate,
    periods,
    select,
    prevPage: () => setView((v) => v.subtract({ months: stride })),
    nextPage: () => setView((v) => v.add({ months: stride })),
  };

  // Type-ahead is a division of labour: the Field.Search stays a dumb box that
  // emits the raw query; the Calendar interprets it with its OWN `queryParser`
  // and decides what to DO with the result (the mirror of OptionList's `filter`,
  // which lives on the container for the same reason — only the container holds
  // what the query is matched against). Parsing is opt-in: no `queryParser` prop
  // means the raw string never resolves to a date, so nothing navigates.
  //
  // Typing only NAVIGATES: a resolved date pages the grid to that month, takes
  // the roving tabstop, and marks its cell `data-query` so the recipe can
  // preview it — but it stops there. Committing stays an explicit act — Enter
  // here, or Space / Enter on a day cell (they're real buttons) — so Escape can
  // dismiss a picker without the last thing typed becoming the selection.
  const commitQuery = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter commits whatever the search currently resolves to — the `query` the
    // last keystroke parsed. Space is a literal character in a text field, so
    // the day cells own that half of the "Enter/Space commits" convention.
    if (event.key !== "Enter" || !query) return;
    event.preventDefault();
    select(query); // still gated by min/max, exactly like a clicked cell
  };

  // Dress a Field.Search dropped directly under <Calendar>: give it the `search`
  // slot and interpret its raw query here via `queryParser`. Every other child,
  // and the consumer's own handlers, are left untouched / composed with.
  const dressed = Children.map(children, (child) => {
    if (isValidElement(child) && child.type === Field.Search) {
      const el = child as ReactElement<FieldSearchProps>;
      return cloneElement(el, {
        className: cx(styles.search, el.props.className),
        onValueChange: (raw: string) => {
          el.props.onValueChange?.(raw);
          const date = queryParser?.(raw) ?? null;
          setQuery(date);
          if (date) reveal(date);
        },
        onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
          el.props.onKeyDown?.(event);
          if (event.defaultPrevented) return;
          commitQuery(event);
        },
      });
    }
    return child;
  });

  return (
    <CalendarContext.Provider value={ctx}>
      <div
        role="group"
        aria-labelledby={hasLabel ? labelId : undefined}
        aria-describedby={hasHint ? hintId : undefined}
        className={cx(styles.root, className)}
        {...rest}
      >
        {dressed}
      </div>
    </CalendarContext.Provider>
  );
}

export type CalendarPeriodListProps = HTMLAttributes<HTMLDivElement>;

/**
 * The row of months, and the only part that knows how many there are. It clones
 * its single `Calendar.Period` template once per visible month, and wires its
 * icon-`Button` children in order — the first pages back, the second forward —
 * so the chevron buttons stay generic and this part owns the wiring. One pair
 * flanks the WHOLE list rather than any single month — which is why they belong
 * here and not inside a `Period`.
 */
function CalendarPeriodList({
  className,
  children,
  ...rest
}: CalendarPeriodListProps) {
  const { styles, periods, months, prevPage, nextPage } = useCalendar(
    "Calendar.PeriodList",
  );
  const items = Children.toArray(children);
  const isAction = (c: ReactNode): c is ReactElement =>
    isValidElement(c) && c.type === Button;
  const unit = months === 1 ? "month" : `${months} months`;

  const expanded = items.flatMap((child, i) => {
    if (isAction(child)) {
      const el = child as ReactElement<{
        onClick?: () => void;
        "aria-label"?: string;
      }>;
      // First chevron pages back, the second forward.
      const isPrev = items.slice(0, i).filter(isAction).length === 0;
      const side = isPrev ? "prev" : "next";
      // The chevron goes in a positioned wrapper rather than being positioned
      // itself: it's a `Button`, and no slot style can outrank that recipe (see
      // the `nav` slot). The wrapper is also what pins it to the list's corner.
      return (
        <div key={side} data-nav={side} className={styles.nav}>
          {cloneElement(el, {
            onClick: el.props.onClick ?? (isPrev ? prevPage : nextPage),
            "aria-label":
              el.props["aria-label"] ??
              (isPrev ? `Previous ${unit}` : `Next ${unit}`),
          })}
        </div>
      );
    }
    if (isValidElement(child) && child.type === CalendarPeriod) {
      const el = child as ReactElement<CalendarPeriodProps>;
      return periods.map((period) =>
        cloneElement(el, { key: period.key, period }),
      );
    }
    return child;
  });

  return (
    <div className={cx(styles.periodList, className)} {...rest}>
      {expanded}
    </div>
  );
}

export interface CalendarPeriodProps extends HTMLAttributes<HTMLDivElement> {
  /** Injected by Calendar.PeriodList; not set by consumers. */
  period?: CalendarMonth;
}

/**
 * One month column — its label, weekday header and day grid. Written once and
 * cloned per visible month, so it publishes the month it was handed and the
 * parts inside read that rather than the root's view.
 */
function CalendarPeriod({
  period,
  className,
  children,
  ...rest
}: CalendarPeriodProps) {
  const { styles } = useCalendar("Calendar.Period");
  if (!period)
    throw new Error("Calendar.Period must be a child of Calendar.PeriodList.");
  return (
    <CalendarPeriodContext.Provider value={period}>
      <div className={cx(styles.period, className)} {...rest}>
        {children}
      </div>
    </CalendarPeriodContext.Provider>
  );
}

export interface CalendarMonthProps extends HTMLAttributes<HTMLDivElement> {
  /** `full` → "July 2026" (default); `narrow` → "Jul 2026". */
  monthFormat?: MonthFormat;
}

/** The "July 2026" label for the month its `Calendar.Period` is rendering. */
function CalendarMonthLabel({
  monthFormat = "full",
  className,
  children,
  ...rest
}: CalendarMonthProps) {
  const { styles } = useCalendar("Calendar.Month");
  const period = usePeriod("Calendar.Month");
  return (
    <div aria-live="polite" className={cx(styles.month, className)} {...rest}>
      {children ?? monthLabel(period.start, monthFormat)}
    </div>
  );
}

export type CalendarWeekProps = HTMLAttributes<HTMLDivElement>;

/** The weekday header row — clones its single Calendar.Day per header cell. */
function CalendarWeek({ className, children, ...rest }: CalendarWeekProps) {
  const { styles } = useCalendar("Calendar.Week");
  const { weekdays } = usePeriod("Calendar.Week");
  const template = Children.only(children) as ReactElement<CalendarDayProps>;
  return (
    <div role="row" className={cx(styles.week, className)} {...rest}>
      {weekdays.map((wd) => cloneElement(template, { key: wd.key, headerCell: wd }))}
    </div>
  );
}

export interface CalendarDayProps extends HTMLAttributes<HTMLDivElement> {
  /** Injected by Calendar.Week; not set by consumers. */
  headerCell?: WeekdayHeaderCell;
}

/** One weekday header cell (e.g. "S"), carrying data-weekday/data-weekend. */
function CalendarDay({
  headerCell,
  className,
  children,
  ...rest
}: CalendarDayProps) {
  const { styles } = useCalendar("Calendar.Day");
  if (!headerCell) throw new Error("Calendar.Day must be a child of Calendar.Week.");
  return (
    <div
      role="columnheader"
      aria-label={WEEKDAY_LONG[headerCell.key]}
      data-weekday={headerCell.key}
      data-weekend={headerCell.isWeekend || undefined}
      className={cx(styles.weekday, className)}
      {...rest}
    >
      {children ?? WEEKDAY_NARROW[headerCell.key]}
    </div>
  );
}

export type CalendarGridProps = HTMLAttributes<HTMLDivElement>;

/** The day grid — clones its single Calendar.Date per day in the 6×7 month. */
function CalendarGrid({ className, children, ...rest }: CalendarGridProps) {
  const { styles } = useCalendar("Calendar.Grid");
  const { weeks, start } = usePeriod("Calendar.Grid");
  const template = Children.only(children) as ReactElement<CalendarDateProps>;
  return (
    <div
      role="grid"
      // Always the full month name, whatever the visible label's `monthFormat`.
      aria-label={monthLabel(start)}
      className={cx(styles.grid, className)}
      {...rest}
    >
      {weeks.flat().map((cell) => cloneElement(template, { key: cell.key, cell }))}
    </div>
  );
}

export interface CalendarDateProps
  extends Omit<HTMLAttributes<HTMLButtonElement>, "children"> {
  /** Injected by Calendar.Grid; not set by consumers. */
  cell?: CalendarCell;
  children?: ReactNode;
}

/**
 * One day cell — a real <button>. This is the "you have the button" leaf: your
 * `className` lands straight on it, while the component sets the state + identity
 * attributes (aria-selected, data-state, data-outside, data-weekday,
 * data-weekend, disabled) the styling keys off.
 */
function CalendarDate({ cell, className, children, ...rest }: CalendarDateProps) {
  const { styles, selected, today, min, max, query, activeDate, select } =
    useCalendar("Calendar.Date");
  if (!cell) throw new Error("Calendar.Date must be a child of Calendar.Grid.");

  // Across a range, a date on a month boundary renders twice — once for real,
  // once as the neighbouring grid's spill day. State belongs to the month that
  // OWNS the date: the spill copy is a decorative placeholder holding a column,
  // so it claims neither the chip nor the tabstop, and a boundary date can't
  // paint itself twice. `disabled` is deliberately NOT gated — min/max is a
  // constraint on the date itself, and a spill day must stay unclickable when
  // its real counterpart is.
  const owned = cell.inCurrentMonth;
  const isSelected = owned && selected != null && cell.date.equals(selected);
  const isToday = owned && cell.date.equals(today);
  const isQuery = owned && query != null && cell.date.equals(query);
  const disabled = isDisabled(cell.date, min, max);

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={`${MONTH_NAMES[cell.date.month - 1]} ${cell.date.day}, ${cell.date.year}`}
      aria-selected={isSelected}
      data-state={isToday ? "today" : undefined}
      data-query={isQuery ? "" : undefined}
      data-outside={cell.inCurrentMonth ? undefined : ""}
      data-weekday={cell.weekday}
      data-weekend={cell.isWeekend || undefined}
      disabled={disabled}
      tabIndex={owned && cell.date.equals(activeDate) ? 0 : -1}
      className={cx(styles.date, className)}
      onClick={() => select(cell.date)}
      {...rest}
    >
      {children ?? cell.day}
    </button>
  );
}

/**
 * Compound calendar. `Calendar` is the root/context; the parts read it and stay
 * dumb. `Field.Search` (from field.tsx) and a pair of icon `Button` chevrons
 * compose in as the search row and the range steppers. Surface it as
 * `Field.Calendar` from the Date-input assembly when that lands.
 */
export const Calendar = Object.assign(CalendarRoot, {
  PeriodList: CalendarPeriodList,
  Period: CalendarPeriod,
  Month: CalendarMonthLabel,
  Week: CalendarWeek,
  Day: CalendarDay,
  Grid: CalendarGrid,
  Date: CalendarDate,
});
