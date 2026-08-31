"use client";

import { useCallback, useRef, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css } from "../../../styled-system/css";
import { ShiftFormShell } from "./shift-form-shell";
import { ShiftFormFields } from "./shift-form-fields";
import { DemoCursor } from "./demo-cursor";
import { DemoControls } from "./demo-controls";
import { DemoInvitation } from "./demo-invitation";
import { Field } from "@/components/ui/input/field";
import { Calendar } from "@/components/ui/input/calendar";
import { Wireframe } from "@/components/ui/wireframe";
import { useInView } from "@/hooks/use-in-view";
import { useDemoCursorTour } from "@/hooks/use-demo-cursor-tour";
import { useDemoInvitation } from "@/hooks/use-demo-invitation";
import ChevronLeftIcon from "@/assets/icons/chevron-left.svg";
import ChevronRightIcon from "@/assets/icons/chevron-right.svg";

// ---------------------------------------------------------------------------
// Shift Scheduling v0 — the BEFORE in the series (Figma 745:4375 light /
// 745:4080 dark, "Old Shift Scheduling"). It is staged in the same "Post a
// Shift" dialog as v1 and v2, so the three read as one form redesigned twice
// rather than three unrelated screens.
//
// The old design's whole shape is the argument: a column of ordinary form
// fields on the left, and the scheduling calendar exiled to a 208px box on the
// right, so picking WHEN a shift happens is a separate activity from describing
// WHAT it is. v1 answers that by moving recurrence into a sentence; v2 by
// letting you draw the shifts straight onto a range. Neither point lands unless
// you can see the arrangement they replaced.
//
// Which is why the left column is WIREFRAMED rather than filled in. The fields
// are real components (Combobox, TextInput, Checkbox) inside a `<Wireframe>`, so
// they keep their true frames, chevron, checkbox box and vertical rhythm while
// their text reads as bars — the layout is the subject, and specific copy would
// only invite you to read it instead. At 25% it recedes to the depth the Figma
// draws it at (745:4383), leaving the calendar as the one thing in focus.
//
// The calendar is deliberately a SIBLING of that scope, not a child: it stays
// live, at full strength, and fully interactive. That is the composition the
// Figma shows, and it needs no opt-out of its own — anything outside the
// wrapper is simply not wireframed.
//
// And because the argument is a TEDIUM — one date, one click, four times over —
// the demo makes it itself. Once the form is properly on screen a stand-in
// cursor walks in and picks four dates the long way round, then withdraws. It
// is the real cursor artwork clicking the real day cells, so what you watch is
// the v0 workflow being performed rather than a video of it, and it plays
// exactly once: this is the setup for v1 and v2, not a loop to sit and watch.
// It stands down for a visitor who asked for less motion, for one who has
// already picked a date, and for one who touches the grid mid-performance.
//
// When it is done it CLEARS what it picked, because the walkthrough's whole
// purpose is to hand the grid over, and handing it over with four dates already
// on it means the first thing you do is undo someone else's work. The frame's
// own corner keeps the two controls that follow from that: replay the
// performance, or reset the board.
// ---------------------------------------------------------------------------

// The form body: the wireframed field column beside the calendar. The column
// takes the remaining width so the 208px calendar (the recipe's single-month
// measure) keeps its natural size and the two are separated by one 32px gutter,
// reproducing the Figma's 347 ∣ 208 split without hardcoding either number.
//
// Narrowing the frame spends the FIELD column first, since it is the half made
// of rubber and the calendar's grid cannot shrink without breaking its pitch:
// the two close on each other until they are the same width. That is the floor.
// A field column narrower than the calendar beside it has stopped being the
// form's main column, so THAT is the point the row wraps and the two stack —
// not some frame width guessed in advance. Flex lines break on their items'
// hypothetical sizes, so the floor below IS the breakpoint; nothing here has to
// name a viewport.
//
// `wrap-reverse` is what puts the calendar on top when they do stack, leaving
// the DOM in the old form's own reading order (the fields, then the calendar
// exiled to their right). It swaps the cross axis with it, which is why
// holding the two columns' TOPS together asks for `flex-end` here. And the row
// gap only exists once there are two rows, so it needs no condition of its own.
const bodyStyle = css({
  display: "flex",
  flexWrap: "wrap-reverse",
  alignItems: "flex-end",
  columnGap: "3xl",
  rowGap: "xl",
  // The stage the walkthrough's cursor is placed against, so its points are
  // plain offsets into this box rather than viewport coordinates.
  position: "relative",
});

// The calendar's measure written as the arithmetic that produces it rather than
// as the 208px it comes out at: seven day cells on a 4px gutter inside the
// period's 8px inset. The calendar column reads its own width off the grid
// (`min-content`, below) and CSS gives the field column no way to ask a sibling
// for it, so this is the one place the pitch is restated — in the same tokens
// the recipe builds it from, so it moves when they do.
const CALENDAR_MEASURE =
  "calc(7 * token(sizes.calendarDay) + 6 * token(spacing.sm) + 2 * token(spacing.md))";

// The wireframe scope IS the field column, so it carries the column's layout —
// one wrapper, not a wrapper inside a wrapper.
const fieldColumnStyle = css({
  flex: "1 1 0",
  // Shrinks to the calendar's width and no further — the floor the body's
  // comment describes, and so also the width at which the row gives up and
  // wraps. Once wrapped it is alone on its line and grows back to fill it,
  // which is what the compact width override used to have to say by hand.
  minWidth: CALENDAR_MEASURE,
  display: "flex",
  flexDirection: "column",
  gap: "lg",
});

// The calendar column is exactly as wide as the calendar. `min-content` reads
// that 208px off the grid itself — its cells are a fixed 24px on a 4px gutter,
// so it cannot shrink — rather than restating the number here. `fit-content`
// would NOT do: it resolves to the widest child's max-content, which is the
// hint on one line, and the column would run ~390px wide. Taking min-content
// instead makes the hint wrap under the grid, as the Figma draws it (745:4415).
const calendarColumnStyle = css({ width: "min-content", flexShrink: 0 });

/** How many dates the walkthrough picks — enough to feel like work, not a list. */
const TOUR_DATES = 4;

/**
 * The dates the walkthrough clicks, given today. Four of them, EVERY OTHER DAY
 * and starting tomorrow: spaced so the run reads as four separate decisions
 * rather than a swept range (the range is v2's move, and this frame exists to
 * show the design that didn't have it), and clear of today so the picked chips
 * never land on the cell already carrying the accent.
 *
 * All four stay inside today's month, because that is the only month the grid
 * has cells for — a date past its end renders as the next month's spill copy,
 * which multiple-select deliberately makes inert. So when the month runs out of
 * room the spacing closes to consecutive days, and failing that the run backs up
 * to fit.
 */
export function planDemoShiftDates(
  today: Temporal.PlainDate,
  count = TOUR_DATES,
): Temporal.PlainDate[] {
  const lastDay = today.daysInMonth;
  const stride = today.day + 1 + 2 * (count - 1) <= lastDay ? 2 : 1;
  const span = stride * (count - 1);
  const first = Math.max(1, Math.min(today.day + 1, lastDay - span));
  return Array.from({ length: count }, (_, index) =>
    today.with({ day: first + index * stride }),
  );
}

export function ShiftSchedulingV0() {
  // Opens empty: the demo's live half is the act of picking dates, so a
  // pre-filled one would only be something to clear first (same call as v2).
  const [shifts, setShifts] = useState<Temporal.PlainDate[]>([]);
  // Read at mount rather than per render (v2 reads its opening month the same
  // way), so the walkthrough can't have the ground move under it mid-run.
  const [tourDates] = useState(() =>
    planDemoShiftDates(Temporal.Now.plainDateISO()),
  );

  // The form body is what has to be on screen — 70% of IT, not of the frame
  // around it, which is the difference between "the demo is legible" and "the
  // demo's border is legible".
  const stageRef = useRef<HTMLDivElement>(null);
  const onScreen = useInView(stageRef);

  // The state a run starts from, which here is also the state a finished one
  // hands back: an empty grid either way.
  const clear = useCallback(() => setShifts([]), []);

  const invitation = useDemoInvitation(stageRef);

  const cursor = useDemoCursorTour({
    stageRef,
    active: onScreen,
    // Each date is looked up against the DOM the calendar actually rendered, so
    // one whose cell isn't there to be clicked is simply skipped. An empty plan
    // calls the whole thing off, which is how the demo declines to perform over
    // dates the visitor picked first.
    stops: () =>
      shifts.length
        ? []
        : tourDates.map(
            (date) => () =>
              stageRef.current?.querySelector<HTMLButtonElement>(
                `[data-date="${date}"]:not([data-outside])`,
              ) ?? null,
          ),
    // The walkthrough puts the calendar back the way it found it, so the
    // visitor's first act isn't undoing someone else's four picks — and hands
    // over with the page's invitation, if this is the first run on it to finish
    // and there is a cursor on screen to put the words beside.
    onComplete: () => {
      clear();
      invitation.offer();
    },
    // ...and the same again when the frame scrolls away mid-run, so the board
    // is clean for the fresh run that starts when it scrolls back.
    onRewind: clear,
  });

  // Replay clears first: the tour TOGGLES dates, so running it over a board
  // that already holds its four picks would rub them all out again.
  const { replay: replayTour, stop: stopTour } = cursor;
  const replay = useCallback(() => {
    clear();
    replayTour();
  }, [clear, replayTour]);

  // Reset calls off a performance in flight as well as clearing the board —
  // otherwise the tour's remaining clicks would put dates straight back.
  const reset = useCallback(() => {
    stopTour();
    clear();
  }, [stopTour, clear]);

  return (
    <>
      <ShiftFormShell>
        <div className={bodyStyle} ref={stageRef}>
          {/* The old form's left column, as a shape. Non-interactive by default,
            so nothing here takes focus or invites a click it cannot honour. */}
          <Wireframe className={fieldColumnStyle} opacity={25}>
            <ShiftFormFields />
          </Wireframe>

          {/* Live, full strength, outside the scope — the one thing in focus. */}
          <Field className={calendarColumnStyle}>
            <Field.Label>Scheduling Calendar</Field.Label>
            <Calendar
              selectionMode="multiple"
              values={shifts}
              onValuesChange={setShifts}
              // One date per action — no marquee drag, no Shift+Arrow run. Sweeping
              // a range in a single gesture is v2's move, and the whole point of
              // this frame is the design that did NOT have it: here you pick days
              // one at a time, which is exactly the tedium v2 answers.
              sweep={false}
              // No `today` override — the accent tracks the real current date.
            >
              <Calendar.PeriodList>
                <Calendar.Prev>
                  <ChevronLeftIcon />
                </Calendar.Prev>
                <Calendar.Period>
                  <Calendar.Month />
                  <Calendar.Week>
                    <Calendar.Day />
                  </Calendar.Week>
                  <Calendar.Grid>
                    <Calendar.Date />
                  </Calendar.Grid>
                </Calendar.Period>
                <Calendar.Next>
                  <ChevronRightIcon />
                </Calendar.Next>
              </Calendar.PeriodList>
            </Calendar>
            <Field.Hint>Select one or more shift dates</Field.Hint>
          </Field>

          {/* Last, so it paints over the calendar it is pointing at. */}
          <DemoCursor {...cursor} />
          <DemoInvitation {...invitation} />
        </div>
      </ShiftFormShell>

      {/* Outside the shell, so it pins to the FRAME's corner rather than the
          dialog's — and outside the stage, so pressing one is not mistaken for
          the visitor reaching into the grid mid-performance. */}
      <DemoControls
        onPlay={replay}
        // Stops the run where it stands and keeps its picks — the same break-in
        // touching the calendar already performs, offered as a control.
        onStop={stopTour}
        running={cursor.running}
        onReset={reset}
        // An empty board is already the state reset hands back, so there is
        // nothing to offer until dates are on it — and nothing to offer while
        // the walkthrough is still putting them there.
        resettable={shifts.length > 0 && !cursor.running}
      />
    </>
  );
}
