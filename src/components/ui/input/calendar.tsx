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
// `months` (default 1) sets the range size, and `step` (default `months`) how
// far one chevron press moves it — equal by default, so the range PAGES and
// nothing on screen repeats; `step={1}` on a wider range WALKS it instead,
// keeping most of the previous view as context. Every day cell surfaces its
// state (aria-selected, data-state=today,
// data-outside, :disabled) AND identity (data-weekday, data-weekend) as
// attributes, so the look is fully re-skinnable off selectors.
//
// `selectionMode` picks how many dates can be held at once. `single` (default)
// is the Date input's picker — one date, and picking replaces it. `multiple`
// swaps in a toggle model (`values` / `onValuesChange`) and unlocks two
// gestures that only make sense there:
//
//   • DRAG — a marquee. The press point pins one corner of a rectangle and the
//     cursor is the other; every day cell the rectangle overlaps, by any amount,
//     is toggled against the selection the drag started from. So the band is
//     reversible: shrink it back off a cell and that cell reverts. It is pure
//     geometry over the whole period list, which is why a band can span months
//     and why it never depends on the path the cursor took.
//   • Shift+Arrow — a path, since a keyboard caret has no second corner to drag.
//     A run flips what it steps onto, and reversing over it rubs it out.
//
// Neither gesture is visible in the chrome, so a `Calendar.Tooltip` dropped in
// the `PeriodList` volunteers the drag: the cursor-following tooltip, shown
// while the pointer is over the draggable area, withdrawing after a few seconds
// and for good after the first drag (the consumer writes the copy).
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

/** How many dates the calendar can hold at once. */
export type CalendarSelectionMode = "single" | "multiple";

type CalendarContextValue = {
  styles: CalendarStyles;
  today: Temporal.PlainDate;
  selectionMode: CalendarSelectionMode;
  /**
   * Are the multi-commit GESTURES live? Already folded in with the mode, so a
   * consumer of this context asks one question rather than two.
   */
  sweep: boolean;
  /**
   * The selection as ISO day keys — ONE representation for both modes, so a
   * cell only ever asks "is my key in here" rather than branching on the mode.
   */
  selection: ReadonlySet<string>;
  min?: Temporal.PlainDate;
  max?: Temporal.PlainDate;
  /** First-of-month for the FIRST month of the visible range. */
  view: Temporal.PlainDate;
  /** How many months one chevron press moves — NOT the range's width. */
  step: number;
  /** The date the search currently resolves to — Enter's pending target. */
  query: Temporal.PlainDate | null;
  /**
   * The single roving-tabindex anchor across the whole range
   * (keyboard focus ▸ query ▸ earliest selected ▸ today ▸ first-of-range).
   */
  activeDate: Temporal.PlainDate;
  /** One entry per visible month, in order. */
  periods: CalendarMonth[];
  /** Single-mode commit — replaces the selection. */
  select: (date: Temporal.PlainDate) => void;
  /** Multiple-mode commit — flips one date in or out. */
  toggle: (date: Temporal.PlainDate) => void;
  /** Parks the roving tabstop without touching DOM focus (pointer paths). */
  anchorFocus: (date: Temporal.PlainDate) => void;
  /**
   * Moves the roving tabstop AND DOM focus, paging the range if the date is off
   * screen. `extend` also toggles what the step lands on — the Shift+Arrow run.
   */
  moveFocus: (date: Temporal.PlainDate, extend?: boolean) => void;
  /** Pins the marquee's first corner at a viewport point and measures the grid. */
  dragStart: (x: number, y: number, listRect: DOMRect) => void;
  /** The live drag band, or null when no drag is in flight. */
  band: CalendarBand | null;
  /** Did the last drag actually leave its press point? Guards the trailing click. */
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

/**
 * Dates as deduplicated, sorted ISO day keys. ISO-8601 sorts lexicographically
 * in chronological order, so the plain string sort IS the date sort — which is
 * why the selection can live as keys end to end and only become `PlainDate`s
 * again on the way out to the consumer.
 */
function toKeys(dates: readonly Temporal.PlainDate[] = []): string[] {
  return [...new Set(dates.map((date) => date.toString()))].sort();
}

/** How far one arrow key moves, in days. Up/Down are a whole week. */
const ARROW_DAYS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

/**
 * One marquee drag. The press point pins one corner of a rectangle and the live
 * pointer is the opposite corner, so the band grows, shrinks and flips
 * direction with the cursor instead of tracing the path it took to get there.
 *
 * `cells` is measured once, at press time: nothing in the grid moves mid-drag
 * (the range only pages on a chevron or a keyboard nav), so the move handler
 * stays pure arithmetic over a snapshot instead of hitting layout every frame.
 *
 * `base` is the selection the drag started from, and every frame recomputes the
 * result as `base` XOR "cells the band currently covers" rather than
 * accumulating flips. That is what makes the band reversible — retreat off a
 * cell and it returns to exactly the state it had before the drag began.
 *
 * `moved` keeps a click a click: until the pointer clears `DRAG_THRESHOLD` no
 * band is applied, and once it has, the browser's trailing click is swallowed
 * so the press cell isn't flipped a second time.
 */
type CalendarGesture = {
  originX: number;
  originY: number;
  /** The period list's own box, so the band can be drawn in list-relative px. */
  listRect: DOMRect;
  cells: { key: string; rect: DOMRect }[];
  base: string[];
  moved: boolean;
  active: boolean;
};

/** The drag band's box, in period-list-relative pixels. */
export type CalendarBand = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Pointer slop, in px, before a press is treated as a drag rather than a click. */
const DRAG_THRESHOLD = 3;

/**
 * How long a page turn takes — the window in which both the arriving and the
 * leaving range are on screen. Kept in step with the `calendarPageIn/Out`
 * keyframes in `panda.config.ts`.
 */
const PUSH_MS = 200;

/** Do two boxes overlap at all? Touching edges don't count; any sliver does. */
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
  /**
   * `single` (default) holds one date and picking replaces it — the Date
   * input's picker. `multiple` holds a set and picking toggles, which is also
   * what turns on the pointer sweep and Shift+Arrow.
   */
  selectionMode?: CalendarSelectionMode;
  /**
   * Whether `multiple` also gets the two gestures that commit MORE than one
   * date per action — the marquee drag and its keyboard mirror, Shift+Arrow.
   * Defaults to `true`. Set `false` for a calendar that still holds a set but
   * takes it strictly one date at a time; clicking (and plain arrow movement)
   * are unaffected. Ignored in `single` mode, which has no sweep to withdraw.
   */
  sweep?: boolean;
  /** Controlled selection — `single` only. */
  value?: Temporal.PlainDate | null;
  /** Initial selection when uncontrolled — `single` only. */
  defaultValue?: Temporal.PlainDate | null;
  /** Fired with the picked date — `single` only. */
  onValueChange?: (date: Temporal.PlainDate) => void;
  /** Controlled selection — `multiple` only. Order is irrelevant on the way in. */
  values?: readonly Temporal.PlainDate[];
  /** Initial selection when uncontrolled — `multiple` only. */
  defaultValues?: readonly Temporal.PlainDate[];
  /** Fired with the WHOLE selection after a toggle, in chronological order. */
  onValuesChange?: (dates: Temporal.PlainDate[]) => void;
  /**
   * Which month the range OPENS on. Uncontrolled — the chevrons, a search and
   * an off-range pick all move on from it freely. Without it the range starts
   * at the selection, then today; pass it when neither is where the range
   * should begin (e.g. opening a 3-month range one month BEFORE today, so the
   * current month sits in the middle).
   */
  defaultView?: Temporal.PlainDate;
  /** Lower/upper selectable bounds (inclusive). */
  min?: Temporal.PlainDate;
  max?: Temporal.PlainDate;
  /** Which weekday sits in column 0. Defaults to Sunday. */
  weekStartsOn?: WeekdayKey;
  /**
   * How many consecutive months the range shows, starting at the view — one
   * `Calendar.Period` each. Defaults to 1.
   */
  months?: number;
  /**
   * How many months one chevron press moves. Defaults to `months`, which PAGES:
   * the range turns over completely, so nothing on screen repeats
   * (Apr–Jun ▸ Jul–Sep). Set `step={1}` on a wider range to WALK it instead
   * (Apr–Jun ▸ May–Jul), which costs a press to cross the same distance but
   * keeps most of what you were just reading on screen — the right trade when
   * the months are being compared rather than flipped through. Also sets what
   * PageUp/PageDown move by, so the keyboard matches the chevrons.
   */
  step?: number;
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
  /**
   * How the flanking chevrons meet the list's edges. `label` (default) is a
   * bare chevron on the month label row — right for one month. `edge` gives
   * each a full-height gradient scrim with the chevron centred in it, which is
   * what a range WIDER than its frame wants: the fade dissolves the half-cut
   * outer columns rather than leaving them on a hard crop, and centring suits
   * chevrons that belong to the whole run rather than to any one month's
   * label row.
   */
  navPlacement?: "label" | "edge";
  /**
   * Fill the box rather than hug the months. The calendar's width is otherwise
   * intrinsic (208px a month), so in a wider column it simply sits in one
   * corner of it; `fluid` grows the period to the column and opens the gutters
   * between the seven day columns to take up the slack, leaving the day cell
   * itself at its 24px square. A no-op at the natural measure, which is what
   * makes it safe to set once and let the column decide.
   */
  fluid?: boolean;
  /** Override "today" — primarily for tests/deterministic rendering. */
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
  // This interactive calendar is always a field control (inline, or the Date
  // input's popover), so it hard-consumes the field wiring like Switch does —
  // but as a compound group it associates via aria-labelledby/-describedby
  // (a <div role="group"> is not a labelable `htmlFor` target). Display-only
  // calendars (availability/event/heatmap) are a separate component.
  const { labelId, hasLabel, hintId, hasHint } = useField("Calendar");
  const styles = calendar({ tone, navPlacement, fluid });
  const today = todayProp ?? Temporal.Now.plainDateISO();

  const multiple = selectionMode === "multiple";
  // The multi-commit gestures. Folded together here so neither the pointer path
  // nor the keyboard one has to re-check the mode: `single` never had a sweep,
  // and `sweep={false}` withdraws it from `multiple`.
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

  // Both modes collapse to one sorted key list, so everything downstream —
  // the `aria-selected` test, the roving anchor, the toggle — is mode-blind.
  const selectionKeys = multiple
    ? multiKeys
    : selected
      ? [selected.toString()]
      : [];
  // Rebuilt each render rather than memoised: it holds one key per selected
  // date, so there is nothing here worth a dependency array.
  const selection = new Set(selectionKeys);

  // An explicit `defaultView` wins; otherwise the range opens where the
  // selection is, and failing that on today.
  const [view, setView] = useState<Temporal.PlainDate>(() => {
    if (defaultView) return defaultView.with({ day: 1 });
    const seeded = toKeys(values ?? defaultValues)[0];
    const seed =
      value ?? defaultValue ?? (seeded ? Temporal.PlainDate.from(seeded) : null);
    return (seed ?? today).with({ day: 1 });
  });

  const periods = useMemo(
    () => buildCalendarPeriods(view, { months, weekStartsOn }),
    [view, months, weekStartsOn],
  );

  // What the search currently resolves to, if anything — see `goToQuery` below.
  const [query, setQuery] = useState<Temporal.PlainDate | null>(null);

  // Where the keyboard has walked the roving tabstop to. Null until something
  // moves it, so an untouched calendar still opens on query/selection/today.
  const [focusDate, setFocusDate] = useState<Temporal.PlainDate | null>(null);
  // Set only by `moveFocus`, so the effect below moves DOM focus for keyboard
  // navigation WITHOUT stealing it on mount or on any unrelated re-render.
  const pendingFocus = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const inView = (d: Temporal.PlainDate) => {
    const offset = monthsBetween(view, d);
    return offset >= 0 && offset < Math.max(1, months);
  };
  // Keyboard focus outranks everything — once you've arrowed somewhere, that IS
  // the tabstop. Below it a resolving query outranks the selection: it's what
  // Enter would commit, so it's also where a Tab into the grid should land.
  // In `multiple` mode the earliest selected date in view stands in for "the"
  // selection (`selectionKeys` is sorted, so `find` is that date).
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

  const commitKeys = (keys: string[]) => {
    if (!isMultiControlled) setMultiInternal(keys);
    onValuesChange?.(keys.map((key) => Temporal.PlainDate.from(key)));
  };

  // Flips a whole batch in ONE commit. The batch matters: a Shift+Arrow run's
  // first step has to flip both the cell it left and the one it landed on, and
  // two sequential `toggle` calls in one handler would each read the same stale
  // selection, the second dropping the first.
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

  // The open marquee. A ref, not state: it is read only inside event handlers,
  // and re-rendering on every pointer move would buy nothing.
  const gesture = useRef<CalendarGesture | null>(null);
  // Mirrors whether a Shift+Arrow run is mid-flight, so the first step of a run
  // can flip its origin too and later steps only flip what they land on.
  const keyRun = useRef(false);
  // Drives the window listeners below. The only reason this is state.
  const [dragging, setDragging] = useState(false);
  // The band's box, in list-relative px — state because it is rendered.
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
      // Spill copies are already excluded by the selector, and a date outside
      // min/max can't be dragged into any more than it can be clicked. A page
      // mid-turn is a picture of the range it is replacing: its cells are
      // duplicates, and their boxes are still moving — the band is measured
      // off the live page alone.
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
    // Normalised so the band works in every direction — up-left drags give the
    // same rectangle as down-right ones.
    const left = Math.min(open.originX, x);
    const right = Math.max(open.originX, x);
    const top = Math.min(open.originY, y);
    const bottom = Math.max(open.originY, y);

    // Drawn relative to the period list, which is both the band's positioning
    // parent and (since a page turn has to be cropped to it) the box that
    // clips it — so a drag that runs off the grid stops at the frame instead
    // of trailing across the page.
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

  // `dragTo` closes over the current selection commit path, so the listeners
  // below read it through a ref rather than being torn down and rebound on
  // every render of a drag.
  const dragToRef = useRef(dragTo);
  useEffect(() => {
    dragToRef.current = dragTo;
  });

  // A drag is tracked on `window`, not on the cells: the band is defined by the
  // POINTER, so it has to keep updating while the cursor is between cells, over
  // the chevrons, or outside the calendar altogether — and it has to end
  // wherever the button is released.
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
      // Shift+Arrow stays a PATH, not a rectangle — a keyboard caret has no
      // second corner to drag, so a run flips what it steps onto. The first
      // step also flips the cell it left, since you extended FROM there;
      // reversing back over the run rubs it out again.
      if (!keyRun.current) {
        keyRun.current = true;
        toggleMany([activeDate, date]);
      } else {
        toggle(date);
      }
    } else {
      // A plain move closes the run, so the next Shift+Arrow starts fresh
      // rather than resuming one from minutes ago.
      keyRun.current = false;
    }
    pendingFocus.current = true;
    setFocusDate(date);
    reveal(date);
  };

  // Chase the roving tabstop with real DOM focus after the commit that moved
  // it — one tick later than `moveFocus`, because paging to an off-range date
  // means the target cell doesn't exist yet when the key is handled. `view` is
  // a dependency for exactly that case. The owned copy is the target: a spill
  // copy carries the same date but never takes the tabstop.
  useEffect(() => {
    if (!pendingFocus.current || !focusDate) return;
    pendingFocus.current = false;
    rootRef.current
      ?.querySelector<HTMLElement>(
        `[data-date="${focusDate.toString()}"]:not([data-outside])`,
      )
      ?.focus();
  }, [focusDate, view]);

  // Unset, a chevron press moves a whole range, so the months on screen never
  // repeat between pages (Apr–Jun ▸ Jul–Sep). `step` decouples the two — how
  // far the chevrons move is a separate question from how much is on show.
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
          // Typing hands the roving tabstop back to the query, so a Tab into
          // the grid lands on what Enter would commit rather than on wherever
          // the arrow keys were left.
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

/**
 * Shared body of `Calendar.Prev` / `Calendar.Next`. Each DECLARES its role, so
 * the calendar never has to infer one: the role is the part you reached for,
 * not this button's position among its siblings. That's what lets the chevrons
 * be reordered, or wrapped in a consumer's own chrome at any depth — they read
 * the root context rather than being cloned by a parent, so they only have to
 * be somewhere under `<Calendar>`.
 */
function CalendarNav({
  direction,
  onClick,
  "aria-label": ariaLabel,
  children,
  ...rest
}: CalendarNavProps & { direction: CalendarNavDirection }) {
  const part = direction === "prev" ? "Calendar.Prev" : "Calendar.Next";
  // Named for the distance it MOVES, not the width of the range — a chevron
  // announcing "Next 3 months" that advances one is worse than no label.
  const { styles, step, prevPage, nextPage } = useCalendar(part);
  const unit = step === 1 ? "month" : `${step} months`;

  // The chevron sits in a positioned wrapper rather than being positioned
  // itself: it renders a `Button`, and Panda emits plain recipes into a layer
  // that always beats the `recipes.slots` sublayer a slot style lands in — so
  // nothing here could override `action`'s own `position: relative`. The
  // wrapper also carries `data-nav`, which is what a `PeriodList` keys off to
  // pin it to the matching corner; anywhere else it just sits in the flow.
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

/** Moves the range back by one `step` (a whole range unless `step` says less). */
function CalendarPrev(props: CalendarNavProps) {
  return <CalendarNav direction="prev" {...props} />;
}

/** Moves the range forward by one `step`. */
function CalendarNext(props: CalendarNavProps) {
  return <CalendarNav direction="next" {...props} />;
}

export type CalendarPeriodListProps = HTMLAttributes<HTMLDivElement>;

/**
 * The row of months on screen, and the one being pushed off to make room for
 * it. `view` is held alongside `periods` because it is what a change is
 * MEASURED against — the direction of a turn is the compare between the view
 * that arrived and the one it replaced.
 */
type CalendarPageState = {
  view: Temporal.PlainDate;
  periods: CalendarMonth[];
  /** The leaving page, mounted only for the length of the slide. */
  out: {
    /** Its view, as a React key — a new turn remounts, and so restarts. */
    key: string;
    periods: CalendarMonth[];
    /** Is the range moving forward in time? Decides which side to push from. */
    forward: boolean;
  } | null;
};

/**
 * The row of months, and the only part that knows how many there are. It clones
 * its single `Calendar.Period` template once per visible month and leaves every
 * other child alone — including the navs, which wire themselves. Dropping a
 * `Calendar.Prev`/`Calendar.Next` directly in here pins it to the matching
 * corner, so one pair flanks the WHOLE range rather than any single month.
 *
 * It is also the DRAGGABLE area, which is why an optional `Calendar.Tooltip`
 * dropped in here is the sweep's hint — see `useHintTooltip` below.
 *
 * And it is where a view change becomes a PAGE TURN. Moving the range replaces
 * every month at once, and cut between the two the range simply blinks:
 * nothing says which way it went, or that the months either side of the press
 * are neighbours at all. So this holds the page it turned away from beside the
 * one arriving and pushes the pair along together — see `page` below.
 */
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

  // A `Calendar.Tooltip` child is lifted out of the flow and hosted here: this
  // list IS the draggable area, so pointing at it is exactly the moment the
  // sweep is worth mentioning. It teaches rather than labels, hence the hint
  // clocks — a few seconds per hover, and gone for good after the first drag.
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
  // No hint to give when there is no gesture to teach: `sweep` is already the
  // folded "can this calendar sweep at all" answer.
  const hinting = Boolean(hint) && sweep;

  // `band` is non-null only once a press has cleared DRAG_THRESHOLD — which is
  // precisely "the user dragged". A click never draws one, so it never retires
  // a hint the user hasn't acted on yet.
  useEffect(() => {
    if (band) retireHint();
  }, [band, retireHint]);

  // The one child this part does rewrite: `Period` is a TEMPLATE, not a role —
  // it has to be a direct child because it's stamped out once per month.
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

  // The same template again, for the row a page turn is pushing off.
  const template = items.find(
    (child): child is ReactElement<CalendarPeriodProps> =>
      isValidElement(child) && child.type === CalendarPeriod,
  );

  // The page turn. `view` moving is the whole trigger — a chevron, a searched
  // date, an arrow key walking off the range — so every one of them turns the
  // page, and picking a date already on screen (which moves nothing) turns
  // none. Derived during render rather than in an effect: the leaving page has
  // to be mounted in the SAME commit the arriving one is, or the first frame of
  // the slide is a range with nothing behind it.
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
        // Which side the arriving page comes from. A jump of any distance
        // still only says forward or back — the turn is a direction, not a
        // measure of how far it went.
        forward: Temporal.PlainDate.compare(view, page.view) > 0,
      },
    });
  } else if (periods !== page.periods) {
    // `months` / `weekStartsOn` changed under a standing view: no turn to play,
    // but the snapshot the NEXT one takes has to be the row actually on screen.
    setPage({ ...page, periods });
  }

  // A clock rather than `animationend`: a turn is one animation per COLUMN, so
  // the event arrives once per month and the last one to fire is the page's
  // own business, not this component's. (PropertiesPanel's exit makes the same
  // trade.) Under `prefers-reduced-motion` globals.css collapses the slide to
  // 0.01ms, so the leaving page is off frame immediately either way and the
  // wait costs nothing anyone can see.
  const { out } = page;
  useEffect(() => {
    if (!out) return;
    // A turn that interrupts this one replaces `out`, and the cleanup below
    // takes its clock with it — so this only ever drops the page it was set
    // for, and the new one gets its own full slide.
    const timer = setTimeout(
      () => setPage((current) => ({ ...current, out: null })),
      PUSH_MS,
    );
    return () => clearTimeout(timer);
  }, [out]);

  // One signed distance drives both halves, in COLUMNS rather than screenfuls:
  // a range that walks (step < months) travels one column, so the months that
  // carry over land exactly where they already were instead of sliding against
  // themselves.
  const push = out
    ? { "--calendar-push": `${(out.forward ? step : -step) * 100}%` }
    : null;

  return (
    <div
      className={cx(styles.periodList, className)}
      data-push={out ? "" : undefined}
      style={{ ...style, ...push } as CSSProperties}
      // The band opens HERE rather than on a day cell, so a drag can begin on
      // the gutters between months, the month labels, or the empty tail of a
      // short month — anywhere in the list. A press that lands on a day cell
      // still bubbles up to this handler, so that case is unchanged.
      onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerDown?.(event);
        if (event.defaultPrevented || !sweep) return;
        if (event.pointerType === "touch" || event.button !== 0) return;
        // The chevrons live in this list too, and pressing one pages the range
        // — that is a button, not the start of a selection.
        if ((event.target as HTMLElement).closest?.("[data-nav]")) return;
        dragStart(
          event.clientX,
          event.clientY,
          event.currentTarget.getBoundingClientRect(),
        );
      }}
      onMouseEnter={(event: ReactMouseEvent<HTMLDivElement>) => {
        onMouseEnter?.(event);
        // Seeded at the cursor so it opens in place, exactly like Button's.
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
        // Keyed on the view it shows, so a turn that interrupts another
        // restarts the slide instead of inheriting its tail. Last in the DOM
        // and `inert`, so neither the focus chase nor a Tab can reach a cell
        // on a page that is already leaving; `aria-hidden` keeps the month
        // labels from announcing themselves a second time on the way out.
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
        // A plain sibling: the tooltip box is `position: fixed`, placed by the
        // ref and portalled to the body, so it needs no positioned ancestor and
        // takes no layout slot in this flex row.
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
  const { styles, selectionMode } = useCalendar("Calendar.Grid");
  const { weeks, start } = usePeriod("Calendar.Grid");
  const template = Children.only(children) as ReactElement<CalendarDateProps>;
  return (
    <div
      role="grid"
      // Always the full month name, whatever the visible label's `monthFormat`.
      aria-label={monthLabel(start)}
      // Announced here rather than on the root: `grid` takes
      // aria-multiselectable, the root's `group` does not.
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

/**
 * One day cell — a real <button>. This is the "you have the button" leaf: your
 * `className` lands straight on it, while the component sets the state + identity
 * attributes (aria-selected, data-state, data-outside, data-weekday,
 * data-weekend, disabled) the styling keys off.
 */
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

  // Across a range, a date on a month boundary renders twice — once for real,
  // once as the neighbouring grid's spill day. State belongs to the month that
  // OWNS the date: the spill copy is a decorative placeholder holding a column,
  // so it claims neither the chip nor the tabstop, and a boundary date can't
  // paint itself twice. `disabled` is deliberately NOT gated — min/max is a
  // constraint on the date itself, and a spill day must stay unclickable when
  // its real counterpart is.
  const owned = cell.inCurrentMonth;
  const multiple = selectionMode === "multiple";
  const isSelected = owned && selection.has(cell.key);
  const isToday = owned && cell.date.equals(today);
  const isQuery = owned && query != null && cell.date.equals(query);
  const disabled = isDisabled(cell.date, min, max);
  // The same reason a spill copy draws no chip applies to toggling it: one
  // sweep along a boundary would otherwise flip that date twice, once per
  // month that renders it. Single-select has no such hazard — picking a spill
  // day is a useful "jump to next month" — so only `multiple` opts out.
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
        // Coarse pointers never drag a band — dragging a finger across the grid
        // would fight the page's own scroll. Touch stays tap-to-toggle, which
        // the trailing click below already handles.
        if (event.pointerType === "touch" || event.button !== 0) return;
        // Park the roving tabstop here; the DRAG itself is opened by
        // Calendar.PeriodList, which this event goes on to bubble to. A band is
        // pointer geometry over the whole list, so it must be able to start on
        // the gutters and the month labels too — not only on a day cell.
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
        // `detail` is 0 only for a keyboard-activated button, which is how
        // Enter/Space stay live even while a drag's own trailing click — fired
        // when press and release share a cell — has to be swallowed.
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
          // Shift makes the move a sweep — the keyboard half of "every date
          // you cross flips".
          moveFocus(cell.date.add({ days }), event.shiftKey);
          return;
        }
        // Home/End run to the ends of THIS row, which is a `weekStartsOn`
        // question — hence the column index off the period's own header order
        // rather than an assumed Sunday start.
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
        // Paging moves by the chevrons' own step, and keeps the day-of-month —
        // so PageDown/PageUp round-trips back to where you started (Temporal
        // clamps a short month for you).
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

/**
 * Compound calendar. `Calendar` is the root/context; the parts read it and stay
 * dumb. `Field.Search` (from field.tsx) and a pair of icon `Button` chevrons
 * compose in as the search row and the range steppers. Surface it as
 * `Field.Calendar` from the Date-input assembly when that lands.
 */
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
