import { defineSlotRecipe } from "@pandacss/dev";

// The collection's tile grid, in BOTH the editor and the reader — one
// recipe, because the tile itself (radius, hairline, cover crop) is the
// same object in both and only the arrangement differs.
//
//   uniform  │ editor: every slot shown, filled or not, so the 6-image
//            │ cap is visible rather than merely enforced (828:6837).
//   featured │ reader, 3+ images: the first spans the 2×2 block and the
//            │ next two stack in column 3 (829:6911).
//   pair     │ reader, exactly 2: equal 1:1 tiles. The featured
//   single   │ reader, 0–1: one tile at its NATURAL ratio, i.e. exactly
//            │ what a lone `image` block looks like. The reader has no
//            │ empty slots to draw, so a collection too small for the
//            │ skeleton splits evenly instead of leaving holes.
//
// `aspectRatio` lives on the ROOT for the two-row layouts (a 3:2 box
// divided by `1fr` rows) and on the CELL for `pair` (two squares whose
// height follows their own width), so the grid never needs a measured
// height.
// A media object standing ALONE — the picture-or-clip block in article
// prose, as opposed to the same object standing in a numbered slot
// (`collectionGrid`). One recipe for both the editor's canvas and the
// reader's article, because a block that composed differently in the
// two would make the canvas a guess rather than a preview — the same
// argument that put `objectFit` and `padding` on the node itself.
//
// This replaces the pair of single-part recipes that used to draw it
// (`articleImg`, `articleMediaFrame`). They were separate only because
// nothing had ever needed to put a third box in between; the ground
// behind a picture and the control rail over it are both that third
// box, and a slot recipe is where a composition of boxes belongs.
export const mediaBlock = defineSlotRecipe({
  className: "media-block",
  description:
    "The boxes a standalone media block is composed of, in the editor and in the reader alike: `root` is the box that does NOT clip, so the editor's control rail can straddle the picture's top edge with half of it outside; `frame` is the positioned box the ground fills and a clip's transport pins to; `tile` is the reader's hit target that opens the enlargement; `image` is the picture; `backgroundEffect` is the shader ground behind it. Mirrors `collectionGrid`'s slot/cell/tile/image/backgroundEffect for the same object standing in a numbered slot.",
  slots: ["root", "frame", "tile", "image", "backgroundEffect"],
  base: {
    // The rail is centred on the frame's top edge with half of it
    // hanging above — so this box must not clip, exactly as the grid's
    // `slot` must not. `grid` rather than `block` so the frame stretches
    // in both axes without restating a size; the rail is absolute, so it
    // never becomes a second track.
    root: {
      position: "relative",
      display: "grid",
      alignSelf: "stretch",
      width: "token(spacing.full)",
    },
    // The box around the picture — the picture's own, NOT the figure's,
    // which also holds the caption. It is the positioned parent a clip's
    // transport pins to, so the chip lands in the corner of the picture
    // rather than down beside the words under it, and it is what the
    // shader ground fills.
    //
    // The width is load-bearing, not a default: `articleShowcase` is a
    // centred flex column, so a box that did not state one would
    // shrink-wrap, and the media's own frame inside it — a query
    // container, whose inline size may not come from its contents —
    // would then collapse to nothing at all. `flex` rather than `block`
    // so no line box puts a descender gap under the picture.
    frame: {
      position: "relative",
      display: "flex",
      width: "token(spacing.full)",
      minWidth: 0,
      // The CARD's corner — a constant of the design system, and
      // nothing to do with the picture inside it. `xl`, the same one a
      // collection cell and the lightbox's frame draw, because all
      // three are the same container seen from somewhere else: the box
      // a media object and its ground sit in. The properties panel's
      // slider rounds the media OBJECT and only the media object.
      //
      // It became visible the moment a standalone block could carry a
      // shader ground: the ground fills this box (`inset: 0`, corner
      // inherited), so without a corner here an inset picture floated
      // rounded inside a square card, where the identical picture in a
      // collection slot sat on a rounded one.
      //
      // Deliberately NOT paired with `overflow: hidden`, which is where
      // this parts company with the other two. A collection cell clips
      // because a photo FILLS its slot and has to take the card's
      // shape; an article's media block has no card behind it until a
      // ground is added, and clipping here would round every picture
      // ever published in an article — making the panel a liar again
      // (`Radius 0` under a visibly rounded corner), which is the exact
      // thing `DEFAULT_MEDIA_RADIUS` was written to end.
      borderRadius: "xl",
    },
    // The reader's hit target — the block opens its own enlargement,
    // exactly as a collection tile does. A button around the picture
    // and NOT the frame, so the transport laid over the same frame
    // stays outside it: one control may not contain another.
    tile: {
      display: "block",
      width: "token(spacing.full)",
      minWidth: 0,
      padding: "none",
      border: "none",
      background: "none",
      appearance: "none",
      cursor: "zoom-in",
      // Over the ground behind it. The frame is `position: relative`
      // with no z-index, so it is not a stacking context and whatever
      // stands in it competes with the gradient in the same one — the
      // same paint ladder a collection cell states, for the same
      // reason.
      position: "relative",
      zIndex: 1,
      "html[data-keyboard-focus] &:focus-visible": {
        boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
      },
    },
    image: {
      width: "token(spacing.full)",
      // No corner: an article image, like a collection tile, wears the
      // radius its own properties state and nothing else — see
      // `DEFAULT_MEDIA_RADIUS`.
      display: "block",
      borderWidth: "token(spacing.3xs)",
      borderStyle: "solid",
      borderColor: "border.divider",
      // The editor puts the picture straight into the frame with no
      // tile around it, so it names its own rung on the ladder above.
      position: "relative",
      zIndex: 1,
    },
    backgroundEffect: {
      position: "absolute",
      inset: 0,
      zIndex: 0,
      // The FRAME's corner, not the picture's: the ground fills the
      // card, and the picture in front of it wears its own, which is a
      // property of the picture and stops at the picture.
      borderRadius: "inherit",
      // Decoration under the picture — whatever is laid over it owns
      // the press.
      pointerEvents: "none",
    },
  },
});
