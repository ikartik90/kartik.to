"use client";

import type { ReactNode } from "react";
import { css, cx } from "../../../styled-system/css";
import { RedesignDiagram, type DiagramRedline } from "./redesign-diagram";
import type { DemoProps } from "./registry";
import { Field } from "@/components/ui/input/field";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/wireframe";
import BanIcon from "@/assets/icons/ban.svg";
import EditIcon from "@/assets/icons/edit.svg";
import GotoIcon from "@/assets/icons/goto.svg";
import InfoIcon from "@/assets/icons/info.svg";
import MapPinIcon from "@/assets/icons/map-pin.svg";
import SiteMapWireframe from "@/assets/wireframes/site-map.svg";

// ---------------------------------------------------------------------------
// Position Fields Consolidation — what a job position's details cost the "Post
// a Shift" form, before and after (Figma 1167:8542: 1167:7778 / 1167:8451
// before, 1166:7461 / 1167:7991 after). Two arrangements of the same screen, on
// one toggle, staged on the same `RedesignDiagram` the Scheduling Layout
// Redesign is.
//
// BEFORE, the position arrives as five form fields you are not allowed to
// touch: Site Address, Unit, Hourly Wage, Department and Entrance
// Instructions, each wearing a ⊘, each taking a full field's worth of room to
// say something the form has already decided. The redlines name the two costs
// separately, because they are two. Half a screen of DISABLED FIELDS is the
// first. The second is POOR HIERARCHY: five fields at one weight, in one flat
// column, so the position's name, where it is and what it pays all read as the
// same size of thing — and nothing on the screen says which of them you are
// meant to take in first.
//
// AFTER, the same five values are one read-only summary panel, and that panel
// has a shape: the position's name across the top with the way through to it,
// then the address and wage down the left against a map of the site and the
// department down the right. Nothing is a field, so nothing has to be disabled;
// nothing is at the same weight as everything else, so there is an order to
// read it in. The two things the redlines complained about are the two things
// that are gone, which is the whole point of showing them together.
//
// Nothing on the panel is editable in place either — the one way through to the
// position is the link across its top, which is the same answer the old screen
// gave in its notice, given once instead of alongside five dead fields.
//
// Everything about HOW the comparison is shown lives in `RedesignDiagram`.
// ---------------------------------------------------------------------------

// The jagged block's own height — the Figma's 332px Form Wrapper (1167:7791)
// less the 16px the form surface insets its content by, top and bottom.
//
// It is the BEFORE that fixes it: the redlines are drawn to this block and have
// to reach their full length inside it, where the After — a third the height —
// would happily be shown in any box at all. The room the After does not need is
// then the visible part of the argument rather than dead space, so it is
// centred in the block rather than pinned to its top.
const BODY_HEIGHT = 300;

// The Figma hangs the card 12px under the toggle (1167:7778: a 28px control at
// y=16, the card's header opening at 56) rather than the 76 its sibling has to
// spare — this one is the whole dialog and fills far more of the frame.
const TOGGLE_GAP = 12;

// Where both marks open: level with the first field they annotate, measured
// from the top of the card. Written as the sum it is rather than as the Figma's
// 198, because the terms are this codebase's rather than the drawing's — the
// header box closes with a hairline, and the form surface insets its content by
// 16px where the Figma's wrapper uses 12. The notice itself now measures the
// Figma's 82 exactly.
//
//   73  the header and the torn edge under it
//   36  the jagged block's toothed top, and its inset below that
//   82  the notice
//   12  the gap after it
const REDLINE_TOP = 73 + 36 + 82 + 12;

/**
 * The two costs of the old arrangement, bracketed on the side each is read
 * from. Both open level with the first field they annotate, and both hang their
 * label off a leader tick halfway down (Figma 1167:8544 / 1167:8549).
 *
 * They END differently, and that difference is the argument. "Disabled Fields"
 * closes with a foot tick: it is a countable set, and all five of them are
 * disabled whether or not you can see the fifth. "Poor Hierarchy" cannot close,
 * because it is not a set at all — it is a property of the whole flat column,
 * which the card crops rather than finishes. So it runs on into dots, saying
 * that what is wrong with the part you can see is equally wrong below the cut.
 */
const REDLINES: DiagramRedline[] = [
  {
    label: "Disabled Fields",
    side: "start",
    top: REDLINE_TOP,
    spine: 218,
    attach: 109,
  },
  {
    label: "Poor Hierarchy",
    side: "end",
    top: REDLINE_TOP,
    spine: 172,
    tail: 44,
    attach: 109,
  },
];

// --- The old arrangement ---------------------------------------------------

// The old body leaves upward and the new one arrives from above, so at no point
// are the two crossing in opposite directions — one is on its way out of the
// top of the card and the other is following it in.
const beforePaneStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "lg",
  "&[data-presented=false]": { transform: "translateY(-12px)" },
});

// This notice carries a HEADING with a description under it. The library's other
// two carry body copy — v1's is a sentence about recurrence, not a title — so
// the two things that differ are said HERE rather than in the recipe, which
// keeps its `sidenote` prose at 75% for them.
//
// The heading sets in `bodySmall`, which is 14px on a 24px line exactly (Figma
// 1167:7927). Its TONE is not set here: the heading is wrapped in a `<strong>`,
// which is the recipe's own emphasis rule, and that already paints it the full
// `field.text.default` the icon takes — a title and the glyph announcing it are
// one statement, not two levels of one. The description under it keeps the
// label's own 75% prose tone, which is what the recipe is for.
const noticeHeadingStyle = css({
  textStyle: "bodySmall",
});

// And the icon takes a box one line of that heading tall, with its 20px glyph
// centred in it, so it sits on the heading's centre rather than on the top of a
// block whose second and third lines it has nothing to do with. `1lh` of the
// same style rather than a literal 24, so the two cannot drift apart.
const noticeIconStyle = css({
  display: "flex",
  alignItems: "center",
  textStyle: "bodySmall",
  height: "1lh",
  "& svg": { height: "token(spacing.xxl)" },
});

// The notice the position arrives under: what it is, and the only way to change
// it — which is somewhere else entirely, and is exactly why the five fields
// below it are dead.
const noticeActionStyle = css({
  display: "flex",
  flex: "none",
  alignItems: "center",
  gap: "sm",
  textStyle: "bodySmall",
  color: "field.text.active",
  whiteSpace: "nowrap",
});

const actionIconStyle = css({
  display: "block",
  flexShrink: 0,
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  "& svg": {
    display: "block",
    width: "token(spacing.full)",
    height: "token(spacing.full)",
  },
});

// The notice's own two lines of description, under its title (Figma 1167:7935).
//
// It states its own text style rather than inheriting: it sits INSIDE
// `Notice.Label`, which is the heading at 14px on a 24px line, and these are
// the smaller run beneath it — 20px line boxes, which is `sidenote`. The 2px
// above is the Figma's gap between the two (a 24px title, the block opening at
// y=26).
const noticeHintStyle = css({
  display: "flex",
  flexDirection: "column",
  marginBlockStart: "xs",
  textStyle: "sidenote",
  color: "field.text.muted",
});

const fieldsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "xl",
});

const fieldRowStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "xl",
});

// The Figma splits each row 433.25 ∣ 133.75 of its 583 (1167:7859 + 1167:7870),
// and swaps which side the narrow one is on between the two rows. So the narrow
// field states its width and the wide one takes the rest, which reproduces both
// rows from one pair of rules and lets the whole block still answer a narrower
// card.
const narrowFieldStyle = css({
  width: "133.75px",
  flexShrink: 0,
});

const wideFieldStyle = css({
  flex: "1 1 0",
  minWidth: 0,
});

// How far a refused field is turned down. The Figma dims it in two places at
// once and they compound, which is the whole effect: the LABEL is the field's
// resting ink at half strength, and the input FRAME — fill, hairline, value and
// ⊘ together — is a 50% layer on top of that, so the ⊘ inside it lands at a
// quarter and the value bar at a half. Both halves of the file agree on it
// (1167:7859 dark, 1167:8485 light), which is what makes it a token expression
// rather than two hex values.
const DIMMED_INK = "field.text.default/50";

// The whole box goes down together, rather than each part being re-toned: it is
// one control that is off, not four things that happen to be faint.
const disabledInputStyle = css({ opacity: 0.5 });

const disabledLabelStyle = css({ color: DIMMED_INK });

// The ⊘ that makes the point: a field you can read and cannot edit. It is the
// field family's own ink turned down rather than an alarm colour, because the
// screen is not warning you about anything — it is simply refusing, five times.
const banStyle = css({
  display: "block",
  flexShrink: 0,
  marginInlineStart: "auto",
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  color: DIMMED_INK,
  "& svg": {
    display: "block",
    width: "token(spacing.full)",
    height: "token(spacing.full)",
  },
});

// The one field the cut is drawn over, and so the only thing in the block that
// has to clear FASTER than the pane it sits in.
//
// The reason is the cut's own stagger. While the arrangement fades, the gradient
// covering this field is fading too, 80ms behind it — so through the first part
// of the morph the field is being UNCOVERED about as fast as it is being faded,
// and it reads as hanging on after everything above it has gone. Dropping its
// own opacity in well under half the time settles it before the gradient has
// thinned enough to matter.
const croppedFieldStyle = css({
  transitionProperty: "opacity",
  transitionDuration: "120ms",
  transitionTimingFunction: "ease-out",
  "[data-presented=false] &": { opacity: 0 },
});

// The one multi-line field (Figma 1167:7890): a 68px frame holding two lines of
// value with the ⊘ level with the FIRST of them rather than centred on both.
// The 6px inset is the Figma's own and lands between `sm` and `md`, which is
// what a 68px box holding two 28px line boxes comes to.
const textareaFrameStyle = css({
  height: "68px",
  alignItems: "flex-start",
  paddingBlock: "6px",
});

const textareaLinesStyle = css({
  flex: "1 1 0",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  color: "field.text.default",
});

/** The five fields the position occupies, and how wide each one's value runs. */
const DISABLED_FIELDS = [
  { label: "Site Address", value: "60%", width: "wide" },
  { label: "Unit", value: "44%", width: "narrow" },
  { label: "Hourly Wage", value: "54%", width: "narrow" },
  { label: "Department", value: "32%", width: "wide" },
] as const;

/**
 * One dead field: a real frame, a value you can only look at, and the ⊘.
 *
 * All five go through here, the two-line one included — a refusal that reached
 * four fields out of five would be the demo arguing against something the
 * screen does not do.
 */
function DisabledField({
  label,
  frameClassName,
  children,
}: {
  label: string;
  /** Extra geometry for the frame — the one multi-line field needs its own. */
  frameClassName?: string;
  /** The value, however many lines it runs to. */
  children: ReactNode;
}) {
  return (
    <>
      <Field.Label className={disabledLabelStyle}>{label}</Field.Label>
      <Field.Frame className={cx(disabledInputStyle, frameClassName)}>
        {children}
        <span className={banStyle} data-testid="disabled-mark" aria-hidden>
          <BanIcon />
        </span>
      </Field.Frame>
    </>
  );
}

// --- The new arrangement ---------------------------------------------------

const afterPaneStyle = css({
  display: "flex",
  flexDirection: "column",
  // The room the consolidated panel does not need, split evenly above and below
  // it, so the block reads as roomy rather than as half-empty.
  justifyContent: "center",
  // The pane itself does NOT travel. Its parts do — see `panelStyle` below —
  // which is the gesture the Scheduling Layout Redesign arrives on, and the two
  // diagrams share it: the new arrangement assembles in reading order rather
  // than sliding in as one slab. Moving the pane as well would double the
  // distance every part covers.
});

// The panel the five fields collapse into (Figma 1166:7716): the field family's
// own fill and hairline at an 8px corner, clipping its header rule to it.
const panelStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "lg",
  overflow: "hidden",
  // Its two rows carry the arrival, settling a beat apart — the name and the way
  // through first, the details under them next — so the card assembles in the
  // order it is read rather than landing as one slab.
  //
  // 260ms, `ease-out`, 12px, one 60ms step between parts: the Scheduling Layout
  // Redesign's three steps arrive on exactly these numbers, and a reader moving
  // between the two diagrams should not be able to tell them apart. Only the
  // COUNT of parts differs, because the content does.
  "& > *": {
    transitionProperty: "opacity, transform",
    transitionDuration: "260ms",
    transitionTimingFunction: "ease-out",
    "[data-presented=false] &": { opacity: 0, transform: "translateY(-12px)" },
    "&:nth-child(2)": { transitionDelay: "60ms" },
  },
  borderRadius: "md",
  backgroundColor: "field.bg.default",
  boxShadow: "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
});

// The position's name, and the way through to the screen that owns it. A rule
// under it rather than a fill on it: the header is the same surface as the body,
// separated rather than raised (Figma 1166:7717).
const panelHeaderStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "lg",
  height: "token(spacing.4xl)",
  paddingInline: "lg",
  borderBottomWidth: "token(spacing.3xs)",
  borderBottomStyle: "solid",
  borderBottomColor: "field.border.default",
  // The one bar on the panel drawn at full strength: it is the position's NAME,
  // and everything under it is that position's details.
  color: "field.text.default",
});

// `align-items: stretch` (the default, stated by its absence) so the two columns
// are one height whichever of them is taller — which is what lets the wage and
// the department below sit on one line, as the Figma draws them (1167:8423 and
// 1167:7988 both open at y=124 of a 168px row).
const panelBodyStyle = css({
  display: "flex",
  gap: "lg",
  paddingInline: "lg",
  paddingBlockEnd: "lg",
});

const detailColumnStyle = css({
  flex: "1 1 0",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "md",
});

// 208 across — the map's own width, and so the column's (Figma 1167:7985).
const mapColumnStyle = css({
  width: "208px",
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  gap: "lg",
});

const detailStyle = css({
  display: "flex",
  flexDirection: "column",
});

const detailLabelStyle = css({
  textStyle: "sidenote",
  color: "field.text.muted",
  whiteSpace: "nowrap",
});

// A read value, at half strength. The panel is a summary rather than a form, so
// its values sit a step behind the labels that name them — the reverse of the
// fields it replaces, where the value was the thing you were being denied.
const detailValueStyle = css({
  display: "flex",
  flexDirection: "column",
  color: "field.text.default",
  opacity: 0.5,
});

const detailHintStyle = css({
  display: "flex",
  flexDirection: "column",
  color: "field.text.muted",
  opacity: 0.5,
});

// The site, drawn rather than described — the one thing the old arrangement had
// no room to show at all.
//
// The committed drawing is the STREET NETWORK and nothing else. Everything the
// export wrapped around it is a box, and a box is this stylesheet's to draw:
//
//   • The wash. Figma exports it as a flat `neutral.500` at 25%, which is the
//     dark half of `field.bg.default` — so it is that token, and light gets the
//     15% it is meant to have instead of dark's 25% a second time.
//   • The ring. `filter0_i` is an inner shadow Figma authored on the FRAME, but
//     a flattened SVG applies its one filter to the whole group — so every
//     street path came out edged with a 0.5px inset shadow, which is a stroke
//     nobody drew. It is `field.border.default` on the box instead, which is
//     also what the panel around it draws its own edge with.
//   • The streets themselves. Exported twice, once per theme (1166:7742 dark,
//     1167:8324 light), differing in exactly one value — #6C7987 against
//     #8C8F93 — which are `field.text.muted` resolved in each. So they are
//     `currentColor` and this box says which, and there is one drawing rather
//     than two.
//
// The pin is `currentColor` for the same reason, and set separately below,
// because the accent is a different hue in each theme rather than a shade.
const mapStyle = css({
  position: "relative",
  width: "208px",
  height: "112px",
  flexShrink: 0,
  borderRadius: "sm",
  backgroundColor: "field.bg.default",
  boxShadow: "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
  color: "field.text.muted",
  "& > svg": {
    display: "block",
    width: "token(spacing.full)",
    height: "token(spacing.full)",
  },
});

// Where the Figma drops it on the drawing (1166:7774) — a place on a map, not a
// centred badge.
const mapPinStyle = css({
  position: "absolute",
  insetBlockStart: "35px",
  insetInlineStart: "102px",
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  color: "field.text.active",
  "& svg": {
    display: "block",
    width: "token(spacing.full)",
    height: "token(spacing.full)",
  },
});

// The last detail in each column, pinned to the foot of a row both columns
// stretch to. The two of them then align without either knowing how tall the
// other's contents came to — the map's 112px on one side, three groups of text
// on the other.
const detailFooterStyle = css({ marginBlockStart: "auto" });

/** One named value on the summary panel. */
function Detail({
  label,
  footer,
  children,
}: {
  label: string;
  /** Last in its column, and so on the row's shared bottom line. */
  footer?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={cx(detailStyle, footer && detailFooterStyle)}>
      <span className={detailLabelStyle}>{label}</span>
      {children}
    </span>
  );
}

export function PositionFieldsConsolidation({
  aspect = "3/2",
}: DemoProps = {}) {
  return (
    <RedesignDiagram
      ariaLabel="Position fields layout"
      bodyHeight={BODY_HEIGHT}
      toggleGap={TOGGLE_GAP}
      // NOT cropped. The subject is a block in the MIDDLE of the form, so the
      // whole dialog is staged and the torn edges do the arguing: a fragment of
      // a header above, a fragment of an action bar below, and the block
      // between them cut out of a form that runs on past it both ways.
      aspect={aspect}
      redlines={REDLINES}
      /* BEFORE — a position spelled out as five fields nobody may fill in. */
      before={{
        className: beforePaneStyle,
        // Five fields do not fit in the block, so the stage draws the cut they
        // run past — and the right-hand mark then runs on into it, because the
        // flatness it is naming carries on below the cut too. The new
        // arrangement claims no cut, because it fits.
        overflows: true,
        children: (
          <>
            <Notice>
              <Notice.Icon className={noticeIconStyle}>
                <InfoIcon />
              </Notice.Icon>
              <Notice.Label className={noticeHeadingStyle}>
                <strong>Default Job Position</strong>
                <span className={noticeHintStyle}>
                  <Skeleton width="97%" />
                  <Skeleton width="21%" />
                </span>
              </Notice.Label>
              <span className={noticeActionStyle}>
                <span className={actionIconStyle} aria-hidden>
                  <EditIcon />
                </span>
                Edit Position
              </span>
            </Notice>

            <div className={fieldsStyle}>
              <div className={fieldRowStyle}>
                {DISABLED_FIELDS.slice(0, 2).map((entry) => (
                  <Field
                    key={entry.label}
                    className={
                      entry.width === "narrow"
                        ? narrowFieldStyle
                        : wideFieldStyle
                    }
                  >
                    <DisabledField label={entry.label}>
                      <Skeleton width={entry.value} />
                    </DisabledField>
                  </Field>
                ))}
              </div>

              <div className={fieldRowStyle}>
                {DISABLED_FIELDS.slice(2).map((entry) => (
                  <Field
                    key={entry.label}
                    className={
                      entry.width === "narrow"
                        ? narrowFieldStyle
                        : wideFieldStyle
                    }
                  >
                    <DisabledField label={entry.label}>
                      <Skeleton width={entry.value} />
                    </DisabledField>
                  </Field>
                ))}
              </div>

              <Field className={croppedFieldStyle}>
                <DisabledField
                  label="Entrance Instructions"
                  frameClassName={textareaFrameStyle}
                >
                  <span className={textareaLinesStyle}>
                    <Skeleton width="91%" />
                    <Skeleton width="14%" />
                  </span>
                </DisabledField>
              </Field>
            </div>
          </>
        ),
      }}
      /* AFTER — the same five values, read rather than refused. */
      after={{
        className: afterPaneStyle,
        children: (
          <div className={panelStyle} data-testid="position-summary">
            <div className={panelHeaderStyle}>
              <Skeleton width="27%" />
              <span className={noticeActionStyle}>
                View Position
                <span className={actionIconStyle} aria-hidden>
                  <GotoIcon />
                </span>
              </span>
            </div>

            <div className={panelBodyStyle}>
              <div className={detailColumnStyle}>
                <Detail label="Site Location">
                  <span className={detailValueStyle}>
                    <Skeleton width="72%" />
                    <Skeleton width="17%" />
                  </span>
                </Detail>

                <span className={detailHintStyle}>
                  <Skeleton width="90%" />
                  <Skeleton width="19%" />
                </span>

                <Detail label="Hourly Wage" footer>
                  <span className={detailValueStyle}>
                    {/* 30% of the column — the Figma's 101px bar, as a share of
                      the 339 it sits in, now that nothing sits beside it. */}
                    <Skeleton width="30%" />
                  </span>
                </Detail>
              </div>

              <div className={mapColumnStyle}>
                <span className={mapStyle} data-testid="site-map">
                  <SiteMapWireframe aria-hidden />
                  <span className={mapPinStyle} aria-hidden>
                    <MapPinIcon />
                  </span>
                </span>

                <Detail label="Department" footer>
                  <span className={detailValueStyle}>
                    <Skeleton width="80%" />
                  </span>
                </Detail>
              </div>
            </div>
          </div>
        ),
      }}
    />
  );
}
