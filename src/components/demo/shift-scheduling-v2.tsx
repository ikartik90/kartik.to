"use client";

import { useCallback, useRef, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css } from "../../../styled-system/css";
import { ShiftFormShell } from "./shift-form-shell";
import { DemoCursor } from "./demo-cursor";
import { DemoControls } from "./demo-controls";
import { DemoInvitation } from "./demo-invitation";
import { Field } from "@/components/ui/input/field";
import { Calendar } from "@/components/ui/input/calendar";
import { Tooltip } from "@/components/ui/tooltip";
import { useInView } from "@/hooks/use-in-view";
import { useDemoCursorTour } from "@/hooks/use-demo-cursor-tour";
import { useDemoInvitation } from "@/hooks/use-demo-invitation";
import ChevronLeftIcon from "@/assets/icons/chevron-left.svg";
import ChevronRightIcon from "@/assets/icons/chevron-right.svg";

// ---------------------------------------------------------------------------
// Shift Scheduling v2 — the showcase for the Calendar primitive's MULTIPLE
// selection mode, staged in the same "Post a Shift" dialog as v1 (Figma
// 723:1952 dark / 723:2281 light). Where v1 describes a recurrence in words —
// a switch, a weekday toolbar and a Notice that recomposes the sentence — v2
// drops the prose and lets you draw the shifts straight onto a three-month
// range: click a date to toggle it, or press and drag to sweep a run.
//
// It is a composition, not a component: the whole calendar is the library
// `Calendar` with `selectionMode="multiple"`, and the dialog chrome is the
// `ShiftFormShell` v1 also renders into. Nothing here re-implements a part.
//
// The one thing this file does own is the FRAME the range sits in. Three months
// measure 624px (3 × 208 — see the calendar recipe's arithmetic) but the form's
// content box is 583px, so the design deliberately runs the range wider than
// its container and crops it: the outermost weekend columns are half-cut on
// both sides, and the chevrons sit over them. That reads as "the range
// continues past here", which is exactly what the chevrons then do. It falls
// out of `width: 100%` + the recipe's centred period list — no measuring.
//
// And because the sweep is INVISIBLE — a grid that drags looks exactly like a
// grid that doesn't until you happen to hold the button down — the demo
// performs it for you. Once the frame is properly on screen a stand-in cursor
// walks in, presses on a Monday, draws a rectangle over four weeks of working
// days, and lets go with twenty shifts committed; then it makes the one edit a
// rectangle cannot, clicking a Wednesday off and that week's Saturday on. It is
// the real cursor artwork operating the real grid — the band grows from
// dispatched pointer positions, exactly as it would under your own hand — so
// what you watch is the gesture happening rather than a video of it.
//
// It plays once, stands down for a visitor who asked for less motion or who has
// already picked a date, and bows out the moment a real pointer touches the
// grid. When it is done it CLEARS the board, because handing the grid over with
// twenty dates on it means the first thing you do is undo someone else's work.
// The frame's corner keeps the two controls that follow: replay, or reset.
//
// One knock-on worth naming: the `Calendar.Tooltip` below retires itself after
// the first drag, and the walkthrough's drag counts. That is the right answer
// rather than a casualty — the tooltip exists to volunteer a gesture you might
// not know is there, and you have just watched it performed.
// ---------------------------------------------------------------------------

// Fill the form's content box (615px shell − 2 × 16px inset = 583px). The root
// slot is `width: fit-content`, which would otherwise shrink-wrap the 624px
// range and defeat the crop above; a `css()` utility beats a recipe slot, so
// this override lands without a specificity fight.
const calendarStyle = css({ width: "token(spacing.full)" });

// Blank the spill-over days. The primitive dims them to 15% and keeps them for
// the Date popover, where one month alone would otherwise look ragged — but at
// three months abreast the design drops them outright (Figma renders each
// month's real dates and nothing else), and three columns of ghost numbers
// running into each other is exactly the noise that motivates it. It also lines
// the LOOK up with the behaviour multiple-select already has: a spill copy is
// inert, so drawing it invites a click that does nothing.
//
// `visibility`, not `display`, so the cell still holds its square and the grid
// stays a constant six rows — the range keeps one height as you page it, which
// is the whole reason the primitive builds a 6×7 grid in the first place.
const dateStyle = css({ "&[data-outside]": { visibility: "hidden" } });

// The stage the walkthrough's cursor is placed against. It wraps the whole
// dialog rather than the form surface, because that surface is `clip-path`ed
// into torn edges — a cursor inside it would be cut off by the teeth on its way
// in, and a clip-path is a stacking context besides.
const stageStyle = css({ position: "relative" });

/** A beat to look at what the sweep drew, before the board is handed back. */
const TOUR_FINALE_MS = 1600;

/** What the walkthrough draws, and the one edit it then makes by hand. */
export interface DemoSweepPlan {
  /** The press corner — the first Monday. */
  from: Temporal.PlainDate;
  /** The release corner — the last Friday. */
  to: Temporal.PlainDate;
  /** The swept shift it then clicks OFF... */
  drop: Temporal.PlainDate;
  /** ...and the one it clicks ON in its place. */
  add: Temporal.PlainDate;
  /** Every date the band commits, in order. */
  dates: Temporal.PlainDate[];
}

/**
 * The block the walkthrough sweeps: every full Mon–Fri week the month holds.
 *
 * Mon–Fri is the argument, not a convenience. A marquee is a RECTANGLE, so one
 * press-and-drag takes four weeks of working days and leaves every weekend out
 * of it — which is the thing neither v0 (a click per date) nor v1 (a weekday
 * pattern typed into a sentence) can do in one gesture.
 *
 * It stays inside ONE month, and specifically today's, which is the middle of
 * the three columns and the only one fully on screen: the range deliberately
 * runs wider than the form, so a date drawn in either outer column is a date
 * nobody can see.
 *
 * The count needs no minimum or cap. With the first Monday on day `d ≤ 7` and a
 * month of `L ∈ 28…31` days, the number of whole Mon–Fri weeks is
 * `⌊(L − 4 − d) / 7⌋ + 1` — which is 3 at worst and 4 at best, so the sweep
 * commits 15 or 20 shifts and lands inside the 15-to-25 brief either way.
 */
export function planDemoSweep(today: Temporal.PlainDate): DemoSweepPlan {
  const first = today.with({ day: 1 });
  // Temporal counts Monday as 1, so this is the first Monday on or after the
  // 1st — day 1 itself when the month opens on one.
  const opening = ((8 - first.dayOfWeek) % 7) + 1;
  // Stepped by DAY NUMBER rather than by date: `add({ days: 7 })` off the last
  // Monday of a month lands in the next one, where the guard below reads true
  // again and the loop never ends.
  const mondays: number[] = [];
  for (let day = opening; day + 4 <= first.daysInMonth; day += 7)
    mondays.push(day);

  const dates = mondays.flatMap((monday) =>
    Array.from({ length: 5 }, (_, day) => first.with({ day: monday + day })),
  );

  return {
    from: dates[0],
    to: dates[dates.length - 1],
    // Wednesday of the opening week, and that same week's Saturday. Three days
    // apart, one row of the grid, so the swap reads as a single decision — and
    // the Saturday is safely inside the month, since a third week follows it.
    drop: first.with({ day: mondays[0] + 2 }),
    add: first.with({ day: mondays[0] + 5 }),
    dates,
  };
}

export function ShiftSchedulingV2() {
  // Opens empty: the point of the demo is the act of drawing shifts on, so a
  // pre-filled date would only be something to clear first.
  const [shifts, setShifts] = useState<Temporal.PlainDate[]>([]);
  // Both read at mount rather than per render — and from ONE reading of the
  // clock, so the two can never straddle a midnight — then held in state, so a
  // re-render can't slide the range out from under a drag.
  const [{ openingMonth, tour }] = useState(() => {
    const today = Temporal.Now.plainDateISO();
    // The shifts go in NEXT month: a roster is written forward, and it leaves
    // the whole block clear of today's own accent.
    const tour = planDemoSweep(today.add({ months: 1 }));
    // ...so the range opens one month BEFORE that, which puts the month being
    // drawn on in the MIDDLE column. That is not cosmetic: the range runs 624px
    // wide in a 583px box, so the outer columns are cropped at the frame — in
    // the third column the Friday cells sit under the Next chevron and the
    // Saturdays are half gone. The middle column is the only one wholly on
    // screen, so it is the only one worth performing in.
    return { openingMonth: today, tour };
  });

  const stageRef = useRef<HTMLDivElement>(null);
  const onScreen = useInView(stageRef);

  // The state a run starts from, which here is also the state a finished one
  // hands back: an empty grid either way.
  const clear = useCallback(() => setShifts([]), []);

  const invitation = useDemoInvitation(stageRef);

  const cursor = useDemoCursorTour({
    stageRef,
    active: onScreen,
    finaleMs: TOUR_FINALE_MS,
    stops: () => {
      const stage = stageRef.current;
      // An empty plan calls the whole thing off, which is how the demo declines
      // to perform over dates the visitor picked first.
      if (!stage || shifts.length) return [];
      const cell = (date: Temporal.PlainDate) => () =>
        stage.querySelector<HTMLElement>(
          // A date owned by one month is also drawn as the next one's spill
          // copy, and that copy is inert — clicking it would do nothing.
          `[data-date="${date}"]:not([data-outside])`,
        );
      return [
        // One gesture for four weeks of working days...
        { from: cell(tour.from), to: cell(tour.to) },
        // ...and then the two clicks a rectangle can't make for you: a band
        // reaches every date between its corners and nothing outside them, so
        // dropping one shift and taking a Saturday instead is still hand work.
        cell(tour.drop),
        cell(tour.add),
      ];
    },
    // The walkthrough puts the calendar back the way it found it, so the
    // visitor's first act isn't rubbing out someone else's twenty picks — and
    // hands over with the page's invitation, if this is the first run on it to
    // finish and there is a cursor on screen to put the words beside.
    onComplete: () => {
      clear();
      invitation.offer();
    },
    // ...and the same again when the frame scrolls away mid-run, so the board
    // is clean for the fresh run that starts when it scrolls back.
    onRewind: clear,
  });

  // Replay clears first: the sweep TOGGLES, so running it over a board that
  // already holds the block would rub the whole thing out again.
  const { replay: replayTour, stop: stopTour } = cursor;
  const replay = useCallback(() => {
    clear();
    replayTour();
  }, [clear, replayTour]);

  // Reset calls off a performance in flight as well as clearing the board —
  // otherwise the tour's remaining stops would put dates straight back.
  const reset = useCallback(() => {
    stopTour();
    clear();
  }, [stopTour, clear]);

  return (
    <>
      <div className={stageStyle} ref={stageRef}>
        <ShiftFormShell>
          <Field>
            <Field.Label>Scheduling Calendar</Field.Label>
            <Calendar
              className={calendarStyle}
              selectionMode="multiple"
              values={shifts}
              onValuesChange={setShifts}
              defaultView={openingMonth}
              months={3}
              // Walk the range, don't page it. Three months abreast are here to be
              // compared — a shift run is drawn ACROSS the boundaries — and a
              // chevron that turned all three over at once threw away the two you
              // were reading to reach the one you wanted. Stepping by one keeps
              // them, so the run you just drew is still on screen while you extend
              // it into the month you brought in.
              step={1}
              // No `today` override — the accent tracks the real current date.
              // The range is wider than this frame, so the chevrons sit in the
              // gradient scrims that fade the half-cut outer columns away.
              navPlacement="edge"
            >
              <Calendar.PeriodList>
                {/*
              The sweep is what this demo exists to show, and a marquee leaves
              no mark on the chrome to advertise itself — the grid looks like
              any click-to-toggle calendar until you happen to hold the button
              down. So the calendar says it once, at the cursor: the tooltip
              rides in on the hover, withdraws after three seconds, and never
              returns once a drag has actually happened. The Field.Hint below
              carries the same instruction permanently, for the pointer that
              never rests here and for a screen reader — this is the version
              that arrives while your hand is already on the grid.
            */}
                <Calendar.Tooltip>
                  <Tooltip.Text>Drag to select multiple</Tooltip.Text>
                </Calendar.Tooltip>
                <Calendar.Prev>
                  <ChevronLeftIcon />
                </Calendar.Prev>
                <Calendar.Period>
                  {/* "Jul 2026" — three labels side by side want the short form. */}
                  <Calendar.Month monthFormat="narrow" />
                  <Calendar.Week>
                    <Calendar.Day />
                  </Calendar.Week>
                  <Calendar.Grid>
                    <Calendar.Date className={dateStyle} />
                  </Calendar.Grid>
                </Calendar.Period>
                <Calendar.Next>
                  <ChevronRightIcon />
                </Calendar.Next>
              </Calendar.PeriodList>
            </Calendar>
            <Field.Hint>
              Drag across multiple dates or click on a shift date to toggle
              selection
            </Field.Hint>
          </Field>
        </ShiftFormShell>

        {/* Outside the shell's torn form surface, for the reason given at
            `stageStyle`. Last, so it paints over what it is pointing at. */}
        <DemoCursor {...cursor} />
        <DemoInvitation {...invitation} />
      </div>

      {/* Outside the shell, so it pins to the FRAME's corner rather than the
          dialog's — and outside the stage, so pressing one is not mistaken for
          the visitor reaching into the grid mid-performance. */}
      <DemoControls onReplay={replay} onReset={reset} />
    </>
  );
}
