"use client";

import { Fragment, useState, type ReactNode } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css } from "../../../styled-system/css";
import { ShiftFormShell } from "./shift-form-shell";
import { Field } from "@/components/ui/input/field";
import { DatePicker } from "@/components/ui/input/datepicker";
import { Switch } from "@/components/ui/input/switch";
import { OptionList } from "@/components/ui/input/option-list";
import { Notice } from "@/components/ui/notice";
import { weekdayOf, type WeekdayKey } from "@/utils/calendar-month";
import InfoIcon from "@/assets/icons/info.svg";

// ---------------------------------------------------------------------------
// Shift Scheduling — the showcase for the Notice primitive, in the context the
// design gives it: a "Post a Shift" scheduling form (Figma 684:1012 dark /
// 704:1605 light). A registry demo, so it renders bare content — the DemoFrame
// supplies the outer 960×640 bordered canvas surface, and `ShiftFormShell` the
// wireframe dialog chrome it shares with Shift Scheduling v2. Every part but
// the Notice is an existing library component — DatePicker, Switch, and
// OptionList.Toolbar (the weekday selector, used AS a field). The Notice at the
// foot of the form recomposes live from the current selections — its emphasized
// dates/weekdays are the `<strong>` runs the recipe steps up to full accent.
// ---------------------------------------------------------------------------

const WEEKDAYS: { key: WeekdayKey; letter: string; name: string }[] = [
  { key: "sun", letter: "S", name: "Sunday" },
  { key: "mon", letter: "M", name: "Monday" },
  { key: "tue", letter: "T", name: "Tuesday" },
  { key: "wed", letter: "W", name: "Wednesday" },
  { key: "thu", letter: "T", name: "Thursday" },
  { key: "fri", letter: "F", name: "Friday" },
  { key: "sat", letter: "S", name: "Saturday" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]; // prettier-ignore

// ISO dayOfWeek is 1 (Mon) … 7 (Sun).
const WEEKDAY_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
]; // prettier-ignore

/** "Tuesday, 11 August, 2026" — weekday, day, month, year (Figma order). */
function formatFull(date: Temporal.PlainDate): string {
  return `${WEEKDAY_NAMES[date.dayOfWeek - 1]}, ${date.day} ${MONTHS[date.month - 1]}, ${date.year}`;
}

/** Emphasized weekday names joined with commas and a trailing "and". */
function joinDays(names: string[]): ReactNode {
  return names.map((name, i) => (
    <Fragment key={name}>
      {i > 0 && (i === names.length - 1 ? " and " : ", ")}
      <strong>{name}</strong>
    </Fragment>
  ));
}

// No `gap` — the recurrence block carries its own top spacing so that spacing
// folds away WITH it. A parent gap would survive the collapse and leave a dead
// band above the bottom rule.
const fieldsStyle = css({
  display: "flex",
  flexDirection: "column",
  paddingBlock: "lg",
  borderBlockWidth: "token(spacing.xxs)",
  borderBlockStyle: "solid",
  borderColor: "color-mix(in srgb, var(--colors-neutral-500) 15%, transparent)",
});

const rowStyle = css({ display: "flex", gap: "xl" });
const rowCenterStyle = css({ alignItems: "center" });
const rowTopStyle = css({ alignItems: "flex-start" });
const dateFieldStyle = css({ width: "140px", flexShrink: 0 });

// The recurrence block — weekday toolbar, Last Shift, and the Notice — folds
// away as ONE region when the repeat switch is off, so the form resizes instead
// of snapping. Three nested elements, each owning one job:
//
//   • WRAPPER animates the height. `grid-template-rows: 1fr → 0fr` is the only
//     cross-browser way to transition to/from an intrinsic size (`height: auto`
//     needs `interpolate-size`, which is Chromium-only). `display` rides the
//     same transition under `allow-discrete`, so `none` lands at the very END of
//     the collapse and `grid` is restored at the START of the expand.
//   • CLIP supplies the `overflow: hidden` + `min-height: 0` the 0fr row needs to
//     actually crop its content. Safe for the DatePicker: its calendar portals
//     to document.body, so no ancestor clips it.
//   • CONTENT fades and rises 20px, and holds the block's own top spacing.
//
// The halves are deliberately offset so neither direction reads as a jump: on
// exit the content fades first (0→160ms) and the height follows (60→240ms); on
// entry the height opens first (0→180ms) and the content fades in behind it
// (80→240ms). Both directions land together at 240ms. The exit-side timings live
// in the `[data-collapsed='true']` blocks; the base values ARE the entry side.
//
// `@starting-style` is what makes the ENTRY animate at all: an element sitting
// at `display: none` was not rendered on the previous style change, so it has no
// before-change style and the browser starts NO transitions — the expand snaps
// back in a single frame. `_starting` supplies that missing origin (collapsed
// height + faded/raised content). It also fires the first time an element is
// rendered, i.e. on page load, which would play a spurious open animation on
// mount — hence the `[data-armed='true']` gate, false until the switch is first
// touched.
const recurrenceStyle = css({
  display: "grid",
  gridTemplateRows: "1fr",
  transitionProperty: "grid-template-rows, display",
  transitionDuration: "180ms",
  transitionTimingFunction: "ease-out",
  transitionDelay: "0s",
  transitionBehavior: "allow-discrete",
  "&[data-collapsed='true']": {
    gridTemplateRows: "0fr",
    display: "none",
    transitionDelay: "60ms",
  },
  _starting: {
    "&[data-armed='true'][data-collapsed='false']": { gridTemplateRows: "0fr" },
  },
});

const recurrenceClipStyle = css({ minHeight: 0, overflow: "hidden" });

const recurrenceContentStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "lg",
  paddingBlockStart: "lg",
  opacity: 1,
  translate: "0 0",
  transitionProperty: "opacity, translate",
  transitionDuration: "160ms",
  transitionTimingFunction: "ease-out",
  transitionDelay: "80ms",
  "[data-collapsed='true'] &": {
    opacity: 0,
    translate: "0 -20px",
    transitionDelay: "0s",
  },
  _starting: {
    "[data-armed='true'][data-collapsed='false'] &": {
      opacity: 0,
      translate: "0 -20px",
    },
  },
});

const switchFieldStyle = css({
  display: "flex",
  alignItems: "center",
  height: "token(spacing.4xl)",
  paddingInlineStart: "lg",
  borderInlineStartWidth: "token(spacing.xxs)",
  borderInlineStartStyle: "solid",
  borderColor: "color-mix(in srgb, var(--colors-neutral-500) 15%, transparent)",
});

// No gap: the label's line box sits directly above the frame, matching how the
// Field stacks its label over the input — so the weekday toolbar frame lines up
// with the sibling Last Shift input frame (Figma 684:1032 — label y=0, frame y=24).
const weekdaysGroupStyle = css({ display: "flex", flexDirection: "column" });

const weekdaysLabelStyle = css({
  textStyle: "bodySmall",
  color: "field.text.muted",
  whiteSpace: "nowrap",
});

const weekdaysFrameStyle = css({
  display: "inline-flex",
  alignItems: "center",
  height: "token(spacing.4xl)",
  paddingInline: "md",
  borderRadius: "sm",
  backgroundColor: "field.bg.default",
  boxShadow: "inset 0 0 0 0.5px var(--colors-field-border-default)",
  width: "fit-content",
});

const weekdaysToolbarStyle = css({ gap: "sm" });

const dayChipStyle = css({
  width: "token(sizes.toolbarButton)",
  height: "token(sizes.toolbarButton)",
  padding: "none",
  justifyContent: "center",
  textAlign: "center",
});

export function ShiftScheduling() {
  // The form opens on a plausible near-future run rather than on fixed dates:
  // tomorrow through a week later. Read from the clock ONCE and shared by both
  // seeds, so they can't land on either side of midnight, and lazily so the
  // read happens at mount rather than on every render.
  const [today] = useState(() => Temporal.Now.plainDateISO());
  const [firstShift, setFirstShift] = useState<Temporal.PlainDate | null>(() =>
    today.add({ days: 1 }),
  );
  const [lastShift, setLastShift] = useState<Temporal.PlainDate | null>(() =>
    today.add({ days: 8 }),
  );
  const [repeat, setRepeat] = useState(true);
  // Seeded with the weekday the first shift itself falls on — the one repeat a
  // shift on that date implies, so the form opens already describing something
  // true rather than an arbitrary pair. Seeded ONLY: re-dating the first shift
  // later leaves the toolbar alone, because by then the weekdays are the user's
  // answer and not ours to overwrite.
  const [days, setDays] = useState<Set<WeekdayKey>>(
    () => new Set(firstShift ? [weekdayOf(firstShift)] : []),
  );
  // Arms the recurrence block's @starting-style once the switch is first
  // touched, so the entry animation can't fire on the initial render.
  const [armed, setArmed] = useState(false);

  const toggleDay = (key: WeekdayKey) =>
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selectedNames = WEEKDAYS.filter((d) => days.has(d.key)).map(
    (d) => d.name,
  );
  // Deliberately NOT gated on `repeat`: the Notice now collapses along with the
  // rest of the recurrence block, so folding the clause out on `repeat: false`
  // would only re-flow the sentence under the reader mid-fade. The clause still
  // drops when the block is VISIBLE but no weekday is selected.
  const repeating = selectedNames.length > 0;

  return (
    <ShiftFormShell>
      {/* Interactive scheduling section — the real components + the Notice. */}
      <div className={fieldsStyle}>
        <div className={`${rowStyle} ${rowCenterStyle}`}>
          <Field className={dateFieldStyle}>
            <Field.Label>{repeat ? "First Shift" : "Shift Date"}</Field.Label>
            <DatePicker value={firstShift} onValueChange={setFirstShift} />
            <Field.Hint>dd/mm/yyyy</Field.Hint>
          </Field>
          <div className={switchFieldStyle}>
            <Field size="lg">
              <Switch
                checked={repeat}
                onCheckedChange={(next) => {
                  setArmed(true);
                  setRepeat(next);
                }}
              />
              <Field.Label>Repeat this shift on other days</Field.Label>
            </Field>
          </div>
        </div>

        <div
          className={recurrenceStyle}
          data-testid="recurrence"
          data-collapsed={!repeat}
          data-armed={armed}
          inert={!repeat}
        >
          <div className={recurrenceClipStyle}>
            <div className={recurrenceContentStyle}>
              <div className={`${rowStyle} ${rowTopStyle}`}>
                <div className={weekdaysGroupStyle}>
                  <span className={weekdaysLabelStyle}>
                    Repeat Every Week On
                  </span>
                  <div className={weekdaysFrameStyle}>
                    <OptionList direction="inline">
                      <OptionList.Toolbar
                        aria-label="Repeat on weekdays"
                        className={weekdaysToolbarStyle}
                      >
                        {WEEKDAYS.map((day, i) => (
                          <OptionList.Option
                            key={`${day.key}-${i}`}
                            pressed={days.has(day.key)}
                            aria-label={day.name}
                            className={dayChipStyle}
                            onClick={() => toggleDay(day.key)}
                          >
                            {day.letter}
                          </OptionList.Option>
                        ))}
                      </OptionList.Toolbar>
                    </OptionList>
                  </div>
                </div>
                <Field className={dateFieldStyle}>
                  <Field.Label>Last Shift</Field.Label>
                  <DatePicker value={lastShift} onValueChange={setLastShift} />
                  <Field.Hint>dd/mm/yyyy</Field.Hint>
                </Field>
              </div>

              {/* The star of the showcase — a live, self-describing Notice. */}
              <Notice role="status" aria-live="polite">
                <Notice.Icon>
                  <InfoIcon />
                </Notice.Icon>
                <Notice.Label>
                  This shift will start on{" "}
                  <strong>{firstShift ? formatFull(firstShift) : "—"}</strong>
                  {repeating && lastShift ? (
                    <>
                      {" "}
                      and repeat every {joinDays(selectedNames)} until{" "}
                      <strong>{formatFull(lastShift)}</strong>
                    </>
                  ) : null}
                  .
                </Notice.Label>
              </Notice>
            </div>
          </div>
        </div>
      </div>
    </ShiftFormShell>
  );
}
