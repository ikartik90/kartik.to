import { defineSlotRecipe } from "@pandacss/dev";

export const checkboxField = defineSlotRecipe({
  className: "checkbox-field",
  description:
    "A checkbox's box and check mark, the control of a `field`: neutral when off, brand accent when on.",
  slots: ["control", "box"],
  base: {
    control: {
      gridColumn: 1,
      gridRow: 1,
      position: "relative",
      flexShrink: 0,
      display: "block",
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
      // Inset box-shadow, not a border, which would shrink the box's interior.
      boxShadow:
        "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
      color: "field.text.active",
      transition: "background-color 150ms ease, box-shadow 150ms ease",
      "[aria-checked='true'] &": {
        backgroundColor: "field.bg.active",
        boxShadow:
          "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-active)",
      },
      // SVGR sets the stroke to currentColor, so `color` above tints it.
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
