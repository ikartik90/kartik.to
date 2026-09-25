import { defineSlotRecipe } from "@pandacss/dev";

// The other toggle control of the field family (see `switchField`).
// Structural difference: no `size` — the checkbox is drawn at a single
// geometry (Figma 757:4635), so the field's `size` scales only the
// label/hint beside it.
export const checkboxField = defineSlotRecipe({
  className: "checkbox-field",
  description:
    "The box + check of a checkbox — the control slot of a `field`. Off = neutral, on = brand accent (keyed off `aria-checked` on the <button role=checkbox>), reusing the exact tokens the text input and the switch use. Unlike the switch it has no `size`: one geometry — a 20px hit frame around a 16px visual box, the 2px surround keeping the box optically centred on the label's cap-height. The check glyph is the shared 20px `check-small` icon overhanging the box by 2px a side (as drawn), revealed by opacity so it fades rather than pops.",
  slots: ["control", "box"],
  base: {
    control: {
      // First column of the grid `field` sets up for a toggle.
      gridColumn: 1,
      gridRow: 1,
      position: "relative",
      flexShrink: 0,
      display: "block",
      // The full 20px frame — hit target and layout box; the `box` slot
      // draws the 16px square centred inside it.
      width: "token(spacing.xxl)",
      height: "token(spacing.xxl)",
      padding: "none",
      margin: "none",
      border: "none",
      background: "none",
      appearance: "none",
      cursor: "pointer",
      _disabled: { cursor: "not-allowed", opacity: 0.5 },
    },
    box: {
      position: "absolute",
      top: "token(spacing.xs)",
      left: "token(spacing.xs)",
      width: "token(spacing.xl)",
      height: "token(spacing.xl)",
      borderRadius: "sm",
      backgroundColor: "field.bg.default",
      // Inset box-shadow, not a `border` — same reasoning as the switch
      // track.
      boxShadow:
        "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
      // The glyph is invisible until checked, so it needs no off tone.
      color: "field.text.active",
      transition: "background-color 150ms ease, box-shadow 150ms ease",
      "[aria-checked='true'] &": {
        backgroundColor: "field.bg.active",
        boxShadow:
          "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-active)",
      },
      // A 20px icon on a 16px box, so it hangs 2px off every side —
      // drawn at its own size rather than scaled down to fit. SVGR
      // rewrites its stroke to currentColor, so `color` above tints it.
      "& > svg": {
        position: "absolute",
        top: "calc(token(spacing.xs) * -1)",
        left: "calc(token(spacing.xs) * -1)",
        width: "token(spacing.xxl)",
        height: "token(spacing.xxl)",
        display: "block",
        pointerEvents: "none",
        opacity: 0,
        transition: "opacity 150ms ease",
      },
      "[aria-checked='true'] & > svg": { opacity: 1 },
    },
  },
});
