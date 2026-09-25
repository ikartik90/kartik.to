import { defineRecipe } from "@pandacss/dev";

export const selectionPopover = defineRecipe({
  className: "selection-popover",
  description:
    "Shared floating popover for the text-selection / link / numbering / bullet menus — anchored above the target via CSS anchor() and flipped below when there's no room (Figma 422:833 selection, 474:74 numbering, 475:204 bullet). Composes with `toolbar` for the rail itself and adds only what floating costs: the anchor, the hairline, the elevation, and a clip. `align=center` centres on the target (text selection / link); `align=start` left-aligns to it (list-marker menus).",
  base: {
    position: "fixed",
    zIndex: 50,
    positionAnchor: "--selection-popover",
    // Default above the target; flip below when there is no room.
    bottom: "anchor(top)",
    marginBottom: "sm",
    positionTryFallbacks: "flip-block",
    maxWidth: "min(100vw, token(sizes.articleContent))",
    borderWidth: "token(spacing.3xs)",
    borderStyle: "solid",
    borderColor: "border.divider",
    overflow: "hidden",
    boxShadow:
      "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
  },
  variants: {
    align: {
      center: { left: "anchor(center)", translate: "-50% 0" },
      start: { left: "anchor(left)" },
    },
  },
  defaultVariants: { align: "center" },
});
