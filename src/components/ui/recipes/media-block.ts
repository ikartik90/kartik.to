import { defineSlotRecipe } from "@pandacss/dev";

export const mediaBlock = defineSlotRecipe({
  className: "media-block",
  description:
    "A standalone image or video block, the same in the reader and the editor.",
  slots: ["root", "frame", "tile", "image", "backgroundEffect"],
  base: {
    // Must not clip: the editor's control rail straddles the frame's top edge.
    root: {
      position: "relative",
      display: "grid",
      alignSelf: "stretch",
      width: "token(spacing.full)",
    },
    // The picture's own box, not the figure's. Its width is load-bearing: in the centred flex column
    // it would otherwise shrink-wrap and collapse the media's query container.
    frame: {
      position: "relative",
      display: "flex",
      width: "token(spacing.full)",
      minWidth: 0,
      // No `overflow: hidden`: clipping here would round every published picture whatever its radius.
      borderRadius: "xl",
    },
    // A button around the picture, not the frame, so the transport over the frame stays outside it.
    tile: {
      display: "block",
      width: "token(spacing.full)",
      minWidth: 0,
      padding: "none",
      border: "none",
      background: "none",
      appearance: "none",
      cursor: "zoom-in",
      // Rung 1, over the ground, as in `collectionGrid`.
      position: "relative",
      zIndex: 1,
      "html[data-keyboard-focus] &:focus-visible": {
        boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
      },
    },
    image: {
      width: "token(spacing.full)",
      // No radius: the picture's own properties state it.
      display: "block",
      borderWidth: "token(spacing.3xs)",
      borderStyle: "solid",
      borderColor: "border.divider",
      // The editor has no tile, so the image takes rung 1 itself.
      position: "relative",
      zIndex: 1,
    },
    backgroundEffect: {
      position: "absolute",
      inset: 0,
      zIndex: 0,
      borderRadius: "inherit",
      pointerEvents: "none",
    },
  },
});
