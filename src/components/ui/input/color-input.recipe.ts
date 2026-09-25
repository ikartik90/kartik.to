import { defineSlotRecipe } from "@pandacss/dev";
import { fieldValueBox } from "../recipes/shared";

// Both inputs carry `data-control`, so the frame lights while either has focus.
export const colorField = defineSlotRecipe({
  className: "color-field",
  description:
    "Colour input inside a `field` frame: a swatch, a hex input and an opacity input, divided by hairlines.",
  slots: ["swatch", "swatchFill", "separator", "hex", "opacity"],
  base: {
    swatch: {
      appearance: "none",
      margin: "none",
      padding: "none",
      borderWidth: "0",
      cursor: "pointer",
      position: "relative",
      flexShrink: 0,
      width: "token(spacing.xl)",
      height: "token(spacing.xl)",
      borderRadius: "sm",
      overflow: "hidden",
      backgroundColor: "field.bg.default",
      backgroundImage:
        "conic-gradient(var(--colors-border-divider) 0deg 90deg, transparent 90deg 180deg, var(--colors-border-divider) 180deg 270deg, transparent 270deg 360deg)",
      backgroundSize: "token(spacing.md) token(spacing.md)",
      boxShadow: "inset 0 0 0 0.5px var(--colors-field-border-default)",
    },
    // A separate layer: the checkerboard occupies the swatch's background.
    swatchFill: { position: "absolute", inset: 0 },
    separator: {
      alignSelf: "stretch",
      flexShrink: 0,
      width: "token(spacing.3xs)",
      backgroundColor: "field.border.default",
      transition: "background-color 150ms ease",
      "[data-field]:has([data-control]:focus-visible) &": {
        backgroundColor: "field.border.active",
      },
    },
    hex: {
      flex: "1 1 0",
      minWidth: 0,
      fontVariantNumeric: "tabular-nums",
      textTransform: "uppercase",
    },
    opacity: { ...fieldValueBox },
  },
});
