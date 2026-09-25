import { ASPECT_RATIOS } from "../../../utils/demo-frame-sizing";

// Style pieces spread into recipes that live in more than one file. A piece
// only one recipe file needs lives in that file instead.

// Every CSS shape any recipe needs the app's aspect ratios in, all generated
// from the single `[W, H]` map in src/utils/demo-frame-sizing.ts. Two of them
// are the demo frame's, and they read as unrelated values in the output —
// `aspect-ratio: 3 / 2` against a min-height of `calc(200cqw / 3)` — which is
// exactly why they were allowed to drift apart by hand: the floor states the
// ratio INVERTED, so the two never look like copies of each other and a careful
// reader can correct one and leave the other sitting at the old value. Deriving
// them from the same tuple is the only thing that makes them impossible to
// disagree.
//
// The entries are named for the RATIOS, not for the demo frame, because a
// second consumer has arrived: `linkCard` shapes its box off the same map. The
// map itself is deliberately not renamed — see the note over `ASPECT_RATIOS`
// for what its keys cost the last time they were named something other than
// the answer.
export const aspectRatioEntries = Object.entries(ASPECT_RATIOS);

/**
 * The numeric value at the end of a field frame — the slider's readout and the
 * colour input's opacity are ONE box wearing ONE set of rules, so a column of
 * slider rows and colour rows lines its hairlines and its numbers up. They were
 * two numbers before (a 60px `sizes.effectColorOpacity` beside the slider's
 * 28px), which is how two things that have to match stop matching.
 *
 * The box is an <input>, so it also wears the `field` recipe's `control` reset
 * — and has to beat that slot's `flex: 1 1 0` / `width: 100%`, which would grow
 * the number across the ruler beside it. One stated width instead, for every
 * one of them: a column of rows lines up because the boxes are the same size,
 * not because their contents happen to be. It was content-sized over a 28px
 * floor before, which drew a different width per row and moved the hairline
 * beside it as a value counted past 9.
 *
 * It also takes the frame's dead space with it. The flex gap on its left and
 * the frame's own inline padding on its right would otherwise fall through to
 * the frame, whose mousedown forwards focus to the field's CONTROL — so a click
 * a few pixels off the number moves a slider's thumb instead of placing a caret
 * in the box. A negative margin pulls the box out over each side, an equal
 * padding puts the number back on exactly the pixel it is drawn on, and
 * `alignSelf` claims the frame's full height the way a slider track does. Each
 * side is scoped to the arrangement that has the space to reclaim, so a
 * re-composed frame cannot pull the box out over a sibling.
 *
 * The stated width is the DRAWN box, reclaimed space included — that space was
 * already the frame's own padding, so the number keeps sitting on the pixel it
 * always sat on and only the room in front of it changes.
 */
export const fieldValueBox = {
  // Doubled class, and this is load-bearing: the box wears the `field` recipe's
  // `control` reset as well as its own slot, and Panda emits slot recipes
  // ALPHABETICALLY inside `@layer recipes.slots` — `.field__control` lands
  // after `.color-field__opacity`, so at equal specificity the reset's
  // `flex: 1 1 0` / `width: 100%` / `min-width: 0` won on source order and the
  // opacity box's stated width had simply never applied. `&&` puts every
  // declaration that overlaps the reset a specificity step above it, wherever
  // the box is used and whatever the slot is called.
  "&&": {
    flex: "0 0 auto",
    width: "token(sizes.fieldValue)",
    alignSelf: "stretch",
    textAlign: "right",
    // The number changes on every drag frame and every keystroke; proportional
    // digits would make it shuffle horizontally as it counts.
    fontVariantNumeric: "tabular-nums",
    "&:not(:first-child)": {
      marginInlineStart: "calc(token(spacing.md) * -1)",
      paddingInlineStart: "md",
    },
    "&:last-child": {
      marginInlineEnd: "calc(token(spacing.md) * -1)",
      paddingInlineEnd: "md",
    },
  },
} as const;
