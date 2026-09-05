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
import { ThemeToggleButton } from "@/components/theme-toggle";

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

/**
 * The most columns the year's own measure has room for, and therefore what is
 * drawn on the very first paint — before there is a laid-out grid to ask. How
 * many actually fit is `auto-fit`'s decision and is read back off it (see
 * `yearGridStyle` and `columnsOf`), so this is a starting guess and never an
 * answer: on anything narrower it is corrected before the frame is shown.
 */
const WIDEST_GRID = 3;

// There are no chevrons, so SCROLLING is the only way through the months, and
// it does not run out: the scroll is a CENTURY either side of today, and only
// the rows near the viewport are ever built. The arithmetic of which month
// lands on which row is `monthGrid`'s (src/utils/calchemy-grid.ts), because it
// changes with the column count and is worth being able to test without a
// viewport.
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
/** What is built before the row height is known — see `useLayoutEffect`. */
const INITIAL_ROWS = 8;

/** How long a scroll has to stand still to count as where the reader IS, in ms
 *  — long enough to outlast the scroll a re-snap fires within the frame. */
const SETTLE = 150;

/**
 * How many columns the grid actually laid out, read off the resolved template.
 *
 * `auto-fit` is what decides — it drops a column the moment the row can no
 * longer hold one at the month's own pitch — and that pitch is a set of tokens
 * this file has no business restating as a breakpoint. So the width question is
 * left entirely to CSS and only its ANSWER is read back here, which is the one
 * thing the row arithmetic cannot get from the stylesheet.
 *
 * A resolved template is a list of used track sizes in px. Anything else — a
 * box with no layout, a context that never painted — is not a measurement, and
 * gives 0 for the caller to ignore.
 */
function columnsOf(grid: HTMLElement): number {
  return getComputedStyle(grid)
    .gridTemplateColumns.split(" ")
    .filter((track) => track.endsWith("px")).length;
}

/**
 * How many rows read CLEAR of the page's chrome — the viewport less the two
 * overlay bands the scrollport runs under. Both are already reserved as the
 * stage's own padding, so they are measured rather than restated: the head one
 * IS that padding, and the foot one is the scrim standing over the query bar.
 */
function readableRows(
  stage: HTMLElement,
  scrim: HTMLElement | null,
  rowHeight: number,
): number {
  const head = parseFloat(getComputedStyle(stage).paddingTop) || 0;
  const foot = scrim?.offsetHeight ?? 0;
  return Math.floor((stage.clientHeight - head - foot) / rowHeight);
}

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

/**
 * The near half of the ramp, then the tail — see the note above. Built from the
 * edge the band stands on, because both bands want the same pair pointed
 * opposite ways: the foot's fades up off the query bar, the head's down off the
 * two gutter controls.
 */
const scrimRamps = (towards: "top" | "bottom") => [
  `linear-gradient(to ${towards}, #000, transparent 55%)`,
  `linear-gradient(to ${towards}, #000, transparent)`,
];

const SCRIM_RAMPS = scrimRamps("top");
const CHROME_RAMPS = scrimRamps("bottom");

/** A month's own measure: 7 day columns, their 6 gutters, and the period's
 *  padding — the 208px pitch the `calendar` recipe is built on. */
const MONTH_MEASURE =
  "calc(7 * token(sizes.calendarDay) + 6 * token(spacing.sm) + 2 * token(spacing.md))";

/**
 * How wide a month is ever allowed to spread: its share of the full measure at
 * the widest grid, gutters taken out first.
 *
 * `fluid` spends surplus width BETWEEN the seven day columns, and at three
 * across that surplus is what opens them to a readable ~14px. Two months given
 * a three-month surplus would open theirs to nearly 30, and one month left
 * alone with it to fifty — a single month dissolved across half a screen. So a
 * month takes its share and no more, and the grid centres what it has: the same
 * month at every width, with the air outside it rather than through it.
 */
const MONTH_STRETCH = `calc((token(sizes.calchemyPlayground) - ${WIDEST_GRID - 1} * token(spacing.5xl)) / ${WIDEST_GRID})`;

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
  // The grid drops a column rather than squeezing one, and a single month
  // holds its 208px pitch rather than shrinking: below THAT the stage scrolls
  // sideways instead of the grid cropping (the list hides its overflow).
  overflowX: "auto",
});

// The scroll's whole extent, at its true height, so the geometry above the
// viewport never changes as you move through it. Nothing lives in here but the
// window below, parked at its row's offset.
const runStyle = css({
  position: "relative",
  // `token(spacing.full)` and not the bare `full`, which is a SPACING token:
  // width resolves against `sizes`, which has no such entry, so the bare
  // spelling emits `width: full` and the box collapses to nothing. It read as
  // centred anyway while the grid held a fixed three columns — a 960 measure
  // shrink-wrapped around a zero-width line lands in the same place — and
  // stopped reading as anything the moment the columns became the width's
  // answer. Same fix on the field's cap below.
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
  // A month takes its share of the measure and no more — see `MONTH_STRETCH`.
  // Capped HERE rather than on the grid, because the grid's own box is what
  // `auto-fit` counts columns against: cap that and a narrow width would pin
  // the count to one and then never see the room to grow back.
  maxWidth: MONTH_STRETCH,
  // `stretch` is a grid item's default, so a cap alone would leave the month
  // against the head of its track. Centred, the slack reads as the gutter it
  // is.
  marginInline: "auto",
  // The cap is a maximum, not a width: with room to spare the month still
  // fills its track, which is what `fluid` is being handed.
  width: "token(spacing.full)",
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
  // See `runStyle` — `full` alone is a spacing token, and `max-width` reads
  // `sizes`.
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
  // gradient, upside down, with `ScrimBlur` laying the foot's frosting over it
  // the same way. `bg.canvas` for the same reason the foot uses it: this
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
  // ABOVE the band's frosting, and this is painting order rather than taste.
  // The blur layers are `position: absolute` and this row is not, and a
  // stacking context paints its positioned descendants AFTER its in-flow ones
  // however they are written — so the frosting landed on top of the two
  // controls and took them into its own backdrop. The menu's ⌘K chip came out
  // smeared with the calendar showing through it.
  //
  // The foot has never had the problem because its bar is a SIBLING of the
  // scrim rather than a child, sitting a z-index above it. This is that same
  // arrangement said from inside: the band frosts the calendar behind it, and
  // the navigation stands clear of it.
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

const scrimLayerStyle = css({
  position: "absolute",
  inset: 0,
});

/**
 * The frosting half of a band, pointed at whichever edge asks for it: the pair
 * of 1.4px blurs masked over different distances that the note above
 * `SCRIM_BLUR` describes. The band itself carries the wash, which is the half
 * that does the work — this is the garnish, and both ends of the page wear the
 * same one.
 */
function ScrimBlur({ ramps }: { ramps: string[] }) {
  return (
    <>
      {ramps.map((ramp) => (
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
    </>
  );
}

/**
 * The site's own two controls, which this page has to carry itself: `Header`
 * draws them for the homepage alone, and an article hangs them off its intro
 * row. A playground has neither.
 */
function PlaygroundChrome() {
  return (
    <div className={chromeStyle}>
      {/* Behind the controls, and inert with the strip: `chromeRowStyle` takes
          its own children's presses back, and these are not among them. */}
      <ScrimBlur ramps={CHROME_RAMPS} />
      <div className={chromeRowStyle}>
        <MenuButton />

        <div className={chromeEndStyle}>
          <ThemeToggleButton />
        </div>
      </div>
    </div>
  );
}

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
  //
  // AUTO-FIT, so how many months a row holds is decided by whether one more
  // still clears that pitch — three at the full measure, two beside a docked
  // rail, one on a phone. The count is CSS's answer to a question of tokens,
  // and the row arithmetic reads it back off this rather than restating those
  // tokens as a breakpoint in JS (see `columnsOf`).
  gridTemplateColumns: `repeat(auto-fit, minmax(${MONTH_MEASURE}, 1fr))`,
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
  "--colors-field-bg-default": "var(--colors-field-bg-default-on-surface)",
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
// is a `NamedDatesVocabularyEntry`: a name, the days it stands for, and
// whatever else it answers to.
//
// The days are never asked for. They are whatever the grid has lit when the
// form is opened, which is the whole reason the form lives in the query panel
// rather than in a popover on the rail: a name is given TO a selection. So an
// entry holds a SET of days and hands the parser `resolveDates`.
//
// An entry is a RULE, not a date, because the parser asks for one by YEAR: it
// resolves "christmas next year" by handing the entry 2027 and drawing whatever
// comes back. There are two rules worth having, and `repeatsYearly` is which:
//
//   • repeating — the set slides WHOLE, by the difference between the year
//     asked about and the year its first day falls in. A single day is then a
//     month and a day like any other Christmas, and a set that straddles a new
//     year — a season, a fixture list — keeps its shape instead of collapsing
//     into whichever of the two years it started in.
//   • pinned — days in history, which answer with THEMSELVES whatever year is
//     asked. Returning nothing for the other years is the purer reading, but it
//     would leave the bare name unparseable except during its own year, and
//     "the eclipse" has to still mean the eclipse next Tuesday.
//
// Sliding only means anything while the set fits inside a year: stretch it past
// twelve months and the second lap lands on the first, so whether an entry MAY
// repeat is a fact about what is lit rather than a preference — see
// `fitsWithinAYear`, and the switch that withdraws itself.
// ---------------------------------------------------------------------------

// Identity that survives an edit. Derived from the fields it used to be built
// from — a name, a day — a rename would read as a different entry to React and
// to the row that opened the form on it.
let namedDateSerial = 0;
const nextNamedDateId = () => `named-date-${(namedDateSerial += 1)}`;

interface NamedDate {
  id: string;
  name: string;
  /** The days it stands for, in order, and never empty. */
  dates: Temporal.PlainDate[];
  /** Whether the set slides to whatever year the parser asks about. */
  repeatsYearly: boolean;
  /** The other words that mean this date. Trimmed, and never empty strings. */
  aliases: string[];
  isHoliday: boolean;
}

/**
 * Whether a set may repeat — whether a year is a long enough stride to clear
 * it. A run from July to the following June repeats; one that reaches the same
 * date a year on does not, because that day would be on both laps at once.
 * Takes the days in order.
 */
function fitsWithinAYear(dates: readonly Temporal.PlainDate[]): boolean {
  if (dates.length === 0) return false;
  return (
    Temporal.PlainDate.compare(
      dates[0].add({ years: 1 }),
      dates[dates.length - 1],
    ) > 0
  );
}

/**
 * The days an entry falls on, written so the two rules are told apart at a
 * glance: a repeating date is a month and a day, and a pinned one carries the
 * year that makes it days in history. A set says how many MORE days it holds
 * rather than listing them — the row is 80px of label, and the entry is one
 * press away from being read in full.
 */
function namedDateDay(entry: NamedDate): string {
  // Abbreviated, because this is a row's LABEL and the panel's label column is
  // 80px — which a written-out month and a day are not.
  const [first, ...rest] = entry.dates;
  const day = `${MONTH_NAMES[first.month - 1].slice(0, 3)} ${first.day}`;
  const dated = entry.repeatsYearly ? day : `${day}, ${first.year}`;
  return rest.length === 0 ? dated : `${dated} +${rest.length}`;
}

// A section's own header strip, in the panel's measurements — 40px on a 12px
// inset, with the section's title at the leading edge and nothing at the other.
// `PropertiesPanel.SectionHeader` draws this already, but its button is spent
// on opening and closing the section, and neither of these two has anything to
// open: the preferences are always on, and the dictionary is filled from the
// query panel rather than from here. Same strip, no button.
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

// ---------------------------------------------------------------------------
// The definition form, which is the query panel wearing the rail's own row:
// label ∣ control ∣ action, with the action column held open on every row so
// the controls end on one line whether or not a row has a chip in it. That is
// what makes the morph read as one instrument rather than two — a definition is
// a set of labelled settings, exactly like the settings behind the slider.
// ---------------------------------------------------------------------------

const definitionStyle = css({
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  // The rule between the form and the kinds control above it, drawn on the form
  // so it sits under that row's own padding rather than inside it — the same
  // hairline, and the same bargain, as the query row makes.
  borderTopWidth: "token(spacing.3xs)",
  borderTopStyle: "solid",
  borderTopColor: "field.border.default",
});

// The fields — 32px rows on a 4px rhythm, which is a command list's and NOT the
// 40px the panel's two chrome rows are drawn at: a row here is a field in a
// form, not a strip of controls over the year.
const definitionRowsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "sm",
  paddingBlock: "sm",
  color: "text.body",
});

const definitionRowStyle = css({
  // `flexDirection` explicitly, not just `display`: a `Field` is a COLUMN (or,
  // with a switch in it, a grid) and only its direction is being overruled
  // here — leave it out and the label goes on standing above its control while
  // everything else about the row looks right.
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  // The gap either side of the field — off its label, and off the chip in the
  // slot after it (Figma 1187:9698). The label never comes that close: it takes
  // the row's slack, so what shows is whatever is left inside its own box.
  columnGap: "sm",
  // A `Field` holding a switch HUGS its two parts — that is what lets one stand
  // on its own in a form — and hugging is the wrong half of that bargain here:
  // these are settings rows, and the slack is what carries the track out to the
  // margin the boxes above it end on.
  width: "token(spacing.full)",
  paddingInline: "lg",
  minHeight: "token(spacing.3xl)",
  "& > label": {
    flex: "1 1 auto",
    // The recipe gives a label `width: 100%`, which as a flex BASIS is the
    // whole row — the field is then squeezed out of its measure to make room
    // for a label claiming everything. Sized by its content instead, and grown
    // into the slack by the `flex` above, which is the same result the recipe
    // was after in a column.
    width: "auto",
    minWidth: 0,
  },
  "& > div": {
    // 208 — the measure the option list and one month column are already drawn
    // at, so a box in this panel is as wide as the popover it would open
    // (Figma 1187:9698). NOT the rail's `propertyRowField`: that 212 is derived
    // from a 360px panel, and this one is 480 wide with its own drawing.
    width: "token(sizes.optionListWidth)",
    // Allowed to give way, unlike the rail's own field: the bar narrows with
    // the viewport (`BAR_WIDTH`) and this measure is more than a phone has to
    // spend. Shrinking in proportion to a basis takes it out of the 208 first,
    // which is the column that can afford it — a squeezed box still reads, and
    // a squeezed label wraps the row to two lines.
    minWidth: 0,
    // What puts an unlabelled row's field in the field's column — the alias
    // rows after the first, which have nothing in the label column to push it.
    marginInlineStart: "auto",
  },
  // A switch needs no rule of its own: it is narrower than the field column,
  // and the label beside it having taken the slack leaves it on the same margin
  // the boxes end on.
});

// The column at the end of every row — where a chip lands on the row that has
// one, and what holds the rows that do not clear of the panel's edge by exactly
// as much. A real element rather than a trailing padding the chip rows would
// have to take back: two classes setting the same padding are two atomic
// utilities in one layer, and `cx` is a string joiner with no opinion about
// which of them wins.
const definitionActionSlotStyle = css({
  flexShrink: 0,
  width: "token(sizes.propertyRowAction)",
});

// The two flag rows, muted back down to a label.
//
// `field` promotes a TOGGLE's label to resting field text on purpose — beside a
// switch it is a full statement rather than a caption, and it is clickable. In
// a column of four labelled rows that reading breaks the column: two labels come
// out bright and the two naming boxes read as disabled next to them. Figma draws
// all four at the one muted ink (1187:9698), which is right here and wrong for a
// switch standing on its own — so it is said here rather than in the recipe.
const definitionFlagLabelStyle = css({
  color: "field.text.muted",
});

// The form's foot — the retreat and the commitment, pushed to opposite margins
// under a hairline. 48px rather than the bar's own 40: it holds a 32px chip on
// an 8px inset, and that is the sum, the same way the small field derives its
// own 28px frame.
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

// The control row's trailing cluster — the chip that names a selection beside
// the one that opens the settings, on the toolbar's own 4px gap.
const barActionsStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "sm",
  flexShrink: 0,
});

// The form's heading, standing exactly where the kinds stood — the leading half
// of the control row, opposite the same two chips.
//
// It takes the BAR's ink rather than `bodyLarge`'s muted body text: this is the
// panel saying what it has become, on the row whose other half is a pair of
// live controls, and a muted heading beside them reads as a caption. Cut rather
// than wrapped, for the reason the dictionary's rows are — the row is 40px, and
// nothing on it may stand two lines tall.
const definitionHeadingStyle = css({
  color: "field.text.default",
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
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

/** Calchemy's own value kinds — what a phrase is allowed to mean. */
const QUERY_KINDS = [
  { value: "single", label: "Single" },
  { value: "range", label: "Range" },
  { value: "multiple", label: "Multiple" },
] satisfies { value: ExpectedDateValue; label: string }[];

/**
 * What to try, in the kind that is set. The kinds are a FILTER — asked for one
 * day, "mondays next month" resolves to nothing at all rather than to some
 * arbitrary day out of the set — so a single suggestion across all three would
 * be an invitation to type something the parser is about to turn down. Each of
 * these reads as its own kind and nothing else, and the range's crosses a month
 * boundary because that is where its band has something to show.
 */
const QUERY_PLACEHOLDERS: Record<ExpectedDateValue, string> = {
  single: 'Try "the second friday of march"',
  range: 'Try "today until the end of next month"',
  multiple: 'Try "mondays and fridays next month"',
};

// ---------------------------------------------------------------------------
// Drawing a range.
//
// A range is two dates and everything between them, and drawing all of it as a
// selection would be a lie about the gesture: thirty chips is what `multiple`
// looks like. So only the ENDS are selected — they carry the chip, and they are
// the only two days handed to the calendar — and the days between them are a
// band at a fifth of the chip's strength, which the ends are read across.
//
// The band's arithmetic is `calchemy-range`'s (which runs it holds, where they
// break, where they fade). What is left here is the one measurement it needs:
// how far apart two day columns are, so a run can be drawn as ONE box over the
// cells and the gutters between them rather than as a chip per cell.
//
// That number is CSS's and it moves with the viewport — `fluid` spends a
// month's surplus width in its gutters, so the gap between columns runs from 4
// to about 14 — but it never has to be measured in JS. Seven columns of a fixed
// `calendarDay` spread edge to edge across the grid, so the pitch between them
// is (grid − one column) / 6 whatever the grid's width turns out to be, and
// container units let the cells ask the grid for it directly.
// ---------------------------------------------------------------------------

/** The wash between the ends — see `bg.calendarRange`. */
const RANGE_WASH = "token(colors.bg.calendarRange)";

// The one thing a day cell cannot work out for itself. `container-type` is what
// makes `cqw` below the GRID's width rather than the cell's 24px: a percentage
// in a custom property is resolved by whoever uses it, and the cells are what
// use this.
const monthGridStyle = css({
  containerType: "inline-size",
  "--calchemy-day-pitch": "calc((100cqw - token(sizes.calendarDay)) / 6)",
});

const rangeDateStyle = css({
  // Every day the range covers, its two ends included.
  "&[data-range]": {
    position: "relative",
    // The band is a `::before` lying behind the day's number, and a negative
    // z-index has to be caught SOMEWHERE: left to itself the pseudo escapes to
    // the page's context and paints under the stage's background, where nothing
    // is visible at all.
    //
    // Caught here, on the cell, it lands inside this cell's own stacking
    // context — where a negative z-index still paints ABOVE the cell's own
    // background and below its text. That is the point, not an accident: the
    // range washes over every day it holds, chips included, so an end is the
    // selection seen THROUGH the range rather than a chip sitting on top of it.
    // Caught any higher (on the grid) the wash would slide under every chip in
    // the month and the ends would lose it.
    isolation: "isolate",
    // A day inside the range does not recede. The weekend rule is a way of
    // reading a month at rest; this month is answering a question, and half an
    // answer greyed out is not the answer.
    opacity: 1,
    // The ink the selected chip carries, so the band reads as a weaker form of
    // the same statement rather than as a tint behind unrelated days. The two
    // ends have it from the recipe already; this is what gives it to the days
    // between them, which are not selected.
    color: "field.text.active",
  },
  // Drawn once per RUN, on the cell that opens it — the box reaches over the
  // cells after it and the gutters between them, which is what makes a week's
  // worth of days one band instead of seven chips.
  "&[data-range-run]::before": {
    content: '""',
    position: "absolute",
    zIndex: -1,
    insetBlock: 0,
    insetInlineStart: 0,
    width:
      "calc((var(--calchemy-range-run) - 1) * var(--calchemy-day-pitch) + token(sizes.calendarDay))",
    // The chip's own corner, so a run that stops mid-month ends exactly as the
    // day sitting on it does.
    borderRadius: "sm",
    // One gradient for all four cases, because a fade is a stop that has moved:
    // with no fade the two lengths are zero, the wash starts at 0 and runs to
    // 100%, and the gradient is a flat fill.
    backgroundImage: `linear-gradient(to right, transparent, ${RANGE_WASH} var(--calchemy-range-fade-in, 0px), ${RANGE_WASH} calc(100% - var(--calchemy-range-fade-out, 0px)), transparent)`,
  },
  // A chip the run box reaches but cannot show through, because the chip is
  // opaque and painted after it: the run covering this day was opened by an
  // EARLIER cell, so its box lives in that cell's stacking context and this
  // cell's background lands on top of it. One cell-sized copy of the wash, in
  // this cell's own context, puts it back over the chip — without which a range
  // had two differently coloured ends (the one that opened a run wore the wash,
  // the one that only closed one did not). Excluded where the cell opens its
  // own run, which already covers it: both firing would wash an end twice.
  "&[data-range][aria-selected='true']:not([data-range-run])::before": {
    content: '""',
    position: "absolute",
    zIndex: -1,
    inset: 0,
    borderRadius: "sm",
    backgroundColor: RANGE_WASH,
  },
  // A fade is drawn over exactly ONE day — the first of the month the band is
  // reaching into, or the last of the one it is leaving.
  "&[data-range-fade~='in']": {
    "--calchemy-range-fade-in": "token(sizes.calendarDay)",
  },
  "&[data-range-fade~='out']": {
    "--calchemy-range-fade-out": "token(sizes.calendarDay)",
  },
});

/**
 * One day cell, told where it sits in the range being drawn and — in the kinds
 * whose selection is not a set — what a press on it means.
 *
 * `Calendar.Grid` clones its single child once per day with the `cell` injected,
 * so this stands in the template's place and passes it straight through.
 */
function RangeDate({
  cell,
  range,
  weekStartsOn,
  onPick,
}: {
  /** Injected by `Calendar.Grid`; not set here. */
  cell?: CalendarCell;
  /** The range to draw, or null when the kind is not drawing one. */
  range: DateRange | null;
  weekStartsOn: WeekdayKey;
  /**
   * Takes the press instead of the calendar's own toggle. Null in `multiple`,
   * where toggling IS the rule.
   */
  onPick: ((date: Temporal.PlainDate) => void) | null;
}) {
  // Spill days are never banded: a boundary date is drawn twice — once by the
  // month that owns it, once as its neighbour's spill — and the fade is the
  // thing saying the band carried over into that other grid.
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
        // The calendar's own handler stands down on a press that has already
        // been answered, which is how a kind holding ONE thing keeps a click
        // from toggling a second into the set. Enter and Space arrive here too.
        event.preventDefault();
        onPick(cell.date);
      }}
    />
  );
}

/**
 * The fields a named date is made of — a name, whatever else it answers to, and
 * two yes/no questions about it. What it does NOT ask for is the days: those
 * are `dates`, the selection the form was opened over, and they stay live while
 * it is open, so the grid can be corrected without leaving the form.
 *
 * The same form defines a new entry and edits an existing one: they ask the
 * identical questions, and an edit that offered a different set of them would
 * be a second thing to keep in step. `entry` is which, and seeds the fields.
 *
 * "Repeats every year" is the rule the days are read under — see the dictionary
 * note above. It is offered only while the set fits inside a year, and a set
 * grown past one turns the switch off rather than carrying a stale yes.
 */
function NamedDateForm({
  entry,
  headingId,
  dates,
  onSubmit,
  onCancel,
}: {
  /** The entry being edited, or `null` to define a new one. */
  entry: NamedDate | null;
  /**
   * The heading standing where the kinds stood — the form's own name, on the
   * bar's control row. It is the label, rather than one written here, so the
   * group is announced by the words actually on screen.
   */
  headingId: string;
  /** The days on the grid — the entry's subject, live while the form is open. */
  dates: Temporal.PlainDate[];
  /** The fields as filled in. Identity is the caller's — see `nextNamedDateId`. */
  onSubmit: (fields: Omit<NamedDate, "id">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(entry?.name ?? "");
  // One row from the start, because the row is where the add chip lives: the
  // section header the popover hung it on is gone, and a chip at the end of the
  // last row needs a last row. A blank one is dropped on the way out, so an
  // untouched row costs the entry nothing.
  const [aliases, setAliases] = useState<string[]>(() =>
    entry && entry.aliases.length > 0 ? entry.aliases : [""],
  );
  // How many rows this form OPENED with, so that none of them takes the caret
  // on mount: `autoFocus` belongs to a row the reader has just asked for, and
  // the form starts at the name.
  const [openedWith] = useState(() => aliases.length);
  // Most of a dictionary falls every year, so that is what a new entry assumes;
  // turning it off is how you say these days happened once.
  const [repeatsYearly, setRepeatsYearly] = useState(
    entry ? entry.repeatsYearly : true,
  );
  const [isHoliday, setIsHoliday] = useState(entry?.isHoliday ?? false);

  // In order, because both rules read the set by its ends — which day the
  // slide is anchored on, and whether the run outlasts a year. A click order is
  // not a date order.
  const days = [...dates].sort(Temporal.PlainDate.compare);
  // The switch's answer is only half the question; the other half is whether
  // the days can be slid at all, and that changes under the form as the grid is
  // corrected. Held apart from the reader's yes rather than folded into it, so
  // that widening the selection past a year and narrowing it back does not
  // quietly lose the answer they gave.
  const canRepeat = fitsWithinAYear(days);
  const repeats = repeatsYearly && canRepeat;

  return (
    <div
      className={definitionStyle}
      role="group"
      aria-labelledby={headingId}
      // Escape retreats from the FORM and stops there — the rail behind the
      // panel is not the thing being dismissed.
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
        {/* Everything written in this panel is small type, the switch labels
            included — so the fields are `sm`, whose label IS the 12/20 the rows
            are drawn in, and each track is asked for `lg` explicitly rather
            than left to the field's coercion (which reads `sm` as a detail and
            hands back the 20px track). `labelFirst` makes each one a settings
            row: the statement first, the state after it. */}
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
        {/* Appended to and never reordered, so the index IS a row's identity.
            The first row is the one the label sits on and the last is the one
            carrying the chip that adds another; each row names itself by
            number, so it is still addressable on its own. */}
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
                  // The point of pressing add is to type one, so the row that
                  // has just mounted takes the caret. `autoFocus` only fires on
                  // mount, which is exactly the moment meant: the rows already
                  // standing are untouched, and no effect has to chase the DOM
                  // for a node that does not exist yet.
                  autoFocus={last && index >= openedWith}
                  onChange={(event) => {
                    const next = event.currentTarget.value;
                    setAliases((current) =>
                      current.map((held, at) => (at === index ? next : held)),
                    );
                  }}
                />
              </Field.Frame>
              {/* The action column, filled on the last row and standing empty
                  on the ones above it — so a row that cannot be added from
                  still ends its field on the same margin. */}
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
          // A name, and something for it to mean. The grid stays live under an
          // open form, so the days can empty out from under it — and a name for
          // no days is not a definition.
          disabled={name.trim().length === 0 || days.length === 0}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              dates: days,
              repeatsYearly: repeats,
              // A row added and left blank is one the reader thought better of,
              // not an empty word to teach the parser.
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
  // What the form is standing for: `null` while the panel is a query panel, an
  // `entry` of null while it is defining a new date, otherwise the entry being
  // edited. One form doing both jobs, because they are the same questions.
  const [definition, setDefinition] = useState<{
    entry: NamedDate | null;
  } | null>(null);
  // The button it was opened FROM — the panel's add chip, or one row's pencil.
  // Where focus goes back when the form is done.
  const namedDateTrigger = useRef<HTMLElement | null>(null);
  // The heading the form is announced by — see `definitionHeadingStyle`.
  const definitionHeadingId = useId();

  // The vocabulary the engine is built with. A named date is a RULE (which days
  // does this name fall on in year N), not a date, so it is handed over as a
  // resolver rather than a value.
  const namedDatesVocabulary = useMemo(
    () =>
      namedDates.map((entry) => ({
        value: entry.name,
        aliases: entry.aliases,
        isHoliday: entry.isHoliday,
        // One expression, both rules: a repeating entry SLIDES to the year it
        // is asked about, whole and by the stride between that year and the one
        // it was defined in, while a pinned one overrules the question with its
        // own days. The parser dedupes and orders whatever comes back.
        resolveDates: ({ year }: { year: number }) => {
          if (!entry.repeatsYearly) return entry.dates;
          const stride = year - entry.dates[0].year;
          return entry.dates.map((date) => date.add({ years: stride }));
        },
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
  // Non-null only while a hand-made selection is standing (see the header). In
  // `range` it holds the two ENDS rather than the days between them — that is
  // what a range is, and it is what keeps a span picked years apart from being
  // thirty thousand dates in a piece of component state.
  const [picked, setPicked] = useState<Temporal.PlainDate[] | null>(null);
  // The end a range is being drawn from — set by the first press, spent by the
  // second. Null whenever no range is half-made.
  const [rangeAnchor, setRangeAnchor] = useState<Temporal.PlainDate | null>(
    null,
  );
  const stageRef = useRef<HTMLElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  // Row heights are uniform (every month draws six week rows), so one
  // measurement places every row in the run. Held rather than assumed: it is
  // derived from the recipe's cell and gutter tokens, and this way it stays
  // right if any of them move.
  const [rowHeight, setRowHeight] = useState<number | null>(null);
  // How many months a row holds, which is the viewport's answer and not this
  // file's — see `columnsOf`. Everything about the run follows from it: how
  // long it is, which month is on which row, and where it opens.
  const [columns, setColumns] = useState(WIDEST_GRID);
  const today = useMemo(() => Temporal.Now.plainDateISO(), []);
  const grid = useMemo(() => monthGrid(columns, today), [columns, today]);
  // Which rows are actually built. Derived from the scroll on every move, so
  // nothing is ever loaded — the rows simply exist where they always were.
  const [window_, setWindow] = useState(() => ({
    // Nothing has been measured yet, so nothing is obscured yet either: the
    // opening window is the one a viewport with room for all of it would get.
    start: grid.openingRow(INITIAL_ROWS),
    rows: INITIAL_ROWS,
    // The row the window was built around — the one at the top of the
    // viewport. Carried with it because it is the reader's POSITION, and a
    // window's own start is that position less the overscan and clamped to the
    // ends of the run, which is not the same thing at either edge.
    top: grid.openingRow(INITIAL_ROWS),
  }));
  const opened = useRef(false);
  // A scroll offset waiting for the rows it lands on to exist — see `jumpTo`.
  const pendingScroll = useRef<{ top: number; smooth: boolean } | null>(null);
  // The month that was at the top when the column count changed under it. The
  // rows are a different length afterwards and start on different months, so
  // the scroll offset means something else entirely — the MONTH is the one
  // thing both geometries can name, and putting it back is what keeps a resize
  // from throwing the reader years away.
  const keepInView = useRef<Temporal.PlainDate | null>(null);
  // Where the reader is, sampled only from a scroll that has SETTLED — and
  // that qualifier is the whole point.
  //
  // A width change re-snaps the scroller: the months have just re-wrapped, so
  // `scroll-snap-type` finds a different period nearest the top and pulls the
  // scroll a row or two onto it. That happens BEFORE the resize is reported,
  // and its scroll event is committed before it too — so at the moment the new
  // column count is known, neither `scrollTop` nor the window built from it
  // still says where the reader was. A settled reading predates all of it.
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

  // Back to the phrase's own answer. A half-drawn range goes with it: the end
  // it was anchored on is no longer on the grid, and a second press would
  // otherwise draw a range from a day nothing is showing.
  const dropPicked = () => {
    setPicked(null);
    setRangeAnchor(null);
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
  // the box, which is exactly what is needed to measure. Taken again whenever
  // the column count moves: a month keeps its six week rows at every width, so
  // this should not move with it — and measuring is cheaper than trusting that.
  useLayoutEffect(() => {
    if (!calchemy) return;

    const month = stageRef.current?.querySelector<HTMLElement>(
      "[data-playground-month]",
    );
    // A zero is not a measurement — it is a context with no layout at all
    // (jsdom, a print pass, a tab that never painted). Taking it would divide
    // the whole run by zero; leaving it null keeps the plain opening window,
    // which is exactly what those contexts should see.
    const height = month?.getBoundingClientRect().height ?? 0;
    if (height > 0)
      setRowHeight((current) => (current === height ? current : height));
  }, [calchemy, columns]);

  // How many months fit across, watched. The answer is CSS's (`auto-fit`) and
  // this only reads it back — but it reads it back BEFORE the frame is shown,
  // so a narrow window never flashes a three-column grid on its way to two.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const list = stage?.querySelector<HTMLElement>("[data-playground-grid]");
    if (!stage || !list || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const next = columnsOf(list);
      if (next === 0 || next === grid.columns) return;
      // Where the reader is, in the one currency a change of geometry does not
      // devalue — see `keepInView`. Only once the page has OPENED: before that
      // there is no reader position to keep, and the opening is itself about to
      // decide where to land.
      if (opened.current) keepInView.current = settled.current;
      setColumns(next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);

    return () => observer.disconnect();
  }, [calchemy, grid]);

  // Going somewhere far off is two steps, and it has to be: a scroll into rows
  // that have not been built has no snap point to come to rest on, and the
  // browser drags it back to the nearest one that has. So the destination is
  // BUILT first, and the scroll happens once it is on the page.
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

  // Arrive on the opening row rather than at the top of a century — which row
  // that is depends on how many read clear, so it is asked of the measured
  // page rather than fixed: a viewport with room for two opens a row early,
  // and a short one opens on today's own row instead.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !rowHeight || opened.current) return;

    opened.current = true;
    const opening = grid.openingRow(
      readableRows(stage, scrimRef.current, rowHeight),
    );
    // Seeded rather than waited for: a window resized in the first moments has
    // a settled position of its own — the one the page just opened on.
    settled.current = grid.monthForRow(opening);
    jumpTo(opening, false);
    // Again on the next frame, because a browser restores an inner scroller's
    // position AFTER layout — so without this you arrive wherever the page was
    // left last time, which for a century-long run is anywhere at all.
    const frame = requestAnimationFrame(() => jumpTo(opening, false));
    return () => cancelAnimationFrame(frame);
  }, [rowHeight, grid, jumpTo]);

  // A column dropped or gained under the reader: the same months, on rows of a
  // different length. Put the one that was at the top back at the top — see
  // `keepInView`.
  useLayoutEffect(() => {
    const month = keepInView.current;
    if (!month) return;

    keepInView.current = null;
    const row = grid.rowForDate(month);
    jumpTo(row, false);
    // And again on the next frame, for the reason the opening does it: the run
    // is a different height now, and a browser CLAMPS or anchors an inner
    // scroller after the layout this effect runs in — which lands the reader a
    // couple of rows off the month they were reading.
    const frame = requestAnimationFrame(() => jumpTo(row, false));
    return () => cancelAnimationFrame(frame);
  }, [grid, jumpTo]);

  // Which rows to build, read straight off the scroll. No loading, no
  // shifting: the row that was at 1,200px is still at 1,200px, whether or not
  // it happens to be built at the moment.
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

  // Bring a day's row into view — unless it is already readable, in which case
  // moving would be rude. Worked out ARITHMETICALLY rather than by looking for
  // the month: at a century's range the row is very often not built yet, and
  // this is the same sum that decides where it would be built.
  const reveal = useCallback(
    (date: Temporal.PlainDate) => {
      const stage = stageRef.current;
      if (!stage || !rowHeight) return;

      const row = grid.rowForDate(date);
      const top = row * rowHeight;
      // The scrim's band is an overlay, so a row resting under it is on screen
      // and unreadable. Measured rather than repeated as a number.
      const obscured = scrimRef.current?.offsetHeight ?? 0;
      const readable =
        top >= stage.scrollTop &&
        top + rowHeight <= stage.scrollTop + stage.clientHeight - obscured;
      if (readable) return;

      // Smooth only when it is a short move; sliding a century is not a journey
      // anyone wants to watch.
      jumpTo(row, Math.abs(top - stage.scrollTop) < stage.clientHeight * 3);
    },
    [rowHeight, grid, jumpTo],
  );

  // A phrase can be answered off screen, so bring its row up.
  useEffect(() => {
    if (dates.length === 0) return;
    reveal(dates[0]);
  }, [dates, reveal]);

  // Pressing the chip that already has the form open closes it; pressing a
  // DIFFERENT trigger moves the form onto that entry rather than closing and
  // reopening.
  //
  // An edit is the form standing over the entry's OWN days, so opening one
  // LIGHTS them and brings them on screen: the days are the subject here, and a
  // form left over whatever happened to be selected would save the wrong ones.
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
  // The range being drawn, in the one kind that draws one. Read off whatever is
  // standing — the phrase's answer or a hand-made pair — because a range is its
  // two ends however it was arrived at.
  const range = kind === "range" ? rangeOf(values) : null;
  // What the calendar is told is SELECTED. A range hands it the ends alone: the
  // days between them are the band, and handing over all of them would draw the
  // very row of chips the band exists instead of.
  const selected = range
    ? range.first.equals(range.last)
      ? [range.first]
      : [range.first, range.last]
    : values;
  // ...and what the dictionary is told, which is the opposite: a named date
  // stands for DAYS, so the ends are filled back in. Only while there is a form
  // to fill — a span picked years apart is cheap to draw and not to expand.
  const definitionDates = definition && range ? rangeDays(range) : values;

  // What a press on a day does. `multiple` leaves it to the calendar's own
  // toggle — that IS its rule — and the two kinds that hold less than a set
  // take it back: a single date is REPLACED by the next one pressed, and a
  // range is drawn between two presses, the first anchoring it and the second
  // closing it.
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
      {/* The band the query bar floats in, frosted so the bar is not sitting
          crisply on a dense field of numbers — see `SCRIM_RAMPS`. */}
      <div ref={scrimRef} className={scrimStyle} aria-hidden>
        <ScrimBlur ramps={SCRIM_RAMPS} />
      </div>
      {/* The bar the year is talked to through. */}
      <div ref={barRef} className={barStyle}>
        <div className={barControlRowStyle}>
          {/* The other half of the morph. While the panel is naming a
              selection the kinds have nothing left to say — changing what a
              phrase may mean under an open form would replace the very days
              being named — so the row's leading half becomes the form's
              heading, and the panel says what it has turned into. */}
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
                // A new kind can change what the readings even are, so neither
                // the highlight nor the commitment carries over. Said by
                // re-typing the phrase into the hook, which is the one place
                // that rule lives.
                phrase.setQuery(query);
                // The hand-made selection goes with them, for the same reason
                // and one the kinds make plainer still: they are what a
                // selection is ALLOWED to be. Three scattered days are not a
                // range, and a range is not one day — so a pick is dropped
                // rather than coerced into a shape nobody asked for.
                dropPicked();
              }}
              ariaLabel="What a phrase may mean"
            />
          )}
          <div className={barActionsStyle}>
            {/* Only while there is something to name. A definition's days are
                whatever is lit, so with nothing lit there is nothing to offer —
                and the form has no field that could ask for them instead. It
                stays through an open form, which is where the pressed state and
                the focus return both land. */}
            {(values.length > 0 || definition) && (
              <Button
                variant="icon"
                aria-label="New named date"
                // Only while the form is standing for a NEW entry: an open edit
                // is the rail's own pencil, and this chip is not it.
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
        </div>
        {/* The morph. The panel is one instrument in two states — a phrase is
            typed at the year, or a name is given to what the year is showing —
            and they are never both wanted at once: the form's whole subject is
            the selection standing, which a new phrase would replace. */}
        {definition ? (
          <NamedDateForm
            // A new subject is a new FORM: the fields are seeded from the entry
            // once, as it mounts, so switching entries under an open form has
            // to remount it.
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
            {/* Same slot as the readings, and never at the same time — see the
                component. Taking the offer retypes the phrase, so it drops the
                hand-made selection exactly as typing does. */}
            <CalchemySuggestion query={phrase} onQueryChange={dropPicked} />
            <CalchemyQueryField
              query={phrase}
              // The kinds are a filter, so what is worth typing changes with
              // them — see `QUERY_PLACEHOLDERS`.
              placeholder={QUERY_PLACEHOLDERS[kind]}
              // Back to the phrase's answer — see the header.
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
              // Fills the 960 instead of hugging its months — the slack goes into
              // the gutters between the day columns, never into the cells.
              fluid
              selectionMode="multiple"
              // The ends alone in `range` — see `selected`.
              values={selected}
              // Only ever reached in `multiple`: the other two kinds answer the
              // press themselves (see `RangeDate`), and the sweep that is the
              // other way into this is withdrawn from them below.
              onValuesChange={setPicked}
              // The marquee drag and its keyboard mirror, Shift+Arrow, commit
              // MORE than one date per action — which is the one thing a range
              // and a single date may not do. `multiple` is the only kind whose
              // selection a sweep can even describe, so it is the only one that
              // keeps it.
              sweep={kind === "multiple"}
              months={window_.rows * grid.columns}
              // Controlled, and deliberately WITHOUT an `onViewChange`: which months
              // exist is decided by the scroll and nothing else. Left to itself the
              // calendar would move the range when a typed date fell outside it,
              // which is the same navigation done twice and in disagreement.
              view={grid.monthForRow(window_.start)}
              // One row, matching the snap — this is what PageUp/PageDown move by
              // now that there are no chevrons to press.
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
          // These are the settings the page is READ through, and the page is
          // the whole screen behind them — so an ambient press is someone
          // using the playground, not someone dismissing the rail. It closes
          // from its own chip, its header, or Escape.
          dismissOnOutsidePointer={false}
          onDismiss={() => setRailChoice(false)}
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
              parses as nothing at all until something here says what it means.

              A LIST, though, and no longer a door: an entry is defined over the
              days it is to mean, so the way in is the add chip on the query
              panel and this section is where the definitions are read back and
              reopened. */}
          <PropertiesPanel.Section enabled>
            {/* The panel's own SectionHeader spends its button on opening and
                closing the section, and this one has nothing to open — so the
                header is composed here: same strip, same measurements, no
                button. */}
            <div className={railSectionHeaderStyle}>
              <Typography tag="p" type="bodySmall">
                Named Dates Dictionary
              </Typography>
            </div>
            {/* Nothing at all until there is something to list. An empty
                dictionary is the ordinary state — Calchemy ships no named
                dates — and a line of prose announcing it every time says less
                than the days on the grid and the chip over them already do. */}
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
        </PropertiesPanel>
      )}
    </main>
  );
}
