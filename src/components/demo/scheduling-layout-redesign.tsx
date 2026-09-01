"use client";

import { css } from "../../../styled-system/css";
import { ShiftFormFields } from "./shift-form-fields";
import { RedesignDiagram, type DiagramRedline } from "./redesign-diagram";
import type { DemoProps } from "./registry";
import { Field } from "@/components/ui/input/field";
import { Skeleton, Wireframe } from "@/components/ui/wireframe";
import ChevronLeftIcon from "@/assets/icons/chevron-left.svg";
import ChevronRightIcon from "@/assets/icons/chevron-right.svg";

// ---------------------------------------------------------------------------
// Scheduling Layout Redesign — the "Post a Shift" form's SHAPE, before and
// after (Figma 1143:6560: 1137:5962 / 1135:5310 before, 1137:5924 / 1135:4713
// after). Two arrangements of the same screen, on one toggle.
//
// Everything about HOW a comparison like this is shown — the toggle, the
// cropped card, the cross-fade, the redlines and what a narrowing frame takes
// from them — lives in `RedesignDiagram`, which this and the Position Fields
// Consolidation demo both stage themselves on. What is left here is only the
// argument.
//
// BEFORE is the old screen with its two concerns bracketed in red: describing
// the shift down the left, scheduling it in a 208px box exiled to the right,
// both of them running off the bottom of a card that cannot hold them. AFTER
// answers the redlines directly — the two brackets become the first two of
// three steps, and the calendar that was a column is now a full-width strip.
// The first two step names are literally the two redline labels, which is the
// whole point and is pinned by a test rather than left to a reader to notice.
// ---------------------------------------------------------------------------

/**
 * The three steps the redesign splits the screen into. The first two ARE the
 * before-state's two redlines, in order — `state` is what the Figma paints:
 * `done` and `current` both carry the accent rule, and only `current` takes the
 * accent type as well (1137:5936–5944).
 */
const STEPS = [
  { name: "Shift Information", state: "done" },
  { name: "Shift Planning", state: "current" },
  { name: "Review Shift Summary", state: "pending" },
] as const;

// The card body's height (Figma 1137:5945 / 1137:5977).
const BODY_HEIGHT = 190;

/**
 * The two concerns the old screen crams together, bracketed on the side each
 * sits on. Both open level with the first field they annotate — the header's
 * 52px plus the body's own 16px inset — and both run on into dots, because the
 * card crops them rather than ending them (1135:5645 + 1135:5652: a 118px
 * spine, a 2px break, then a 44px dotted run-on, with the leader tick halfway
 * down the spine).
 */
const REDLINES: DiagramRedline[] = [
  {
    label: "Shift Information",
    side: "start",
    top: 68,
    spine: 118,
    tail: 44,
    attach: 59,
  },
  {
    label: "Shift Planning",
    side: "end",
    top: 68,
    spine: 118,
    tail: 44,
    attach: 59,
  },
];

// --- The old arrangement ---------------------------------------------------

// The old body leaves upward and the new one arrives from above, so at no point
// are the two crossing in opposite directions — one is on its way out of the
// top of the card and the other is following it in.
const beforePaneStyle = css({
  display: "flex",
  alignItems: "flex-start",
  // 28px, not the neighbouring 3xl: it is what splits the 583px of content into
  // the Figma's 347 ∣ 208 columns (1137:5977), and rounding it up to 32 takes
  // those 4px off the field column, which is the half that has to stretch.
  gap: "28px",
  padding: "xl",
  "&[data-presented=false]": { transform: "translateY(-12px)" },
});

const fieldColumnStyle = css({
  flex: "1 1 0",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "lg",
});

// The calendar's exile, at the width it was exiled to: the Calendar recipe's
// own single-month measure (7 × 24px cells + 6 × 4px gutters + 2 × 8px padding).
// It is a PLACEHOLDER rather than the live grid v0 stages, because here the
// calendar is not the subject — the fact that it is over here at all is.
const calendarColumnStyle = css({
  width: "208px",
  flexShrink: 0,
});

const calendarPlaceholderStyle = css({
  // Runs past the crop, exactly as the fields beside it do.
  height: "174px",
  alignItems: "flex-start",
  gap: "md",
  // The Field frame's own inset is a one-line control's (0 ∣ 8px); this box
  // holds a month header, so it takes the Figma's 8 ∣ 12 (1137:6013).
  paddingBlock: "md",
  paddingInline: "lg",
});

const monthNavStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "sm",
  marginInlineStart: "auto",
  color: "field.text.default",
  "& svg": {
    display: "block",
    width: "token(spacing.xxl)",
    height: "token(spacing.xxl)",
  },
});

// --- The new arrangement ---------------------------------------------------

const afterPaneStyle = css({
  display: "flex",
  flexDirection: "column",
});

const stepsStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "lg",
  paddingInline: "xl",
  paddingTop: "xl",
  listStyle: "none",
});

// One step: an eyebrow over a name over the rule that carries its state. The
// rule is `border-bottom` on the step itself rather than a drawn bar, so it
// spans exactly the step's share of the row and re-divides itself when the
// three of them are given a narrower card.
const stepStyle = css({
  flex: "1 1 0",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "xs",
  paddingInline: "sm",
  paddingBottom: "md",
  borderBottomWidth: "token(spacing.xs)",
  borderBottomStyle: "solid",
  transitionProperty: "opacity, transform",
  transitionDuration: "260ms",
  transitionTimingFunction: "ease-out",
  // Steps behind and at the cursor have been earned; the one ahead has not.
  "&[data-state=done], &[data-state=current]": {
    borderBottomColor: "field.text.active",
  },
  "&[data-state=pending]": { borderBottomColor: "field.text.muted" },
  // They arrive one after another, left to right, which is the order they are
  // meant to be read in and the order the form now runs in.
  "[data-presented=false] &": { opacity: 0, transform: "translateY(-12px)" },
  "&:nth-child(2)": { transitionDelay: "60ms" },
  "&:nth-child(3)": { transitionDelay: "120ms" },
});

const stepEyebrowStyle = css({
  textStyle: "sidenote",
  color: "text.body",
  whiteSpace: "nowrap",
  "[data-state=current] &": { color: "field.text.active" },
  "[data-state=pending] &": { color: "field.text.muted" },
});

const stepNameStyle = css({
  textStyle: "bodySmall",
  color: "field.text.default",
  "[data-state=current] &": { color: "field.text.active" },
  "[data-state=pending] &": { color: "field.text.muted" },
});

// The calendar, no longer a column: one strip the full width of the form, with
// the months side by side. It sits under the steps at a quarter strength
// because it is the RESULT of the redesign rather than the redesign itself —
// the steps are what there is to look at (Figma 1137:5945).
const monthStripStyle = css({
  position: "relative",
  paddingInline: "xl",
  paddingBlock: "lg",
  transitionProperty: "opacity",
  transitionDuration: "260ms",
  transitionDelay: "120ms",
  transitionTimingFunction: "ease-out",
  "[data-presented=false] &": { opacity: 0 },
});

const monthStripFrameStyle = css({
  height: "94px",
  alignItems: "flex-start",
  gap: "md",
  // Same inset as the calendar box it replaces (Figma 1137:5948).
  paddingBlock: "md",
  paddingInline: "lg",
});

const monthStyle = css({
  flex: "1 1 0",
  minWidth: 0,
  display: "flex",
  justifyContent: "center",
});

// The strip's nav sits on the card's own inset, flanking all three months
// rather than any one of them — the point of the strip being that you no longer
// page a single month at a time.
const stripNavStyle = css({
  position: "absolute",
  top: "58px",
  color: "field.text.default",
  "&[data-side=start]": { insetInlineStart: "xl" },
  "&[data-side=end]": { insetInlineEnd: "xl" },
  "& svg": {
    display: "block",
    width: "token(spacing.xxl)",
    height: "token(spacing.xxl)",
  },
});

/** The three months the strip shows at once — names, so the bars measure. */
const MONTHS = ["August", "September 2026", "October"];

export function SchedulingLayoutRedesign({ aspect = "2/1" }: DemoProps = {}) {
  return (
    <RedesignDiagram
      ariaLabel="Scheduling form layout"
      bodyHeight={BODY_HEIGHT}
      // Its subject is the form's overall SHAPE, read from the top down, and it
      // never reaches the action bar — so the card ends at a tear rather than
      // promising a bottom it does not have.
      cropped
      aspect={aspect}
      redlines={REDLINES}
      /* BEFORE — two concerns, one screen, both running off the bottom. */
      before={{
        className: beforePaneStyle,
        // Both of its columns run off the bottom of a card that cannot hold
        // them, which is what the redlines are pointing at.
        overflows: true,
        children: (
          <>
            <Wireframe className={fieldColumnStyle} opacity={50}>
              <ShiftFormFields />
            </Wireframe>

            {/* Held at the same strength as the fields, unlike v0's live
              calendar: the comparison is between two ARRANGEMENTS, and
              putting one half of this one in focus would be judging it. */}
            <Wireframe className={calendarColumnStyle} opacity={50}>
              <Field>
                <Field.Label>Scheduling Calendar</Field.Label>
                <Field.Frame className={calendarPlaceholderStyle}>
                  <Skeleton>August 2026</Skeleton>
                  <span className={monthNavStyle} aria-hidden>
                    <ChevronLeftIcon />
                    <ChevronRightIcon />
                  </span>
                </Field.Frame>
              </Field>
            </Wireframe>
          </>
        ),
      }}
      /* AFTER — the same work, in the order it is actually done. */
      after={{
        className: afterPaneStyle,
        // And the strip runs on too — it is one month band of a calendar that
        // keeps going, so it is cut by the same edge rather than tapering into
        // its own fill.
        overflows: true,
        children: (
          <>
            <ol className={stepsStyle}>
              {STEPS.map((step, index) => (
                <li
                  key={step.name}
                  className={stepStyle}
                  data-state={step.state}
                >
                  <span className={stepEyebrowStyle}>Step {index + 1}</span>
                  <span className={stepNameStyle} data-testid="step-name">
                    {step.name}
                  </span>
                </li>
              ))}
            </ol>

            <Wireframe className={monthStripStyle} opacity={25}>
              <Field>
                <Field.Label>Scheduling Calendar</Field.Label>
                <Field.Frame className={monthStripFrameStyle}>
                  {MONTHS.map((month) => (
                    <span key={month} className={monthStyle}>
                      <Skeleton>{month}</Skeleton>
                    </span>
                  ))}
                </Field.Frame>
              </Field>
              <span className={stripNavStyle} data-side="start" aria-hidden>
                <ChevronLeftIcon />
              </span>
              <span className={stripNavStyle} data-side="end" aria-hidden>
                <ChevronRightIcon />
              </span>
            </Wireframe>
          </>
        ),
      }}
    />
  );
}
