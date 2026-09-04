"use client";

import { useMemo, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css, cx } from "../../../../styled-system/css";
import { datePopover } from "../../../../styled-system/recipes";
import type { WeekdayKey } from "@/utils/calendar-month";
import {
  DEFAULT_DATE_FORMAT,
  formatCalendarDate,
  parseCalendarDate,
} from "@/utils/calendar-date";
import { Popover } from "@/components/ui/popover";
import { Field, useField } from "./field";
import { Calendar } from "./calendar";
import CalendarIcon from "@/assets/icons/calendar.svg";
import ChevronLeftIcon from "@/assets/icons/chevron-left.svg";
import ChevronRightIcon from "@/assets/icons/chevron-right.svg";
import { WireframeText } from "../wireframe";

// ---------------------------------------------------------------------------
// DatePicker — the Date field's control, composed INTO a <Field> exactly like
// Switch and Calendar (label + hint are the consumer's Field.Label/Field.Hint
// siblings, not props):
//
//   <Field>
//     <Field.Label>Trip date</Field.Label>
//     <DatePicker value={date} onValueChange={setDate} />
//     <Field.Hint>Pick a day</Field.Hint>
//   </Field>
//
// Collapsed, it renders the shared `field` frame (a button trigger + a decorative
// calendar icon); the whole frame is the open target. Activated, it opens a
// popover that COVERS the frame (the `datePopover` anchor recipe) holding the
// composable Calendar with a search row on top. The trigger is the field's
// labelable control; focus moves into the search on open and returns to the
// trigger on close (select / Escape / outside-click).
// ---------------------------------------------------------------------------

const triggerClass = css({
  textAlign: "left",
  cursor: "pointer",
  // Placeholder colour (resting + active) is owned by the shared `field`
  // recipe's control slot, keyed off the `[data-placeholder]` sentinel — so it
  // recolors to the brand accent on focus/open like every other field control.
});

export interface DatePickerProps {
  /** Controlled selection. */
  value?: Temporal.PlainDate | null;
  /** Initial selection when uncontrolled. */
  defaultValue?: Temporal.PlainDate | null;
  /** Fired with the picked date. */
  onValueChange?: (date: Temporal.PlainDate) => void;
  /** Inclusive selectable bounds. */
  min?: Temporal.PlainDate;
  max?: Temporal.PlainDate;
  /** Which weekday sits in column 0. Defaults to Sunday. */
  weekStartsOn?: WeekdayKey;
  /**
   * Date pattern driving BOTH the trigger's display and the popover search's
   * type-ahead — `DD`, `MM` and `YYYY` in any order, with any separators (see
   * `formatCalendarDate` / `parseCalendarDate`). One pattern for both directions
   * means the field can never render one format and read another.
   */
  format?: string;
  /** Shown in the trigger when nothing is selected. */
  placeholder?: string;
  /**
   * Whether the popover renders in a `document.body` portal. On by default, so
   * it escapes an ancestor that clips or contains it (a DemoFrame).
   *
   * Turn it OFF inside a `position: fixed` surface. CSS anchor positioning will
   * not accept an anchor whose containing-block chain does not pass through the
   * portalled popover's own containing block — and a fixed ancestor ends that
   * chain at the viewport, so the trigger becomes unanchorable and the calendar
   * falls back to its static position at the foot of the document. Kept in
   * place, popover and trigger share a containing block and the anchor
   * resolves. The surface must then not clip its overflow (see
   * `colorPickerPopover`). The same escape hatch Combobox carries, for the same
   * reason.
   */
  portal?: boolean;
  /** Override "today" — primarily for tests/deterministic rendering. */
  today?: Temporal.PlainDate;
}

/**
 * The Date control. Reads the field wiring (controlId to be the labelable
 * control, registerControl for the frame's focus-forward, focusControl to
 * restore focus on close) — so it must live inside a `<Field>`, like Switch.
 */
export function DatePicker({
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  weekStartsOn,
  format = DEFAULT_DATE_FORMAT,
  placeholder = "Select date",
  portal = true,
  today,
}: DatePickerProps) {
  const { controlId, registerControl, focusControl, styles } =
    useField("DatePicker");
  const [open, setOpen] = useState(false);

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<Temporal.PlainDate | null>(
    defaultValue ?? null,
  );
  const selected = isControlled ? value ?? null : internal;

  const close = () => {
    setOpen(false);
    focusControl();
  };

  const handleSelect = (date: Temporal.PlainDate) => {
    if (!isControlled) setInternal(date);
    onValueChange?.(date);
    close();
  };

  const formatDate = useMemo(() => formatCalendarDate(format), [format]);
  const parseDate = useMemo(() => parseCalendarDate(format), [format]);
  const display = selected ? formatDate(selected) : "";

  return (
    <>
      <Field.Frame
        // The whole frame is the open target — the decorative calendar icon and
        // the frame's dead padding are pointer-events:none / non-interactive, so
        // without this only a direct hit on the value text would open it.
        onClick={() => setOpen(true)}
        className={css({ cursor: "pointer" })}
        style={{ anchorName: open ? "--date-popover" : undefined }}
      >
        <button
          ref={registerControl}
          id={controlId}
          type="button"
          data-control
          data-placeholder={display ? undefined : ""}
          aria-haspopup="dialog"
          aria-expanded={open}
          // In the tab order explicitly, because WebKit's default one skips a
          // bare <button> — see `Button`. A field the keyboard cannot reach is
          // not a field.
          tabIndex={0}
          className={cx(styles.control, triggerClass)}
        >
          <WireframeText>{display || placeholder}</WireframeText>
        </button>
        <CalendarIcon aria-hidden />
      </Field.Frame>

      {open && (
        <Popover
          className={datePopover()}
          role="dialog"
          ariaLabel="Choose date"
          portal={portal}
          onDismiss={close}
        >
          <Calendar
            value={selected}
            onValueChange={handleSelect}
            min={min}
            max={max}
            weekStartsOn={weekStartsOn}
            today={today}
            tone="onBrand"
            // The popover is at LEAST as wide as the field it covers
            // (`minWidth: anchor-size(width)`), and a field is usually wider
            // than a month's natural 208px — so without this the calendar hugs
            // its months and leaves the surplus as dead space in one corner of
            // the popover. `fluid` spends it in the GUTTERS instead: the period
            // grows to the list and each grid distributes what is left between
            // its seven tracks, so the day cell stays the 24px square the rest
            // of the system draws and only the space between the columns opens
            // up. Unconditional, because at the natural measure there is no
            // free space and the arithmetic is a no-op — a narrow field gets
            // exactly what it got before.
            fluid
            // Parser derived from the same `format` that drives the trigger's
            // display — one pattern, both directions. It lives on the Calendar
            // (which interprets the query), not the dumb search box.
            queryParser={parseDate}
          >
            <Field.Search
              autoFocus
              defaultValue={display}
              placeholder="Type a date…"
            />
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
        </Popover>
      )}
    </>
  );
}
