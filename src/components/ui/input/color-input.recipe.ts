import { defineSlotRecipe } from "@pandacss/dev";
import { fieldValueBox } from "../recipes/shared";

// A colour as TWO editable parts inside one field frame — the swatch,
// the six hex digits, and an opacity percentage — divided by the same
// hairlines the slider uses, so a column of colour rows and slider rows
// reads as one set of controls (Figma 872:7296).
//
// The `#` is drawn by the field, never typed: `sanitizeHex` strips it
// wherever it lands, so pasting `#FFAB6F` and typing `FFAB6F` agree.
//
// Both inputs carry `data-control`, not just the hex one. The `field`
// recipe lights the whole frame off `:has([data-control]:focus-visible)`,
// so without it the frame would stay resting while the opacity input
// held focus — the one field in the panel that looked inactive while
// being edited. Only the hex input takes the field's `id`, since a
// label may point at exactly one control.
export const colorField = defineSlotRecipe({
  className: "color-field",
  description:
    "Colour input — a live swatch, a six-digit hex input and a 0–100 opacity input, divided by hairlines inside the shared `field` frame (Figma 872:7296). The swatch composites the colour over a checkerboard so a partial opacity reads as partial rather than as a lighter colour.",
  slots: ["swatch", "swatchFill", "separator", "hex", "opacity"],
  base: {
    // The checkerboard. Without it a 0% colour is indistinguishable
    // from a 100% one that happens to match the field fill, and the
    // opacity input would be editing something invisible.
    swatch: {
      // A BUTTON now, not a plate: it opens the picker. The reset is
      // here rather than on the element because the swatch is the
      // trigger wherever a colour field is used, and a field that drew
      // a native button border inside its own frame would be the one
      // control in the app with two edges.
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
      // A hairline of its own: a pale colour on a pale field would
      // otherwise have no edge at all.
      boxShadow: "inset 0 0 0 0.5px var(--colors-field-border-default)",
    },
    // The colour itself, over the checker. A separate layer rather than
    // a background on the swatch, because the checker occupies the
    // background and the two have to composite.
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
      // Digits only, and they change as you type — proportional figures
      // would make the value shuffle horizontally mid-edit.
      fontVariantNumeric: "tabular-nums",
      textTransform: "uppercase",
    },
    // The same box the slider's value wears — see `fieldValueBox`.
    opacity: { ...fieldValueBox },
  },
});
