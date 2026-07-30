"use client";

import { useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css } from "../../../../styled-system/css";
import { DatePicker } from "@/components/ui/input/datepicker";
import { Field } from "@/components/ui/input/field";
import { Wireframe } from "@/components/ui/wireframe";

const captionStyle = css({ textStyle: "caption", color: "text.default/50" });
const columnStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "lg",
  width: "180px",
});

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
        // globals.css sets `main { flex-direction: column }`; state the row
        // explicitly so the declared flexWrap below is not a no-op.
        flexDirection: "row",
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

      {/* Wireframe: the trigger's frame and calendar icon stay; the formatted
          date becomes a bar of that date string's width. */}
      <div className={columnStyle}>
        <span className={captionStyle}>placeholder — inert</span>
        <Wireframe>
          <Field>
            <Field.Label>Trip date</Field.Label>
            <DatePicker
              defaultValue={Temporal.PlainDate.from("2026-12-11")}
              today={Temporal.PlainDate.from("2026-12-11")}
            />
            <Field.Hint>Click to open the calendar</Field.Hint>
          </Field>
        </Wireframe>
      </div>

      <div className={columnStyle}>
        <span className={captionStyle}>loading — shimmering</span>
        <Wireframe mode="loading">
          <Field>
            <Field.Label>Return date</Field.Label>
            <DatePicker
              placeholder="Select a date"
              today={Temporal.PlainDate.from("2026-12-11")}
            />
            <Field.Hint>No selection yet</Field.Hint>
          </Field>
        </Wireframe>
      </div>
    </main>
  );
}
