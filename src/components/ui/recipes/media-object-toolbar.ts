import { defineRecipe } from "@pandacss/dev";

// A sibling of the cell, never a child: the cell clips and this rail overhangs its top edge.
// Revealed by opacity rather than display, so its buttons stay focusable.
export const mediaObjectToolbar = defineRecipe({
  className: "media-object-toolbar",
  description:
    "The control pill shown over an image, collection slot or demo in the editor on hover or focus.",
  base: {
    position: "absolute",
    // Centred on the cell's top edge; the grid's 20px gap swallows the overhang.
    insetBlockStart: 0,
    insetInlineStart: "half",
    transform: "translate(-50%, -50%)",
    // Rung 3 of the cell's paint ladder (see `collectionGrid`'s `backgroundEffect`).
    zIndex: 3,
    borderWidth: "token(spacing.3xs)",
    borderStyle: "solid",
    borderColor: "border.divider",
    boxShadow:
      "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
    overflow: "hidden",
    maxWidth: "calc(100% - token(spacing.lg) * 2)",
    opacity: 0,
    // Inert while hidden, so an invisible control can't be hit and `&:hover` can't fire.
    pointerEvents: "none",
    transition: "opacity 150ms ease",
    // Also up while the pointer is on its overhanging half, or anything in it or the cell has focus.
    "[data-media-cell]:hover + &, [data-media-cell]:focus-within + &, &:hover, &:focus-within":
      {
        opacity: 1,
        pointerEvents: "auto",
      },
    // Down at once for the whole reorder. The extra `[data-media-cell]` breaks the tie with the reveal rule.
    "[data-collection-grid][data-reordering] [data-media-cell] + &": {
      opacity: 0,
      pointerEvents: "none",
      transition: "none",
    },
    // Stays down after a drop until the pointer moves; see `pointerIdle` in collection-grid.tsx.
    "[data-collection-grid][data-pointer-idle] [data-media-cell] + &": {
      opacity: 0,
      pointerEvents: "none",
    },
    // Fades back over the landing flight; matches LANDING_MS / LANDING_EASE in collection-grid.tsx.
    "[data-media-cell][data-landing] + &": {
      transition: "opacity 100ms ease-out",
    },
  },
});
