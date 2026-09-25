"use client";

import { useMemo, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css, cx } from "../../../../styled-system/css";
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

const triggerClass = css({
  textAlign: "left",
  cursor: "pointer",
});

export interface DatePickerProps {
  value?: Temporal.PlainDate | null;
  defaultValue?: Temporal.PlainDate | null;
  onValueChange?: (date: Temporal.PlainDate) => void;
  /** Inclusive selectable bounds. */
  min?: Temporal.PlainDate;
  max?: Temporal.PlainDate;
  weekStartsOn?: WeekdayKey;
  /** One pattern (`DD`, `MM`, `YYYY`) for both the trigger's display and the search's parsing. */
  format?: string;
  placeholder?: string;
  /** Set false inside a `position: fixed` surface, where a portalled popover cannot anchor. */
  portal?: boolean;
  /** Override "today", e.g. for tests. */
  today?: Temporal.PlainDate;
}

// `--date-popover` is set on the frame only while open, so exactly one element carries it.
const datePopoverStyle = css({
  // Absolute, not fixed: a fixed anchored popover lags its trigger by a frame on scroll. The
  // <body> is the scroll container, so absolute keeps both in one scrolled space.
  position: "absolute",
  zIndex: 50,
  positionAnchor: "--date-popover",
  top: "anchor(top)",
  left: "anchor(left)",
  minWidth: "anchor-size(width)",
  backgroundColor: "field.bg.popover",
  borderRadius: "sm",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  boxShadow:
    "inset 0 0 0 0.5px var(--colors-field-border-active), 0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
});

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
          // WebKit's default Tab order skips a bare <button>.
          tabIndex={0}
          className={cx(styles.control, triggerClass)}
        >
          <WireframeText>{display || placeholder}</WireframeText>
        </button>
        <CalendarIcon aria-hidden />
      </Field.Frame>

      {open && (
        <Popover
          className={datePopoverStyle}
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
            // The popover is at least the field's width; `fluid` spends the surplus in the gutters.
            fluid
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
