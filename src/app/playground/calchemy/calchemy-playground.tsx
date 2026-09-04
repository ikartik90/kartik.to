"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
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
import { css, cx } from "../../../../styled-system/css";
import { colorPickerPopover } from "../../../../styled-system/recipes";
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
import { Popover } from "@/components/ui/popover";
import { TextInput } from "@/components/ui/input/text-input";
import { DatePicker } from "@/components/ui/input/datepicker";
import { Switch } from "@/components/ui/input/switch";
import { usePickerPin } from "@/hooks/use-picker-pin";
import { useCalchemyQuery } from "@/hooks/use-calchemy-query";
import { CalchemyReadings } from "@/components/calchemy-readings";
import { CalchemyQueryField } from "@/components/calchemy-query-field";
import { CalchemySuggestion } from "@/components/calchemy-suggestion";
import SliderIcon from "@/assets/icons/slider.svg";
import AddIcon from "@/assets/icons/add.svg";
import EditIcon from "@/assets/icons/edit.svg";
import { MenuButton } from "@/components/menu-button";
import { ThemeToggleButton } from "@/components/theme-toggle";
import CrossIcon from "@/assets/icons/cross.svg";

// ---------------------------------------------------------------------------
// Calchemy Playground — a year of calendar, and one line to talk to it.
//
// The grid is the design system's own `Calendar` (src/components/ui/input),
// held in `multiple` selection and handed a whole year at once: twelve months
// laid 3 across and 4 down. Calchemy is not asked to draw anything. It only
// answers the question "which days does this phrase mean", and the calendar
// draws that answer — so the parser is being read through the same primitive
// the Date field uses, not through a picker built to flatter it.
//
// The query bar floats over the stage rather than sitting above the grid. A
// year is taller than most screens, so a bar in the flow would scroll away
// from the thing it drives; pinned, it stays where a command line belongs and
// the grid moves behind it.
//
// Selection has two sources and one of them always wins the moment it acts:
// typing REPLACES the selection (a phrase means what it means), and a click or
// a drag on the grid takes it over until the next keystroke. That is why the
// picked set is held as an override of the parse rather than beside it.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The preferences, which are `ParseDateContext` — every setting the parser
// takes, and nothing invented on top. They are the sidebar's whole content, and
// the reason the sidebar is worth having: `03/04/25` means three different days
// and WHICH it means is one of these, not a mystery of the parser's.
//
// Two fields are left out. `referenceDate` fixes what "today" means, which is a
// testing knob — a playground whose today is not today makes every relative
// phrase in it a lie. `lastNDaysIncludesToday` is a single phrase's off-by-one,
// which is a question about "last 90 days" rather than a preference about
// dates, and the parser's default answer is the one people mean.
// ---------------------------------------------------------------------------

/** How a numeric date is read — the setting `03/04/25` turns on. */
const DATE_ORDERS = [
  { value: "DMY", label: "DMY" },
  { value: "MDY", label: "MDY" },
  { value: "YMD", label: "YMD" },
] satisfies { value: DateOrder; label: string }[];

// Letters on the chips and the day's name behind each — the row Shift
// Scheduling v1 draws its weekdays as. Two Ss and two Ts among seven letters
// cannot name themselves, so the name is what assistive tech reads.
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

/** Which weekday sits in column 0, in the two spellings the two consumers take. */
const WEEK_START_KEYS = [
  "sun", "mon", "tue", "wed", "thu", "fri", "sat",
] as const; // prettier-ignore

// A short list rather than every tag the platform knows: a locale here changes
// how the parser LABELS an answer, and a list nobody can read the labels of is
// not a setting anyone can use.
const LOCALES = [
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-IN", label: "English (India)" },
  { value: "de-DE", label: "German (Germany)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "ja-JP", label: "Japanese (Japan)" },
];

/** Every zone the platform knows, for the type-ahead. */
function timeZones(): string[] {
  const supported = Intl.supportedValuesOf?.("timeZone");
  return supported && supported.length > 0 ? [...supported] : [localZone()];
}

function localZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Three across; how many rows are on screen is now the viewport's business. */
const GRID_COLUMNS = 3;

// There are no chevrons, so SCROLLING is the only way through the months, and
// it does not run out: the scroll is a CENTURY either side of today, and only
// the rows near the viewport are ever built.
//
// Virtualised against a FIXED content height, which is the whole point. The
// obvious way — keep a window of months and load more onto whichever end you
// approach — means the run's start moves, which moves everything on screen,
// which has to be put back by writing `scrollTop`. That works right up until
// the scroll has momentum behind it: Safari applies the rest of the inertia
// from wherever the write left the scroller, and a one-row flick lands you two
// years away. Here the tall box below never changes size and every row sits at
// its own absolute offset, so scrolling in is all that happens and there is
// nothing to correct.
const TOTAL_ROWS = 800;
const ORIGIN_ROW = TOTAL_ROWS / 2;
/** Rows built beyond each edge of the viewport, so a fast scroll never outruns
 *  them — deep enough to cover a hard flick, which is roughly a screen. */
const OVERSCAN_ROWS = 6;
/** What is built before the row height is known — see `useLayoutEffect`. */
const INITIAL_ROWS = 8;

// ---------------------------------------------------------------------------
// The scrim, built the way the calendar's own `edge` nav scrims are built
// (panda.config.ts): an opaque colour WASH carries the fade, and a whisper of
// blur is laid over it.
//
// The wash is the load-bearing half. A colour gradient is smooth by
// construction and renders identically everywhere, which is why no ramp is ever
// visible in the shift-scheduling demo.
//
// The blur is 1.4px twice — masked over two different distances so the pair
// composes in quadrature to ~2px where both survive and relaxes to 1.4 where
// only the long one does. It is a garnish, and it is written knowing WebKit may
// well drop it: an element carrying `mask-image` is a backdrop root, so its own
// backdrop-filter can end up with nothing behind it to filter. That is a real
// risk and an acceptable one HERE, where the wash is what does the work — the
// same bet the edge scrims already make in this codebase.
//
// The alternative was to build the fade out of the blur itself, in bands. It is
// not worth it: a `backdrop-filter` samples its backdrop clipped to its own box,
// so a thin band blurs with nothing above it to mix in and clamps against its
// own edge instead. Every band then lands visibly apart from its neighbour
// however close the radii are, which is banding you can read a date through.
// ---------------------------------------------------------------------------

// The bar's own two measurements, and the clearance the fade runs out at. The
// scrim's band is built from all three — 32 below the bar, its own 40, and 32
// clear of its top edge — so they are named once here and BOTH the bar and the
// band read them. The height in particular would otherwise come from the
// `calendar` recipe's `search` slot, which this file has no way to notice
// changing: the band would drift off the bar it is measured against and the
// fade would stop reaching its thirty-two pixels.
//
// The clearance and the standoff are the same 32 — the band is symmetrical
// about the bar — but they stay separately named because they answer different
// questions: how far the bar sits off the screen edge, and how far above it the
// fade has finished.
const BAR_INSET = "token(spacing.3xl)";
const BAR_WIDTH = "min(480px, calc(100dvw - 2 * token(spacing.3xl)))";
// The kinds and the sidebar, then the query — 40 each — with the readings of an
// ambiguous phrase between them when there are any. That middle section is as
// tall as the readings make it, so the bar is left to its content and MEASURES
// itself: `--bar-height` is what it publishes, and the scrim's band is built
// from that rather than from a row count nobody can keep in step.
const BAR_ROW_HEIGHT = "token(spacing.4xl)";
const BAR_HEIGHT = `var(--bar-height, calc(2 * ${BAR_ROW_HEIGHT}))`;
const SCRIM_CLEARANCE = "token(spacing.3xl)";

/**
 * How tall the gutter controls' box is — the site's 80px band on a desktop, and
 * the menu's own row plus its standoff on a phone. Held as a custom property
 * for the reason the shader playground holds it as one: the box's height and
 * the room reserved above the calendar are the same number, and one of them not
 * knowing what the other did would either cover the first row of months or hold
 * room for a band that is not there.
 */
const CHROME_BAND = "var(--chrome-band)";

const SCRIM_BLUR = "blur(1.4px)";

/** The near half of the ramp, then the tail — see the note above. */
const SCRIM_RAMPS = [
  "linear-gradient(to top, #000, transparent 55%)",
  "linear-gradient(to top, #000, transparent)",
];

/** The first day of the quarter today falls in. */
function currentQuarterStart(): Temporal.PlainDate {
  const today = Temporal.Now.plainDateISO();
  return today.with({
    month: Math.floor((today.month - 1) / 3) * 3 + 1,
    day: 1,
  });
}

/** The month opening `row`. Row `ORIGIN_ROW` is the quarter today falls in. */
function monthForRow(
  row: number,
  quarter: Temporal.PlainDate,
): Temporal.PlainDate {
  return quarter.add({ months: (row - ORIGIN_ROW) * GRID_COLUMNS });
}

/** The row `date` falls in — the inverse of `monthForRow`. */
function rowForDate(
  date: Temporal.PlainDate,
  quarter: Temporal.PlainDate,
): number {
  const months = (date.year - quarter.year) * 12 + (date.month - quarter.month);
  return ORIGIN_ROW + Math.floor(months / GRID_COLUMNS);
}

/**
 * The row parked at the top on arrival: one above the current quarter's, which
 * is what makes the quarter you are in the SECOND row.
 */
const OPENING_ROW = ORIGIN_ROW - 1;

/** A month's own measure: 7 day columns, their 6 gutters, and the period's
 *  padding — the 208px pitch the `calendar` recipe is built on. */
const MONTH_MEASURE =
  "calc(7 * token(sizes.calendarDay) + 6 * token(spacing.sm) + 2 * token(spacing.md))";

const stageStyle = css({
  // The stage scrolls, not the page: snapping belongs to this one screen, and
  // `scroll-snap-type` on the document would follow the reader everywhere.
  height: "100dvh",
  overflowY: "auto",
  // PROXIMITY, not mandatory. Mandatory snapping cannot come to rest anywhere
  // without a snap point, and only the built rows have any — so a flick whose
  // momentum briefly outran the window was pulled to the nearest built row,
  // which could be a year away. Proximity snaps a settled scroll to its row and
  // otherwise leaves it alone, which is the behaviour that survives rows being
  // built as you go.
  scrollSnapType: "y proximity",
  // The site's own 80px band, and on a phone the 8px standoff plus the menu's
  // 40px row — `shader-playground`'s two values exactly, and for its reasons:
  // 80 is a number that fills a gap an article already opens above its first
  // row, and there is no such gap here.
  "--chrome-band": "token(spacing.5xl)",
  _bottomSheet: {
    "--chrome-band": "calc(token(spacing.md) + token(spacing.4xl))",
  },
  // A snapped row lands below the stage's own top inset rather than jammed
  // against the edge — and below the gutter band above that, which is an
  // overlay the scrollport still runs under. Same reasoning as the foot, one
  // line down.
  scrollPaddingTop: `calc(${CHROME_BAND} + token(spacing.3xl))`,
  // The scrim's band is an overlay, so the scrollport still runs under it and a
  // revealed answer would come to rest behind the frosting. This is the
  // scroller being told that the bottom 104 is spoken for — same three
  // measurements the band itself is built from.
  scrollPaddingBottom: `calc(${BAR_INSET} + ${BAR_HEIGHT} + ${SCRIM_CLEARANCE})`,
  backgroundColor: "bg.canvas",
  // Both axes are declared because the site already makes every <main> a flex
  // COLUMN (globals.css) — so a lone `justifyContent: center` here would have
  // centred the year vertically and left it against the gutter, which is
  // exactly what it did.
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  padding: "3xl",
  // The gutter band's own height on top of that inset, so the year starts
  // BELOW the two controls rather than under them.
  paddingTop: `calc(${CHROME_BAND} + token(spacing.3xl))`,
  // The floating bar's height and its standoff, so the last row of months can
  // always be scrolled clear of it.
  paddingBottom: "calc(2 * token(spacing.5xl))",
  // The grid holds its 3 × 208px measure rather than shrinking: below that the
  // stage scrolls sideways instead of the grid cropping (the list hides its
  // overflow).
  overflowX: "auto",
});

// The scroll's whole extent, at its true height, so the geometry above the
// viewport never changes as you move through it. Nothing lives in here but the
// window below, parked at its row's offset.
const runStyle = css({
  position: "relative",
  width: "token(spacing.full)",
  // The stage is a flex COLUMN, so its main axis is the one this box is a
  // century long on — and a flex item shrinks on the main axis by default.
  // Without this the whole run is squeezed down to the height of the viewport
  // and the scroll has nowhere to go.
  flexShrink: 0,
});

const windowStyle = css({
  position: "absolute",
  insetInline: 0,
  display: "flex",
  justifyContent: "center",
});

// Every month is a snap point, and the three in a row share a top edge — so
// what actually snaps is the ROW, in either direction, with no chevrons and no
// paging: scrolling IS how you move through the months.
const periodStyle = css({
  scrollSnapAlign: "start",
});

// The one override the year layout needs. Everything else about the list —
// its cropping, the corner-pinned chevrons, the drag band — is the recipe's.
// The Field root is a full-width stack (it exists to hold a label above a
// control), so without this the year would sit against the left edge of a
// stage that is centring something the width of the page. It is also where the
// year's 960 measure is declared, once: the calendar is `fluid`, so it fills
// whatever this is.
const fieldStyle = css({
  width: "token(sizes.calchemyPlayground)",
  maxWidth: "token(spacing.full)",
});

// The band the bar floats in: the 32 below it, its own 40, and 32 clear of its
// top edge, which is where the ramp runs out. Below the bar there is nothing
// left to fade against, so the band ends where the screen does. The blur itself
// is inline on the layers — `css()` rejects both `backdrop-filter` spellings
// and Panda's utility emits only the `-webkit-` one, which Chromium ignores.
const scrimStyle = css({
  // The fade itself, and the half that owes nothing to `backdrop-filter`: the
  // band dissolves into the page it is standing on. `bg.canvas` rather than the
  // edge scrims' `bg.calendarScrim` because the surface differs, not the
  // technique — those fade over the calendar's own field surface, and this
  // calendar has no panel to fade over (see `yearStyle`).
  backgroundImage:
    "linear-gradient(to top, token(colors.bg.canvas), transparent)",
  position: "fixed",
  insetInline: 0,
  bottom: 0,
  height: `calc(${BAR_INSET} + ${BAR_HEIGHT} + ${SCRIM_CLEARANCE})`,
  pointerEvents: "none",
  zIndex: 1,
  // The rail insets the PAGE, and a fixed element is measured against the
  // viewport rather than the padded body — so the band would run on underneath
  // it. `--page-inset-end` is what the body publishes for exactly this (see
  // globals.css), and it is 0 wherever no rail is docked.
  right: "var(--page-inset-end, 0px)",
  // A custom property flips instantly — only the body's own padding is
  // transitioned — so without this the band would jump the width of the rail
  // while the page slid. 200ms ease-out is what globals.css moves the page by,
  // and what the panel's own slide takes. (Reduced motion zeroes every
  // transition globally.)
  transition: "right 200ms ease-out",
});

// The site's two gutter controls, on the band an article opens with.
//
// FIXED, not in the stage's flow: the page is one full-height scroller and a
// band inside it would scroll away with the first row of months. It is the
// mirror of the query bar's band at the foot — an overlay the scrollport runs
// under, with the stage reserving its height at both ends so nothing ever
// comes to rest behind it.
//
// The strip runs the width of the page and the controls sit in a box the
// calendar's own width inside it, so the menu and the toggle land on the year's
// left and right edges. Two boxes rather than one because the inner `100%` has
// to be the space LEFT of the rail: a fixed box is measured against the
// viewport, so a width capped against `100%` would not know the rail was there.
const chromeStyle = css({
  position: "fixed",
  insetBlockStart: 0,
  insetInlineStart: 0,
  height: `calc(${CHROME_BAND} + ${SCRIM_CLEARANCE})`,
  // The band dissolves into the page rather than ending on a line — the foot's
  // gradient, upside down. `bg.canvas` for the same reason it uses it: this
  // calendar has no panel of its own to fade over.
  backgroundImage:
    "linear-gradient(to bottom, token(colors.bg.canvas), transparent)",
  // The scrollport runs underneath, so the strip must not eat the wheel. The
  // controls take their own presses back.
  pointerEvents: "none",
  zIndex: 1,
  // The band is the page's, so it is centred in what the page has: the shader
  // playground's chrome is `inset-inline: 0` inside a canvas the presets pane
  // has already inset, and this is that same box drawn against a viewport
  // instead — `--page-inset-end` is what the rail insets the page by, and it
  // is 0 wherever no rail is docked. The two playgrounds put their controls in
  // the same place at every width as a result.
  insetInlineEnd: "var(--page-inset-end, 0px)",
  // A custom property flips instantly while the page's own padding is
  // transitioned, so without this the band would jump while the page slid —
  // `scrimStyle` below carries that note in full.
  transition: "inset-inline-end 200ms ease-out",
});

// The shader playground's `canvasChromeStyle`, to the declaration: the site's
// showcase measure with the page's own 20px margin below it, the band's height,
// and the two ends of a two-column grid — the menu on the left, the theme
// toggle pushed to the right of the second column.
const chromeRowStyle = css({
  width: "min(token(spacing.full), token(sizes.articleShowcase))",
  maxWidth:
    "min(token(sizes.articleShowcase), calc(token(spacing.full) - 2 * token(spacing.xxl)))",
  marginInline: "auto",
  height: CHROME_BAND,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  // The menu's row alone on a phone, 8px down from the top of the screen — the
  // same standoff the shader's canvas keeps from its own edges.
  _bottomSheet: { paddingBlockStart: "md" },
  // The strip itself is inert so the scrollport under it still takes the wheel;
  // the controls take their own presses back.
  "& > *": { pointerEvents: "auto" },
});

/** The shader playground's `chromeEndStyle` — the band's trailing cluster. */
const chromeEndStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  justifySelf: "end",
});

/**
 * The site's own two controls, which this page has to carry itself: `Header`
 * draws them for the homepage alone, and an article hangs them off its intro
 * row. A playground has neither.
 */
function PlaygroundChrome() {
  return (
    <div className={chromeStyle}>
      <div className={chromeRowStyle}>
        <MenuButton />

        <div className={chromeEndStyle}>
          <ThemeToggleButton />
        </div>
      </div>
    </div>
  );
}

const scrimLayerStyle = css({
  position: "absolute",
  inset: 0,
});

// No panel. The calendar's `default` tone frames itself with a field surface
// and a hairline ring — right for the Date popover it was drawn for, wrong on
// a stage where the grid IS the page and has nothing to sit apart from. The
// ring goes with the fill: an outline around nothing reads as a stray box.
const yearStyle = css({
  // Both this and the list below hide their overflow by default, and each is
  // therefore a scroll container — which is what a `scroll-snap-align` resolves
  // against. With either of them clipping, the months would be snapping to a
  // box nobody scrolls instead of to the stage. Safe to open up here: the
  // cropping existed to hold a page turn and a rounded field surface inside,
  // and this calendar has neither.
  overflow: "visible",
  backgroundColor: "transparent",
  "&::after": { content: "none" },
});

const yearGridStyle = css({
  // See `yearStyle` — the snap points have to reach the stage.
  overflow: "visible",
  // No page turn. The calendar animates a view change as a horizontal push —
  // the arriving months slide in from the side and a copy of the leaving ones
  // is held over the list while they go. That is right for a range that moves a
  // page at a time under a chevron, and wrong for this one: the window here
  // shifts by a row whenever a load comes in, so a turn fires while you are
  // simply scrolling, and months come flying in from the left and right.
  "&[data-push] > *": { animation: "none" },
  "& > [data-outgoing]": { display: "none" },
  display: "grid",
  // The columns SHARE the 960 rather than hugging their intrinsic measure —
  // that share is what `fluid` has to spend — but never below the month's own
  // pitch: a column may not squeeze the grid its cells are drawn on. Under
  // that the stage scrolls instead, which is what the recipe says in flex
  // terms with `flexShrink: 0`.
  gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(${MONTH_MEASURE}, 1fr))`,
  // The month boundary, and the whole reason this is not simply `fluid` across
  // 960. `fluid` spends surplus width in the gutters BETWEEN the seven day
  // columns, so widening the grid without this widens the inside of a month by
  // exactly as much as the space beside it — twelve months dissolve into one
  // field of numbers with nothing marking where each ends. Taking the gap out
  // of the surplus first keeps the ratio decisive: ~14px between day columns,
  // 80 between months.
  columnGap: "5xl",
  alignItems: "start",
  justifyContent: "center",
});

// The bar itself: a row that owns the chrome, holding the glyph and the field.
//
// It was the input, once — the box carried the surface and the glyph was placed
// against its geometry from outside, which needed a z-index to sit above the
// very element it belonged to. That was working around the wrong constraint:
// `Field.Search` has to be a direct child of `<Calendar>` to be DRESSED by it,
// but the dressing is only a class this can set itself and a `queryParser`
// navigation that `jumpTo` replaced. Nothing needed the box in there, so the
// row is an ordinary row and the glyph an ordinary child of it.
const barStyle = css({
  position: "fixed",
  bottom: BAR_INSET,
  translate: "-50% 0",
  // Over the scrim it floats in, and over the year behind that.
  zIndex: 2,
  display: "flex",
  flexDirection: "column",
  width: BAR_WIDTH,
  borderRadius: "md",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "field.border.default",
  backgroundColor: "bg.surface",
  // The elevation every other floating surface here carries.
  boxShadow:
    "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
  // The glyph is `currentColor`, so the row owns its hue.
  color: "field.text.default",
  // Centred in what is LEFT of the page once a rail is docked — see
  // `scrimStyle`, including why this is transitioned.
  left: "calc(50% - var(--page-inset-end, 0px) / 2)",
  transition: "left 200ms ease-out",
});

// The upper row: what a phrase is allowed to MEAN on the left, and the way
// into the sidebar on the right.
const barControlRowStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexShrink: 0,
  height: BAR_ROW_HEIGHT,
  paddingInline: "lg",
});

// The lower row, and the separator between the two. A hairline like every other
// divider here, drawn on the row below it so the rule sits under the control
// row's own padding rather than inside it.
// The rail fills whatever box it is given (it is a toolbar, and a toolbar
// spans its row), so it is told to hug its three labels instead — the row's
// `space-between` is what puts it opposite the sidebar button, and that only
// reads as opposite if it ends where its options do.
const kindsStyle = css({
  // `flex`, not `width`: the rail is a `toolbar({ fit: "fill" })`, which is
  // `flex: 1 1 0` — it GROWS to its row, and no width can outrank that. Told to
  // take its content's size instead, the three segments size to their labels.
  flex: "0 0 auto",
  width: "fit-content",
  // ...and the segments have to be sized from their own content for that to
  // mean anything. They are `flex-basis: 0` — equal shares of the rail — which
  // is right when the rail fills a row and wrong when it hugs: the share
  // collapses onto the label and squeezes out the padding around it.
  //
  // Their own inset comes with that. Filling a row, a segment is a share with a
  // label centred in it and 4px of padding nobody sees; hugging, that 4px IS
  // the segment's width either side of the word, and reads as a chip pinched
  // around its label.
  "& [role='option']": { flexBasis: "auto", paddingInline: "md" },
});

// ---------------------------------------------------------------------------
// The named date dictionary.
//
// Calchemy ships NO named dates — its vocabulary starts empty, so "christmas"
// parses as nothing at all until something here says what it means. Every entry
// is a `NamedDatesVocabularyEntry`: a name, the day it falls on, and whatever
// else it answers to.
//
// An entry is a RULE, not a date, because the parser asks for one by YEAR: it
// resolves "christmas next year" by handing the entry 2027 and drawing whatever
// day comes back. There are two rules worth having, and `year` is which:
//
//   • null — the date falls every year, so the entry is a month and a day and
//     answers for whatever year it is asked about. Christmas, a birthday.
//   • a year — one day in history, which answers with ITSELF whatever year is
//     asked. Returning nothing for the other years is the purer reading, but it
//     would leave the bare name unparseable except during its own year, and
//     "the eclipse" has to still mean the eclipse next Tuesday.
// ---------------------------------------------------------------------------

// Identity that survives an edit. Derived from the fields it used to be built
// from — name, month, day — a rename would read as a different entry to React
// and to the row that opened the form on it.
let namedDateSerial = 0;
const nextNamedDateId = () => `named-date-${(namedDateSerial += 1)}`;

interface NamedDate {
  id: string;
  name: string;
  /** The year it is pinned to, or `null` when it falls every year. */
  year: number | null;
  month: number;
  day: number;
  /** The other words that mean this date. Trimmed, and never empty strings. */
  aliases: string[];
  isHoliday: boolean;
}

/**
 * The day an entry falls on, written so the two rules are told apart at a
 * glance: a repeating date is a month and a day, and a pinned one carries the
 * year that makes it a single day in history.
 */
function namedDateDay(entry: NamedDate): string {
  // Abbreviated, because this is a row's LABEL and the panel's label column is
  // 80px — which a written-out month and a day are not.
  const day = `${MONTH_NAMES[entry.month - 1].slice(0, 3)} ${entry.day}`;
  return entry.year === null ? day : `${day}, ${entry.year}`;
}

// A section's own header strip, in the panel's measurements — 40px on a 12px
// inset, the title at the leading edge and whatever the section's one control
// is at the other. `PropertiesPanel.SectionHeader` draws this already, but its
// button is spent on opening and closing the section: one of these sections has
// nothing to open (its settings are always on) and the other's button DEFINES
// an entry. Same strip, different jobs.
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

// The popover's header, in the colour picker's own measurements — a 40px strip
// on a 12px inset under a hairline, the title taking the slack and the chips
// clustered at its end. The shell it sits in is that picker's too.
const namedDateHeadStyle = css({
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  gap: "md",
  height: "token(spacing.4xl)",
  paddingInline: "lg",
  borderBottomWidth: "token(spacing.3xs)",
  borderBottomStyle: "solid",
  borderBottomColor: "border.divider",
  // One ink for the strip, so the close chip — an icon button painted in
  // `currentColor` — matches the title beside it.
  color: "text.body",
});

const namedDateTitleStyle = css({
  flex: 1,
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

// How wide the panel is — and why that is now a free choice.
//
// A `datePopover` covers its trigger (`min-width: anchor-size(width)`) while the
// calendar inside it hugs one month: `sizes.calendarPeriod`, the recipe's 208px
// pitch. So while the date field filled the panel, the panel's width WAS the
// calendar's, and any panel wider than a month stretched the calendar past the
// month it draws, leaving empty surface beside it. The field states its own
// measure now (`namedDateOnStyle`), which takes the calendar out of the
// argument: the panel is simply as wide as the form reads best at.
const namedDatePopoverStyle = css({
  width: "320px",
  // On a phone the shell is a sheet spanning the canvas, not a column beside a
  // rail; it has its own width there and this must not overrule it.
  _bottomSheet: { width: "auto" },
});

// The two yes/no questions about the date, pushed to opposite margins. Neither
// is wide enough to be worth a row of its own, and asking them side by side is
// what makes them read as a pair of flags on one date rather than two more
// fields to fill in.
const namedDateFlagsStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "md",
});

// `sizes.dateField` — the measure every date field in the app is drawn at (see
// the shift-scheduling form). The popover it opens is a month wide regardless
// and overhangs it, which is the covering popover's own bargain: the field is
// sized for the ten characters it holds, not for the calendar that fills it in.
const namedDateOnStyle = css({
  width: "token(sizes.dateField)",
  flexShrink: 0,
});

// Hugs its own two parts, so each label stays ON the switch it speaks for and
// the row's `space-between` opens the gap where it belongs — between the two
// questions, not inside either of them. The trailing one lands its track on the
// panel's right margin, in line with the Aliases add chip and the CTA under it.
const namedDateFlagStyle = css({
  width: "auto",
  flexShrink: 0,
});

// The name fills the row's field column and is CUT rather than wrapped: the
// dictionary is a list of one-line rows, and a long name must not be the one
// that stands two lines tall.
const namedDateNameStyle = css({
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const namedDateFormStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "lg",
  padding: "lg",
});

const namedDateActionsStyle = css({
  display: "flex",
  justifyContent: "flex-end",
});

// A section INSIDE the form, headed the way the rail's own sections are: a
// label with the button that adds to it at the far end. The rows it collects
// are the section's content, so they sit under that header at the form's own
// rhythm rather than being fields of their own with a label each.
const aliasSectionStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "md",
});

const aliasHeaderStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "md",
  // The label sits on the baseline the field labels above it sit on, and the
  // add chip is taller than the text — so the strip is the chip's height and
  // the label is centred in it, exactly as the dictionary header does it.
  minHeight: "token(sizes.propertyRowAction)",
  color: "text.body",
});

/** Calchemy's own value kinds — what a phrase is allowed to mean. */
const QUERY_KINDS = [
  { value: "single", label: "Single" },
  { value: "range", label: "Range" },
  { value: "multiple", label: "Multiple" },
] satisfies { value: ExpectedDateValue; label: string }[];

/**
 * The fields a named date is made of — a name, the day it falls on, whatever
 * else it answers to, and two yes/no questions about it. The same form defines
 * a new entry and edits an existing one: they ask the identical questions, and
 * an edit that offered a different set of them would be a second thing to keep
 * in step. `entry` is which, and seeds the fields.
 *
 * "Repeats every year" is what the picker's YEAR is for. On (the default, and
 * the common case for a dictionary: Christmas, Diwali, a birthday) the year is
 * thrown away and the entry keeps a month and a day, so it can answer for every
 * year the parser asks about. Off, the picked year is kept and the entry names
 * one day in history.
 */
function NamedDateForm({
  entry,
  onSubmit,
  onClose,
}: {
  /** The entry being edited, or `null` to define a new one. */
  entry: NamedDate | null;
  /** The fields as filled in. Identity is the caller's — see `nextNamedDateId`. */
  onSubmit: (fields: Omit<NamedDate, "id">) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(entry?.name ?? "");
  const [on, setOn] = useState<Temporal.PlainDate>(() =>
    entry
      ? Temporal.PlainDate.from({
          // A repeating entry has no year of its own to show, and the picker
          // still needs one: this year, which is the year it would resolve to
          // if the phrase asked today.
          year: entry.year ?? Temporal.Now.plainDateISO().year,
          month: entry.month,
          day: entry.day,
        })
      : Temporal.Now.plainDateISO(),
  );
  // One string per alias, appended to. Most named dates have none, so the list
  // starts empty and the section's add button is where a first one comes from —
  // nothing is drawn for aliases that do not exist.
  const [aliases, setAliases] = useState<string[]>(entry?.aliases ?? []);
  // How many rows this form OPENED with, so that none of them takes the caret
  // on mount: `autoFocus` belongs to a row the reader has just asked for, and
  // an edit starts at the name like a new entry does.
  const [openedWith] = useState(() => entry?.aliases.length ?? 0);
  // Most of a dictionary falls every year, so that is what a new entry assumes;
  // turning it off is how you say this one date happened once.
  const [repeatsYearly, setRepeatsYearly] = useState(
    entry ? entry.year === null : true,
  );
  const [isHoliday, setIsHoliday] = useState(entry?.isHoliday ?? false);

  return (
    <>
      <header className={namedDateHeadStyle}>
        <Typography tag="p" type="bodySmall" className={namedDateTitleStyle}>
          {entry ? "Edit Named Date" : "New Named Date"}
        </Typography>
        <Button variant="icon" aria-label="Close" onClick={onClose}>
          <CrossIcon />
        </Button>
      </header>
      <div className={namedDateFormStyle}>
        <TextInput
          size="sm"
          label="Date name"
          placeholder="Christmas"
          autoFocus
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Field size="sm" className={namedDateOnStyle}>
          <Field.Label>Falls on</Field.Label>
          {/* Kept in flow. This popover is `position: fixed`, so a calendar
              portalled to <body> would be positioned against a containing
              block the trigger's chain never passes through — CSS anchor
              positioning rejects that anchor outright and drops the calendar
              at the foot of the document. In place, the two share this panel
              as their containing block and the anchor resolves;
              `colorPickerPopover` deliberately does not clip, so nothing
              crops it. */}
          <DatePicker value={on} onValueChange={setOn} portal={false} />
        </Field>
        {/* Everything written in this panel is bodySmall, the switch labels
            included — so the fields are `md`, whose label IS bodySmall, and
            each track is asked for `md` explicitly rather than left to the
            field's coercion (which reads `md` as "full geometry" and hands back
            `lg`). `labelFirst` makes each one a settings row: the statement
            first, the state after it. */}
        <div className={namedDateFlagsStyle}>
          <Field size="md" labelFirst className={namedDateFlagStyle}>
            <Field.Label>Repeats every year</Field.Label>
            <Switch
              size="md"
              checked={repeatsYearly}
              onCheckedChange={setRepeatsYearly}
            />
          </Field>
          <Field size="md" labelFirst className={namedDateFlagStyle}>
            <Field.Label>Is holiday</Field.Label>
            <Switch
              size="md"
              checked={isHoliday}
              onCheckedChange={setIsHoliday}
            />
          </Field>
        </div>
        {/* A section, not a field: the rail's own sections are a label with the
            button that adds to them at the far end, and this is that same
            bargain one level in. The rows it collects are its content. */}
        <div className={aliasSectionStyle}>
          <div className={aliasHeaderStyle}>
            <Typography tag="p" type="bodySmall">
              Aliases
            </Typography>
            <Button
              variant="icon"
              aria-label="Add an alias"
              onClick={() => setAliases((current) => [...current, ""])}
            >
              <AddIcon />
            </Button>
          </div>
          {/* Appended to and never reordered, so the index IS a row's identity.
              The header names them collectively; each row carries its own
              number so it is still addressable on its own. */}
          {aliases.map((alias, index) => (
            <TextInput
              key={index}
              size="sm"
              aria-label={`Alias ${index + 1}`}
              placeholder="Xmas"
              value={alias}
              // The point of pressing add is to type one, so the row that has
              // just mounted takes the caret. `autoFocus` only fires on mount,
              // which is exactly the moment meant: the rows already standing
              // are untouched, and no effect has to chase the DOM for a node
              // that does not exist yet.
              autoFocus={index === aliases.length - 1 && index >= openedWith}
              onChange={(event) => {
                const next = event.currentTarget.value;
                setAliases((current) =>
                  current.map((held, at) => (at === index ? next : held)),
                );
              }}
            />
          ))}
        </div>
        <div className={namedDateActionsStyle}>
          <Button
            size="sm"
            disabled={name.trim().length === 0}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                // The picker always has a year; whether the entry keeps it is
                // the question the switch above asks.
                year: repeatsYearly ? null : on.year,
                month: on.month,
                day: on.day,
                // A row added and left blank is one the reader thought better
                // of, not an empty word to teach the parser.
                aliases: aliases.map((alias) => alias.trim()).filter(Boolean),
                isHoliday,
              })
            }
          >
            {entry ? "Save named date" : "Add named date"}
          </Button>
        </div>
      </div>
    </>
  );
}

// Whether the page can afford the rail without taking width off the year: the
// grid's own 960 measure (`sizes.calchemyPlayground`), the rail's 360
// (`sizes.propertiesPanelWidth`, which globals.css insets the page by) and the
// stage's 32px either side — 1384. Narrower than that and docking the rail
// would crop the row of months it exists to annotate, so the year comes first
// and the rail is opened when it is wanted.
const RAIL_ROOM_QUERY = "(min-width: 1384px)";

function useRoomForRail(): boolean {
  const [roomy, setRoomy] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.(RAIL_ROOM_QUERY);
    if (!query) return;
    // Synced to the VIEWPORT, which is not a render-derived value — the same
    // deliberate one-commit-later correction `useHasCursor` makes, for the same
    // reason: the server has no viewport to ask, so the first client render has
    // to match the HTML it is hydrating.
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
  // The preferences the sidebar sets — see `DATE_ORDERS` and friends. Seeded
  // from the machine, because a playground whose zone is not the reader's makes
  // every "today" in it subtly wrong.
  const [dateOrder, setDateOrder] = useState<DateOrder>("MDY");
  const [timeZone, setTimeZone] = useState(localZone);
  const [weekStartsOn, setWeekStartsOn] = useState<WeekdayIndex>(0);
  const [locale, setLocale] = useState("en-US");
  const [namedDates, setNamedDates] = useState<NamedDate[]>([]);
  // What the popover is standing for: `null` while it is closed, an `entry` of
  // null for a new one, otherwise the entry being edited. One popover doing
  // both jobs, because they are the same questions.
  const [draft, setDraft] = useState<{ entry: NamedDate | null } | null>(null);
  const definePin = usePickerPin();
  // The button it was opened FROM — the header's add chip, or one row's pencil.
  // Both the thing the popover is pinned level with and where focus goes back.
  const namedDateTrigger = useRef<HTMLElement | null>(null);

  // The vocabulary the engine is built with. A named date is a RULE (what day
  // does this name fall on in year N), not a date, so it is handed over as a
  // resolver rather than a value.
  const namedDatesVocabulary = useMemo(
    () =>
      namedDates.map((entry) => ({
        value: entry.name,
        aliases: entry.aliases,
        isHoliday: entry.isHoliday,
        // One expression, both rules: a repeating entry has no year of its
        // own and takes the one it is asked about, a pinned one overrules the
        // question with its own.
        resolveDate: ({ year }: { year: number }) =>
          Temporal.PlainDate.from({
            year: entry.year ?? year,
            month: entry.month,
            day: entry.day,
          }),
      })),
    [namedDates],
  );
  const zones = useMemo(() => timeZones(), []);

  // What every parse is made against. The engine holds these as its defaults
  // too, but a per-call context is what lets them CHANGE without rebuilding it.
  const parseContext = useMemo<ParseDateContext>(
    () => ({
      locale,
      timeZone,
      weekStartsOn,
      // RANKED, not restricted. The parser takes an ordered list, and the
      // difference matters: `["MDY"]` alone settles `03/04/25` outright — one
      // reading, no ambiguity, and the readings row can never appear again —
      // while the full list ordered by preference keeps all three and puts the
      // preferred one first, which is where the highlight starts. So the
      // setting says which reading is MEANT, and leaves the others reachable.
      dateOrderPreference: [
        dateOrder,
        ...DATE_ORDERS.map((order) => order.value).filter(
          (order) => order !== dateOrder,
        ),
      ],
    }),
    [locale, timeZone, weekStartsOn, dateOrder],
  );
  // The rail's default is the viewport's answer, and a press is the reader's —
  // theirs stands from then on, including through a resize. Which is the whole
  // difference between a default and a binding: widening the window before
  // anyone has touched the rail opens it, widening it after they closed it
  // does not reopen it behind their back.
  const roomForRail = useRoomForRail();
  const [railChoice, setRailChoice] = useState<boolean | null>(null);
  const sidebarOpen = railChoice ?? roomForRail;
  // Closed THROUGH the handle rather than by dropping it from the tree, which
  // would take the closing slide with it; `onDismiss` is what unmounts it.
  const sidebar = useRef<PropertiesPanelHandle>(null);
  const barRef = useRef<HTMLDivElement>(null);
  // What the bar currently measures, published to the scrim below. Measured
  // rather than counted: the readings section is as tall as its readings.
  const [barHeight, setBarHeight] = useState<number | null>(null);
  // Non-null only while a hand-made selection is standing (see the header).
  const [picked, setPicked] = useState<Temporal.PlainDate[] | null>(null);
  const stageRef = useRef<HTMLElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  // Row heights are uniform (every month draws six week rows), so one
  // measurement places all 800 of them. Held rather than assumed: it is derived
  // from the recipe's cell and gutter tokens, and this way it stays right if
  // any of them move.
  const [rowHeight, setRowHeight] = useState<number | null>(null);
  // Which rows are actually built. Derived from the scroll on every move, so
  // nothing is ever loaded — the rows simply exist where they always were.
  const [window_, setWindow] = useState({
    start: OPENING_ROW,
    rows: INITIAL_ROWS,
  });
  const opened = useRef(false);
  // A scroll offset waiting for the rows it lands on to exist — see `jumpTo`.
  const pendingScroll = useRef<{ top: number; smooth: boolean } | null>(null);
  const quarter = useMemo(() => currentQuarterStart(), []);

  const closeNamedDate = (restoreFocus = true) => {
    setDraft(null);
    definePin.unpin();
    if (restoreFocus) namedDateTrigger.current?.focus();
  };

  // Pressing the button that already has the popover open closes it; pressing a
  // DIFFERENT one moves the popover onto that entry rather than closing and
  // reopening — which is why every one of these buttons is exempt from the
  // outside-press dismiss (see `ignoreSelector`).
  const openNamedDate = (entry: NamedDate | null, button: HTMLElement) => {
    if (draft && (draft.entry?.id ?? null) === (entry?.id ?? null)) {
      closeNamedDate();
      return;
    }
    namedDateTrigger.current = button;
    definePin.pin(button);
    setDraft({ entry });
  };

  useEffect(() => {
    let cancelled = false;
    // Async because the engine loads a Temporal polyfill unless the browser
    // ships Temporal natively.
    // Rebuilt whenever the dictionary changes: the vocabulary is given at
    // CREATION, so a new named date means a new engine. Cheap after the first
    // one — the Temporal polyfill it loads is already in memory — and the old
    // engine stays in place until the new one resolves, so nothing blinks.
    createCalchemy({ namedDatesVocabulary }).then((engine) => {
      if (!cancelled) setCalchemy(engine);
    });

    return () => {
      cancelled = true;
    };
  }, [namedDatesVocabulary]);

  // The phrase and everything that follows from it, held by the same hook the
  // article's demo uses — the rules between the highlight, the commitment and
  // the phrase are the parser's, not this page's.
  const phrase = useCalchemyQuery(calchemy, parseContext, kind);
  const { dates, query } = phrase;

  // The bar's height, kept current. It changes whenever a phrase turns out to
  // be ambiguous (or stops being), and the scrim's band is built from it.
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;

    const measure = () => setBarHeight(bar.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);

    return () => observer.disconnect();
  }, [calchemy]);

  // One measurement, before the first paint, and every row in the run is
  // placed. Until it lands the window is `INITIAL_ROWS` sitting at the top of
  // the box, which is exactly what is needed to measure.
  useLayoutEffect(() => {
    if (!calchemy || rowHeight !== null) return;

    const month = stageRef.current?.querySelector<HTMLElement>(
      "[data-playground-month]",
    );
    // A zero is not a measurement — it is a context with no layout at all
    // (jsdom, a print pass, a tab that never painted). Taking it would divide
    // the whole run by zero; leaving it null keeps the plain opening window,
    // which is exactly what those contexts should see.
    const height = month?.getBoundingClientRect().height ?? 0;
    if (height > 0) setRowHeight(height);
  }, [calchemy, rowHeight]);

  // Going somewhere far off is two steps, and it has to be: a scroll into rows
  // that have not been built has no snap point to come to rest on, and the
  // browser drags it back to the nearest one that has. So the destination is
  // BUILT first, and the scroll happens once it is on the page.
  const jumpTo = useCallback(
    (row: number, smooth: boolean) => {
      const stage = stageRef.current;
      if (!stage || !rowHeight) return;

      const rows =
        Math.ceil(stage.clientHeight / rowHeight) + OVERSCAN_ROWS * 2;
      const start = Math.min(
        Math.max(0, row - OVERSCAN_ROWS),
        TOTAL_ROWS - rows,
      );
      pendingScroll.current = { top: row * rowHeight, smooth };
      setWindow({ start, rows });
    },
    [rowHeight],
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

  // Arrive on the opening row rather than at the top of a century.
  useLayoutEffect(() => {
    if (!rowHeight || opened.current) return;

    opened.current = true;
    jumpTo(OPENING_ROW, false);
    // Again on the next frame, because a browser restores an inner scroller's
    // position AFTER layout — so without this you arrive wherever the page was
    // left last time, which for a century-long run is anywhere at all.
    const frame = requestAnimationFrame(() => jumpTo(OPENING_ROW, false));
    return () => cancelAnimationFrame(frame);
  }, [rowHeight, jumpTo]);

  // Which rows to build, read straight off the scroll. No loading, no
  // shifting: the row that was at 1,200px is still at 1,200px, whether or not
  // it happens to be built at the moment.
  const trackScroll = () => {
    const stage = stageRef.current;
    if (!stage || !rowHeight) return;

    const rows = Math.ceil(stage.clientHeight / rowHeight) + OVERSCAN_ROWS * 2;
    const start = Math.min(
      Math.max(0, Math.floor(stage.scrollTop / rowHeight) - OVERSCAN_ROWS),
      TOTAL_ROWS - rows,
    );

    setWindow((current) =>
      current.start === start && current.rows === rows
        ? current
        : { start, rows },
    );
  };

  // A phrase can be answered off screen, so bring its row to the top — unless
  // it is already readable, in which case moving would be rude. Worked out
  // ARITHMETICALLY rather than by looking for the month: at a century's range
  // the answer's row is very often not built yet, and this is the same sum that
  // decides where it would be built.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !rowHeight || dates.length === 0) return;

    const top = rowForDate(dates[0], quarter) * rowHeight;
    // The scrim's band is an overlay, so a row resting under it is on screen
    // and unreadable. Measured rather than repeated as a number.
    const obscured = scrimRef.current?.offsetHeight ?? 0;
    const readable =
      top >= stage.scrollTop &&
      top + rowHeight <= stage.scrollTop + stage.clientHeight - obscured;
    if (readable) return;

    // Smooth only when it is a short move; sliding a century is not a journey
    // anyone wants to watch.
    const row = rowForDate(dates[0], quarter);
    jumpTo(row, Math.abs(top - stage.scrollTop) < stage.clientHeight * 3);
  }, [dates, rowHeight, quarter, jumpTo]);

  // Nothing date-shaped is rendered until the engine lands, which also keeps
  // "today" off the server: it is read from the client's clock, and a server
  // in another time zone would hand React markup to hydrate against that
  // disagrees about which cell is today.
  // The chrome is the page's, not the engine's: it stands from the first paint
  // so the two controls do not pop in behind the calendar.
  if (!calchemy)
    return (
      <main className={stageStyle} aria-busy="true">
        <PlaygroundChrome />
      </main>
    );

  const values = picked ?? dates;

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
      {/* The band the query bar floats in, frosted so the bar is not sitting
          crisply on a dense field of numbers — see `SCRIM_RAMPS`. */}
      <div ref={scrimRef} className={scrimStyle} aria-hidden>
        {SCRIM_RAMPS.map((ramp) => (
          <div
            key={ramp}
            className={scrimLayerStyle}
            style={{
              backdropFilter: SCRIM_BLUR,
              WebkitBackdropFilter: SCRIM_BLUR,
              maskImage: ramp,
              WebkitMaskImage: ramp,
            }}
          />
        ))}
      </div>
      {/* The bar the year is talked to through. */}
      <div ref={barRef} className={barStyle}>
        <div className={barControlRowStyle}>
          <SegmentedControl
            className={kindsStyle}
            options={QUERY_KINDS}
            value={kind}
            onValueChange={(next) => {
              setKind(next as ExpectedDateValue);
              // A new kind can change what the readings even are, so neither
              // the highlight nor the commitment carries over. Said by
              // re-typing the phrase into the hook, which is the one place
              // that rule lives.
              phrase.setQuery(query);
            }}
            ariaLabel="What a phrase may mean"
          />
          <Button
            variant="icon"
            {...PROPERTIES_TRIGGER_ATTR}
            // One label in both states, with the state itself on
            // `aria-pressed` — which is also what paints the chip while the
            // rail is up. A toggle that renames itself says the same thing
            // twice and disagrees with its own appearance.
            aria-label="Parser Settings"
            aria-pressed={sidebarOpen}
            onClick={() =>
              sidebarOpen ? sidebar.current?.dismiss() : setRailChoice(true)
            }
          >
            <SliderIcon />
          </Button>
        </div>
        <CalchemyReadings query={phrase} />
        {/* Same slot as the readings, and never at the same time — see the
            component. Taking the offer retypes the phrase, so it drops the
            hand-made selection exactly as typing does. */}
        <CalchemySuggestion query={phrase} onQueryChange={() => setPicked(null)} />
        <CalchemyQueryField
          query={phrase}
          placeholder='Try "mondays and fridays next month"'
          // Back to the phrase's answer — see the header.
          onQueryChange={() => setPicked(null)}
        />
      </div>
      <div
        className={runStyle}
        style={
          rowHeight === null ? undefined : { height: TOTAL_ROWS * rowHeight }
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
              // Fills the 960 instead of hugging its months — the slack goes into
              // the gutters between the day columns, never into the cells.
              fluid
              selectionMode="multiple"
              values={values}
              onValuesChange={setPicked}
              months={window_.rows * GRID_COLUMNS}
              // Controlled, and deliberately WITHOUT an `onViewChange`: which months
              // exist is decided by the scroll and nothing else. Left to itself the
              // calendar would move the range when a typed date fell outside it,
              // which is the same navigation done twice and in disagreement.
              view={monthForRow(window_.start, quarter)}
              // One row, matching the snap — this is what PageUp/PageDown move by
              // now that there are no chevrons to press.
              step={GRID_COLUMNS}
              weekStartsOn={WEEK_START_KEYS[weekStartsOn]}
            >
              <Calendar.PeriodList className={yearGridStyle}>
                <Calendar.Period
                  className={periodStyle}
                  data-playground-month=""
                >
                  <Calendar.Month monthFormat="narrow" />
                  <Calendar.Week>
                    <Calendar.Day />
                  </Calendar.Week>
                  <Calendar.Grid>
                    <Calendar.Date />
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
          // These are the settings the page is READ through, and the page is
          // the whole screen behind them — so an ambient press is someone
          // using the playground, not someone dismissing the rail. It closes
          // from its own chip, its header, or Escape.
          dismissOnOutsidePointer={false}
          onDismiss={() => setRailChoice(false)}
          // The definition popover is portalled, so by every measure the
          // dismiss can take it is outside this panel — and a press in it would
          // close the panel it was opened from.
          ignoreSelector="[data-named-date-form]"
        >
          <PropertiesPanel.Header>Parser Settings</PropertiesPanel.Header>
          {/* One always-on section: these are not features to add, they are the
              settings every parse is already made against — so the header is
              composed here, without the add/remove button the panel's own
              SectionHeader spends itself on. */}
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
                {/* `portal={false}`: the panel is `position: fixed`, and a
                    portalled popover cannot anchor to something whose
                    containing-block chain does not pass through it. */}
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

          {/* The named dates, which are entirely the reader's to define:
              Calchemy ships NONE. Its vocabulary starts empty, so "christmas"
              parses as nothing at all until something here says what it means —
              which makes this section the only door to that half of the parser
              rather than a convenience over it.

              An addable section rather than an always-on one, because unlike
              the preferences above it holds a list that starts empty, and the
              header's add button is what a first entry comes from. */}
          <PropertiesPanel.Section enabled>
            {/* The panel's own SectionHeader spends its button on opening and
                closing the section. This one defines an ENTRY, so the header is
                composed here — same strip, same measurements, different job. */}
            <div className={railSectionHeaderStyle}>
              <Typography tag="p" type="bodySmall">
                Named Dates Dictionary
              </Typography>
              <Button
                variant="icon"
                data-named-date-trigger
                aria-label="Add a named date"
                // Only while the popover is standing for a NEW entry: an open
                // edit is a different button's business.
                aria-expanded={draft?.entry === null}
                onClick={(event) => openNamedDate(null, event.currentTarget)}
              >
                <AddIcon />
              </Button>
            </div>
            {/* Nothing at all until there is something to list. An empty
                dictionary is the ordinary state — Calchemy ships no named
                dates — and a line of prose announcing it every time says less
                than the add button beside the heading already does. */}
            {namedDates.length > 0 && (
              <PropertiesPanel.ControlPanel ariaLabel="Named dates">
                {/* The DAY labels the row and the name is its value: the
                    dictionary is read to find out WHEN something falls, and a
                    column of dates is what makes it scannable. The pencil is
                    the row's third child, which is the action column the panel
                    grid has held open for exactly this. */}
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
                      data-named-date-trigger
                      aria-label={`Edit ${entry.name}`}
                      aria-expanded={draft?.entry?.id === entry.id}
                      onClick={(event) =>
                        openNamedDate(entry, event.currentTarget)
                      }
                    >
                      <EditIcon />
                    </Button>
                  </PropertiesPanel.Control>
                ))}
              </PropertiesPanel.ControlPanel>
            )}
          </PropertiesPanel.Section>
        </PropertiesPanel>
      )}
      {draft && (
        <Popover
          // The colour picker's shell, which is exactly this arrangement
          // already solved: docked 2px off the rail's leading edge at the
          // rail's own width, and pinned level with the button that opened it
          // rather than tracking it, so the rail can scroll underneath.
          className={cx(colorPickerPopover(), namedDatePopoverStyle)}
          role="dialog"
          ariaLabel={draft.entry ? "Edit Named Date" : "New Named Date"}
          // Out to the body: the rail is its own scroll container, and left in
          // flow this would be cropped at the one edge it has to cross.
          portal
          // Every trigger toggles, so a press on one must not also count as a
          // press outside — and a press on ANOTHER one has to reach its own
          // click with the popover still open, or moving between entries would
          // close and reopen instead of switching.
          ignoreSelector="[data-named-date-trigger]"
          onDismiss={() => closeNamedDate(false)}
          containerRef={definePin.ref}
          style={{ top: definePin.top }}
        >
          <div data-named-date-form>
            <NamedDateForm
              // A new subject is a new FORM: the fields are seeded from the
              // entry once, as it mounts, so switching entries under an open
              // popover has to remount it.
              key={draft.entry?.id ?? "new"}
              entry={draft.entry}
              onClose={() => closeNamedDate()}
              onSubmit={(fields) => {
                const edited = draft.entry;
                setNamedDates((current) =>
                  edited
                    ? current.map((held) =>
                        held.id === edited.id
                          ? { ...fields, id: held.id }
                          : held,
                      )
                    : [...current, { ...fields, id: nextNamedDateId() }],
                );
                closeNamedDate();
              }}
            />
          </div>
        </Popover>
      )}
    </main>
  );
}
