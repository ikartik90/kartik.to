import { defineSlotRecipe } from "@pandacss/dev";

// A segmented control — one row, every option visible, exactly one on
// (Figma 885:1963). Almost all of it is already built: the BOX is the
// shared `toolbar` at `size="sm"` on the field tone, and the OPTIONS
// are `optionList`'s own, which already draw `field.bg.active` +
// `field.text.active` for `aria-selected` and the neutral wash on
// hover. So this recipe is only what a segmented control adds to an
// inline option list: the row and its items STRETCH, splitting the
// frame into equal segments instead of hugging their labels.
//
// Every declaration here is a property neither `optionList` nor
// `toolbar` sets, which is what keeps the composition safe — the three
// classes land in the same `@layer recipes` where a tie would be broken
// by emission order. That is also why the row fills with `flex-grow` +
// `flex-basis` rather than `width`, and why `flex-shrink` is left alone:
// the `flex` shorthand would collide with the option's own
// `flex-shrink: 0`, and longhands cannot.
export const segmentedControl = defineSlotRecipe({
  className: "segmented-control",
  description:
    "Equal-width segments for a short horizontal choice — the stretch an `OptionList` behavior container needs to become a segmented control inside a `toolbar({ size: 'sm', tone: 'field' })` rail (Figma 885:1963). `list` fills the rail; `option` takes an equal share of it and centres its label. Everything else — the 28px height, the squared abutting items, the active chip — already comes from those two recipes. It serves the single-select `Listbox` (SegmentedControl) and the multi-toggle `Toolbar` (ToggleBar) alike; which of the two a row is, is a question about semantics rather than about the box. The one thing it adds beyond layout is the SEAM between adjacent segments — a hairline between two that agree (the active border where both are on, the resting one where both are off) and nothing between two that differ, where the chip's own fill already divides them.",
  slots: ["list", "option"],
  base: {
    // Stretched as well as grown, and BOTH are needed: the rail centres
    // its children, so without this the row would sit at its own
    // content height and a segment stretching to it would stretch to
    // nothing. The rail's height is definite (28px), so this row is
    // exactly that, and the segments below inherit a real box to fill.
    list: {
      flexGrow: 1,
      flexBasis: 0,
      minWidth: 0,
      alignSelf: "stretch",
    },
    option: {
      flexGrow: 1,
      flexBasis: 0,
      minWidth: 0,
      // A segment's label sits in the middle of its share; an option
      // row's sits against its leading edge. Same leaf, two jobs.
      justifyContent: "center",
      // Take the rail's full height rather than the option's own
      // 4px + line-box + 4px, which for a 24px line comes to 32 and
      // leaves the segment standing 2px proud of the 28px rail at
      // either end — invisible only because the rail clips it. A
      // stretched segment makes the selected chip's fill exactly the
      // height of the bar it is a segment OF, which is the whole read
      // of the control.
      alignSelf: "stretch",
      // Anchors the seam hairline below.
      position: "relative",

      // THE SEAM between one segment and the next, drawn by the RIGHT
      // one of each pair on its leading edge.
      //
      // Which pairs get one is the whole rule, and it follows from what
      // a seam is FOR: telling two segments apart. Where they differ
      // the fill already does that, so a line would be a second answer
      // to a question already answered — and a heavier one, since it
      // would land exactly where the chip's own edge is.
      //
      //   two on    a line, in the ACTIVE border — a run of pressed
      //             segments shares one continuous fill and would
      //             otherwise read as a single wide chip rather than as
      //             the several toggles it is.
      //   two off   a line, in the resting border — the rail's own
      //             hairline, carried inward.
      //   one each  NOTHING. The fill changes at that seam.
      //
      // Nothing is drawn by default, so the mixed case needs no rule of
      // its own; and both rules below require a PRECEDING sibling, so
      // the first segment can never paint one against the rail's edge.
      //
      // Both flavours of container are covered: `aria-selected` is what
      // a Listbox marks its chosen row with (SegmentedControl), and
      // `aria-pressed` what a Toolbar marks a pressed toggle with
      // (ToggleBar). One row is only ever one of the two, so the pairs
      // cannot collide.
      //
      // The same 0.5px weight as `optionList`'s own `divider` slot, so
      // the two hairlines that can meet in one rail do not read as two
      // different lines — but run EDGE TO EDGE where that slot holds
      // itself 2px clear.
      //
      // A floating divider is right between the groups of a toolbar,
      // which are a loose row of buttons: the gaps at its ends are what
      // say it separates two runs rather than cutting the bar. Here the
      // segments are one continuous bar with a ring around it, and a
      // seam that stops short of that ring leaves a sliver of chip
      // joined at the top and bottom — the two segments read as one
      // shape pinched in the middle rather than as two. Meeting the
      // ring is what makes the division a division.
      //
      // The segment is `alignSelf: stretch` above, so zero here is the
      // rail's full 28px exactly, and the seam lands on the inside of
      // the ring at both ends.
      "&::before": {
        content: '""',
        position: "absolute",
        insetBlock: "none",
        insetInlineStart: 0,
        width: "token(spacing.3xs)",
        backgroundColor: "transparent",
      },
      // NOTHING between two that are on. It used to be a line here, and
      // the ring made that line the third drawn in one place: the left
      // chip's trailing edge, the right chip's leading edge, and this.
      // Measured, the divider came out twice the width of every other
      // one in the rail with a darker core where all three stacked.
      //
      // The chips can say it themselves, so they do — see the ring's
      // own rule below, which withdraws ONE of the two abutting edges
      // so what is left is a single hairline of exactly the weight the
      // rest of the rail is drawn at.
      '&[aria-selected="false"] + [aria-selected="false"]::before, &[aria-pressed="false"] + [aria-pressed="false"]::before':
        {
          backgroundColor: "field.border.default",
        },

      // THE SELECTION RING — the whole way round, as every other
      // `field.bg.active` chip wears it.
      //
      // Stated in FULL rather than inherited from `optionList`'s, which
      // draws the same edge. The two agree and this one wins on every
      // property it names — but the shared ring is on trial and this
      // one is not, so it does not depend on it: pulling the trial must
      // not take the rail's own hairline out with it.
      //
      // The BLOCK edges are that hairline, put back. The rail draws its
      // edge as an inset box-shadow, which paints above the rail's
      // background but below its children's, so an opaque chip lands on
      // top of it and the ring is what stops the rail reading as nicked.
      //
      // The INLINE edges close the chip. They overlap the seam's
      // territory and win it: where the seam's rule was that two
      // segments which differ need no line — the fill already divides
      // them — a chip that is outlined on three sides and open on the
      // fourth reads as unfinished, not as economical. The seam still
      // owns the line between two segments that AGREE, where there is
      // no chip edge to do the job.
      //
      // Nothing squares the middle corners because nothing has to: a
      // `size=sm` rail's items are already square, and the ring takes
      // its radius from the chip it edges.
      //
      // Per-side longhands, so the two rules below each add their own
      // corner without restating the others — where a `box-shadow` is
      // one property a later rule replaces WHOLE, and the slot already
      // spends its box-shadow on the focus ring.
      '&[aria-selected="true"]::after, &[aria-pressed="true"]::after': {
        content: '""',
        position: "absolute",
        inset: 0,
        // Decoration; the press belongs to the segment under it.
        pointerEvents: "none",
        borderStyle: "solid",
        borderColor: "field.border.active",
        borderWidth: "token(spacing.3xs)",
      },
      // The ends of the row, where the chip meets the rail's own corner.
      //
      // The radius is not decoration here, it is the difference between
      // a line and a nick. The rail CLIPS its row, and clipping a square
      // 1px border with a 4px corner does not bend that border round the
      // curve — it slices the corner off it, leaving the edge to stop
      // dead a few pixels short at the top and start again below. The
      // overlay has to carry the rail's corner itself so it curves
      // INSIDE the clip and meets the rail's hairline where the two
      // become one line.
      //
      // Logical longhands, so a right-to-left row rounds the end that is
      // actually its outside.
      '&[aria-selected="true"]:first-child::after, &[aria-pressed="true"]:first-child::after':
        {
          borderInlineStartWidth: "token(spacing.3xs)",
          borderStartStartRadius: "sm",
          borderEndStartRadius: "sm",
        },
      '&[aria-selected="true"]:last-child::after, &[aria-pressed="true"]:last-child::after':
        {
          borderInlineEndWidth: "token(spacing.3xs)",
          borderStartEndRadius: "sm",
          borderEndEndRadius: "sm",
        },
      // Two chips that abut would each draw the line between them, at
      // twice the weight of every other line in the rail. The RIGHT one
      // of the pair gives its leading edge up, so the divider is the
      // left one's trailing edge alone — one hairline, and the same
      // hairline a chip shows against an unpressed neighbour or against
      // the rail itself.
      '&[aria-selected="true"] + [aria-selected="true"]::after, &[aria-pressed="true"] + [aria-pressed="true"]::after':
        {
          borderInlineStartWidth: 0,
        },
    },
  },
});
