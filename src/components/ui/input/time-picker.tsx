"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css, cx } from "../../../../styled-system/css";
import { Popover } from "@/components/ui/popover";
import { Field, useField } from "./field";
import { OptionList } from "./option-list";
import type { OptionItem } from "@/utils/option-filter";
import {
  DEFAULT_TIME_FORMAT,
  formatClockTime,
  formatElapsed,
  matchesClockQuery,
  timeSlots,
} from "@/utils/clock-time";
import ClockIcon from "@/assets/icons/clock.svg";
import { WireframeText } from "../wireframe";

const triggerClass = css({
  textAlign: "left",
  cursor: "pointer",
});

// Snaps to whole rows: centring on the selection lands on a fractional offset, cutting the top row.
// `proximity` leaves a scroll still in flight alone.
const listClass = css({ scrollSnapType: "y proximity" });

const optionClass = css({ gap: "sm", scrollSnapAlign: "start" });

/** The query is filtered here: only its holder knows whether the day rule survives. */
const passThrough = (options: OptionItem[]) => options;

export interface TimePickerProps {
  value?: Temporal.PlainTime | null;
  defaultValue?: Temporal.PlainTime | null;
  onValueChange?: (time: Temporal.PlainTime) => void;
  /** Anchors the list to a start time: it runs a day forward from it, each row showing the elapsed span. */
  differenceFrom?: Temporal.PlainTime | null;
  /** In minutes. */
  step?: number;
  /** One clock pattern (`h`/`HH`, `mm`, `A`) for the trigger, the rows and the type-ahead. */
  format?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  /** The rule drawn where an anchored list crosses midnight. */
  nextDayLabel?: string;
  emptyLabel?: string;
  /** Set false inside a `position: fixed` surface, where a portalled popover cannot anchor. */
  portal?: boolean;
}

// Its own anchor name: date, select and time fields in one form would otherwise share one.
const timePopoverStyle = css({
  // Absolute, not fixed: a fixed anchored popover lags its trigger on scroll.
  position: "absolute",
  zIndex: 50,
  positionAnchor: "--time-popover",
  top: "anchor(top)",
  left: "anchor(left)",
  width: "token(sizes.optionListWidth)",
  minWidth: "anchor-size(width)",
  backgroundColor: "field.bg.popover",
  borderRadius: "sm",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  boxShadow:
    "inset 0 0 0 0.5px var(--colors-field-border-active), 0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
});

const timePickerHeadingStyle = css({
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  height: "token(sizes.calendarDay)",
  paddingInline: "sm",
  textStyle: "sidenote",
  color: "field.text.active",
  opacity: 0.5,
  whiteSpace: "nowrap",
  userSelect: "none",
});

const timePickerLabelStyle = css({
  flex: "1 1 0",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const timePickerElapsedStyle = css({
  flexShrink: 0,
  textStyle: "sidenote",
  opacity: 0.5,
  whiteSpace: "nowrap",
});

export function TimePicker({
  value,
  defaultValue,
  onValueChange,
  differenceFrom,
  step = 30,
  format = DEFAULT_TIME_FORMAT,
  placeholder = "Select time",
  searchPlaceholder = "Type a time…",
  nextDayLabel = "Next Day",
  emptyLabel,
  portal = true,
}: TimePickerProps) {
  const { controlId, size, registerControl, focusControl, styles } =
    useField("TimePicker");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<Temporal.PlainTime | null>(
    defaultValue ?? null,
  );
  const selected = isControlled ? (value ?? null) : internal;

  const close = () => {
    setOpen(false);
    focusControl();
  };

  const formatTime = useMemo(() => formatClockTime(format), [format]);
  const display = selected ? formatTime(selected) : "";

  const handleSelect = (key: string) => {
    const time = Temporal.PlainTime.from(key);
    if (!isControlled) setInternal(time);
    onValueChange?.(time);
    close();
  };

  // Keyed by `PlainTime.toString()`, which round-trips through `from()` in handleSelect.
  const rows = useMemo(
    () =>
      timeSlots({ step, from: differenceFrom }).map((slot) => ({
        ...slot,
        key: slot.time.toString(),
        label: formatTime(slot.time),
      })),
    [step, differenceFrom, formatTime],
  );

  // Clock rules, not substring ones, which would let "2:30" match "12:30 AM".
  const visible = useMemo(
    () => rows.filter((row) => matchesClockQuery(row.label, query)),
    [rows, query],
  );

  // Flat: the day rule is a sibling, so `collectOptions` sees every option where it is.
  const options = useMemo(() => {
    const out: ReactNode[] = [];
    visible.forEach((row, i) => {
      if (row.nextDay && !visible[i - 1]?.nextDay) {
        out.push(
          <div key="next-day" role="presentation" className={timePickerHeadingStyle}>
            {nextDayLabel}
          </div>,
        );
      }
      const elapsed = row.elapsed === null ? null : formatElapsed(row.elapsed);
      out.push(
        <OptionList.Option
          key={row.key}
          value={row.key}
          label={row.label}
          className={optionClass}
          aria-label={
            [row.label, row.nextDay ? nextDayLabel : null, elapsed]
              .filter(Boolean)
              .join(", ") || undefined
          }
        >
          <span className={timePickerLabelStyle}>{row.label}</span>
          {elapsed && <span className={timePickerElapsedStyle}>{elapsed}</span>}
        </OptionList.Option>,
      );
    });
    return out;
  }, [visible, nextDayLabel]);

  return (
    <>
      <Field.Frame
        onClick={() => setOpen(true)}
        className={css({ cursor: "pointer" })}
        style={{ anchorName: open ? "--time-popover" : undefined }}
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
        <ClockIcon aria-hidden />
      </Field.Frame>

      {open && (
        <Popover
          className={timePopoverStyle}
          role="dialog"
          ariaLabel="Choose time"
          portal={portal}
          onDismiss={close}
        >
          <OptionList
            value={selected ? selected.toString() : null}
            onValueChange={handleSelect}
            filter={passThrough}
            emptyLabel={emptyLabel}
            tone="onBrand"
            // Scaled by the field; the list has two sizes, so `lg` takes `md`.
            size={size === "sm" ? "sm" : "md"}
          >
            <Field.Search
              autoFocus
              // Seeded for reading: the query starts empty, so the whole day shows until you type.
              defaultValue={display}
              placeholder={searchPlaceholder}
              onValueChange={setQuery}
            />
            <OptionList.Listbox className={listClass}>
              {options}
            </OptionList.Listbox>
          </OptionList>
        </Popover>
      )}
    </>
  );
}
