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
  buildCalendarMonth,
  type CalendarCell,
  type WeekdayHeaderCell,
  type WeekdayKey,
} from "@/utils/calendar-month";
import { Field, useField, type FieldSearchProps } from "./field";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Calendar — the composable grid behind the Date input's popover.
//
//   <Calendar value={date} onValueChange={setDate}>
//     <Field.Search />
//     <Calendar.Period>
//       <Button variant="icon"><ChevronLeft/></Button>
//       <Calendar.Heading />
//       <Button variant="icon"><ChevronRight/></Button>
//     </Calendar.Period>
//     <Calendar.Week><Calendar.Day/></Calendar.Week>     {/* one template, cloned per weekday */}
//     <Calendar.Grid><Calendar.Date/></Calendar.Grid>    {/* one template, cloned per day     */}
//   </Calendar>
//
// The root owns Temporal month math + selection and hands each part what it
// needs through context; `Week`/`Grid` clone their single child template once
// per header/day cell, injecting the cell. `Period` clones its two icon-`Button`
// chevron children into prev/next. Every day cell surfaces its state (aria-selected,
// data-state=today, data-outside, :disabled) AND identity (data-weekday,
// data-weekend) as attributes, so the look is fully re-skinnable off selectors.
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

type CalendarStyles = ReturnType<typeof calendar>;

type CalendarContextValue = {
  styles: CalendarStyles;
  today: Temporal.PlainDate;
  selected: Temporal.PlainDate | null;
  min?: Temporal.PlainDate;
  max?: Temporal.PlainDate;
  /** First-of-month for the visible page. */
  view: Temporal.PlainDate;
  /** The date the search currently resolves to — Enter's pending target. */
  query: Temporal.PlainDate | null;
  /**
   * The single roving-tabindex anchor
   * (query ▸ selected ▸ today ▸ first-of-month).
   */
  activeDate: Temporal.PlainDate;
  weeks: CalendarCell[][];
  weekdays: WeekdayHeaderCell[];
  headingLabel: string;
  select: (date: Temporal.PlainDate) => void;
  prevMonth: () => void;
  nextMonth: () => void;
};

const CalendarContext = createContext<CalendarContextValue | null>(null);

function useCalendar(component: string): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error(`${component} must be used within <Calendar>.`);
  return ctx;
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

  const { weeks, weekdays } = useMemo(
    () => buildCalendarMonth(view, { weekStartsOn }),
    [view, weekStartsOn],
  );

  // What the search currently resolves to, if anything — see `goToQuery` below.
  const [query, setQuery] = useState<Temporal.PlainDate | null>(null);

  const inView = (d: Temporal.PlainDate) =>
    d.year === view.year && d.month === view.month;
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

  const select = (date: Temporal.PlainDate) => {
    if (isDisabled(date, min, max)) return;
    if (!isControlled) setInternal(date);
    onValueChange?.(date);
    setView(date.with({ day: 1 }));
  };

  const ctx: CalendarContextValue = {
    styles,
    today,
    selected,
    min,
    max,
    view,
    query,
    activeDate,
    weeks,
    weekdays,
    headingLabel: `${MONTH_NAMES[view.month - 1]} ${view.year}`,
    select,
    prevMonth: () => setView((v) => v.subtract({ months: 1 })),
    nextMonth: () => setView((v) => v.add({ months: 1 })),
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
          if (date) setView(date.with({ day: 1 }));
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

export type CalendarPeriodProps = HTMLAttributes<HTMLDivElement>;

/**
 * The `‹ month year ›` header. Clones its icon-`Button` children in order — the
 * first drives the previous month, the second the next — so the chevron buttons
 * stay generic and this part owns the wiring.
 */
function CalendarPeriod({ className, children, ...rest }: CalendarPeriodProps) {
  const { styles, prevMonth, nextMonth } = useCalendar("Calendar.Period");
  const items = Children.toArray(children);
  const isAction = (c: ReactNode): c is ReactElement =>
    isValidElement(c) && c.type === Button;

  const wired = items.map((child, i) => {
    if (!isAction(child)) return child;
    const el = child as ReactElement<{
      className?: string;
      onClick?: () => void;
      "aria-label"?: string;
    }>;
    // First chevron drives the previous month, the second the next.
    const isPrev = items.slice(0, i).filter(isAction).length === 0;
    return cloneElement(el, {
      className: cx(styles.nav, el.props.className),
      onClick: el.props.onClick ?? (isPrev ? prevMonth : nextMonth),
      "aria-label":
        el.props["aria-label"] ?? (isPrev ? "Previous month" : "Next month"),
    });
  });

  return (
    <div className={cx(styles.period, className)} {...rest}>
      {wired}
    </div>
  );
}

export type CalendarHeadingProps = HTMLAttributes<HTMLDivElement>;

/** The "December 2026" label, read from the current view. */
function CalendarHeading({ className, children, ...rest }: CalendarHeadingProps) {
  const { styles, headingLabel } = useCalendar("Calendar.Heading");
  return (
    <div aria-live="polite" className={cx(styles.heading, className)} {...rest}>
      {children ?? headingLabel}
    </div>
  );
}

export type CalendarWeekProps = HTMLAttributes<HTMLDivElement>;

/** The weekday header row — clones its single Calendar.Day per header cell. */
function CalendarWeek({ className, children, ...rest }: CalendarWeekProps) {
  const { styles, weekdays } = useCalendar("Calendar.Week");
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
  const { styles, weeks, headingLabel } = useCalendar("Calendar.Grid");
  const template = Children.only(children) as ReactElement<CalendarDateProps>;
  return (
    <div
      role="grid"
      aria-label={headingLabel}
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

  const isSelected = selected != null && cell.date.equals(selected);
  const isToday = cell.date.equals(today);
  const isQuery = query != null && cell.date.equals(query);
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
      tabIndex={cell.date.equals(activeDate) ? 0 : -1}
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
 * compose in as the search row and the month steppers. Surface it as
 * `Field.Calendar` from the Date-input assembly when that lands.
 */
export const Calendar = Object.assign(CalendarRoot, {
  Period: CalendarPeriod,
  Heading: CalendarHeading,
  Week: CalendarWeek,
  Day: CalendarDay,
  Grid: CalendarGrid,
  Date: CalendarDate,
});
