"use client";

import { useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css } from "../../../../styled-system/css";
import { DatePicker } from "@/components/ui/input/datepicker";
import { Field } from "@/components/ui/input/field";

/** Local-only preview route for the assembled Date input (trigger + popover). */
export default function DatePickerPreviewPage() {
  const [date, setDate] = useState<Temporal.PlainDate | null>(
    Temporal.PlainDate.from("2026-12-11"),
  );

  return (
    <main
      className={css({
        minHeight: "100dvh",
        backgroundColor: "bg.canvas",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: "5xl",
        padding: "5xl",
        flexWrap: "wrap",
      })}
    >
      {/* Controlled, with a value — label + hint outside, like Calendar/Switch. */}
      <Field className={css({ width: "180px" })}>
        <Field.Label>Trip date</Field.Label>
        <DatePicker
          value={date}
          onValueChange={setDate}
          today={Temporal.PlainDate.from("2026-12-11")}
        />
        <Field.Hint>Click to open the calendar</Field.Hint>
      </Field>

      {/* Empty → placeholder. */}
      <Field className={css({ width: "180px" })}>
        <Field.Label>Return date</Field.Label>
        <DatePicker
          placeholder="Select a date"
          min={Temporal.PlainDate.from("2026-12-01")}
          today={Temporal.PlainDate.from("2026-12-11")}
        />
        <Field.Hint>No selection yet</Field.Hint>
      </Field>
    </main>
  );
}
