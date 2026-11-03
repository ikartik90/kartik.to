"use client";

import { Fragment, useCallback, useEffect, useId, useRef, useState } from "react";
import { css } from "../../../../styled-system/css";
import { useControllable, useOpen } from "./controllable";
import { DAY, clock, parseClock } from "./data";
import { useListKeys } from "./dropdown";
import { TIME_PICKER } from "./copy";
import { Field, Presence, Typography, boxRaw, enterRaw, popoverSidesRaw, useField, useHang } from "./ui";
import ClockIcon from "./assets/icons/medium/clock.svg";
import ChevronUpIcon from "./assets/chevron-up.svg";
import ChevronDownIcon from "./assets/chevron-down-small.svg";

// SW Curie's Time Picker v2 (21132:22411): a 125 × 40 field over a list of 15-minute rows, five rows in view. The
// field also takes a typed time, for the minutes between rows, and turns to its Alert state when that isn't a time.

const ROW = 30;
const GAP = 5;
const LABEL = 20;
const TIMES = Array.from({ length: 96 }, (_, i) => i * 15);

const anchorStyle = css({ position: "relative", display: "flex", width: "7.75rem" });

// The clock takes the state's colour.
const boxStyle = css(boxRaw, { flex: "1 1 auto" });

const popoverStyle = css(enterRaw, popoverSidesRaw, {
  zIndex: 3,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  width: "var(--sw-width-dropdown)",
  padding: "var(--sw-padding-md)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)",
  outline: "2px solid var(--sw-outline-focus)",
});

const stepStyle = css({ display: "flex", cursor: "pointer" });

// Literal sizes: Panda can't extract ones worked out from ROW and GAP.
const listStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xs)",
  width: "100%",
  height: "10.5rem",
  overflowY: "auto",
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" },
});

const rowStyle = css({
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  height: "1.75rem",
  paddingInline: "var(--sw-padding-sm)",
  borderRadius: "var(--sw-radius-xs)",
  color: "var(--sw-glyph-default)",
  textAlign: "start",
  justifyContent: "space-between",
  cursor: "pointer",
  "&:is(:hover, [data-keyed]):not([aria-selected=true])": { backgroundColor: "var(--sw-hover-shade)" },
  "& > [data-typography]": { color: "var(--sw-glyph-subdued)" },
  "&[aria-selected=true]": {
    backgroundColor: "var(--sw-surface-selected)",
    color: "var(--sw-glyph-selected)",
    "& > [data-typography]": { color: "inherit" },
  },
});

const nextDayStyle = css({ flexShrink: 0, paddingInline: "var(--sw-padding-sm)", color: "var(--sw-glyph-subdued)" });

interface TimePickerProps {
  /** Held by its owner; left out, the picker holds the time picked, from `defaultValue`. */
  value?: number;
  defaultValue?: number;
  /** Where the list rests when nothing is picked; its first time unless given. */
  around?: number;
  /** Figma's Time Difference: the time its list runs a day on from, each time with how long after it falls. */
  since?: number;
  onChange?: (minutes: number) => void;
  /** Whether the field holds something typed that isn't a time. */
  onInvalid?: (invalid: boolean) => void;
  disabled?: boolean;
  /** Opens with its list showing, as the design system shows the Active state. */
  defaultOpen?: boolean;
  "aria-label"?: string;
}

/**
 * Molecules/Form/Time Picker v2: its box, and its times under it, or over it where there's no room below. Something
 * typed that isn't a time turns its field to Alert, its hint saying so.
 */
function TimePickerRoot({
  value: held,
  defaultValue,
  around: given,
  since,
  onChange: heard,
  onInvalid,
  disabled: off,
  defaultOpen = false,
  "aria-label": label,
}: TimePickerProps) {
  const [value, onChange] = useControllable<number | undefined>(held, defaultValue, (minutes) => {
    if (minutes !== undefined) heard?.(minutes);
  });
  const [first] = useState(held ?? defaultValue ?? 0);
  // Measured from `since`, a time lands in the day after it.
  const around = given ?? (since === undefined ? first : since + DAY / 2);
  const times = since === undefined ? TIMES : TIMES.map((_, i) => since + (i + 1) * 15);
  const midnight = since === undefined ? -1 : times.findIndex((minutes) => minutes % DAY === 0);
  const { open, setOpen, outside } = useOpen(defaultOpen);
  // What's typed in the field, until it's set or abandoned.
  const [draft, setDraft] = useState<string | null>(null);
  // Whether Enter or leaving the field has found the draft isn't a time; from then on it's checked as it's typed.
  const [checked, setChecked] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const id = useId();

  // A time of day on the day nearest `around`, so one past midnight reads as the shift's next day.
  const near = (minutes: number) => minutes + DAY * Math.round((around - minutes) / DAY);
  const typed = draft === null ? null : parseClock(draft, around);
  const known = typed ?? value;
  const shown = known === undefined ? undefined : near(known);
  const invalid = checked && draft !== null && typed === null;
  const field = useField({ active: open, error: invalid ? TIME_PICKER.invalid : undefined });
  const disabled = off ?? field.disabled;
  const { side, style, hang, mark } = useHang(root, popover, open);

  useEffect(() => onInvalid?.(invalid), [invalid, onInvalid]);

  // A time is set; nothing typed puts the last one back; anything else stays, in the Alert state, selected to retype.
  const set = () => {
    if (draft === null) return;
    if (typed === null && draft.trim()) {
      setChecked(true);
      input.current?.select();
      return;
    }
    if (typed !== null) onChange(near(typed));
    setDraft(null);
    setChecked(false);
  };
  const close = useCallback(() => {
    setDraft(null);
    setChecked(false);
    setOpen(false);
  }, [setOpen]);

  // Where the shown time, or the shift's start, falls among the rows: between two for a time between them.
  const rest =
    since === undefined ? ((((shown ?? around) % DAY) + DAY) % DAY) / 15 : ((shown ?? since) - since) / 15 - 1;

  // That row in the middle; a time between rows rests on the one before.
  useEffect(() => {
    if (!open || !list.current) return;
    const index = Math.max(0, Math.floor(rest));
    const label = midnight >= 0 && midnight <= index ? LABEL + GAP : 0;
    list.current.scrollTop = Math.max(0, index * (ROW + GAP) + label - 2 * (ROW + GAP));
  }, [open, rest, midnight]);

  useEffect(() => {
    if (!open || !outside) return;
    const away = (event: PointerEvent) => {
      const at = event.target as Node;
      if (!root.current?.contains(at) && !popover.current?.contains(at)) setOpen(false);
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [open, outside, setOpen]);

  // The overlay's dialog takes Escape first and passes it on as this event (prototype-overlay).
  useEffect(() => {
    const node = popover.current;
    if (!open || !node) return;
    node.addEventListener("escape-layer", close);
    return () => node.removeEventListener("escape-layer", close);
  }, [open, close]);

  const keys = useListKeys(list, open, () => setOpen(true), { typed: draft ?? "", from: rest });

  const step = (rows: number) =>
    list.current?.scrollBy({ top: rows * (ROW + GAP), behavior: "smooth" });

  const picker = (
    <div ref={root} className={anchorStyle} data-anchor="">
      <Typography
        tag="div"
        variant="bodyLarge"
        className={boxStyle}
        data-box=""
        data-state={disabled ? undefined : invalid && !field.field ? "alert" : field.state}
        data-disabled={disabled ? "" : undefined}
        onPointerDown={(event) => {
          if (disabled) return;
          setOpen(true);
          // Focus and select it whole, so typing replaces the time; a click inside it once focused places the caret.
          if (event.target === input.current && document.activeElement === input.current) return;
          event.preventDefault();
          input.current?.focus();
          input.current?.select();
        }}
      >
        <input
          ref={input}
          id={field.id ?? id}
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={`${id}-times`}
          aria-invalid={invalid || undefined}
          aria-describedby={field.hintId ?? (invalid ? `${id}-alert` : undefined)}
          aria-autocomplete="none"
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          value={draft ?? (value === undefined ? "" : clock(value))}
          onFocus={(event) => {
            event.currentTarget.select();
            setOpen(true);
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
          }}
          onBlur={set}
          onKeyDown={(event) => {
            if (keys(event) || event.key !== "Enter") return;
            event.preventDefault();
            set();
            setOpen(false);
          }}
        />
        <ClockIcon aria-hidden />
      </Typography>
      {hang(
        <Presence>
          {open && (
            <div ref={popover} className={popoverStyle} style={style} {...mark} data-side={side} data-escape-layer="">
              <button type="button" className={stepStyle} aria-label="Earlier" onClick={() => step(-3)}>
                <ChevronUpIcon aria-hidden />
              </button>
              <div
                ref={list}
                id={`${id}-times`}
                className={listStyle}
                role="listbox"
                aria-label={label}
                aria-labelledby={field.labelId}
              >
                {times.map((minutes, i) => (
                  <Fragment key={minutes}>
                    {i === midnight && (
                      <Typography variant="metadata" className={nextDayStyle}>
                        Next Day
                      </Typography>
                    )}
                    <Typography
                      tag="button"
                      variant="bodyLarge"
                      type="button"
                      role="option"
                      aria-selected={near(minutes) === shown}
                      data-time={minutes}
                      className={rowStyle}
                      onClick={() => {
                        onChange(near(minutes));
                        close();
                      }}
                    >
                      {clock(minutes)}
                      {since !== undefined && " "}
                      {since !== undefined && (
                        <Typography variant="metadata">{`+${Math.round((minutes - since) / 0.6) / 100} hours`}</Typography>
                      )}
                    </Typography>
                  </Fragment>
                ))}
              </div>
              <button type="button" className={stepStyle} aria-label="Later" onClick={() => step(3)}>
                <ChevronDownIcon aria-hidden />
              </button>
            </div>
          )}
        </Presence>,
      )}
    </div>
  );
  // In a field without a hint, it says what's wrong in a hint of its own.
  return invalid && !field.hintId ? (
    <>
      {picker}
      <Field.HintText tone="alert" id={`${id}-alert`} role="alert">
        {TIME_PICKER.invalid}
      </Field.HintText>
    </>
  ) : (
    picker
  );
}
TimePickerRoot.displayName = "TimePicker";

export const TimePicker = TimePickerRoot;
