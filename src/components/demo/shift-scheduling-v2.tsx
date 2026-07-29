"use client";

import { useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css } from "../../../styled-system/css";
import { ShiftFormShell } from "./shift-form-shell";
import { Field } from "@/components/ui/input/field";
import { Calendar } from "@/components/ui/input/calendar";
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

export function ShiftSchedulingV2() {
  // Opens empty: the point of the demo is the act of drawing shifts on, so a
  // pre-filled date would only be something to clear first.
  const [shifts, setShifts] = useState<Temporal.PlainDate[]>([]);
  // One month BEFORE today, so the current month lands in the MIDDLE column and
  // the range reads as a window around now rather than a run starting at it.
  // Lazily, so the clock is read at mount rather than on every render — and
  // held in state so a re-render can't slide the range out from under a drag.
  const [openingMonth] = useState(() =>
    Temporal.Now.plainDateISO().subtract({ months: 1 }),
  );

  return (
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
          // No `today` override — the accent tracks the real current date.
          // The range is wider than this frame, so the chevrons sit in the
          // gradient scrims that fade the half-cut outer columns away.
          navPlacement="edge"
        >
          <Calendar.PeriodList>
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
          Click on a date or drag across multiple dates to toggle selection
        </Field.Hint>
      </Field>
    </ShiftFormShell>
  );
}
