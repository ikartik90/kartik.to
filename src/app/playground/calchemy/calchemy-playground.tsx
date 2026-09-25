"use client";

import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Temporal } from "@js-temporal/polyfill";
import {
  createCalchemy,
  type Calchemy,
  type DateOrder,
  type ExpectedDateValue,
  type ParseDateContext,
  type WeekdayIndex,
} from "@calchemy/date-core";
import { css } from "../../../../styled-system/css";
import { Calendar } from "@/components/ui/input/calendar";
import { Field } from "@/components/ui/input/field";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import { Combobox } from "@/components/ui/input/combobox";
import { Typography } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import {
  PropertiesPanel,
  PROPERTIES_TRIGGER_ATTR,
  type PropertiesPanelHandle,
} from "@/components/ui/properties-panel";
import { Switch } from "@/components/ui/input/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { useCalchemyQuery } from "@/hooks/use-calchemy-query";
import { monthGrid } from "@/utils/calchemy-grid";
import {
  rangeCell,
  rangeDays,
  rangeOf,
  type DateRange,
} from "@/utils/calchemy-range";
import type { CalendarCell, WeekdayKey } from "@/utils/calendar-month";
import { CalchemyReadings } from "@/components/calchemy-readings";
import { CalchemyQueryField } from "@/components/calchemy-query-field";
import { CalchemySuggestion } from "@/components/calchemy-suggestion";
import SliderIcon from "@/assets/icons/slider.svg";
import AddIcon from "@/assets/icons/add.svg";
import EditIcon from "@/assets/icons/edit.svg";
import { MenuButton } from "@/components/menu-button";
import { ScrimBlur } from "@/components/scrim-blur";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { PackageCard } from "./package-card";

const DATE_ORDERS = [
  { value: "DMY", label: "DMY" },
  { value: "MDY", label: "MDY" },
  { value: "YMD", label: "YMD" },
] satisfies { value: DateOrder; label: string }[];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]; // prettier-ignore

const WEEK_STARTS = [
  { value: "0", label: "S", ariaLabel: "Sunday" },
  { value: "1", label: "M", ariaLabel: "Monday" },
  { value: "2", label: "T", ariaLabel: "Tuesday" },
  { value: "3", label: "W", ariaLabel: "Wednesday" },
  { value: "4", label: "T", ariaLabel: "Thursday" },
  { value: "5", label: "F", ariaLabel: "Friday" },
  { value: "6", label: "S", ariaLabel: "Saturday" },
];

const WEEK_START_KEYS = [
  "sun", "mon", "tue", "wed", "thu", "fri", "sat",
] as const; // prettier-ignore

const LOCALES = [
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-IN", label: "English (India)" },
  { value: "de-DE", label: "German (Germany)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "ja-JP", label: "Japanese (Japan)" },
];

function timeZones(): string[] {
  const supported = Intl.supportedValuesOf?.("timeZone");
  return supported && supported.length > 0 ? [...supported] : [localZone()];
}

function localZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

const WIDEST_GRID = 3;

// Virtualised against a fixed content height: shifting rows and rewriting
// `scrollTop` breaks Safari's momentum scrolling.
const INITIAL_ROWS = 8;

/** ms a scroll must stand still to count as settled; must outlast a re-snap's scroll. */
const SETTLE = 150;

/** The column count `auto-fit` laid out, or 0 when there is no layout. */
function columnsOf(grid: HTMLElement): number {
  return getComputedStyle(grid)
    .gridTemplateColumns.split(" ")
    .filter((track) => track.endsWith("px")).length;
}

function readableRows(
  stage: HTMLElement,
  scrim: HTMLElement | null,
  rowHeight: number,
): number {
  const head = parseFloat(getComputedStyle(stage).paddingTop) || 0;
  const foot = scrim?.offsetHeight ?? 0;
  return Math.floor((stage.clientHeight - head - foot) / rowHeight);
}

const BAR_INSET = "token(spacing.3xl)";
const BAR_WIDTH = "min(480px, calc(100dvw - 2 * token(spacing.3xl)))";
const BAR_ROW_HEIGHT = "token(spacing.4xl)";
const BAR_HEIGHT = `var(--bar-height, calc(2 * ${BAR_ROW_HEIGHT}))`;
const SCRIM_CLEARANCE = "token(spacing.3xl)";

const CHROME_BAND = "var(--chrome-band)";

const MONTH_MEASURE =
  "calc(7 * token(sizes.calendarDay) + 6 * token(spacing.sm) + 2 * token(spacing.md))";

const MONTH_STRETCH = `calc((token(sizes.calchemyPlayground) - ${WIDEST_GRID - 1} * token(spacing.5xl)) / ${WIDEST_GRID})`;

const stageStyle = css({
  height: "100dvh",
  overflowY: "auto",
  // Proximity, not mandatory: only built rows have snap points.
  scrollSnapType: "y proximity",
  "--chrome-band": "token(spacing.5xl)",
  _bottomSheet: {
    "--chrome-band": "calc(token(spacing.md) + token(spacing.4xl))",
  },
  scrollPaddingTop: `calc(${CHROME_BAND} + token(spacing.3xl))`,
  scrollPaddingBottom: `calc(${BAR_INSET} + ${BAR_HEIGHT} + ${SCRIM_CLEARANCE})`,
  backgroundColor: "bg.canvas",
  // Every <main> is already a flex column (globals.css), so both axes are set.
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  padding: "3xl",
  paddingTop: `calc(${CHROME_BAND} + token(spacing.3xl))`,
  paddingBottom: "calc(2 * token(spacing.5xl))",
  overflowX: "auto",
});

const runStyle = css({
  position: "relative",
  // Not bare `full`: width reads `sizes`, which has no `full`, and the box collapses.
  width: "token(spacing.full)",
  // The stage is a flex column; without this the run shrinks to the viewport.
  flexShrink: 0,
});

const windowStyle = css({
  position: "absolute",
  insetInline: 0,
  display: "flex",
  justifyContent: "center",
});

const periodStyle = css({
  scrollSnapAlign: "start",
  // Capped here, not on the grid: `auto-fit` counts columns against the grid's box.
  maxWidth: MONTH_STRETCH,
  marginInline: "auto",
  width: "token(spacing.full)",
});

const fieldStyle = css({
  width: "token(sizes.calchemyPlayground)",
  // Not bare `full`; see `runStyle`.
  maxWidth: "token(spacing.full)",
});

// The blur is inline on the layers: Panda emits only `-webkit-backdrop-filter`, which Chromium ignores.
const scrimStyle = css({
  backgroundImage:
    "linear-gradient(to top, token(colors.bg.canvas), transparent)",
  position: "fixed",
  insetInline: 0,
  bottom: 0,
  height: `calc(${BAR_INSET} + ${BAR_HEIGHT} + ${SCRIM_CLEARANCE})`,
  pointerEvents: "none",
  zIndex: 1,
  right: "var(--page-inset-end, 0px)",
  // Matches the page's 200ms ease-out inset slide in globals.css.
  transition: "right 200ms ease-out",
});

const chromeStyle = css({
  position: "fixed",
  insetBlockStart: 0,
  insetInlineStart: 0,
  height: `calc(${CHROME_BAND} + ${SCRIM_CLEARANCE})`,
  backgroundImage:
    "linear-gradient(to bottom, token(colors.bg.canvas), transparent)",
  pointerEvents: "none",
  zIndex: 1,
  insetInlineEnd: "var(--page-inset-end, 0px)",
  // Matches the page's 200ms ease-out inset slide in globals.css.
  transition: "inset-inline-end 200ms ease-out",
});

const chromeRowStyle = css({
  // Positioned so it paints above the absolutely positioned blur layers.
  position: "relative",
  zIndex: 1,
  width: "min(token(spacing.full), token(sizes.articleShowcase))",
  maxWidth:
    "min(token(sizes.articleShowcase), calc(token(spacing.full) - 2 * token(spacing.xxl)))",
  marginInline: "auto",
  height: CHROME_BAND,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  _bottomSheet: { paddingBlockStart: "md" },
  "& > *": { pointerEvents: "auto" },
});

const chromeEndStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  justifySelf: "end",
});

function PlaygroundChrome() {
  return (
    <div className={chromeStyle}>
      <ScrimBlur towards="bottom" />
      <div className={chromeRowStyle}>
        <MenuButton />

        <div className={chromeEndStyle}>
          <ThemeToggleButton />
        </div>
      </div>
    </div>
  );
}

const yearStyle = css({
  // Visible, or this becomes the scroll container the months snap to.
  overflow: "visible",
  backgroundColor: "transparent",
  "&::after": { content: "none" },
});

const yearGridStyle = css({
  overflow: "visible",
  // No page turn: the view moves with every scroll.
  "&[data-push] > *": { animation: "none" },
  "& > [data-outgoing]": { display: "none" },
  display: "grid",
  // `auto-fit` decides the column count; `columnsOf` reads it back.
  gridTemplateColumns: `repeat(auto-fit, minmax(${MONTH_MEASURE}, 1fr))`,
  columnGap: "5xl",
  alignItems: "start",
  justifyContent: "center",
});

const barStyle = css({
  position: "fixed",
  bottom: BAR_INSET,
  translate: "-50% 0",
  zIndex: 2,
  display: "flex",
  flexDirection: "column",
  width: BAR_WIDTH,
  borderRadius: "md",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "field.border.default",
  backgroundColor: "bg.surface",
  "--colors-field-bg-default": "var(--colors-field-bg-default-on-surface)",
  boxShadow:
    "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
  color: "field.text.default",
  left: "calc(50% - var(--page-inset-end, 0px) / 2)",
  transition: "left 200ms ease-out",
});

const barControlRowStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexShrink: 0,
  height: BAR_ROW_HEIGHT,
  paddingInline: "lg",
});

const kindsStyle = css({
  // `flex`, not `width`: the toolbar's `flex: 1 1 0` outranks any width.
  flex: "0 0 auto",
  width: "fit-content",
  "& [role='option']": { flexBasis: "auto", paddingInline: "md" },
});

// A serial, not derived from the name, so a rename keeps the entry's identity.
let namedDateSerial = 0;
const nextNamedDateId = () => `named-date-${(namedDateSerial += 1)}`;

interface NamedDate {
  id: string;
  name: string;
  /** In order; never empty. */
  dates: Temporal.PlainDate[];
  repeatsYearly: boolean;
  /** Trimmed; no empty strings. */
  aliases: string[];
  isHoliday: boolean;
}

/** Whether a year's stride clears the set, so it may repeat. Takes the days in order. */
function fitsWithinAYear(dates: readonly Temporal.PlainDate[]): boolean {
  if (dates.length === 0) return false;
  return (
    Temporal.PlainDate.compare(
      dates[0].add({ years: 1 }),
      dates[dates.length - 1],
    ) > 0
  );
}

function namedDateDay(entry: NamedDate): string {
  const [first, ...rest] = entry.dates;
  const day = `${MONTH_NAMES[first.month - 1].slice(0, 3)} ${first.day}`;
  const dated = entry.repeatsYearly ? day : `${day}, ${first.year}`;
  return rest.length === 0 ? dated : `${dated} +${rest.length}`;
}

const railSectionHeaderStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "md",
  flexShrink: 0,
  height: "token(spacing.4xl)",
  paddingInline: "lg",
  color: "text.body",
});

const definitionStyle = css({
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  borderTopWidth: "token(spacing.3xs)",
  borderTopStyle: "solid",
  borderTopColor: "field.border.default",
});

const definitionRowsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "sm",
  paddingBlock: "sm",
  color: "text.body",
});

const definitionRowStyle = css({
  // `flexDirection` too: a `Field` is a column by default.
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  columnGap: "sm",
  width: "token(spacing.full)",
  paddingInline: "lg",
  minHeight: "token(spacing.3xl)",
  "& > label": {
    flex: "1 1 auto",
    // The recipe's `width: 100%` would make the label's flex basis the whole row.
    width: "auto",
    minWidth: 0,
  },
  "& > div": {
    width: "token(sizes.optionListWidth)",
    minWidth: 0,
    marginInlineStart: "auto",
  },
});

// An element, not padding: two atomic classes setting padding have no defined winner.
const definitionActionSlotStyle = css({
  flexShrink: 0,
  width: "token(sizes.propertyRowAction)",
});

const definitionFlagLabelStyle = css({
  color: "field.text.muted",
});

const definitionFootStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexShrink: 0,
  height: "calc(token(spacing.4xl) + token(spacing.md))",
  paddingInline: "lg",
  borderTopWidth: "token(spacing.3xs)",
  borderTopStyle: "solid",
  borderTopColor: "field.border.default",
});

const barActionsStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "sm",
  flexShrink: 0,
});

const definitionHeadingStyle = css({
  color: "field.text.default",
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});
const namedDateNameStyle = css({
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const QUERY_KINDS = [
  { value: "single", label: "Single" },
  { value: "range", label: "Range" },
  { value: "multiple", label: "Multiple" },
] satisfies { value: ExpectedDateValue; label: string }[];

const QUERY_PLACEHOLDERS: Record<ExpectedDateValue, string> = {
  single: 'Try "the second friday of march"',
  range: 'Try "today until the end of next month"',
  multiple: 'Try "mondays and fridays next month"',
};

const RANGE_WASH = "token(colors.bg.calendarRange)";

// Makes the cells' `cqw` the grid's width.
const monthGridStyle = css({
  containerType: "inline-size",
  "--calchemy-day-pitch": "calc((100cqw - token(sizes.calendarDay)) / 6)",
});

const rangeDateStyle = css({
  "&[data-range]": {
    position: "relative",
    // Catches the band's negative z-index: above the cell's background, below its text.
    isolation: "isolate",
    opacity: 1,
    color: "field.text.active",
  },
  "&[data-range-run]::before": {
    content: '""',
    position: "absolute",
    zIndex: -1,
    insetBlock: 0,
    insetInlineStart: 0,
    width:
      "calc((var(--calchemy-range-run) - 1) * var(--calchemy-day-pitch) + token(sizes.calendarDay))",
    borderRadius: "sm",
    backgroundImage: `linear-gradient(to right, transparent, ${RANGE_WASH} var(--calchemy-range-fade-in, 0px), ${RANGE_WASH} calc(100% - var(--calchemy-range-fade-out, 0px)), transparent)`,
  },
  // An end whose run box was opened by an earlier cell paints over it, so it gets its own wash.
  "&[data-range][aria-selected='true']:not([data-range-run])::before": {
    content: '""',
    position: "absolute",
    zIndex: -1,
    inset: 0,
    borderRadius: "sm",
    backgroundColor: RANGE_WASH,
  },
  "&[data-range-fade~='in']": {
    "--calchemy-range-fade-in": "token(sizes.calendarDay)",
  },
  "&[data-range-fade~='out']": {
    "--calchemy-range-fade-out": "token(sizes.calendarDay)",
  },
});

/** A day cell; `Calendar.Grid` clones it per day and injects `cell`. */
function RangeDate({
  cell,
  range,
  weekStartsOn,
  onPick,
}: {
  cell?: CalendarCell;
  range: DateRange | null;
  weekStartsOn: WeekdayKey;
  /** Replaces the calendar's own toggle; null keeps it. */
  onPick: ((date: Temporal.PlainDate) => void) | null;
}) {
  const band =
    cell && range && cell.inCurrentMonth
      ? rangeCell(cell.date, range, weekStartsOn)
      : null;
  const run = band?.run;
  const fade = [run?.fadesIn && "in", run?.fadesOut && "out"]
    .filter(Boolean)
    .join(" ");

  return (
    <Calendar.Date
      cell={cell}
      className={rangeDateStyle}
      data-range={band?.role}
      data-range-run={run ? "" : undefined}
      data-range-fade={fade || undefined}
      style={
        run
          ? ({ "--calchemy-range-run": run.length } as CSSProperties)
          : undefined
      }
      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
        if (!onPick || !cell) return;
        // Tells the calendar's own toggle to stand down.
        event.preventDefault();
        onPick(cell.date);
      }}
    />
  );
}

function NamedDateForm({
  entry,
  headingId,
  dates,
  onSubmit,
  onCancel,
}: {
  /** Null defines a new entry. */
  entry: NamedDate | null;
  headingId: string;
  dates: Temporal.PlainDate[];
  onSubmit: (fields: Omit<NamedDate, "id">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(entry?.name ?? "");
  const [aliases, setAliases] = useState<string[]>(() =>
    entry && entry.aliases.length > 0 ? entry.aliases : [""],
  );
  const [openedWith] = useState(() => aliases.length);
  const [repeatsYearly, setRepeatsYearly] = useState(
    entry ? entry.repeatsYearly : true,
  );
  const [isHoliday, setIsHoliday] = useState(entry?.isHoliday ?? false);

  const days = [...dates].sort(Temporal.PlainDate.compare);
  const canRepeat = fitsWithinAYear(days);
  const repeats = repeatsYearly && canRepeat;

  return (
    <div
      className={definitionStyle}
      role="group"
      aria-labelledby={headingId}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onCancel();
      }}
    >
      <div className={definitionRowsStyle}>
        <Field size="sm" className={definitionRowStyle}>
          <Field.Label>Date name</Field.Label>
          <Field.Frame>
            <Field.Control
              placeholder="Christmas"
              autoFocus
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </Field.Frame>
          <span className={definitionActionSlotStyle} aria-hidden />
        </Field>
        {/* Tracks ask for `lg` explicitly: an `sm` field would coerce them to 20px. */}
        <Field size="sm" labelFirst className={definitionRowStyle}>
          <Field.Label className={definitionFlagLabelStyle}>
            Repeats every year
          </Field.Label>
          <Switch
            size="lg"
            checked={repeats}
            disabled={!canRepeat}
            onCheckedChange={setRepeatsYearly}
          />
          <span className={definitionActionSlotStyle} aria-hidden />
        </Field>
        <Field size="sm" labelFirst className={definitionRowStyle}>
          <Field.Label className={definitionFlagLabelStyle}>
            Is holiday
          </Field.Label>
          <Switch
            size="lg"
            checked={isHoliday}
            onCheckedChange={setIsHoliday}
          />
          <span className={definitionActionSlotStyle} aria-hidden />
        </Field>
        {/* Append-only, so the index is a row's identity. */}
        {aliases.map((alias, index) => {
          const last = index === aliases.length - 1;
          return (
            <Field key={index} size="sm" className={definitionRowStyle}>
              {index === 0 && <Field.Label>Aliases</Field.Label>}
              <Field.Frame>
                <Field.Control
                  aria-label={`Alias ${index + 1}`}
                  placeholder="Xmas"
                  value={alias}
                  autoFocus={last && index >= openedWith}
                  onChange={(event) => {
                    const next = event.currentTarget.value;
                    setAliases((current) =>
                      current.map((held, at) => (at === index ? next : held)),
                    );
                  }}
                />
              </Field.Frame>
              {last ? (
                <Button
                  variant="icon"
                  aria-label="Add an alias"
                  onClick={() => setAliases((current) => [...current, ""])}
                >
                  <AddIcon />
                </Button>
              ) : (
                <span className={definitionActionSlotStyle} aria-hidden />
              )}
            </Field>
          );
        })}
      </div>
      <div className={definitionFootStyle}>
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={name.trim().length === 0 || days.length === 0}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              dates: days,
              repeatsYearly: repeats,
              aliases: aliases.map((alias) => alias.trim()).filter(Boolean),
              isHoliday,
            })
          }
        >
          {entry ? "Save named date" : "Define named date"}
        </Button>
      </div>
    </div>
  );
}

// The year's 960 + the rail's 360 + the stage's 32px either side.
const RAIL_ROOM_QUERY = "(min-width: 1384px)";

function useRoomForRail(): boolean {
  const [roomy, setRoomy] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.(RAIL_ROOM_QUERY);
    if (!query) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoomy(query.matches);
    const handleChange = (event: MediaQueryListEvent) =>
      setRoomy(event.matches);
    query.addEventListener?.("change", handleChange);
    return () => query.removeEventListener?.("change", handleChange);
  }, []);

  return roomy;
}

export function CalchemyPlayground() {
  const [calchemy, setCalchemy] = useState<Calchemy | null>(null);
  const [kind, setKind] = useState<ExpectedDateValue>("multiple");
  const [dateOrder, setDateOrder] = useState<DateOrder>("MDY");
  const [timeZone, setTimeZone] = useState(localZone);
  const [weekStartsOn, setWeekStartsOn] = useState<WeekdayIndex>(0);
  const [locale, setLocale] = useState("en-US");
  const [namedDates, setNamedDates] = useState<NamedDate[]>([]);
  // null: query panel; { entry: null }: defining a new date; else editing `entry`.
  const [definition, setDefinition] = useState<{
    entry: NamedDate | null;
  } | null>(null);
  const namedDateTrigger = useRef<HTMLElement | null>(null);
  const definitionHeadingId = useId();

  const namedDatesVocabulary = useMemo(
    () =>
      namedDates.map((entry) => ({
        value: entry.name,
        aliases: entry.aliases,
        isHoliday: entry.isHoliday,
        resolveDates: ({ year }: { year: number }) => {
          if (!entry.repeatsYearly) return entry.dates;
          const stride = year - entry.dates[0].year;
          return entry.dates.map((date) => date.add({ years: stride }));
        },
      })),
    [namedDates],
  );
  const zones = useMemo(() => timeZones(), []);

  const parseContext = useMemo<ParseDateContext>(
    () => ({
      locale,
      timeZone,
      weekStartsOn,
      // The full list, ranked: a single order would hide the other readings.
      dateOrderPreference: [
        dateOrder,
        ...DATE_ORDERS.map((order) => order.value).filter(
          (order) => order !== dateOrder,
        ),
      ],
    }),
    [locale, timeZone, weekStartsOn, dateOrder],
  );
  const roomForRail = useRoomForRail();
  const [railChoice, setRailChoice] = useState<boolean | null>(null);
  const sidebarOpen = railChoice ?? roomForRail;
  // Close through the handle; unmounting would skip the closing slide.
  const sidebar = useRef<PropertiesPanelHandle>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState<number | null>(null);
  // A hand-made selection, or null; in `range`, just its two ends.
  const [picked, setPicked] = useState<Temporal.PlainDate[] | null>(null);
  const [rangeAnchor, setRangeAnchor] = useState<Temporal.PlainDate | null>(
    null,
  );
  const stageRef = useRef<HTMLElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState<number | null>(null);
  const [columns, setColumns] = useState(WIDEST_GRID);
  const today = useMemo(() => Temporal.Now.plainDateISO(), []);
  const grid = useMemo(() => monthGrid(columns, today), [columns, today]);
  const [window_, setWindow] = useState(() => ({
    start: grid.openingRow(INITIAL_ROWS),
    rows: INITIAL_ROWS,
    top: grid.openingRow(INITIAL_ROWS),
  }));
  const opened = useRef(false);
  const pendingScroll = useRef<{ top: number; smooth: boolean } | null>(null);
  const keepInView = useRef<Temporal.PlainDate | null>(null);
  // Sampled only from a settled scroll: a width change re-snaps the scroller
  // before the resize is reported, so the live position is already wrong.
  const settled = useRef<Temporal.PlainDate | null>(null);
  useEffect(() => {
    const timer = setTimeout(
      () => (settled.current = grid.monthForRow(window_.top)),
      SETTLE,
    );

    return () => clearTimeout(timer);
  }, [window_, grid]);

  const closeDefinition = () => {
    setDefinition(null);
    namedDateTrigger.current?.focus();
  };

  const dropPicked = () => {
    setPicked(null);
    setRangeAnchor(null);
  };

  useEffect(() => {
    let cancelled = false;
    createCalchemy({ namedDatesVocabulary }).then((engine) => {
      if (!cancelled) setCalchemy(engine);
    });

    return () => {
      cancelled = true;
    };
  }, [namedDatesVocabulary]);

  const phrase = useCalchemyQuery(calchemy, parseContext, kind);
  const { dates, query } = phrase;

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;

    const measure = () => setBarHeight(bar.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);

    return () => observer.disconnect();
  }, [calchemy]);

  useLayoutEffect(() => {
    if (!calchemy) return;

    const month = stageRef.current?.querySelector<HTMLElement>(
      "[data-playground-month]",
    );
    // Zero means no layout (jsdom, print); taking it would divide by zero.
    const height = month?.getBoundingClientRect().height ?? 0;
    if (height > 0)
      setRowHeight((current) => (current === height ? current : height));
  }, [calchemy, columns]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const list = stage?.querySelector<HTMLElement>("[data-playground-grid]");
    if (!stage || !list || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const next = columnsOf(list);
      if (next === 0 || next === grid.columns) return;
      if (opened.current) keepInView.current = settled.current;
      setColumns(next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);

    return () => observer.disconnect();
  }, [calchemy, grid]);

  // Builds the destination rows first: a scroll into unbuilt rows snaps back.
  const jumpTo = useCallback(
    (row: number, smooth: boolean) => {
      const stage = stageRef.current;
      if (!stage || !rowHeight) return;

      pendingScroll.current = { top: row * rowHeight, smooth };
      setWindow({
        ...grid.windowFor(row, Math.ceil(stage.clientHeight / rowHeight)),
        top: row,
      });
    },
    [rowHeight, grid],
  );

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const pending = pendingScroll.current;
    if (!stage || !pending) return;

    pendingScroll.current = null;
    if (pending.smooth)
      stage.scrollTo({ top: pending.top, behavior: "smooth" });
    else stage.scrollTop = pending.top;
  }, [window_]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !rowHeight || opened.current) return;

    opened.current = true;
    const opening = grid.openingRow(
      readableRows(stage, scrimRef.current, rowHeight),
    );
    settled.current = grid.monthForRow(opening);
    jumpTo(opening, false);
    // Again next frame: the browser restores the scroller's position after layout.
    const frame = requestAnimationFrame(() => jumpTo(opening, false));
    return () => cancelAnimationFrame(frame);
  }, [rowHeight, grid, jumpTo]);

  useLayoutEffect(() => {
    const month = keepInView.current;
    if (!month) return;

    keepInView.current = null;
    const row = grid.rowForDate(month);
    jumpTo(row, false);
    // Again next frame: the browser clamps or anchors the scroller after layout.
    const frame = requestAnimationFrame(() => jumpTo(row, false));
    return () => cancelAnimationFrame(frame);
  }, [grid, jumpTo]);

  const trackScroll = () => {
    const stage = stageRef.current;
    if (!stage || !rowHeight) return;

    const top = Math.round(stage.scrollTop / rowHeight);
    const next = {
      ...grid.windowFor(top, Math.ceil(stage.clientHeight / rowHeight)),
      top,
    };

    setWindow((current) =>
      current.start === next.start &&
      current.rows === next.rows &&
      current.top === next.top
        ? current
        : next,
    );
  };

  const reveal = useCallback(
    (date: Temporal.PlainDate) => {
      const stage = stageRef.current;
      if (!stage || !rowHeight) return;

      const row = grid.rowForDate(date);
      const top = row * rowHeight;
      const obscured = scrimRef.current?.offsetHeight ?? 0;
      const readable =
        top >= stage.scrollTop &&
        top + rowHeight <= stage.scrollTop + stage.clientHeight - obscured;
      if (readable) return;

      jumpTo(row, Math.abs(top - stage.scrollTop) < stage.clientHeight * 3);
    },
    [rowHeight, grid, jumpTo],
  );

  useEffect(() => {
    if (dates.length === 0) return;
    reveal(dates[0]);
  }, [dates, reveal]);

  const openDefinition = (entry: NamedDate | null, button: HTMLElement) => {
    if (definition && (definition.entry?.id ?? null) === (entry?.id ?? null)) {
      closeDefinition();
      return;
    }
    namedDateTrigger.current = button;
    if (entry) {
      setPicked(entry.dates);
      reveal(entry.dates[0]);
    }
    setDefinition({ entry });
  };

  // Nothing date-shaped renders until the engine lands, keeping "today" off the server.
  if (!calchemy)
    return (
      <main className={stageStyle} aria-busy="true">
        <PlaygroundChrome />
      </main>
    );

  const values = picked ?? dates;
  const range = kind === "range" ? rangeOf(values) : null;
  const selected = range
    ? range.first.equals(range.last)
      ? [range.first]
      : [range.first, range.last]
    : values;
  const definitionDates = definition && range ? rangeDays(range) : values;

  const pick =
    kind === "multiple"
      ? null
      : (date: Temporal.PlainDate) => {
          if (kind === "single") {
            setPicked([date]);
            return;
          }
          if (!rangeAnchor) {
            setRangeAnchor(date);
            setPicked([date]);
            return;
          }
          setRangeAnchor(null);
          setPicked(
            rangeAnchor.equals(date)
              ? [date]
              : [rangeAnchor, date].sort(Temporal.PlainDate.compare),
          );
        };

  return (
    <main
      ref={stageRef}
      className={stageStyle}
      onScroll={trackScroll}
      style={
        barHeight === null
          ? undefined
          : ({ "--bar-height": `${barHeight}px` } as CSSProperties)
      }
    >
      <PlaygroundChrome />
      <div ref={scrimRef} className={scrimStyle} aria-hidden>
        <ScrimBlur towards="top" />
      </div>
      <div ref={barRef} className={barStyle}>
        <div className={barControlRowStyle}>
          {definition ? (
            <Typography
              tag="h2"
              type="bodyLarge"
              id={definitionHeadingId}
              className={definitionHeadingStyle}
            >
              {definition.entry ? "Edit named date" : "New named date"}
            </Typography>
          ) : (
            <SegmentedControl
              className={kindsStyle}
              options={QUERY_KINDS}
              value={kind}
              onValueChange={(next) => {
                setKind(next as ExpectedDateValue);
                // Re-setting the same query resets the highlight and the commitment.
                phrase.setQuery(query);
                dropPicked();
              }}
              ariaLabel="What a phrase may mean"
            />
          )}
          <div className={barActionsStyle}>
            {(values.length > 0 || definition) && (
              <Button
                variant="icon"
                aria-label="New named date"
                aria-pressed={definition?.entry === null}
                onClick={(event) => openDefinition(null, event.currentTarget)}
              >
                <AddIcon />
                <Button.Tooltip>
                  <Tooltip.Text>New named date</Tooltip.Text>
                </Button.Tooltip>
              </Button>
            )}
            <Button
              variant="icon"
              {...PROPERTIES_TRIGGER_ATTR}
              aria-label="Parser Settings"
              aria-pressed={sidebarOpen}
              onClick={() =>
                sidebarOpen ? sidebar.current?.dismiss() : setRailChoice(true)
              }
            >
              <SliderIcon />
            </Button>
          </div>
        </div>
        {definition ? (
          <NamedDateForm
            // Remount per entry: the fields are seeded on mount.
            key={definition.entry?.id ?? "new"}
            entry={definition.entry}
            headingId={definitionHeadingId}
            dates={definitionDates}
            onCancel={closeDefinition}
            onSubmit={(fields) => {
              const edited = definition.entry;
              setNamedDates((current) =>
                edited
                  ? current.map((held) =>
                      held.id === edited.id ? { ...fields, id: held.id } : held,
                    )
                  : [...current, { ...fields, id: nextNamedDateId() }],
              );
              closeDefinition();
            }}
          />
        ) : (
          <>
            <CalchemyReadings query={phrase} />
            <CalchemySuggestion query={phrase} onQueryChange={dropPicked} />
            <CalchemyQueryField
              query={phrase}
              placeholder={QUERY_PLACEHOLDERS[kind]}
              onQueryChange={dropPicked}
            />
          </>
        )}
      </div>
      <div
        className={runStyle}
        style={
          rowHeight === null
            ? undefined
            : { height: grid.totalRows * rowHeight }
        }
      >
        <div
          className={windowStyle}
          style={
            rowHeight === null ? undefined : { top: window_.start * rowHeight }
          }
        >
          <Field className={fieldStyle}>
            <Calendar
              className={yearStyle}
              fluid
              selectionMode="multiple"
              values={selected}
              onValuesChange={setPicked}
              sweep={kind === "multiple"}
              months={window_.rows * grid.columns}
              // No `onViewChange`: the scroll alone decides which months exist.
              view={grid.monthForRow(window_.start)}
              step={grid.columns}
              weekStartsOn={WEEK_START_KEYS[weekStartsOn]}
            >
              <Calendar.PeriodList
                className={yearGridStyle}
                data-playground-grid=""
              >
                <Calendar.Period
                  className={periodStyle}
                  data-playground-month=""
                >
                  <Calendar.Month monthFormat="narrow" />
                  <Calendar.Week>
                    <Calendar.Day />
                  </Calendar.Week>
                  <Calendar.Grid className={monthGridStyle}>
                    <RangeDate
                      range={range}
                      weekStartsOn={WEEK_START_KEYS[weekStartsOn]}
                      onPick={pick}
                    />
                  </Calendar.Grid>
                </Calendar.Period>
              </Calendar.PeriodList>
            </Calendar>
          </Field>
        </div>
      </div>
      {sidebarOpen && (
        <PropertiesPanel
          ref={sidebar}
          ariaLabel="Parser Settings"
          dismissOnOutsidePointer={false}
          // Rail and year arrive together, so an inset slide would only shift the calendar (CLS).
          animateInset={false}
          onDismiss={() => setRailChoice(false)}
        >
          <PropertiesPanel.Header>Parser Settings</PropertiesPanel.Header>
          <PropertiesPanel.Section enabled>
            <div className={railSectionHeaderStyle}>
              <Typography tag="p" type="bodySmall">
                Preferences
              </Typography>
            </div>
            <PropertiesPanel.ControlPanel ariaLabel="Preferences">
              <PropertiesPanel.Control label="Date format">
                <SegmentedControl
                  options={DATE_ORDERS}
                  value={dateOrder}
                  onValueChange={(next) => setDateOrder(next as DateOrder)}
                />
              </PropertiesPanel.Control>
              <PropertiesPanel.Control label="Time zone">
                {/* Not portalled: it must anchor inside the fixed panel. */}
                <Combobox
                  portal={false}
                  value={timeZone}
                  onValueChange={setTimeZone}
                  searchPlaceholder="Search zones…"
                >
                  {zones.map((zone) => (
                    <Combobox.Option key={zone} value={zone}>
                      {zone}
                    </Combobox.Option>
                  ))}
                </Combobox>
              </PropertiesPanel.Control>
              <PropertiesPanel.Control label="Week start">
                <SegmentedControl
                  options={WEEK_STARTS}
                  value={String(weekStartsOn)}
                  onValueChange={(next) =>
                    setWeekStartsOn(Number(next) as WeekdayIndex)
                  }
                />
              </PropertiesPanel.Control>
              <PropertiesPanel.Control label="Locale">
                <Combobox
                  portal={false}
                  value={locale}
                  onValueChange={setLocale}
                  searchPlaceholder="Search locales…"
                >
                  {LOCALES.map((option) => (
                    <Combobox.Option key={option.value} value={option.value}>
                      {option.label}
                    </Combobox.Option>
                  ))}
                </Combobox>
              </PropertiesPanel.Control>
            </PropertiesPanel.ControlPanel>
          </PropertiesPanel.Section>

          <PropertiesPanel.Section enabled>
            <div className={railSectionHeaderStyle}>
              <Typography tag="p" type="bodySmall">
                Named Dates Dictionary
              </Typography>
            </div>
            {namedDates.length > 0 && (
              <PropertiesPanel.ControlPanel ariaLabel="Named dates">
                {namedDates.map((entry) => (
                  <PropertiesPanel.Control
                    key={entry.id}
                    label={namedDateDay(entry)}
                  >
                    <Typography
                      tag="p"
                      type="bodySmall"
                      className={namedDateNameStyle}
                    >
                      {entry.name}
                    </Typography>
                    <Button
                      variant="icon"
                      aria-label={`Edit ${entry.name}`}
                      aria-expanded={definition?.entry?.id === entry.id}
                      onClick={(event) =>
                        openDefinition(entry, event.currentTarget)
                      }
                    >
                      <EditIcon />
                    </Button>
                  </PropertiesPanel.Control>
                ))}
              </PropertiesPanel.ControlPanel>
            )}
          </PropertiesPanel.Section>
          <PropertiesPanel.Footer>
            <PackageCard />
          </PropertiesPanel.Footer>
        </PropertiesPanel>
      )}
    </main>
  );
}
