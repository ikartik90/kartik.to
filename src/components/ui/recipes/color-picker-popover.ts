import { defineRecipe } from "@pandacss/dev";

// Pinned beside the rail horizontally, and vertically at the swatch's position when it opened
// (`usePickerPin`), so it holds still while the rail scrolls.
export const colorPickerPopover = defineRecipe({
  className: "color-picker-popover",
  description:
    "The popover holding the colour picker, docked inside the properties panel beside the swatch that opened it.",
  base: {
    position: "fixed",
    // Over the rail (50), which it opens from.
    zIndex: 60,
    // The real `top` comes inline from `usePickerPin` in the same commit.
    top: 0,
    insetInlineEnd:
      "calc(token(sizes.propertiesPanelWidth) + token(spacing.xs))",
    width: "token(sizes.propertiesPanelWidth)",
    backgroundColor: "bg.surface",
    "--colors-field-bg-default":
      "var(--colors-field-bg-default-on-surface)",
    color: "text.body",
    borderRadius: "md",
    borderWidth: "token(spacing.3xs)",
    borderStyle: "solid",
    borderColor: "border.divider",
    // Not clipped: the format menu runs past the footer and must live inside this panel to anchor.
    overflow: "visible",
    display: "flex",
    flexDirection: "column",
    boxShadow:
      "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
    _bottomSheet: {
      positionAnchor: "auto",
      top: "token(spacing.lg)",
      insetInline: "token(spacing.lg)",
      width: "auto",
      positionTryFallbacks: "none",
    },
  },
});
