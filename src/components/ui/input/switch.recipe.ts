import { defineSlotRecipe } from "@pandacss/dev";

// Named `switchField`: `switch` is a reserved word and breaks the generated export.
export const switchField = defineSlotRecipe({
  className: "switch-field",
  description:
    "A toggle switch's track and thumb, the control of a `field`: neutral when off, brand accent when on, in three `size`s.",
  slots: ["control", "thumb"],
  base: {
    control: {
      position: "relative",
      flexShrink: 0,
      display: "inline-block",
      padding: "none",
      margin: "none",
      appearance: "none",
      // At least half of every track height, so each size stays a pill.
      borderRadius: "lg",
      backgroundColor: "field.bg.default",
      // Inset box-shadow, not a border: a border shrinks the interior and off-centres the thumb.
      boxShadow:
        "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
      transition: "background-color 150ms ease, box-shadow 150ms ease",
      "&[aria-checked='true']": {
        backgroundColor: "field.bg.active",
        boxShadow:
          "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-active)",
      },
      _disabled: { opacity: 0.5 },
    },
    thumb: {
      position: "absolute",
      borderRadius: "token(spacing.half)",
      backgroundColor: "field.text.default",
      transition: "transform 150ms ease, background-color 150ms ease",
      "[aria-checked='true'] &": {
        backgroundColor: "field.text.active",
      },
    },
  },
  variants: {
    size: {
      lg: {
        control: {
          width: "token(spacing.4xl)",
          height: "calc(token(spacing.xl) + 2 * token(spacing.sm))",
        },
        thumb: {
          width: "token(spacing.xl)",
          height: "token(spacing.xl)",
          top: "token(spacing.sm)",
          left: "token(spacing.sm)",
          "[aria-checked='true'] &": {
            transform: "translateX(token(spacing.xl))",
          },
        },
      },
      md: {
        control: {
          width: "token(spacing.3xl)",
          height: "calc(token(spacing.lg) + 2 * token(spacing.sm))",
        },
        thumb: {
          width: "token(spacing.lg)",
          height: "token(spacing.lg)",
          top: "token(spacing.sm)",
          left: "token(spacing.sm)",
          "[aria-checked='true'] &": {
            transform: "translateX(token(spacing.lg))",
          },
        },
      },
      sm: {
        control: {
          width: "token(spacing.xxl)",
          height: "calc(token(spacing.md) + 2 * token(spacing.xs))",
        },
        thumb: {
          width: "token(spacing.md)",
          height: "token(spacing.md)",
          top: "token(spacing.xs)",
          left: "token(spacing.xs)",
          "[aria-checked='true'] &": {
            transform: "translateX(token(spacing.md))",
          },
        },
      },
    },
  },
  defaultVariants: { size: "lg" },
  // Variants are chosen at runtime, so emit every branch.
  staticCss: [{ size: ["*"] }],
});
