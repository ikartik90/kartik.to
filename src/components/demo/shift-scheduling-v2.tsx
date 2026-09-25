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

// Fills the form's 583px so the 624px range overflows and is cropped; beats the recipe's `fit-content`.
const calendarStyle = css({ width: "token(spacing.full)" });

// Blanks spill days; `visibility`, not `display`, so the grid keeps six rows.
const dateStyle = css({ "&[data-outside]": { visibility: "hidden" } });

// Wraps the whole dialog: the form's `clip-path` would cut the cursor off.
const stageStyle = css({ position: "relative" });

const TOUR_FINALE_MS = 1600;

export interface DemoSweepPlan {
  /** First Monday. */
  from: Temporal.PlainDate;
  /** Last Friday. */
  to: Temporal.PlainDate;
  /** Swept date clicked off by hand... */
  drop: Temporal.PlainDate;
  /** ...and the one clicked on in its place. */
  add: Temporal.PlainDate;
  dates: Temporal.PlainDate[];
}

/** Every full Mon–Fri week of the month (15 or 20 dates), plus a hand swap a rectangle cannot make. */
export function planDemoSweep(today: Temporal.PlainDate): DemoSweepPlan {
  const first = today.with({ day: 1 });
  // The first Monday on or after the 1st (Temporal's Monday is 1).
  const opening = ((8 - first.dayOfWeek) % 7) + 1;
  // Stepped by day number: `add({ days: 7 })` would leave the month and never end the loop.
  const mondays: number[] = [];
  for (let day = opening; day + 4 <= first.daysInMonth; day += 7)
    mondays.push(day);

  const dates = mondays.flatMap((monday) =>
    Array.from({ length: 5 }, (_, day) => first.with({ day: monday + day })),
  );

  return {
    from: dates[0],
    to: dates[dates.length - 1],
    drop: first.with({ day: mondays[0] + 2 }),
    add: first.with({ day: mondays[0] + 5 }),
    dates,
  };
}

export function ShiftSchedulingV2() {
  const [shifts, setShifts] = useState<Temporal.PlainDate[]>([]);
  // One clock reading at mount, held so a re-render cannot slide the range under a drag.
  const [{ openingMonth, tour }] = useState(() => {
    const today = Temporal.Now.plainDateISO();
    // The tour draws next month, which a range opening on today puts in the fully visible middle column.
    const tour = planDemoSweep(today.add({ months: 1 }));
    return { openingMonth: today, tour };
  });

  const stageRef = useRef<HTMLDivElement>(null);
  const onScreen = useInView(stageRef);

  const clear = useCallback(() => setShifts([]), []);

  const invitation = useDemoInvitation(stageRef);

  const cursor = useDemoCursorTour({
    stageRef,
    active: onScreen,
    finaleMs: TOUR_FINALE_MS,
    stops: () => {
      const stage = stageRef.current;
      if (!stage || shifts.length) return [];
      const cell = (date: Temporal.PlainDate) => () =>
        stage.querySelector<HTMLElement>(
          `[data-date="${date}"]:not([data-outside])`,
        );
      return [
        { from: cell(tour.from), to: cell(tour.to) },
        cell(tour.drop),
        cell(tour.add),
      ];
    },
    onComplete: () => {
      clear();
      invitation.offer();
    },
    onRewind: clear,
  });

  // Clears first: the sweep toggles, so replaying over its own block would erase it.
  const { replay: replayTour, stop: stopTour } = cursor;
  const replay = useCallback(() => {
    clear();
    replayTour();
  }, [clear, replayTour]);

  // Stops the tour too, or its remaining stops would put dates back.
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
              // Steps one month, so a run drawn across a boundary stays on screen.
              step={1}
              navPlacement="edge"
            >
              <Calendar.PeriodList>
                <Calendar.Tooltip>
                  <Tooltip.Text>Drag to select multiple</Tooltip.Text>
                </Calendar.Tooltip>
                <Calendar.Prev>
                  <ChevronLeftIcon />
                </Calendar.Prev>
                <Calendar.Period>
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

        {/* A sibling of the clipped form (see `stageStyle`), last so it paints on top. */}
        <DemoCursor {...cursor} />
        <DemoInvitation {...invitation} />
      </div>

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
