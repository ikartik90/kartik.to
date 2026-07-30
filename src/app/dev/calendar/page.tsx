"use client";

import { useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css } from "../../../../styled-system/css";
import { Calendar } from "@/components/ui/input/calendar";
import { Field } from "@/components/ui/input/field";
import { TextInput } from "@/components/ui/input/text-input";
import { Wireframe } from "@/components/ui/wireframe";
import { parseCalendarDate } from "@/utils/calendar-date";
import ChevronLeftIcon from "@/assets/icons/chevron-left.svg";
import ChevronRightIcon from "@/assets/icons/chevron-right.svg";

/** Local-only preview route for eyeballing the composable Calendar. */
export default function CalendarPreviewPage() {
  const [date, setDate] = useState<Temporal.PlainDate | null>(
    Temporal.Now.plainDateISO("America/Toronto"),
  );

  return (
    <main
      className={css({
        minHeight: "100dvh",
        backgroundColor: "bg.canvas",
        display: "flex",
        // globals.css sets `main { flex-direction: column }`; state the row
        // explicitly so the declared flexWrap below is not a no-op.
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: "5xl",
        padding: "5xl",
        flexWrap: "wrap",
      })}
    >
      {/* Default styling — straight from the `calendar` recipe, which draws its
          own framed surface. The Calendar is a field control, so it lives in a
          <Field> and picks up the label/hint (associated to its group via
          aria-labelledby/-describedby). */}
      <Field>
        <Field.Label>Trip date</Field.Label>
        <Calendar
          value={date}
          onValueChange={setDate}
          // Explicit parser on the Calendar — date navigation is opt-in; a bare
          // Field.Search just emits raw strings the Calendar never resolves.
          queryParser={parseCalendarDate("DD/MM/YYYY")}
          // today={Temporal.PlainDate.from("2026-12-11")}
        >
          <Field.Search placeholder="Type a date…" />
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
        <Field.Hint>Pick a day for the trip</Field.Hint>
      </Field>

      {/* The multi-month range (Figma 715:912): the SAME single Period template,
          cloned once per month, with one pair of chevrons paging all three at a
          time. `narrow` shortens the labels to fit the 208px columns. */}
      <Field>
        <Field.Label>Stay dates</Field.Label>
        <Calendar
          months={3}
          value={date}
          onValueChange={setDate}
          queryParser={parseCalendarDate("DD/MM/YYYY")}
        >
          <Field.Search placeholder="Type a date…" />
          <Calendar.PeriodList>
            <Calendar.Prev>
              <ChevronLeftIcon />
            </Calendar.Prev>
            <Calendar.Period>
              <Calendar.Month monthFormat="narrow" />
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
        <Field.Hint>Three months at a time</Field.Hint>
      </Field>

      {/* Re-skin proof: consumer restyles weekends purely off the data
          attribute the cell already carries — no prop, no function. */}
      <Field>
        <Field.Label>Weekend-tinted</Field.Label>
        <Calendar
          value={date}
          onValueChange={setDate}
          // today={Temporal.PlainDate.from("2026-12-11")}
        >
          <Calendar.PeriodList>
            <Calendar.Prev>
              <ChevronLeftIcon />
            </Calendar.Prev>
            <Calendar.Period>
              <Calendar.Month />
              <Calendar.Week>
                <Calendar.Day
                  className={css({
                    "&[data-weekend]": { color: "bg.selection" },
                  })}
                />
              </Calendar.Week>
              <Calendar.Grid>
                <Calendar.Date
                  className={css({
                    "&[data-weekend]:not([aria-selected='true'])": {
                      color: "bg.selection",
                    },
                  })}
                />
              </Calendar.Grid>
            </Calendar.Period>
            <Calendar.Next>
              <ChevronRightIcon />
            </Calendar.Next>
          </Calendar.PeriodList>
        </Calendar>
      </Field>

      {/* The Figma composition (745:4382), reproduced: a wireframed form on the
          left and a LIVE calendar beside it. This is why the treatment is a
          scope rather than a flag — the calendar is simply a sibling of the
          wireframe, so it needs no opt-out of its own. A grid of dates barred
          into grey rectangles would read as noise, not as a calendar. */}
      <Field>
        <Field.Label>Wireframed label, live grid</Field.Label>
        <Wireframe className={css({ marginBottom: "md", width: "208px" })}>
          <TextInput label="Shift role" placeholder="Select a role" />
        </Wireframe>
        <Calendar value={date} onValueChange={setDate}>
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
        <Field.Hint>Select one or more dates for this shift</Field.Hint>
      </Field>
    </main>
  );
}
