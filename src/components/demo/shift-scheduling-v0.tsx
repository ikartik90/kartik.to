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

// Wraps where the field column hits its min-width; `wrap-reverse` stacks the calendar on top,
// so tops align with `flex-end`. `_shiftFormStacked` restates that crossover as a container query.
const bodyStyle = css({
  display: "flex",
  flexWrap: "wrap-reverse",
  alignItems: "flex-end",
  columnGap: "3xl",
  rowGap: "xl",
  // The cursor's stage: its points are offsets into this box.
  position: "relative",
  containerType: "inline-size",
  containerName: "shiftForm",
});

// The calendar's 208px, in the recipe's own tokens; CSS cannot read it off the sibling.
const CALENDAR_MEASURE =
  "calc(7 * token(sizes.calendarDay) + 6 * token(spacing.sm) + 2 * token(spacing.md))";

const fieldColumnStyle = css({
  flex: "1 1 0",
  // The floor that decides where the row wraps.
  minWidth: CALENDAR_MEASURE,
  display: "flex",
  flexDirection: "column",
  gap: "lg",
  _shiftFormStacked: {
    "& > :not(:first-child, :last-child)": { display: "none" },
  },
});

// `min-content`, not `fit-content`: the hint wraps under the grid instead of widening the column.
const calendarColumnStyle = css({
  width: "min-content",
  flexShrink: 0,
  _shiftFormStacked: { width: "token(spacing.full)" },
});

const TOUR_DATES = 4;

/** Four dates, every other day from tomorrow, kept inside today's month (the only one with live cells). */
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
  const [shifts, setShifts] = useState<Temporal.PlainDate[]>([]);
  // Read at mount so the plan cannot shift mid-run.
  const [tourDates] = useState(() =>
    planDemoShiftDates(Temporal.Now.plainDateISO()),
  );

  const stageRef = useRef<HTMLDivElement>(null);
  const onScreen = useInView(stageRef);

  const clear = useCallback(() => setShifts([]), []);

  const invitation = useDemoInvitation(stageRef);

  const cursor = useDemoCursorTour({
    stageRef,
    active: onScreen,
    // Looked up in the rendered DOM; an empty plan (the visitor picked first) calls the tour off.
    stops: () =>
      shifts.length
        ? []
        : tourDates.map(
            (date) => () =>
              stageRef.current?.querySelector<HTMLButtonElement>(
                `[data-date="${date}"]:not([data-outside])`,
              ) ?? null,
          ),
    onComplete: () => {
      clear();
      invitation.offer();
    },
    onRewind: clear,
  });

  // Clears first: the tour toggles dates, so replaying over its own picks would erase them.
  const { replay: replayTour, stop: stopTour } = cursor;
  const replay = useCallback(() => {
    clear();
    replayTour();
  }, [clear, replayTour]);

  // Stops the tour too, or its remaining clicks would put dates back.
  const reset = useCallback(() => {
    stopTour();
    clear();
  }, [stopTour, clear]);

  return (
    <>
      <ShiftFormShell>
        <div className={bodyStyle} ref={stageRef}>
          <Wireframe className={fieldColumnStyle} opacity={25}>
            <ShiftFormFields />
          </Wireframe>

          <Field className={calendarColumnStyle}>
            <Field.Label>Scheduling Calendar</Field.Label>
            <Calendar
              selectionMode="multiple"
              values={shifts}
              onValuesChange={setShifts}
              fluid
              // One date per action; sweeping a range is v2's move.
              sweep={false}
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

          {/* Last, so it paints over the calendar. */}
          <DemoCursor {...cursor} />
          <DemoInvitation {...invitation} />
        </div>
      </ShiftFormShell>

      {/* Outside the stage, so a press is not taken for touching the grid. */}
      <DemoControls
        onPlay={replay}
        onStop={stopTour}
        running={cursor.running}
        onReset={reset}
        resettable={shifts.length > 0 && !cursor.running}
      />
    </>
  );
}
