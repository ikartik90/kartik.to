import { defineRecipe } from "@pandacss/dev";

export const selectionPopover = defineRecipe({
  className: "selection-popover",
  description:
    "The floating toolbar over selected text, a link or a list marker; `align` centres it or aligns it to the start.",
  base: {
    position: "fixed",
    zIndex: 50,
    positionAnchor: "--selection-popover",
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
