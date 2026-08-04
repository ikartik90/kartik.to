"use client";

import { useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css } from "../../../styled-system/css";
import { ShiftFormShell } from "./shift-form-shell";
import { Field } from "@/components/ui/input/field";
import { Calendar } from "@/components/ui/input/calendar";
import { Combobox } from "@/components/ui/input/combobox";
import { TextInput } from "@/components/ui/input/text-input";
import { Checkbox } from "@/components/ui/input/checkbox";
import { Wireframe } from "@/components/ui/wireframe";
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
// ---------------------------------------------------------------------------

// The form body: the wireframed field column beside the calendar. The column
// takes the remaining width so the 208px calendar (the recipe's single-month
// measure) keeps its natural size and the two are separated by one 32px gutter,
// reproducing the Figma's 347 ∣ 208 split without hardcoding either number.
const bodyStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "3xl",
  // Below the form's comfortable width the two columns stop being side-by-side
  // furniture and just crowd each other — stack them, calendar first, so the
  // live half stays on top.
  _demoFrameCompact: { flexDirection: "column-reverse", gap: "xl" },
});

// The wireframe scope IS the field column, so it carries the column's layout —
// one wrapper, not a wrapper inside a wrapper.
const fieldColumnStyle = css({
  flex: "1 1 0",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "lg",
  _demoFrameCompact: { width: "token(spacing.full)" },
});

// The calendar column is exactly as wide as the calendar. `min-content` reads
// that 208px off the grid itself — its cells are a fixed 24px on a 4px gutter,
// so it cannot shrink — rather than restating the number here. `fit-content`
// would NOT do: it resolves to the widest child's max-content, which is the
// hint on one line, and the column would run ~390px wide. Taking min-content
// instead makes the hint wrap under the grid, as the Figma draws it (745:4415).
const calendarColumnStyle = css({ width: "min-content", flexShrink: 0 });

// The old form's "how long is the break" box. Per Figma 745:4395 the FIELD is
// 140.8px — the width of its label — while only the `Input+Hint Wrapper` inside
// it is 70px. So this lands on the frame, not on the field root: constraining
// the root instead wraps the long label to a second line, which pushes the
// label's bar off the input it belongs to.
const breakInputStyle = css({ width: "70px" });

/** A role or two, so the Combobox is the real control rather than a lookalike. */
const ROLES = [
  { value: "barista", label: "Barista" },
  { value: "floor", label: "Floor Supervisor" },
  { value: "kitchen", label: "Kitchen Hand" },
];

export function ShiftSchedulingV0() {
  // Opens empty: the demo's live half is the act of picking dates, so a
  // pre-filled one would only be something to clear first (same call as v2).
  const [shifts, setShifts] = useState<Temporal.PlainDate[]>([]);

  return (
    <ShiftFormShell>
      <div className={bodyStyle}>
        {/* The old form's left column, as a shape. Non-interactive by default,
            so nothing here takes focus or invites a click it cannot honour. */}
        <Wireframe className={fieldColumnStyle} opacity={25}>
          <Field>
            <Field.Label>Shift Role</Field.Label>
            <Combobox placeholder="Select a shift role">
              {ROLES.map((role) => (
                <Combobox.Option key={role.value} value={role.value}>
                  {role.label}
                </Combobox.Option>
              ))}
            </Combobox>
            <Field.Hint>Required</Field.Hint>
          </Field>

          {/* Composed from the Field primitives rather than the flat-prop
              TextInput, because this is the one bespoke field here: its label
              and its input want different widths, and the assembly's single
              `className` can only reach the root. */}
          <Field>
            <Field.Label>Break Duration (mins)</Field.Label>
            <Field.Frame className={breakInputStyle}>
              <Field.Control defaultValue="30 min" />
            </Field.Frame>
          </Field>

          <TextInput
            label="Additional Notes"
            defaultValue="Anything the team should know"
            hint="Visible to everyone rostered on this shift"
          />

          <Field>
            <Checkbox />
            <Field.Label>Notify the team when this shift is posted</Field.Label>
          </Field>
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
      </div>
    </ShiftFormShell>
  );
}
