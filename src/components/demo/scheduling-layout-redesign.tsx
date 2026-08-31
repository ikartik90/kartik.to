"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { css, cx } from "../../../styled-system/css";
import { DEMO_FRAME_CONTENT_PADDING_PX } from "@/utils/demo-frame-sizing";
import { ShiftFormShell } from "./shift-form-shell";
import { ShiftFormFields } from "./shift-form-fields";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import { Field } from "@/components/ui/input/field";
import { Skeleton, Wireframe } from "@/components/ui/wireframe";
import ChevronLeftIcon from "@/assets/icons/chevron-left.svg";
import ChevronRightIcon from "@/assets/icons/chevron-right.svg";

// ---------------------------------------------------------------------------
// Scheduling Layout Redesign — the "Post a Shift" form's SHAPE, before and
// after (Figma 1143:6560: 1137:5962 / 1135:5310 before, 1137:5924 / 1135:4713
// after). Two arrangements of the same screen, on one toggle.
//
// The argument is entirely structural, so the demo is a DIAGRAM rather than a
// prototype — the one departure from the Shift Scheduling demos it shares its
// chrome with. Those exist to show a primitive working, and everything in them
// that can be worked, is. Here nothing can: the fields are wireframed at both
// ends of the comparison and the card is cropped at the tear, because a form
// you can fill in is a form you read instead of looking at, and what there is
// to see is where the parts SIT.
//
// BEFORE is the old screen with its two concerns bracketed in red: describing
// the shift down the left, scheduling it in a 208px box exiled to the right,
// both of them running off the bottom of a card that cannot hold them. AFTER
// answers the redlines directly — the two brackets become the first two of
// three steps, and the calendar that was a column is now a full-width strip.
// The first two step names are literally the two redline labels, which is the
// whole point and is pinned by a test rather than left to a reader to notice.
//
// The toggle MORPHS rather than swaps. Both arrangements stay mounted and
// cross-fade in place inside a card whose box never moves: the redlines
// withdraw sideways, the old body leaves upward, and the three steps arrive
// from above one after another. A comparison shown as a cut asks you to
// remember what was there a moment ago; shown as a change, it does the
// remembering for you. (`globals.css` collapses the whole thing to a cut under
// `prefers-reduced-motion`, which is the right answer there — the two states
// are both complete, so losing the travel between them costs nothing.)
// ---------------------------------------------------------------------------

type Arrangement = "before" | "after";

const ARRANGEMENTS = [
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
];

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

/** The two concerns the old screen crams together, and which side each sits on. */
const REDLINES = [
  { label: "Shift Information", side: "start" },
  { label: "Shift Planning", side: "end" },
] as const;

// The card body's height (Figma 1137:5945 / 1137:5977). Fixed, and the same
// number for both arrangements, because the whole card has to hold still while
// its contents change — a box that resized mid-morph would make the change look
// like it was about the box.
const BODY_HEIGHT = "190px";

// Where a redline starts, measured down from the top of the card: the header
// (52px) plus the body's own 16px inset, so the mark opens level with the first
// field it is annotating rather than with the card's edge.
const REDLINE_TOP = "68px";

// The mark's own box, straight off the Figma (1135:5645 + 1135:5652): a 118px
// spine, a 2px break, then a 44px dotted run-on — 164 in all, in a box 8 across.
// The stray `.375`s in the paths below are the export's, and they are the
// stroke's own half-width showing as padding on each edge; keeping them is what
// lets the SVG render at 1:1 with no scaling.
const REDLINE_SPINE = 118;
const REDLINE_HEIGHT = REDLINE_SPINE + 2 + 44;

// --- The stage -------------------------------------------------------------
//
// The diagram has ONE intrinsic size — every part of it is fixed by the Figma,
// so there is no reflow to do and nothing that reads better rearranged. It is
// an annotated drawing: take the annotations off to save room and what is left
// no longer makes the argument. So a narrow frame gets the whole thing SMALLER
// rather than a rearranged subset of it.
//
//   799 = 615 card + 2 × (12 to clear the mark + 80 for its label)
//   366 = 28 toggle + 76 gap + 262 card (52 header + 190 body + 20 tear)
const INTRINSIC_WIDTH = 799;
const INTRINSIC_HEIGHT = 366;

// The box the frame actually lays out and measures: the diagram's footprint at
// whatever scale it ended up at, so nothing overflows and the frame reserves
// neither too much room nor too little.
//
// `--demo-fit` is written by the observer in the component below, and DEFAULTS
// to 1 here on purpose. It is the value that renders before the observer has
// measured anything — and the value that survives if it never runs at all — so
// the failure mode is a diagram drawn too large in a frame that grew to hold
// it, which is still a readable diagram.
//
// This was a `tan(atan2(100cqw - 40px, 799px))` expression, which is the known
// trick for dividing one CSS length by another (calc() refuses to, atan2 takes
// two lengths and returns an angle whose tangent is their ratio). It works in
// Chromium and it is why this demo rendered correctly everywhere it was checked.
// WebKit returns 0 from `tan(atan2(…))` for ANY pair of arguments, so in Safari
// the whole thing collapsed to `scale(0)` — a correctly sized frame with nothing
// inside it. A ResizeObserver computes the same number in every engine.
const fitStyle = css({
  position: "relative",
  "--demo-fit": "1",
  width: `calc(${INTRINSIC_WIDTH}px * var(--demo-fit))`,
  height: `calc(${INTRINSIC_HEIGHT}px * var(--demo-fit))`,
  // Fill the frame's content box (its height is half its width at the 2/1 this
  // demo is registered at, less the same 40px inset) so that the demo area's
  // `justify-content: center` has no slack left to centre — which is what puts
  // the toggle at the TOP of the frame, where the Figma draws it, rather than
  // floating in the middle of it. Where the diagram is taller than that — a
  // narrow frame — this simply stops applying and the frame grows instead.
  minHeight: "calc(50cqw - token(spacing.4xl))",
});

const stageStyle = css({
  position: "absolute",
  insetBlockStart: "token(spacing.none)",
  insetInlineStart: "token(spacing.none)",
  width: `${INTRINSIC_WIDTH}px`,
  height: `${INTRINSIC_HEIGHT}px`,
  // Scaled from the top-left corner because the box above is already sized to
  // the result — anchoring it anywhere else would need the box to re-centre
  // what the transform moved.
  transformOrigin: "top left",
  transform: "scale(var(--demo-fit))",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  // 76px, off the token scale in both directions (xxl is 20, 3xl is 32, 5xl is
  // 80) — the Figma root's own gap between the toggle and the card (1137:5962).
  gap: "76px",
});

// The toggle is the ONE live control on the stage — everything under it is
// scenery — so it gets the house primitive unmodified. Its selected segment
// already paints `field.bg.active` over `field.text.active`, which is the brand
// wash at 15% under the brand at full strength: exactly what the Figma draws
// (1137:5926), with no variant to add.
//
// `flex: none` is load-bearing, not tidiness. SegmentedControl composes the
// shared `toolbar` at `fit="fill"`, which is `flex: 1 1 0` — right where it
// normally lives, a ROW of a properties panel, where filling means taking the
// rest of the width. Dropped into this column it fills along the BLOCK axis
// instead and the control flattens to nothing. So the stage says how the rail
// sizes here: 120px across (Figma 1137:5925), and its own height.
//
// The one shape it does NOT take from the primitive is its corner. The recipe
// squares off at `radii.sm`, and says why: in its usual home it is one row of a
// properties panel, and a 4px corner is what lines it up with the text inputs
// stacked above it. Nothing is stacked above this one — it is a standalone
// control on a canvas, and the Figma draws it as the pill that is (1137:5925,
// a 14px radius on a 28px rail). The rail already clips its segments to its own
// corner, so the selected fill follows the pill for free.
const toggleStyle = css({
  flex: "none",
  width: "120px",
  borderRadius: "token(radii.full)",
});

// The card and the two brackets flanking it. `position: relative` so the
// redlines can be hung off the card's own edges rather than the frame's.
const cardStyle = css({
  position: "relative",
  display: "flex",
  minWidth: 0,
});

// --- The redlines ----------------------------------------------------------

const redlinesStyle = css({
  // Decoration over the card, never in front of the toggle.
  pointerEvents: "none",
  color: "field.text.active",
  transitionProperty: "opacity",
  transitionDuration: "200ms",
  transitionTimingFunction: "ease-out",
  "&[data-presented=false]": { opacity: 0 },
});

const redlineStyle = css({
  position: "absolute",
  top: REDLINE_TOP,
  width: "token(spacing.md)",
  transitionProperty: "transform, opacity",
  transitionDuration: "260ms",
  transitionTimingFunction: "ease-out",
  // 8px of bracket plus the 4px gutter the Figma leaves between it and the card
  // (1137:5966) — written as the two tokens it is rather than as 12. Each side
  // also nests how it LEAVES: outward, away from the card it was annotating,
  // rather than fading on the spot.
  "&[data-side=start]": {
    insetInlineStart: "calc(-1 * (token(spacing.md) + token(spacing.sm)))",
    "[data-presented=false] &": { transform: "translateX(-8px)" },
  },
  "&[data-side=end]": {
    insetInlineEnd: "calc(-1 * (token(spacing.md) + token(spacing.sm)))",
    "[data-presented=false] &": { transform: "translateX(8px)" },
  },
});

// The mark is drawn from the EXPORT's own path data, not from a reading of what
// it looks like. It is not a bracket: it is a spine with a tick at the top
// (where the region starts), a tick at its middle pointing the other way (where
// the label attaches), no tick at the bottom at all — because the region does
// not end, it is cropped — and a dotted run-on carrying it past the tear.
//
// `currentColor` is the single edit to the export. The vectors are flat
// #FF4D97, and the accent is orange in dark, so a committed copy of the file
// would be right in exactly one of the two themes.
const redlineMarkStyle = css({
  display: "block",
  // Mirrored for the right-hand redline, exactly as the Figma mirrors the
  // instance (1137:6025): the top tick then points at the card and the middle
  // tick out at its label, which is what makes the pair read as a pair.
  "[data-side=end] &": { transform: "scaleX(-1)" },
});

const redlineLabelStyle = css({
  position: "absolute",
  // Centred on the middle tick — the point the leader actually attaches at —
  // which is halfway down the spine, not halfway down the whole mark: the
  // dotted tail is a continuation, not part of what is being labelled.
  top: `${REDLINE_SPINE / 2}px`,
  transform: "translateY(-50%)",
  width: "76px",
  textStyle: "bodySmall",
  color: "field.text.active",
  "[data-side=start] &": {
    insetInlineEnd: "calc(100% + token(spacing.sm))",
    textAlign: "end",
  },
  "[data-side=end] &": {
    insetInlineStart: "calc(100% + token(spacing.sm))",
    textAlign: "start",
  },
});

/**
 * One redline, at the size and shape the Figma exports it (1135:5645 for the
 * spine and its two ticks, 1135:5652 for the dotted run-on) — the `d` strings
 * are the export's verbatim, so the geometry is the designer's rather than my
 * reading of a picture of it. Only the stroke changes, to `currentColor`.
 */
function RedlineMark() {
  return (
    <svg
      className={redlineMarkStyle}
      width="8.75"
      height={REDLINE_HEIGHT + 0.75}
      viewBox={"0 0 8.75 " + (REDLINE_HEIGHT + 0.75)}
      fill="none"
      aria-hidden
      focusable="false"
    >
      <path
        d="M8.375 0.375H4.375V59.375M4.375 118.375V59.375M4.375 59.375H0.375"
        stroke="currentColor"
        strokeWidth="0.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={"M4.375 " + (REDLINE_HEIGHT + 0.375) + "V" + (REDLINE_SPINE + 2.375)}
        stroke="currentColor"
        strokeWidth="0.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1.5 1.5"
      />
    </svg>
  );
}

// --- The two arrangements --------------------------------------------------

// Both panes are laid over one another in a box of fixed height, which is what
// lets them cross-fade without the card breathing.
const bodyStyle = css({
  position: "relative",
  height: BODY_HEIGHT,
});

const paneStyle = css({
  position: "absolute",
  inset: 0,
  transitionProperty: "opacity, transform",
  transitionDuration: "300ms",
  transitionTimingFunction: "ease-out",
  "&[data-presented=false]": { opacity: 0 },
});

// The old arrangement leaves upward and the new one arrives from above, so at
// no point are the two crossing in opposite directions — one is on its way out
// of the top of the card and the other is following it in.
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

// The gradient the card is cropped behind. It fades the running-off content
// into the canvas so the tear reads as a cut through a longer form rather than
// as the form's actual end (Figma 1137:6023).
const cropFadeStyle = css({
  position: "absolute",
  insetInline: 0,
  bottom: 0,
  height: "token(spacing.5xl)",
  backgroundImage:
    "linear-gradient(to top, var(--colors-bg-canvas), transparent)",
  pointerEvents: "none",
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
  // The frame's flat fill, turned into a fade: full strength along the top edge
  // and gone by the bottom, so the strip reads as running on under the tear
  // rather than stopping at it (Figma 1137:5948).
  backgroundColor: "transparent",
  backgroundImage:
    "linear-gradient(to top, transparent 42%, var(--colors-field-bg-default))",
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

export function SchedulingLayoutRedesign() {
  const [arrangement, setArrangement] = useState<Arrangement>("before");
  const showing = (which: Arrangement) => arrangement === which;

  const fitRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);

  // What the diagram has to fit into is the DEMO FRAME's box, never anything
  // nearer: this element and its measuring parent are both sized FROM the scale,
  // so observing either would be observing the last answer rather than the
  // question. Outside a frame (a test, a bare render) there is nothing to fit
  // to and the 1:1 default stands.
  useLayoutEffect(() => {
    const host = fitRef.current?.closest("[data-demo-frame]");
    if (!host || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const available = host.clientWidth - DEMO_FRAME_CONTENT_PADDING_PX;
      setFit(Math.min(1, available / INTRINSIC_WIDTH));
    };

    const observer = new ResizeObserver(measure);
    observer.observe(host);
    measure();

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={fitRef}
      className={fitStyle}
      style={{ "--demo-fit": fit } as CSSProperties}
    >
      <div className={stageStyle}>
        <SegmentedControl
          ariaLabel="Scheduling form layout"
          className={toggleStyle}
          options={ARRANGEMENTS}
          value={arrangement}
          onValueChange={(next) => setArrangement(next as Arrangement)}
        />

        <div className={cardStyle}>
          {/* The annotations belong to the old arrangement, so they withdraw with
            it. They are OUTSIDE the card because the card is clipped at its
            side rails and at the tear — a bracket drawn inside it could neither
            reach past its edge nor run on below the cut. */}
          <div
            className={redlinesStyle}
            data-testid="redlines"
            data-presented={showing("before")}
            aria-hidden={!showing("before")}
          >
            {REDLINES.map((redline) => (
              <div
                key={redline.label}
                className={redlineStyle}
                data-side={redline.side}
              >
                <span className={redlineLabelStyle} data-testid="redline-label">
                  {redline.label}
                </span>
                <RedlineMark />
              </div>
            ))}
          </div>

          <ShiftFormShell cropped>
            <div className={bodyStyle}>
              {/* BEFORE — two concerns, one screen, both running off the bottom. */}
              <div
                className={cx(paneStyle, beforePaneStyle)}
                data-testid="before-pane"
                data-presented={showing("before")}
                aria-hidden={!showing("before")}
                inert={!showing("before")}
              >
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

                <div className={cropFadeStyle} aria-hidden />
              </div>

              {/* AFTER — the same work, in the order it is actually done. */}
              <div
                className={cx(paneStyle, afterPaneStyle)}
                data-testid="after-pane"
                data-presented={showing("after")}
                aria-hidden={!showing("after")}
                inert={!showing("after")}
              >
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
              </div>
            </div>
          </ShiftFormShell>
        </div>
      </div>
    </div>
  );
}
