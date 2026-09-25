"use client";

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
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
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipHostContext } from "@/components/ui/tooltip";
import { useHintTooltip } from "@/hooks/use-hint-tooltip";

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

export type MonthFormat = "full" | "narrow";

function monthLabel(
  start: Temporal.PlainDate,
  format: MonthFormat = "full",
): string {
  const name = MONTH_NAMES[start.month - 1];
  return `${format === "narrow" ? name.slice(0, 3) : name} ${start.year}`;
}

type CalendarStyles = ReturnType<typeof calendar>;

export type CalendarSelectionMode = "single" | "multiple";

type CalendarContextValue = {
  styles: CalendarStyles;
  today: Temporal.PlainDate;
  selectionMode: CalendarSelectionMode;
  /** Already false outside `multiple` mode. */
  sweep: boolean;
  /** ISO day keys, whichever the mode. */
  selection: ReadonlySet<string>;
  min?: Temporal.PlainDate;
  max?: Temporal.PlainDate;
  /** First-of-month of the first visible month. */
  view: Temporal.PlainDate;
  /** How far one chevron press moves, not the range's width. */
  step: number;
  /** What the search resolves to: Enter's pending target. */
  query: Temporal.PlainDate | null;
  /** The roving tabstop: keyboard focus ▸ query ▸ earliest selected ▸ today ▸ first of range. */
  activeDate: Temporal.PlainDate;
  periods: CalendarMonth[];
  /** Single-mode commit — replaces the selection. */
  select: (date: Temporal.PlainDate) => void;
  /** Multiple-mode commit — flips one date in or out. */
  toggle: (date: Temporal.PlainDate) => void;
  /** Parks the roving tabstop without moving DOM focus. */
  anchorFocus: (date: Temporal.PlainDate) => void;
  /** Moves the tabstop and DOM focus, paging if needed; `extend` also toggles the date. */
  moveFocus: (date: Temporal.PlainDate, extend?: boolean) => void;
  dragStart: (x: number, y: number, listRect: DOMRect) => void;
  band: CalendarBand | null;
  /** Guards the trailing click after a real drag. */
  dragMoved: () => boolean;
  prevPage: () => void;
  nextPage: () => void;
};

const CalendarContext = createContext<CalendarContextValue | null>(null);

function useCalendar(component: string): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error(`${component} must be used within <Calendar>.`);
  return ctx;
}

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

/** Deduplicated, sorted ISO day keys; ISO strings sort chronologically. */
function toKeys(dates: readonly Temporal.PlainDate[] = []): string[] {
  return [...new Set(dates.map((date) => date.toString()))].sort();
}

const ARROW_DAYS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

/** A marquee drag: each frame is `base` XOR the covered `cells`, so retreating off a cell reverts it. */
type CalendarGesture = {
  originX: number;
  originY: number;
  listRect: DOMRect;
  cells: { key: string; rect: DOMRect }[];
  base: string[];
  moved: boolean;
  active: boolean;
};

export type CalendarBand = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const DRAG_THRESHOLD = 3;

/** Must match the 200ms page-turn animation in calendar.recipe.ts. */
const PUSH_MS = 200;

/** Strict overlap: touching edges don't count. */
function overlaps(
  rect: DOMRect,
  left: number,
  top: number,
  right: number,
  bottom: number,
): boolean {
  return (
    rect.left < right &&
    rect.right > left &&
    rect.top < bottom &&
    rect.bottom > top
  );
}

export interface CalendarProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /** `multiple` holds a set, toggles on pick, and enables the sweep gestures. */
  selectionMode?: CalendarSelectionMode;
  /** In `multiple` mode, enables the marquee drag and Shift+Arrow. Defaults to true. */
  sweep?: boolean;
  /** `single` only. */
  value?: Temporal.PlainDate | null;
  /** `single` only. */
  defaultValue?: Temporal.PlainDate | null;
  /** `single` only. */
  onValueChange?: (date: Temporal.PlainDate) => void;
  /** `multiple` only. */
  values?: readonly Temporal.PlainDate[];
  /** `multiple` only. */
  defaultValues?: readonly Temporal.PlainDate[];
  /** `multiple` only; the whole selection, in chronological order. */
  onValuesChange?: (dates: Temporal.PlainDate[]) => void;
  /** The month the range opens on; defaults to the selection's, then today's. */
  defaultView?: Temporal.PlainDate;
  /** Controlled first month; internal moves report through `onViewChange` instead. */
  view?: Temporal.PlainDate;
  onViewChange?: (view: Temporal.PlainDate) => void;
  /** Inclusive selectable bounds. */
  min?: Temporal.PlainDate;
  max?: Temporal.PlainDate;
  weekStartsOn?: WeekdayKey;
  /** How many months are shown. */
  months?: number;
  /** Months per chevron or PageUp/PageDown press; defaults to `months`. */
  step?: number;
  /** Parses a child `Field.Search` query into a date; without it, typing navigates nowhere. */
  queryParser?: (query: string) => Temporal.PlainDate | null;
  /** `onBrand` inverts the palette for the Date popover's brand surface. */
  tone?: "default" | "onBrand";
  /** `label` puts the chevrons on the month row; `edge` gives full-height scrims for a cropped range. */
  navPlacement?: "label" | "edge";
  /** Fill a wider box by widening the gutters; day cells stay 24px. */
  fluid?: boolean;
  /** Override "today", e.g. for tests. */
  today?: Temporal.PlainDate;
  children: ReactNode;
}

function CalendarRoot({
  selectionMode = "single",
  sweep: sweepProp = true,
  value,
  defaultValue,
  onValueChange,
  values,
  defaultValues,
  onValuesChange,
  view: viewProp,
  onViewChange,
  defaultView,
  min,
  max,
  weekStartsOn = "sun",
  months = 1,
  step: stepProp,
  queryParser,
  tone = "default",
  navPlacement = "label",
  fluid = false,
  today: todayProp,
  className,
  children,
  ...rest
}: CalendarProps) {
  // A role=group div can't take `htmlFor`, so it is labelled via aria-labelledby.
  const { labelId, hasLabel, hintId, hasHint, size } = useField("Calendar");
  const styles = calendar({ tone, navPlacement, fluid, size });
  const today = todayProp ?? Temporal.Now.plainDateISO();

  const multiple = selectionMode === "multiple";
  const sweep = multiple && sweepProp;

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<Temporal.PlainDate | null>(
    defaultValue ?? null,
  );
  const selected = isControlled ? (value ?? null) : internal;

  const isMultiControlled = values !== undefined;
  const [multiInternal, setMultiInternal] = useState<string[]>(() =>
    toKeys(defaultValues),
  );
  const multiKeys = isMultiControlled ? toKeys(values) : multiInternal;

  const selectionKeys = multiple
    ? multiKeys
    : selected
      ? [selected.toString()]
      : [];
  const selection = new Set(selectionKeys);

  const [uncontrolledView, setUncontrolledView] = useState<Temporal.PlainDate>(
    () => {
      if (defaultView) return defaultView.with({ day: 1 });
      const seeded = toKeys(values ?? defaultValues)[0];
      const seed =
        value ?? defaultValue ?? (seeded ? Temporal.PlainDate.from(seeded) : null);
      return (seed ?? today).with({ day: 1 });
    },
  );
  const viewControlled = viewProp !== undefined;
  const view = viewControlled ? viewProp.with({ day: 1 }) : uncontrolledView;
  // Every internal move must go through here so a controlled consumer hears it.
  const setView = (
    next: Temporal.PlainDate | ((current: Temporal.PlainDate) => Temporal.PlainDate),
  ) => {
    const resolved = typeof next === "function" ? next(view) : next;
    if (!viewControlled) setUncontrolledView(resolved);
    onViewChange?.(resolved);
  };

  const periods = useMemo(
    () => buildCalendarPeriods(view, { months, weekStartsOn }),
    [view, months, weekStartsOn],
  );

  const [query, setQuery] = useState<Temporal.PlainDate | null>(null);

  const [focusDate, setFocusDate] = useState<Temporal.PlainDate | null>(null);
  // Set only by `moveFocus`, so focus is never stolen on mount or an unrelated render.
  const pendingFocus = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const inView = (d: Temporal.PlainDate) => {
    const offset = monthsBetween(view, d);
    return offset >= 0 && offset < Math.max(1, months);
  };
  const anchorKey = selectionKeys.find((key) =>
    inView(Temporal.PlainDate.from(key)),
  );
  const activeDate =
    focusDate && inView(focusDate)
      ? focusDate
      : query && inView(query)
        ? query
        : anchorKey
          ? Temporal.PlainDate.from(anchorKey)
          : inView(today)
            ? today
            : view;

  // Pages only for an off-range date, landing it in the first slot.
  const reveal = (date: Temporal.PlainDate) => {
    if (!inView(date)) setView(date.with({ day: 1 }));
  };

  const select = (date: Temporal.PlainDate) => {
    if (isDisabled(date, min, max)) return;
    if (!isControlled) setInternal(date);
    onValueChange?.(date);
    reveal(date);
  };

  const commitKeys = (keys: string[]) => {
    if (!isMultiControlled) setMultiInternal(keys);
    onValuesChange?.(keys.map((key) => Temporal.PlainDate.from(key)));
  };

  // One commit per batch: two `toggle` calls in one handler would both read the stale selection.
  const toggleMany = (dates: Temporal.PlainDate[]) => {
    const allowed = dates.filter((date) => !isDisabled(date, min, max));
    if (!allowed.length) return;
    const next = new Set(selectionKeys);
    for (const date of allowed) {
      const key = date.toString();
      if (next.has(key)) next.delete(key);
      else next.add(key);
    }
    commitKeys([...next].sort());
  };

  const toggle = (date: Temporal.PlainDate) => toggleMany([date]);

  const gesture = useRef<CalendarGesture | null>(null);
  const keyRun = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [band, setBand] = useState<CalendarBand | null>(null);

  const dragStart = (x: number, y: number, listRect: DOMRect) => {
    keyRun.current = false;
    const cells = [
      ...(rootRef.current?.querySelectorAll<HTMLButtonElement>(
        "[data-date]:not([data-outside])",
      ) ?? []),
    ];
    gesture.current = {
      originX: x,
      originY: y,
      listRect,
      // Live page only: the outgoing page's cells are duplicates, still moving.
      cells: cells
        .filter((cell) => !cell.disabled && !cell.closest("[data-outgoing]"))
        .map((cell) => ({
          key: cell.dataset.date as string,
          rect: cell.getBoundingClientRect(),
        })),
      base: selectionKeys,
      moved: false,
      active: true,
    };
    setDragging(true);
  };

  const dragTo = (x: number, y: number) => {
    const open = gesture.current;
    if (!open?.active) return;
    if (!open.moved) {
      if (
        Math.abs(x - open.originX) < DRAG_THRESHOLD &&
        Math.abs(y - open.originY) < DRAG_THRESHOLD
      )
        return;
      open.moved = true;
    }
    const left = Math.min(open.originX, x);
    const right = Math.max(open.originX, x);
    const top = Math.min(open.originY, y);
    const bottom = Math.max(open.originY, y);

    setBand({
      left: left - open.listRect.left,
      top: top - open.listRect.top,
      width: right - left,
      height: bottom - top,
    });

    const next = new Set(open.base);
    for (const { key, rect } of open.cells) {
      if (!overlaps(rect, left, top, right, bottom)) continue;
      if (next.has(key)) next.delete(key);
      else next.add(key);
    }
    commitKeys([...next].sort());
  };

  const dragMoved = () => gesture.current?.moved ?? false;

  const dragToRef = useRef(dragTo);
  useEffect(() => {
    dragToRef.current = dragTo;
  });

  // On `window`, not the cells: the band follows the pointer anywhere until release.
  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) =>
      dragToRef.current(event.clientX, event.clientY);
    const end = () => {
      if (gesture.current) gesture.current.active = false;
      setDragging(false);
      setBand(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragging]);

  const anchorFocus = (date: Temporal.PlainDate) => setFocusDate(date);

  const moveFocus = (date: Temporal.PlainDate, extend = false) => {
    if (extend && sweep) {
      // A path, not a rectangle: the first step also flips the cell it left.
      if (!keyRun.current) {
        keyRun.current = true;
        toggleMany([activeDate, date]);
      } else {
        toggle(date);
      }
    } else {
      keyRun.current = false;
    }
    pendingFocus.current = true;
    setFocusDate(date);
    reveal(date);
  };

  // A tick after `moveFocus`: paging means the target cell may not exist yet, hence `view`.
  useEffect(() => {
    if (!pendingFocus.current || !focusDate) return;
    pendingFocus.current = false;
    rootRef.current
      ?.querySelector<HTMLElement>(
        `[data-date="${focusDate.toString()}"]:not([data-outside])`,
      )
      ?.focus();
  }, [focusDate, view]);

  const stride = Math.max(1, stepProp ?? months);

  const ctx: CalendarContextValue = {
    styles,
    today,
    selectionMode,
    sweep,
    selection,
    min,
    max,
    view,
    step: stride,
    query,
    activeDate,
    periods,
    select,
    toggle,
    anchorFocus,
    moveFocus,
    dragStart,
    dragMoved,
    band,
    prevPage: () => setView((v) => v.subtract({ months: stride })),
    nextPage: () => setView((v) => v.add({ months: stride })),
  };

  // Typing only navigates and marks the cell; committing takes Enter or a click.
  const commitQuery = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || !query) return;
    event.preventDefault();
    select(query);
  };

  const dressed = Children.map(children, (child) => {
    if (isValidElement(child) && child.type === Field.Search) {
      const el = child as ReactElement<FieldSearchProps>;
      return cloneElement(el, {
        className: cx(styles.search, el.props.className),
        // Without `size`, WebKit gives the input an intrinsic 219px that widens the popover.
        size: el.props.size ?? 1,
        onValueChange: (raw: string) => {
          el.props.onValueChange?.(raw);
          const date = queryParser?.(raw) ?? null;
          setQuery(date);
          // Hand the tabstop back to the query.
          setFocusDate(null);
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
        ref={rootRef}
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

export type CalendarNavDirection = "prev" | "next";

export interface CalendarNavProps extends ButtonProps {
  children?: ReactNode;
}

const NAV_VERB: Record<CalendarNavDirection, string> = {
  prev: "Previous",
  next: "Next",
};

function CalendarNav({
  direction,
  onClick,
  "aria-label": ariaLabel,
  children,
  ...rest
}: CalendarNavProps & { direction: CalendarNavDirection }) {
  const part = direction === "prev" ? "Calendar.Prev" : "Calendar.Next";
  const { styles, step, prevPage, nextPage } = useCalendar(part);
  const unit = step === 1 ? "month" : `${step} months`;

  // Positioned via a wrapper: slot styles can't override the button's `action` recipe.
  return (
    <div data-nav={direction} className={styles.nav}>
      <Button
        onClick={onClick ?? (direction === "prev" ? prevPage : nextPage)}
        aria-label={ariaLabel ?? `${NAV_VERB[direction]} ${unit}`}
        {...rest}
      >
        {children}
      </Button>
    </div>
  );
}

function CalendarPrev(props: CalendarNavProps) {
  return <CalendarNav direction="prev" {...props} />;
}

function CalendarNext(props: CalendarNavProps) {
  return <CalendarNav direction="next" {...props} />;
}

export type CalendarPeriodListProps = HTMLAttributes<HTMLDivElement>;

type CalendarPageState = {
  view: Temporal.PlainDate;
  periods: CalendarMonth[];
  out: {
    key: string;
    periods: CalendarMonth[];
    forward: boolean;
  } | null;
};

/** Stamps the Period template per visible month, hosts the sweep hint and plays the page turn. */
function CalendarPeriodList({
  className,
  children,
  style,
  onPointerDown,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: CalendarPeriodListProps) {
  const { styles, periods, view, step, sweep, dragStart, band } =
    useCalendar("Calendar.PeriodList");

  const items = Children.toArray(children);
  const hint = items.find(
    (child) => isValidElement(child) && child.type === Tooltip,
  );
  const {
    ref: hintRef,
    visible: hintVisible,
    show: showHint,
    hide: hideHint,
    retire: retireHint,
  } = useHintTooltip();
  const hinting = Boolean(hint) && sweep;

  useEffect(() => {
    if (band) retireHint();
  }, [band, retireHint]);

  // `Period` is a template, so it must be a direct child.
  const stamp = (
    template: ReactElement<CalendarPeriodProps>,
    row: readonly CalendarMonth[],
  ) => row.map((period) => cloneElement(template, { key: period.key, period }));

  const expanded = items
    .filter((child) => child !== hint)
    .flatMap((child) => {
      if (isValidElement(child) && child.type === CalendarPeriod) {
        return stamp(child as ReactElement<CalendarPeriodProps>, periods);
      }
      return child;
    });

  const template = items.find(
    (child): child is ReactElement<CalendarPeriodProps> =>
      isValidElement(child) && child.type === CalendarPeriod,
  );

  // Derived during render, not in an effect, so the leaving page mounts in the same commit.
  const [page, setPage] = useState<CalendarPageState>(() => ({
    view,
    periods,
    out: null,
  }));
  if (!view.equals(page.view)) {
    setPage({
      view,
      periods,
      out: {
        key: page.view.toString(),
        periods: page.periods,
        forward: Temporal.PlainDate.compare(view, page.view) > 0,
      },
    });
  } else if (periods !== page.periods) {
    // No turn, but the next turn's snapshot must be the row on screen.
    setPage({ ...page, periods });
  }

  // A timer, not `animationend`, which fires once per column.
  const { out } = page;
  useEffect(() => {
    if (!out) return;
    const timer = setTimeout(
      () => setPage((current) => ({ ...current, out: null })),
      PUSH_MS,
    );
    return () => clearTimeout(timer);
  }, [out]);

  // In columns, not screenfuls, so months that carry over stay put.
  const push = out
    ? { "--calendar-push": `${(out.forward ? step : -step) * 100}%` }
    : null;

  return (
    <div
      className={cx(styles.periodList, className)}
      data-push={out ? "" : undefined}
      style={{ ...style, ...push } as CSSProperties}
      // The band opens here, not on a day cell, so a drag can start anywhere in the list.
      onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerDown?.(event);
        if (event.defaultPrevented || !sweep) return;
        if (event.pointerType === "touch" || event.button !== 0) return;
        if ((event.target as HTMLElement).closest?.("[data-nav]")) return;
        dragStart(
          event.clientX,
          event.clientY,
          event.currentTarget.getBoundingClientRect(),
        );
      }}
      onMouseEnter={(event: ReactMouseEvent<HTMLDivElement>) => {
        onMouseEnter?.(event);
        if (hinting) showHint(event.clientX, event.clientY);
      }}
      onMouseLeave={(event: ReactMouseEvent<HTMLDivElement>) => {
        onMouseLeave?.(event);
        if (hinting) hideHint();
      }}
      {...rest}
    >
      {expanded}
      {out && template ? (
        // Keyed by its view so an interrupting turn restarts the slide.
        <div
          key={out.key}
          aria-hidden
          inert
          data-outgoing
          className={styles.outgoing}
        >
          {stamp(template, out.periods)}
        </div>
      ) : null}
      {band ? (
        <div
          aria-hidden
          className={styles.marquee}
          style={{
            left: `${band.left}px`,
            top: `${band.top}px`,
            width: `${band.width}px`,
            height: `${band.height}px`,
          }}
        />
      ) : null}
      {hint ? (
        <TooltipHostContext.Provider value={{ ref: hintRef, visible: hintVisible }}>
          {hint}
        </TooltipHostContext.Provider>
      ) : null}
    </div>
  );
}

export interface CalendarPeriodProps extends HTMLAttributes<HTMLDivElement> {
  /** Injected by Calendar.PeriodList; not set by consumers. */
  period?: CalendarMonth;
}

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

function CalendarGrid({ className, children, ...rest }: CalendarGridProps) {
  const { styles, selectionMode } = useCalendar("Calendar.Grid");
  const { weeks, start } = usePeriod("Calendar.Grid");
  const template = Children.only(children) as ReactElement<CalendarDateProps>;
  return (
    <div
      role="grid"
      // Full month name regardless of `monthFormat`.
      aria-label={monthLabel(start)}
      // On the grid: `group` does not take aria-multiselectable.
      aria-multiselectable={selectionMode === "multiple" || undefined}
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

function CalendarDate({
  cell,
  className,
  children,
  onClick,
  onKeyDown,
  onPointerDown,
  ...rest
}: CalendarDateProps) {
  const {
    styles,
    selectionMode,
    selection,
    today,
    min,
    max,
    query,
    activeDate,
    step: stride,
    select,
    toggle,
    anchorFocus,
    moveFocus,
    dragMoved,
  } = useCalendar("Calendar.Date");
  const { weekdays } = usePeriod("Calendar.Date");
  if (!cell) throw new Error("Calendar.Date must be a child of Calendar.Grid.");

  // State belongs to the owning month; spill copies claim none. `disabled` stays ungated on purpose.
  const owned = cell.inCurrentMonth;
  const multiple = selectionMode === "multiple";
  const isSelected = owned && selection.has(cell.key);
  const isToday = owned && cell.date.equals(today);
  const isQuery = owned && query != null && cell.date.equals(query);
  const disabled = isDisabled(cell.date, min, max);
  // Only `multiple` opts out: a sweep would otherwise flip a boundary date twice.
  const inert = multiple && !owned;

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={`${MONTH_NAMES[cell.date.month - 1]} ${cell.date.day}, ${cell.date.year}`}
      aria-selected={isSelected}
      data-date={cell.key}
      data-state={isToday ? "today" : undefined}
      data-query={isQuery ? "" : undefined}
      data-outside={cell.inCurrentMonth ? undefined : ""}
      data-weekday={cell.weekday}
      data-weekend={cell.isWeekend || undefined}
      disabled={disabled}
      tabIndex={owned && cell.date.equals(activeDate) ? 0 : -1}
      className={cx(styles.date, className)}
      onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
        onPointerDown?.(event);
        if (event.defaultPrevented || inert || !multiple) return;
        // Touch never drags a band; it would fight the page's scroll.
        if (event.pointerType === "touch" || event.button !== 0) return;
        // Park the tabstop; the drag itself opens in Calendar.PeriodList.
        anchorFocus(cell.date);
      }}
      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (!multiple) {
          select(cell.date);
          return;
        }
        if (inert) return;
        // `detail` is 0 for keyboard activation, which must not be swallowed like a drag's trailing click.
        if (event.detail !== 0 && dragMoved()) return;
        anchorFocus(cell.date);
        toggle(cell.date);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;

        const days = ARROW_DAYS[event.key];
        if (days !== undefined) {
          event.preventDefault();
          moveFocus(cell.date.add({ days }), event.shiftKey);
          return;
        }
        // Column index from the period's header, since weeks may not start on Sunday.
        if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          const column = weekdays.findIndex((wd) => wd.key === cell.weekday);
          moveFocus(
            event.key === "Home"
              ? cell.date.subtract({ days: column })
              : cell.date.add({ days: 6 - column }),
            event.shiftKey,
          );
          return;
        }
        if (event.key === "PageUp" || event.key === "PageDown") {
          event.preventDefault();
          const months = event.key === "PageUp" ? -stride : stride;
          moveFocus(cell.date.add({ months }));
        }
      }}
      {...rest}
    >
      {children ?? cell.day}
    </button>
  );
}

export const Calendar = Object.assign(CalendarRoot, {
  PeriodList: CalendarPeriodList,
  Tooltip,
  Prev: CalendarPrev,
  Next: CalendarNext,
  Period: CalendarPeriod,
  Month: CalendarMonthLabel,
  Week: CalendarWeek,
  Day: CalendarDay,
  Grid: CalendarGrid,
  Date: CalendarDate,
});
