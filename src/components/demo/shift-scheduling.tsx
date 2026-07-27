"use client";

import { Fragment, useState, type ReactNode } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css } from "../../../styled-system/css";
import { Field } from "@/components/ui/input/field";
import { DatePicker } from "@/components/ui/input/datepicker";
import { Switch } from "@/components/ui/input/switch";
import { OptionList } from "@/components/ui/input/option-list";
import { Notice } from "@/components/ui/notice";
import type { WeekdayKey } from "@/utils/calendar-month";
import InfoIcon from "@/assets/icons/info.svg";
import CrossIcon from "@/assets/icons/cross.svg";

// ---------------------------------------------------------------------------
// Shift Scheduling — the showcase for the Notice primitive, in the context the
// design gives it: a "Post a Shift" scheduling form (Figma 684:1012 dark /
// 704:1605 light). A registry demo, so it renders bare content — the DemoFrame
// supplies the outer 960×640 bordered canvas surface. Every part but the Notice
// is an existing library component — DatePicker, Switch, and OptionList.Toolbar
// (the weekday selector, used AS a field). The header and footer are
// non-interactive wireframe placeholders: plain bordered boxes whose torn edge
// (header bottom / footer top) is the Figma shim zigzag SVG on a wrapping
// container's ::after / ::before. The form surface's torn top+bottom stay a
// `clip-path` (8 triangular teeth, matching the shim pitch). The Notice at the foot of the form
// recomposes live from the current selections — its emphasized dates/weekdays
// are the `<strong>` runs the recipe steps up to full accent.
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
];

// ISO dayOfWeek is 1 (Mon) … 7 (Sun).
const WEEKDAY_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

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

// The torn surface edge: 8 triangular teeth (matching the Figma shim's 76.875px
// pitch) cut into the top and bottom of the form container, revealing the canvas
// behind. Percentages on x keep it width-independent; the 20px amplitude is
// absolute so the teeth stay a constant depth. Peaks land on the corners so the
// left/right edges stay straight and full-height.
function tornEdgesClip(teeth: number, amp: number): string {
  const segments = teeth * 2;
  const points: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const x = `${((i / segments) * 100).toFixed(3)}%`;
    points.push(`${x} ${i % 2 === 0 ? "0px" : `${amp}px`}`);
  }
  for (let i = segments; i >= 0; i--) {
    const x = `${((i / segments) * 100).toFixed(3)}%`;
    points.push(`${x} ${i % 2 === 0 ? "100%" : `calc(100% - ${amp}px)`}`);
  }
  return `polygon(${points.join(", ")})`;
}

const TORN_CLIP = tornEdgesClip(8, 20);

// The card stack — the DemoFrame provides the surrounding canvas frame. The
// sections abut directly (no gap); each section's own tear band (carried in its
// block padding) is the only space between the torn edges.
const stackStyle = css({
  display: "flex",
  flexDirection: "column",
  width: "615px",
  maxWidth: "token(spacing.full)",
});

// A 10%-neutral hairline — the wireframe sections' faint frame.
const wireBorder = "color-mix(in srgb, var(--colors-neutral-500) 10%, transparent)";

// The header is a plain wireframe box with top + side hairline borders; its torn
// BOTTOM edge is the Figma "bottom shim" zigzag (684:1019) painted on the wrapping
// container's `::after` — a 20px band stretched full-width directly below the
// header. Inlined as a data URI (a fixed neutral.500 @ 10% stroke, theme-neutral),
// the way the blockquote mark's mask is.
const headerStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  padding: "lg",
  borderStyle: "solid",
  borderColor: wireBorder,
  borderTopWidth: "token(spacing.xxs)",
  borderInlineWidth: "token(spacing.xxs)",
  borderBottomWidth: "token(spacing.none)",
});

const headerWrapStyle = css({
  "&::after": {
    content: '""',
    display: "block",
    height: "token(spacing.xxl)",
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg preserveAspectRatio='none' width='615.462' height='21.1273' viewBox='0 0 615.462 21.1273' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0.23079 0.563635L38.6683 20.5636L77.1058 0.563635L115.543 20.5636L153.981 0.563635L192.418 20.5636L230.856 0.563635L269.293 20.5636L307.731 0.563635L346.168 20.5636L384.606 0.563635L423.043 20.5636L461.481 0.563635L499.918 20.5636L538.356 0.563635L576.793 20.5636L615.231 0.563635' stroke='%23576675' stroke-opacity='0.1'/%3E%3C/svg%3E\")",
    backgroundSize: "100% 100%",
    backgroundRepeat: "no-repeat",
  },
});

const wireTitleStyle = css({
  flex: "1 1 0",
  minWidth: 0,
  fontSize: "1.25rem",
  lineHeight: "1.4",
  color: "field.text.placeholder",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const wireIconStyle = css({
  flexShrink: 0,
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  color: "field.text.placeholder",
  "& svg": { width: "token(spacing.full)", height: "token(spacing.full)", display: "block" },
});

// The interactive form surface — bg.surface with torn top & bottom edges. The
// block padding carries the 20px teeth allowance on top of the 16px inner inset.
const formStyle = css({
  backgroundColor: "bg.surface",
  paddingInline: "xl",
  paddingBlock: "calc(token(spacing.xxl) + token(spacing.xl))",
  clipPath: TORN_CLIP,
});

const fieldsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "lg",
  paddingBlock: "lg",
  borderBlockWidth: "token(spacing.xxs)",
  borderBlockStyle: "solid",
  borderColor: "color-mix(in srgb, var(--colors-neutral-500) 15%, transparent)",
});

const rowStyle = css({ display: "flex", gap: "xl" });
const rowCenterStyle = css({ alignItems: "center" });
const rowTopStyle = css({ alignItems: "flex-start" });
const dateFieldStyle = css({ width: "140px", flexShrink: 0 });

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

// Mirror of the header — a plain wireframe box with bottom + side hairline
// borders; its torn TOP edge is the Figma "top shim" zigzag (684:1057) on the
// wrapping container's `::before`, a 20px band directly above the footer. The
// shim is JUST the zigzag (the Figma export's left/right vertical corner rims are
// dropped — the side borders come only from the inner div, so the edge doesn't
// double up into the band, matching the header's rim-less bottom shim).
const footerStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "lg",
  borderStyle: "solid",
  borderColor: wireBorder,
  borderBottomWidth: "token(spacing.xxs)",
  borderInlineWidth: "token(spacing.xxs)",
  borderTopWidth: "token(spacing.none)",
});

const footerWrapStyle = css({
  "&::before": {
    content: '""',
    display: "block",
    height: "token(spacing.xxl)",
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg preserveAspectRatio='none' width='616' height='21.3874' viewBox='0 0 616 21.3874' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0.5 0.823798L38.9375 20.8238L77.375 0.823798L115.812 20.8238L154.25 0.823798L192.688 20.8238L231.125 0.823798L269.562 20.8238L308 0.823798L346.438 20.8238L384.875 0.823798L423.312 20.8238L461.75 0.823798L500.188 20.8238L538.625 0.823798L577.062 20.8238L615.5 0.823798' stroke='%23576675' stroke-opacity='0.1'/%3E%3C/svg%3E\")",
    backgroundSize: "100% 100%",
    backgroundRepeat: "no-repeat",
    // The Figma footer-top shim node is flipped in the layout, so its exported
    // path points the same way as the header's; mirror it vertically so the
    // torn edge points UP toward the form (matching the Figma render).
    transform: "scaleY(-1)",
  },
});

// Same box as the primary button (padding, radius, height) — just no fill.
const wireButtonStyle = css({
  textStyle: "bodyLarge",
  color: "field.text.placeholder",
  whiteSpace: "nowrap",
  display: "flex",
  alignItems: "center",
  height: "token(spacing.4xl)",
  paddingInline: "lg",
  borderRadius: "md",
});

const wirePrimaryButtonStyle = css({
  textStyle: "bodyLarge",
  color: "field.text.placeholder",
  whiteSpace: "nowrap",
  paddingInline: "lg",
  height: "token(spacing.4xl)",
  display: "flex",
  alignItems: "center",
  borderRadius: "md",
  backgroundColor: "color-mix(in srgb, var(--colors-neutral-500) 10%, transparent)",
});

export function ShiftScheduling() {
  const [firstShift, setFirstShift] = useState<Temporal.PlainDate | null>(
    Temporal.PlainDate.from("2026-08-11"),
  );
  const [lastShift, setLastShift] = useState<Temporal.PlainDate | null>(
    Temporal.PlainDate.from("2027-01-10"),
  );
  const [repeat, setRepeat] = useState(true);
  const [days, setDays] = useState<Set<WeekdayKey>>(new Set(["tue", "thu"]));

  const toggleDay = (key: WeekdayKey) =>
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selectedNames = WEEKDAYS.filter((d) => days.has(d.key)).map((d) => d.name);
  const repeating = repeat && selectedNames.length > 0;

  return (
    <div className={stackStyle}>
      {/* Non-interactive wireframe header — top/side borders, torn bottom shim. */}
      <div className={headerWrapStyle}>
        <div className={headerStyle}>
          <span className={wireTitleStyle}>Post a Shift</span>
          <span className={wireIconStyle} aria-hidden>
            <CrossIcon />
          </span>
        </div>
      </div>

      {/* Interactive scheduling section — the real components + the Notice. */}
      <div className={formStyle}>
        <div className={fieldsStyle}>
          <div className={`${rowStyle} ${rowCenterStyle}`}>
            <Field className={dateFieldStyle}>
              <Field.Label>First Shift</Field.Label>
              <DatePicker value={firstShift} onValueChange={setFirstShift} />
              <Field.Hint>dd/mm/yyyy</Field.Hint>
            </Field>
            <div className={switchFieldStyle}>
              <Field size="lg">
                <Switch checked={repeat} onCheckedChange={setRepeat} />
                <Field.Label>Repeat this shift on other days</Field.Label>
              </Field>
            </div>
          </div>

          <div className={`${rowStyle} ${rowTopStyle}`}>
            <div className={weekdaysGroupStyle}>
              <span className={weekdaysLabelStyle}>Repeat Every Week On</span>
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

      {/* Non-interactive wireframe footer — bottom/side borders, torn top shim. */}
      <div className={footerWrapStyle}>
        <div className={footerStyle}>
          <span className={wireButtonStyle}>Cancel</span>
          <span className={wirePrimaryButtonStyle}>Post Shift</span>
        </div>
      </div>
    </div>
  );
}
