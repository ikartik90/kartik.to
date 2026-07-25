"use client";

import { useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css } from "../../../../styled-system/css";
import { Calendar } from "@/components/ui/input/calendar";
import { Field } from "@/components/ui/input/field";
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
          // today={Temporal.PlainDate.from("2026-12-11")}
        >
          {/* Explicit parser — date navigation is opt-in; a bare Field.Search
              would be a dumb string match. */}
          <Field.Search
            placeholder="Type a date…"
            queryParser={parseCalendarDate("DD/MM/YYYY")}
          />
          <Calendar.Period>
            <Field.Action>
              <ChevronLeftIcon />
            </Field.Action>
            <Calendar.Heading />
            <Field.Action>
              <ChevronRightIcon />
            </Field.Action>
          </Calendar.Period>
          <Calendar.Week>
            <Calendar.Day />
          </Calendar.Week>
          <Calendar.Grid>
            <Calendar.Date />
          </Calendar.Grid>
        </Calendar>
        <Field.Hint>Pick a day for the trip</Field.Hint>
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
          <Calendar.Period>
            <Field.Action>
              <ChevronLeftIcon />
            </Field.Action>
            <Calendar.Heading />
            <Field.Action>
              <ChevronRightIcon />
            </Field.Action>
          </Calendar.Period>
          <Calendar.Week>
            <Calendar.Day
              className={css({ "&[data-weekend]": { color: "bg.selection" } })}
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
        </Calendar>
      </Field>
    </main>
  );
}
