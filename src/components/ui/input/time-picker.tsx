"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css, cx } from "../../../../styled-system/css";
import { timePicker, timePopover } from "../../../../styled-system/recipes";
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

// ---------------------------------------------------------------------------
// TimePicker — the Time field's control, composed INTO a <Field> exactly like
// DatePicker and Combobox (label + hint are the consumer's Field.Label /
// Field.Hint siblings, not props):
//
//   <Field>
//     <Field.Label>Shift start</Field.Label>
//     <TimePicker value={start} onValueChange={setStart} />
//     <Field.Hint>Local time</Field.Hint>
//   </Field>
//
// Collapsed, it renders the shared `field` frame (a button trigger + a
// decorative clock icon); the whole frame is the open target. Activated, it
// opens a popover that COVERS the frame (the `timePopover` anchor recipe, the
// clock sibling of datePopover / comboboxPopover) holding a type-ahead search
// over the day's slots.
//
// The list itself is an ordinary `OptionList` at `onBrand` — the design's rows
// ARE option rows, down to the 208px measure, the 32px pitch, the brand text
// and the neutral selected chip, so there is nothing here re-drawing them. What
// this file adds is the two things a list of TIMES has that a list of options
// does not: the rule where it crosses midnight, and the elapsed span beside
// each clock. The list is walked the way every other list in the app is —
// wheel, drag, arrows — rather than through chevrons of its own.
//
// ── The time difference ────────────────────────────────────────────────────
// `differenceFrom` is one knob doing one thing: ANCHOR the list. Given a start
// time, the list runs forward from it (across midnight, ruled where it crosses)
// and every row says how far it is from that start — which is what turns the
// same control into an END-time field. Omit it and the same component is a
// plain 12:00 AM → 11:30 PM day list with no durations and no day rule. So the
// two deployments the design asks for are the prop's two states, rather than a
// separate flag that can disagree with the list it annotates.
//
//   <TimePicker value={end} onValueChange={setEnd} differenceFrom={start} />
//
// ── Filtering ──────────────────────────────────────────────────────────────
// Unusually for an OptionList consumer, the QUERY is held here rather than in
// the list: the day rule is a child of the listbox, so whether to draw it is a
// question about which rows survived, and only the holder of the query can
// answer it. OptionList's own filter is handed a pass-through and the rows it
// receives are already the survivors — one filter, run once, in the one place
// that can act on the result.
//
// The field is sized by its consumer, like every other field in the library.
// The design draws it at `sizes.dateField` (140px) — the same width a date
// field takes, and for the same reason: room for the value and its trailing
// glyph, and no more.
// ---------------------------------------------------------------------------

const triggerClass = css({
  textAlign: "left",
  cursor: "pointer",
  // Placeholder colour (resting + active) is owned by the shared `field`
  // recipe's control slot, keyed off the `[data-placeholder]` sentinel.
});

// The list settles on WHOLE rows. It opens scrolled to its selection (see
// `OptionList.Listbox`), and centring lands on a fractional offset — so without
// this the popover's first row is cut through its own x-height, hard against
// the search strip above it, which reads as a rendering fault rather than as
// the half-row peek the recipe means at the foot. `proximity` rather than
// `mandatory`, so it tidies where a scroll comes to rest without dragging one
// that is still in flight.
//
// A `css()` override lands in the UTILITIES layer and so outranks the
// `optionList` recipe it narrows — the same trick `Field`'s text-style
// overrides use.
const listClass = css({ scrollSnapType: "y proximity" });

// The design's row gap (Figma 1204:10216), against the 8px an option spends on
// separating a leading icon from its label. A clock and its duration are one
// reading, not two things.
const optionClass = css({ gap: "sm", scrollSnapAlign: "start" });

/** OptionList filters nothing: the rows it is handed are already the survivors. */
const passThrough = (options: OptionItem[]) => options;

export interface TimePickerProps {
  /** Controlled selection. */
  value?: Temporal.PlainTime | null;
  /** Initial selection when uncontrolled. */
  defaultValue?: Temporal.PlainTime | null;
  /** Fired with the picked time. */
  onValueChange?: (time: Temporal.PlainTime) => void;
  /**
   * Anchor the list to a start time — an END-time field, listing what can
   * follow it. The list then begins one `step` after this time, runs a full day
   * forward (wrapping past midnight, ruled where it crosses), and every row
   * carries how far it is from the anchor ("+8 hours").
   *
   * Leave it off and the same control is a plain day list — midnight to
   * midnight, no durations, no day rule. That is the whole switch: the anchor
   * and the annotation are one decision, so a field can never show a duration
   * measured from a time its list is not actually running from.
   */
  differenceFrom?: Temporal.PlainTime | null;
  /** The grid the day is cut into, in minutes. Defaults to the design's 30. */
  step?: number;
  /**
   * Clock pattern driving the trigger's display, the popover rows, and the
   * type-ahead they are matched against — `h`/`hh` (12-hour), `H`/`HH`
   * (24-hour), `mm`, `A`/`a`, with whatever separators you like (see
   * `formatClockTime`). One pattern for all three, so the field can never list
   * one clock and read another.
   */
  format?: string;
  /** Shown in the trigger when nothing is selected. */
  placeholder?: string;
  /** Placeholder for the popover's type-ahead. */
  searchPlaceholder?: string;
  /** The rule drawn where an anchored list crosses midnight. */
  nextDayLabel?: string;
  /** Row shown when the type-ahead leaves nothing. */
  emptyLabel?: string;
  /**
   * Whether the popover renders in a `document.body` portal. On by default, so
   * it escapes an ancestor that clips or contains it (a DemoFrame).
   *
   * Turn it OFF inside a `position: fixed` surface, for the reason DatePicker
   * and Combobox carry the same escape hatch: CSS anchor positioning will not
   * accept an anchor whose containing-block chain does not pass through the
   * portalled popover's own containing block, and a fixed ancestor ends that
   * chain at the viewport. The surface must then not clip its overflow.
   */
  portal?: boolean;
}

/**
 * The Time control. Reads the field wiring (controlId to be the labelable
 * control, registerControl for the frame's focus-forward, focusControl to
 * restore focus on close) — so it must live inside a `<Field>`, like DatePicker.
 */
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
  const parts = timePicker();
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

  // The day's rows, in list order — `PlainTime.toString()` is the stable
  // identity selection compares on, and it round-trips through `from()`.
  const rows = useMemo(
    () =>
      timeSlots({ step, from: differenceFrom }).map((slot) => ({
        ...slot,
        key: slot.time.toString(),
        label: formatTime(slot.time),
      })),
    [step, differenceFrom, formatTime],
  );

  // The survivors of the type-ahead — on CLOCK rules rather than the option
  // list's default substring ones, which would let "2:30" match "12:30 AM" and
  // hand Enter a time ten hours from the one that was typed (see
  // `matchesClockQuery`).
  const visible = useMemo(
    () => rows.filter((row) => matchesClockQuery(row.label, query)),
    [rows, query],
  );

  // Flat, not nested: the day rule is a SIBLING of the rows it precedes, so
  // that `collectOptions` and the listbox's own child walk both see the options
  // exactly where they are.
  const options = useMemo(() => {
    const out: ReactNode[] = [];
    visible.forEach((row, i) => {
      // Once, at the crossing — and only if a row on the far side survived the
      // filter, which is why the query lives up here.
      if (row.nextDay && !visible[i - 1]?.nextDay) {
        out.push(
          <div key="next-day" role="presentation" className={parts.heading}>
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
          // The visible row says "12:00 AM" and leans on the rule above it and
          // the column beside it for the rest; a row read ALOUD has neither, so
          // it carries them itself.
          aria-label={
            [row.label, row.nextDay ? nextDayLabel : null, elapsed]
              .filter(Boolean)
              .join(", ") || undefined
          }
        >
          <span className={parts.label}>{row.label}</span>
          {elapsed && <span className={parts.elapsed}>{elapsed}</span>}
        </OptionList.Option>,
      );
    });
    return out;
  }, [visible, parts, nextDayLabel]);

  return (
    <>
      <Field.Frame
        // The whole frame is the open target — the decorative clock and the
        // frame's dead padding are non-interactive, so without this only a
        // direct hit on the value text would open it.
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
          // In the tab order explicitly, because WebKit's default one skips a
          // bare <button> — see `Button`. A field the keyboard cannot reach is
          // not a field.
          tabIndex={0}
          className={cx(styles.control, triggerClass)}
        >
          <WireframeText>{display || placeholder}</WireframeText>
        </button>
        <ClockIcon aria-hidden />
      </Field.Frame>

      {open && (
        <Popover
          className={timePopover()}
          role="dialog"
          ariaLabel="Choose time"
          portal={portal}
          onDismiss={close}
        >
          <OptionList
            value={selected ? selected.toString() : null}
            onValueChange={handleSelect}
            // Already filtered above — see the header note.
            filter={passThrough}
            emptyLabel={emptyLabel}
            tone="onBrand"
            // The list is scaled by the FIELD, like every other part of it (see
            // Combobox): a 28px trigger opening a menu on the 32px row pitch
            // would be the one place in the family where a size stopped at the
            // frame.
            size={size === "sm" ? "sm" : "md"}
          >
            <Field.Search
              autoFocus
              // Seeded for READING, not for filtering: the query starts empty,
              // so the popover opens showing the current time over the whole
              // day, and only becomes a filter once you actually type over it.
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
