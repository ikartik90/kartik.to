"use client";

import { css } from "../../../styled-system/css";
import { ShiftFormFields } from "./shift-form-fields";
import { RedesignDiagram, type DiagramRedline } from "./redesign-diagram";
import type { DemoProps } from "./registry";
import { Field } from "@/components/ui/input/field";
import { Skeleton, Wireframe } from "@/components/ui/wireframe";
import ChevronLeftIcon from "@/assets/icons/chevron-left.svg";
import ChevronRightIcon from "@/assets/icons/chevron-right.svg";

/** The first two names must match the redline labels, in order. */
const STEPS = [
  { name: "Shift Information", state: "done" },
  { name: "Shift Planning", state: "current" },
  { name: "Review Shift Summary", state: "pending" },
] as const;

const BODY_HEIGHT = 190;

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

const beforePaneStyle = css({
  display: "flex",
  alignItems: "flex-start",
  // 28px, not 32: splits the content into the 347 ∣ 208 columns.
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

// The Calendar recipe's single-month width: 7 × 24 + 6 × 4 + 2 × 8.
const calendarColumnStyle = css({
  width: "208px",
  flexShrink: 0,
});

const calendarPlaceholderStyle = css({
  height: "174px",
  alignItems: "flex-start",
  gap: "md",
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
  "&[data-state=done], &[data-state=current]": {
    borderBottomColor: "field.text.active",
  },
  "&[data-state=pending]": { borderBottomColor: "field.text.muted" },
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
  paddingBlock: "md",
  paddingInline: "lg",
});

const monthStyle = css({
  flex: "1 1 0",
  minWidth: 0,
  display: "flex",
  justifyContent: "center",
});

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

/** Real names, so the skeleton bars size to them. */
const MONTHS = ["August", "September 2026", "October"];

export function SchedulingLayoutRedesign({ aspect = "2/1" }: DemoProps = {}) {
  return (
    <RedesignDiagram
      ariaLabel="Scheduling form layout"
      bodyHeight={BODY_HEIGHT}
      cropped
      aspect={aspect}
      redlines={REDLINES}
      before={{
        className: beforePaneStyle,
        overflows: true,
        children: (
          <>
            <Wireframe className={fieldColumnStyle} opacity={50}>
              <ShiftFormFields />
            </Wireframe>

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
      after={{
        className: afterPaneStyle,
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
