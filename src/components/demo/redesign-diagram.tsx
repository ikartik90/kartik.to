"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { css, cx } from "../../../styled-system/css";
import {
  ASPECT_RATIOS,
  DEMO_FRAME_CONTENT_PADDING_PX,
  type DemoFrameAspectRatio,
} from "@/utils/demo-frame-sizing";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import {
  ShiftFormShell,
  SHELL_ACTION_BAR_HEIGHT,
  SHELL_FORM_INSET,
  SHELL_HEADER_HEIGHT,
  SHELL_TEAR_HEIGHT,
} from "./shift-form-shell";

// ---------------------------------------------------------------------------
// RedesignDiagram — the STAGE two "Post a Shift" redesigns are argued on, and
// nothing about either argument.
//
// A redesign demo here is a DIAGRAM rather than a prototype: the argument is
// structural, so the fields are wireframed at both ends of the comparison and
// the card is cropped at the tear, because a form you can fill in is a form you
// read instead of looking at, and what there is to see is where the parts SIT.
// That much is the same in every one of them, and so is everything below —
// the toggle, the cropped card, the two cross-fading panes, the redline marks
// hung off the card's edges, and the way the whole drawing gives up its
// annotation before its size when the frame narrows.
//
// What a CALLER brings is its own two arrangements and its own redlines. It
// says nothing about how they are shown.
//
// The toggle MORPHS rather than swaps. Both arrangements stay mounted and
// cross-fade in place inside a card whose box never moves: the redlines
// withdraw sideways and each pane travels as it goes. A comparison shown as a
// cut asks you to remember what was there a moment ago; shown as a change, it
// does the remembering for you. (`globals.css` collapses the whole thing to a
// cut under `prefers-reduced-motion`, which is the right answer there — the two
// states are both complete, so losing the travel between them costs nothing.)
// ---------------------------------------------------------------------------

export type Arrangement = "before" | "after";

const ARRANGEMENTS = [
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
];

/**
 * One bracket beside the card: what it calls out, where it opens, and how far
 * it reaches. All four measurements are in the card's own coordinates at 1:1,
 * so they read straight off the Figma rather than off whatever the drawing has
 * been scaled to.
 */
export interface DiagramRedline {
  /** What the mark is calling out; also the legend entry it becomes. */
  label: string;
  /** Which edge of the card it hangs off. */
  side: "start" | "end";
  /** Where the mark opens, measured down from the top of the card. */
  top: number;
  /** The solid run — how far the region it brackets reaches. */
  spine: number;
  /**
   * A dotted run-on below the spine, for a region the card CROPS rather than
   * ends. Its absence closes the spine with a foot tick instead, which is the
   * difference between "this continues past the tear" and "this is all of it".
   */
  tail?: number;
  /** Where the leader tick — and so the caption — attaches, from the mark's top. */
  attach: number;
}

/** One arrangement's pane: its own layout, over the stage's cross-fade box. */
export interface RedesignArrangement {
  /**
   * Layout and exit motion for this pane, merged onto the shared box. It is the
   * caller's rather than the stage's because the two arrangements leave in
   * different directions in different demos — a body that lifts away is not the
   * same gesture as a row of steps that arrive one at a time.
   */
  className?: string;
  children: ReactNode;
  /**
   * This arrangement runs past the foot of the block — draw the cut it is
   * severed at, for as long as it is the one showing.
   *
   * Per arrangement rather than per diagram because it is a fact about the
   * layout, not about the card: one comparison crops both of its arrangements
   * and another crops only the old one, where a gradient over the new one would
   * wash out the bottom of something that fits perfectly well.
   */
  overflows?: boolean;
}

// --- The stage -------------------------------------------------------------
//
// The drawing is fixed by the Figma — there is no reflow to do inside it and
// nothing that reads better rearranged — so a narrowing frame is answered by
// giving things UP, in one order, and the order is what the other Shift
// Scheduling frames set: they hold their 615px card at full size until it sits
// 20px from the frame's edge, and only then does anything move. A diagram here
// hangs 92px of annotation off each side of that same card, and would otherwise
// start shrinking the card a full 184px earlier than its neighbours do.
//
// So the annotation is what it spends first. The redline labels become numbered
// marks — 20px a side rather than 92 — with a legend under the drawing saying
// which number is which, and the card carries on at full size for another 112px
// of narrowing. Scaling starts only at the SECOND boundary, where even the
// numbered drawing reaches the gutter and there is nothing left to give up but
// size.
//
// What SCALES is the drawing alone — the card and the marks hung off it. The
// toggle above it is a control and the legend below it is a key: both are
// chrome around the picture rather than part of it, both are far narrower than
// the picture (132px and ~285px against 687), and so both still have room to
// spare at every width the picture has run out at. Shrinking them would be
// answering a question nobody asked, and it would cost a live control its hit
// area and the legend its legibility.
//
//   615 = the card (`ShiftFormShell`'s own stack)
const CARD_WIDTH = 615;

/**
 * The MOST the drawing hangs below the toggle when a caller does not say — see
 * `toggleGap`, and the pair of springs below for why it is a ceiling.
 */
const DEFAULT_TOGGLE_GAP = 76;

// The floor under the air on either side of the drawing: how close the legend
// ever comes to it, and the least the toggle is ever left with. It only binds
// in a frame too short to hold the drawing at all — there, the column overflows
// its min-height and the frame grows, which is better than the two closing on
// the picture.
const MIN_AIR = 32;

// What one redline costs beside the card: the 8px mark plus the 4px gutter the
// Figma leaves between it and the card, then the 4px gap from the mark out to
// whatever captions it.
const REDLINE_CLEARANCE = 12;
const CAPTION_GAP = 4;

// The two captions, at the two widths they come in — the Figma's 76px label
// column, and the numbered mark that stands in for it, which is one 20px disc
// (`spacing.xxl`, the size the styles below draw it at).
const LABEL_WIDTH = 76;
const BADGE_SIZE = 20;

/** 799 — the drawing as the Figma draws it, labels and all. */
export const LABELLED_WIDTH =
  CARD_WIDTH + 2 * (REDLINE_CLEARANCE + CAPTION_GAP + LABEL_WIDTH);

/** 687 — the same drawing with its labels down to a number apiece. */
export const NUMBERED_WIDTH =
  CARD_WIDTH + 2 * (REDLINE_CLEARANCE + CAPTION_GAP + BADGE_SIZE);

/** Which of the two forms the redline captions are drawn in. */
export type RedlineAnnotation = "labels" | "numbers";

export interface DiagramFit {
  annotation: RedlineAnnotation;
  /** The drawing's own width in that form — what the scale is measured from. */
  width: number;
  /** 1 until the numbered drawing reaches the gutter; its share of it after. */
  fit: number;
}

/**
 * What to draw, and how big, in `available` px — the frame's inner width less
 * the demo area's 20px inline padding on each side.
 *
 * The two boundaries in one expression: above `LABELLED_WIDTH` nothing has been
 * spent; below it the labels are, and `Math.min` then holds the scale at 1
 * through the whole stretch where the numbered drawing still clears the gutter.
 *
 * A frame measured mid-collapse reports nothing to fit into, and a negative
 * scale would MIRROR the drawing rather than hide it, so the floor is 0.
 */
export function resolveDiagramFit(available: number): DiagramFit {
  if (available >= LABELLED_WIDTH) {
    return { annotation: "labels", width: LABELLED_WIDTH, fit: 1 };
  }

  return {
    annotation: "numbers",
    width: NUMBERED_WIDTH,
    fit: Math.min(1, Math.max(0, available) / NUMBERED_WIDTH),
  };
}

// The box the frame lays out and measures: the toggle, the drawing at whatever
// form and scale it ended up in, and the legend where there is one — a plain
// column, so its height is the sum of what is actually in it rather than a
// number kept in step by hand.
//
// Both variables are written by the observer in the component below, and DEFAULT
// here to the labelled drawing at 1:1 on purpose. Those are the values that
// render before the observer has measured anything — and the ones that survive
// if it never runs at all — so the failure mode is a diagram drawn too large in
// a frame that grew to hold it, which is still a readable diagram.
//
// This was a `tan(atan2(100cqw - 40px, 799px))` expression, which is the known
// trick for dividing one CSS length by another (calc() refuses to, atan2 takes
// two lengths and returns an angle whose tangent is their ratio). It works in
// Chromium and it is why this demo rendered correctly everywhere it was checked.
// WebKit returns 0 from `tan(atan2(…))` for ANY pair of arguments, so in Safari
// the whole thing collapsed to `scale(0)` — a correctly sized frame with nothing
// inside it. A ResizeObserver computes the same number in every engine.
const fitStyle = css({
  "--demo-fit": "1",
  "--demo-diagram-width": `${LABELLED_WIDTH}px`,
  // As wide as the drawing ends up, which is what the frame measures. The two
  // pieces of chrome are narrower than that at every width the drawing is
  // scaled at, so this is also what they centre on.
  width: "calc(var(--demo-diagram-width) * var(--demo-fit))",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  // Fill the frame's content box (its height follows from the shape the demo is
  // drawn at, less the same 40px inset) so that the demo area's
  // `justify-content: center` has no slack left to centre — which is what puts
  // the toggle at the TOP of the frame, where the Figma draws it, rather than
  // floating in the middle of it. Where the column is taller than that — a
  // narrow frame — this simply stops applying and the frame grows instead.
  //
  // The `cqw` share is a VARIABLE rather than a literal because the shape is
  // the caller's: 50cqw is a 2/1 frame and 66.67cqw a 3/2 one, and a demo told
  // it is being shown at a shape it did not expect still has to fill it.
  minHeight: "calc(var(--demo-frame-height) - token(spacing.4xl))",
});

// The drawing's own footprint AT SCALE, and the only thing in the column whose
// size the scale decides. A transform costs layout nothing, so the scaled
// drawing needs a box of the right size around it or the column would reserve
// the drawing's full height and the frame would grow to hold a picture that is
// no longer that big.
const drawingBoxStyle = css({
  position: "relative",
  flex: "none",
  width: "calc(var(--demo-diagram-width) * var(--demo-fit))",
  height: "calc(var(--demo-card-height) * var(--demo-fit))",
});

// The air above the drawing and the air below it, as a pair of SPRINGS rather
// than as two stated distances — one flex factor each, so whatever the column
// has left over after the toggle, the drawing and the legend is split EQUALLY
// between them. That is what keeps the drawing centred between its chrome, and
// what the fixed pair could not do: the gap under the toggle was a distance and
// the one under the drawing was everything left over, so the moment the legend
// arrived and took 52px off the bottom, the drawing was pushed below the middle
// of its own frame (116 above ∣ 73 below, measured at 2/1).
//
// Both are drawn at the drawing's scale, because the distance from a control to
// the picture it drives belongs to the picture's composition; holding either at
// full size while the drawing halved would leave the parts adrift of each other.
const airStyle = css({
  // Basis zero, so the free space is shared rather than the springs' own
  // heights being grown from — an even split needs both to start from nothing.
  flex: "1 1 0",
  // Nothing sits in them, so they need no width of their own.
  width: "token(spacing.none)",
});

// The caller's gap is a CEILING on the top spring, not the distance itself. The
// Figma's 76 (and the position demo's 12) is what the picture wants under its
// control when the frame has room for it — and when it has not, the spring
// takes its half and no more, so the drawing cannot be pushed down by a legend
// arriving underneath it.
//
// The floor is the smaller of the two numbers rather than `MIN_AIR` flat: a
// caller asking for less than the floor means it, and a min-height above a
// max-height wins in CSS — which would quietly turn the position demo's
// deliberate 12 into 32.
const airAboveStyle = css({
  minHeight: `calc(min(${MIN_AIR}px, var(--demo-toggle-gap)) * var(--demo-fit))`,
  maxHeight: "calc(var(--demo-toggle-gap) * var(--demo-fit))",
});

// ...and the floor under the bottom spring is the legend's clearance, so it is
// carried only while there is a legend to keep off. Trailing air below the
// drawing needs no minimum of its own, and one here would push the frame taller
// than the shape it is drawn at.
const airBelowLegendStyle = css({
  minHeight: `calc(${MIN_AIR}px * var(--demo-fit))`,
});

const drawingStyle = css({
  position: "absolute",
  insetBlockStart: "token(spacing.none)",
  insetInlineStart: "token(spacing.none)",
  width: "var(--demo-diagram-width)",
  height: "var(--demo-card-height)",
  // Scaled from the top-left corner because the box above is already sized to
  // the result — anchoring it anywhere else would need the box to re-centre
  // what the transform moved.
  transformOrigin: "top left",
  transform: "scale(var(--demo-fit))",
  // The card is 615 of the drawing's 799 or 687; the rest is the annotation
  // hanging off its two sides, so the card sits in the middle of it.
  display: "flex",
  justifyContent: "center",
});

// The toggle is the ONE live control on the stage — everything under it is
// scenery — so it gets the house primitive unmodified. Its selected segment
// already paints `field.bg.active` over `field.text.active`, which is the brand
// wash at 15% under the brand at full strength: exactly what the Figma draws,
// with no variant to add.
//
// `flex: none` is load-bearing, not tidiness. SegmentedControl composes the
// shared `toolbar` at `fit="fill"`, which is `flex: 1 1 0` — right where it
// normally lives, a ROW of a properties panel, where filling means taking the
// rest of the width. Dropped into this column it fills along the BLOCK axis
// instead and the control flattens to nothing. So the stage says how the rail
// sizes here: 132px across, and its own height.
//
// The one shape it does NOT take from the primitive is its corner. The recipe
// squares off at `radii.sm`, and says why: in its usual home it is one row of a
// properties panel, and a 4px corner is what lines it up with the text inputs
// stacked above it. Nothing is stacked above this one — it is a standalone
// control on a canvas, and the Figma draws it as the pill that is (a 14px
// radius on a 28px rail). The rail already clips its segments to its own
// corner, so the selected fill follows the pill for free.
const toggleStyle = css({
  flex: "none",
  width: "132px",
  borderRadius: "token(radii.full)",
});

// The card and the brackets flanking it. `position: relative` so the redlines
// can be hung off the card's own edges rather than the frame's.
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
  width: "token(spacing.md)",
  transitionProperty: "transform, opacity",
  transitionDuration: "260ms",
  transitionTimingFunction: "ease-out",
  // 8px of bracket plus the 4px gutter the Figma leaves between it and the card
  // — written as the two tokens it is rather than as 12. Each side also nests
  // how it LEAVES: outward, away from the card it was annotating, rather than
  // fading on the spot.
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
// (where the region starts), a tick at `attach` pointing the other way (where
// the label hangs), and then one of two endings — a foot tick where the region
// ends, or no tick at all and a dotted run-on where the card crops it instead.
//
// `currentColor` is the single edit to the export. The vectors are flat
// #FF4D97, and the accent is orange in dark, so a committed copy of the file
// would be right in exactly one of the two themes.
const redlineMarkStyle = css({
  display: "block",
  // Mirrored for the right-hand redline, exactly as the Figma mirrors the
  // instance: the top tick then points at the card and the middle tick out at
  // its label, which is what makes the pair read as a pair.
  "[data-side=end] &": { transform: "scaleX(-1)" },
});

const redlineLabelStyle = css({
  position: "absolute",
  // Centred on the leader tick — the point the label actually attaches at.
  transform: "translateY(-50%)",
  width: `${LABEL_WIDTH}px`,
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

// The caption the gutter can afford: the mark's number, ringed so it reads as a
// marker rather than as a stray digit. Same colour and same size as the label
// it stands in for, and the same disc appears in the legend — a key drawn
// differently from the mark it explains would be a third thing to read.
const badgeStyle = css({
  display: "flex",
  flex: "none",
  alignItems: "center",
  justifyContent: "center",
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  borderRadius: "token(radii.full)",
  borderWidth: "token(spacing.xxs)",
  borderStyle: "solid",
  borderColor: "field.text.active",
  textStyle: "bodySmall",
  // The type's own 1.72 line box is taller than the disc it has to sit inside,
  // so the digit is centred by the flex box instead of by its leading.
  lineHeight: "1",
  // And centring the LINE box is not centring the digit. A numeral has no
  // descender: its ink runs from the baseline up to the figure height, and
  // Switzer's own ascent/descent put that baseline at 15px inside the 20px
  // disc, which leaves a 9.1px digit sitting 0.45px low — 4.9px of air above it
  // against 4.0 below, measured off the rasterised glyph rather than guessed at.
  // On a disc this small that reads as a number resting on the floor of its
  // circle. One pixel of bottom padding takes 17px of room for a 14px line box
  // instead of 18, which lifts the centred line — and the baseline with it —
  // by half of that: 0.5px, against the 0.45 and 0.35 the two digits want.
  //
  // `text-box: trim-both cap alphabetic` is the same correction declared rather
  // than arithmetic'd, and is what this should become — but it is Chromium and
  // WebKit only for now, and a digit that is centred in two engines out of
  // three is the bug still shipping. Padding lands everywhere.
  paddingBlockEnd: "token(spacing.xxs)",
  color: "field.text.active",
});

// On the rail, the disc hangs exactly where the label hung: centred on the
// leader tick, 4px clear of the mark, on whichever side its redline is.
const redlineBadgeStyle = css({
  position: "absolute",
  transform: "translateY(-50%)",
  "[data-side=start] &": { insetInlineEnd: "calc(100% + token(spacing.sm))" },
  "[data-side=end] &": { insetInlineStart: "calc(100% + token(spacing.sm))" },
});

// The key the numbers need, at the foot of the frame. The spring above it is
// what puts it there — between them the two springs take every pixel the column
// has left over, which leaves the legend against the bottom edge of a box that
// is itself the demo area's own 20px inset above the frame's bottom, the same
// inset the toggle keeps at the top. So the two pieces of chrome bracket the
// drawing, and the drawing sits in the middle of what they leave.
//
// It is drawn at its own size, never at the drawing's scale. A key nobody can
// read is not a key, and it is the one thing on the stage whose job is to be
// read rather than looked at.
const legendStyle = css({
  flex: "none",
  maxWidth: "token(spacing.full)",
  display: "flex",
  // A frame narrow enough that the key will not fit on one line gets it on two
  // rather than a key running under the frame's edge. The two gaps are separate
  // because they are doing different jobs: 32 apart, the entries read as two
  // things; stacked, 8 is what keeps them reading as one block.
  flexWrap: "wrap",
  justifyContent: "center",
  alignItems: "center",
  columnGap: "3xl",
  rowGap: "md",
  listStyle: "none",
  // It belongs to the redlines, so it goes when they do — a key to marks that
  // are no longer on screen is a key to nothing.
  pointerEvents: "none",
  transitionProperty: "opacity",
  transitionDuration: "200ms",
  transitionTimingFunction: "ease-out",
  "&[data-presented=false]": { opacity: 0 },
});

const legendEntryStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  textStyle: "bodySmall",
  color: "field.text.active",
  whiteSpace: "nowrap",
});

/**
 * One redline, at the size and shape the Figma exports it — the `d` strings
 * below are assembled from the same three moves every exported mark is made of,
 * so the geometry is the designer's rather than my reading of a picture of it.
 * Only the stroke changes, to `currentColor`.
 *
 * The one branch is the mark's FOOT, and it carries the whole meaning: a
 * bracket that closes with a tick has said everything it had to say, and one
 * that trails off into dots is pointing at something the card cut in half.
 */
function RedlineMark({ spine, tail, attach }: DiagramRedline) {
  const height = tail == null ? spine : spine + 2 + tail;
  // The stray `.375`s are the export's own, and they are the stroke's half-width
  // showing as padding on each edge; keeping them is what lets the SVG render at
  // 1:1 with no scaling.
  const leader = `${attach + 0.375}`;
  const foot =
    tail == null
      ? `M8.375 ${spine + 0.375}H4.375V${leader}`
      : `M4.375 ${spine + 0.375}V${leader}`;

  return (
    <svg
      className={redlineMarkStyle}
      width="8.75"
      height={height + 0.75}
      viewBox={`0 0 8.75 ${height + 0.75}`}
      fill="none"
      aria-hidden
      focusable="false"
    >
      <path
        d={`M8.375 0.375H4.375V${leader}${foot}M4.375 ${leader}H0.375`}
        stroke="currentColor"
        strokeWidth="0.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {tail == null ? null : (
        <path
          d={`M4.375 ${height + 0.375}V${spine + 2.375}`}
          stroke="currentColor"
          strokeWidth="0.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1.5 1.5"
        />
      )}
    </svg>
  );
}

// --- The two arrangements --------------------------------------------------

// Both panes are laid over one another in a box of fixed height, which is what
// lets them cross-fade without the card breathing.
//
// It clips, because an arrangement that does not fit is a thing these diagrams
// SAY: the panes are absolutely positioned, so content taller than the box would
// otherwise paint straight out over the card's own inset and torn edge instead
// of being cut at the block's bottom line where the fade meets it.
const bodyStyle = css({
  position: "relative",
  height: "var(--demo-body-height)",
  overflow: "hidden",
});

// The cut at the foot of the block, under the arrangement that runs past it: a
// gradient fading the running-off content into whatever is behind it, so the
// bottom of the block reads as a cut through a longer form rather than as the
// form's end.
//
// It sits OUTSIDE the panes and carries no transition of its own, which is the
// whole point of it living here rather than in the arrangement it belongs to.
// The cut belongs to the CARD — it is where the block stops — not to the layout
// passing through it, and a gradient that faded and slid in with the pane reads
// as a piece of the old arrangement arriving rather than as the edge that
// arrangement is cut against. Being outside is what MAKES that possible: a
// child cannot opt out of its parent's opacity or transform.
//
// It fades to `bg.surface`, because a fade has to meet what is ACTUALLY behind
// the content it dissolves — and both cards now work on the form's own fill,
// the same surface v0, v1 and v2 do. One colour for both, and it is the card's
// rather than the frame's: the canvas is no longer what shows through here, and
// fading to it would leave the band a shade the surface never reaches.
//
// Its height is a SHARE of the block, not a flat 80px. Two cards with the same
// 80px band do not read alike: the reference demo fades 80 of a 190px block and
// its content dissolves across the whole run, where a 300px block gets the same
// 80 and has to do the same work in a quarter of its height — the band opens
// over the gap between two rows and the dissolve is then squeezed into the last
// 46px, which is exactly the abruptness the two-fifths below fixes.
//
// And the ramp is EASED rather than linear. A linear one starts washing the
// first thing the band touches, so content is dimmed while it is still meant to
// be read; this holds the top of the band nearly clear and gathers the dissolve
// toward the cut. The last stop is the canvas at zero alpha rather than
// `transparent` — same hue, so the ramp cannot drift through another one.
const CUT_FADE_SHARE = 0.4;

/**
 * How long one arrangement takes to become the other — and the cut leaves ON
 * this, in tandem with the content it belongs to rather than on a clock of its
 * own. Stated once and used twice, so the two cannot drift.
 */
const MORPH_MS = 300;

// And the cut sets off a beat after the content does, so the gradient is still
// at full strength over the first frames of the arrangement's own fade rather
// than thinning at the same moment its subject does. It applies on the way OUT
// only — the way in reads the shown state, which carries no delay.
const CUT_STAGGER_MS = 80;

const cropFadeStyle = css({
  position: "absolute",
  insetInline: 0,
  bottom: 0,
  height: `calc(var(--demo-body-height) * ${CUT_FADE_SHARE})`,
  pointerEvents: "none",
  // Asymmetric, and both halves come from one pair of rules, because a
  // transition takes its duration from the state it is moving TO: the base
  // (shown) state's 0s is what makes the cut APPEAR at once — the old
  // arrangement is already cropped the instant the toggle moves, and a gradient
  // easing in over content that is fully present would be an effect nobody
  // asked for — while the hidden state's duration is what it LEAVES on.
  // Nothing has to be written for the instant direction.
  transitionProperty: "opacity",
  transitionDuration: "0s",
  "&[data-presented=false]": {
    opacity: 0,
    transitionDuration: `${MORPH_MS}ms`,
    transitionDelay: `${CUT_STAGGER_MS}ms`,
    transitionTimingFunction: "ease-out",
  },
  backgroundImage: [
    "linear-gradient(to top",
    "var(--colors-bg-surface) 0%",
    "color-mix(in srgb, var(--colors-bg-surface) 88%, transparent) 20%",
    "color-mix(in srgb, var(--colors-bg-surface) 66%, transparent) 40%",
    "color-mix(in srgb, var(--colors-bg-surface) 40%, transparent) 60%",
    "color-mix(in srgb, var(--colors-bg-surface) 17%, transparent) 80%",
    "color-mix(in srgb, var(--colors-bg-surface) 0%, transparent) 100%)",
  ].join(", "),
});

const paneStyle = css({
  position: "absolute",
  inset: 0,
  transitionProperty: "opacity, transform, filter",
  transitionDuration: `${MORPH_MS}ms`,
  transitionTimingFunction: "ease-out",
  // An arrangement does not merely fade as it goes — it goes OUT OF FOCUS, and
  // the one replacing it resolves into focus as it arrives. Opacity alone
  // cross-dissolves two sharp images through each other, and for the moment they
  // are both half-present that reads as a double exposure of two legible forms.
  // Defocusing whichever is leaving keeps exactly one of them readable at a
  // time, which is what makes the change look like a change rather than a
  // flicker between two states.
  //
  // `filter` is on the PANE rather than on anything inside it, so it costs one
  // composited layer per arrangement rather than one per part — and the body's
  // `overflow: hidden` clips the bleed a blur paints past its own box.
  "&[data-presented=false]": { opacity: 0, filter: "blur(4px)" },
});

export interface RedesignDiagramProps {
  /**
   * Names the toggle. It is the one live control on the stage, and the two
   * segments are called Before and After in every demo — so what a screen
   * reader needs is what the two are arrangements OF.
   */
  ariaLabel: string;
  /**
   * The card body's height at 1:1 — the same number for both arrangements,
   * because the whole card has to hold still while its contents change. A box
   * that resized mid-morph would make the change look like it was about the box.
   */
  bodyHeight: number;
  /**
   * End the card at a single torn edge partway down the form — header, body,
   * tear, no action bar — rather than staging the whole dialog.
   *
   * Which one is right is a question about WHERE the subject sits. A diagram
   * arguing about the form's overall shape starts at the top and simply stops,
   * and drawing a Cancel/Post pair under it would promise a bottom it does not
   * have. One whose subject is a block in the MIDDLE of the form wants the
   * dialog entire, because there the torn edges are the argument: a fragment of
   * a header above, a fragment of an action bar below, and the block between
   * them cut out of a form that carries on past it in both directions.
   */
  cropped?: boolean;
  /**
   * The MOST the drawing sits below the toggle, at 1:1. The Figma's own gap,
   * and it varies by design — a card that fills its frame has far less to give
   * it than one that ends halfway down.
   *
   * A ceiling rather than a distance: the drawing is centred in whatever the
   * chrome leaves it, and this is only how far the air above may open before
   * the rest of it is handed to the air below. Where the frame has room for the
   * whole gap, it gets the whole gap.
   */
  toggleGap?: number;
  /**
   * The shape the frame is drawing this demo at, so the column knows how much
   * height to fill. Passed down from `DemoProps.aspect` rather than looked up,
   * because a publication may override the shape per row.
   */
  aspect?: DemoFrameAspectRatio;
  redlines: readonly DiagramRedline[];
  before: RedesignArrangement;
  after: RedesignArrangement;
}

export function RedesignDiagram({
  ariaLabel,
  bodyHeight,
  cropped = false,
  toggleGap = DEFAULT_TOGGLE_GAP,
  aspect = "2/1",
  redlines,
  before,
  after,
}: RedesignDiagramProps) {
  const [arrangement, setArrangement] = useState<Arrangement>("before");
  const showing = (which: Arrangement) => arrangement === which;

  const fitRef = useRef<HTMLDivElement>(null);
  // What the frame has room for, rather than the answer worked out from it:
  // stored as the one number the observer actually reads, so a resize that
  // changes nothing about the fit re-renders nothing either. It opens at the
  // width the labelled drawing wants, which is the 1:1 default the styles above
  // are written to agree with.
  const [available, setAvailable] = useState(LABELLED_WIDTH);
  const { annotation, width, fit } = resolveDiagramFit(available);

  // What the diagram has to fit into is the DEMO FRAME's box, never anything
  // nearer: this element and its measuring parent are both sized FROM the scale,
  // so observing either would be observing the last answer rather than the
  // question. Outside a frame (a test, a bare render) there is nothing to fit
  // to and the 1:1 default stands.
  useLayoutEffect(() => {
    const host = fitRef.current?.closest("[data-demo-frame]");
    if (!host || typeof ResizeObserver === "undefined") return;

    const measure = () =>
      setAvailable(host.clientWidth - DEMO_FRAME_CONTENT_PADDING_PX);

    const observer = new ResizeObserver(measure);
    observer.observe(host);
    measure();

    return () => observer.disconnect();
  }, []);

  const [aspectWidth, aspectHeight] = ASPECT_RATIOS[aspect];

  // What the card comes to around the body, summed from the shell's own rows
  // rather than stated — the redlines are hung off this box, so a number kept
  // by hand here is a number that drifts the moment the chrome changes.
  //
  // The whole dialog carries FOUR torn bands: one under the header, the form
  // surface's own two, and one above the action bar. The cropped card carries a
  // single closing edge and nothing after it.
  const cardHeight = cropped
    ? SHELL_HEADER_HEIGHT + bodyHeight + SHELL_TEAR_HEIGHT
    : SHELL_HEADER_HEIGHT +
      SHELL_TEAR_HEIGHT +
      SHELL_TEAR_HEIGHT +
      SHELL_FORM_INSET +
      bodyHeight +
      SHELL_FORM_INSET +
      SHELL_TEAR_HEIGHT +
      SHELL_TEAR_HEIGHT +
      SHELL_ACTION_BAR_HEIGHT;

  return (
    <div
      ref={fitRef}
      className={fitStyle}
      data-testid="redesign-diagram"
      style={
        {
          "--demo-fit": fit,
          "--demo-diagram-width": `${width}px`,
          "--demo-body-height": `${bodyHeight}px`,
          "--demo-card-height": `${cardHeight}px`,
          "--demo-toggle-gap": `${toggleGap}px`,
          "--demo-frame-height": `${(aspectHeight / aspectWidth) * 100}cqw`,
        } as CSSProperties
      }
    >
      {/* The one live control on the stage, and so the one thing here drawn at
        the size a hand has to hit rather than at the picture's scale. */}
      <SegmentedControl
        ariaLabel={ariaLabel}
        className={toggleStyle}
        options={ARRANGEMENTS}
        value={arrangement}
        onValueChange={(next) => setArrangement(next as Arrangement)}
      />

      {/* The air above the drawing — see `airAboveStyle`. */}
      <div className={cx(airStyle, airAboveStyle)} aria-hidden />

      <div className={drawingBoxStyle}>
        <div className={drawingStyle} data-testid="redesign-drawing">
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
              {redlines.map((redline, index) => (
                <div
                  key={redline.label}
                  className={redlineStyle}
                  data-side={redline.side}
                  style={{ top: `${redline.top}px` }}
                >
                  {annotation === "labels" ? (
                    <span
                      className={redlineLabelStyle}
                      data-testid="redline-label"
                      style={{ top: `${redline.attach}px` }}
                    >
                      {redline.label}
                    </span>
                  ) : (
                    <span
                      className={cx(badgeStyle, redlineBadgeStyle)}
                      data-testid="redline-badge"
                      style={{ top: `${redline.attach}px` }}
                    >
                      {index + 1}
                    </span>
                  )}
                  <RedlineMark {...redline} />
                </div>
              ))}
            </div>

            <ShiftFormShell cropped={cropped}>
              <div className={bodyStyle}>
                <div
                  className={cx(paneStyle, before.className)}
                  data-testid="before-pane"
                  data-presented={showing("before")}
                  aria-hidden={!showing("before")}
                  inert={!showing("before")}
                >
                  {before.children}
                </div>

                <div
                  className={cx(paneStyle, after.className)}
                  data-testid="after-pane"
                  data-presented={showing("after")}
                  aria-hidden={!showing("after")}
                  inert={!showing("after")}
                >
                  {after.children}
                </div>

                {/* Outside both panes, so it neither fades nor travels with
                  them — the cut is the block's, not the arrangement's. It stays
                  MOUNTED whenever either arrangement is cut, because on the way
                  out it has to outlive the one it belongs to. */}
                {before.overflows || after.overflows ? (
                  <div
                    className={cropFadeStyle}
                    data-testid="crop-fade"
                    data-presented={Boolean(
                      (showing("before") ? before : after).overflows,
                    )}
                    aria-hidden
                  />
                ) : null}
              </div>
            </ShiftFormShell>
          </div>
        </div>
      </div>

      {/* ...and the air below it, which carries the legend's clearance only
        while there is a legend under it to keep off. */}
      <div
        className={cx(
          airStyle,
          annotation === "numbers" ? airBelowLegendStyle : undefined,
        )}
        aria-hidden
      />

      {/* Only the numbered form needs saying out loud, and only while the marks
        it explains are up. */}
      {annotation === "numbers" ? (
        <ol
          className={legendStyle}
          data-testid="redline-legend"
          data-presented={showing("before")}
          aria-hidden={!showing("before")}
        >
          {redlines.map((redline, index) => (
            <li key={redline.label} className={legendEntryStyle}>
              <span className={badgeStyle} aria-hidden>
                {index + 1}
              </span>
              {redline.label}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
