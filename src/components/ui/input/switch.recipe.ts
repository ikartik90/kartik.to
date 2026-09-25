import { defineSlotRecipe } from "@pandacss/dev";

// Named `switchField`: `switch` is a reserved word and breaks the generated export.
export const switchField = defineSlotRecipe({
  className: "switch-field",
  description:
    "The track + thumb of a toggle switch — the control slot of a `field`. Off = neutral, on = brand accent (keyed off `aria-checked` on the <button role=switch>), reusing the field tokens the text input uses. `size` scales the track geometry and thumb travel (sm/lg); the label/hint and the control ∣ text layout come from the `field` recipe. Geometry derives from spacing tokens — track height = thumb + 2·inset, travel = width − 2·inset − thumb — so nothing is arbitrary.",
  slots: ["control", "thumb"],
  base: {
    control: {
      gridColumn: 1,
      gridRow: 1,
      position: "relative",
      flexShrink: 0,
      display: "inline-block",
      padding: "none",
      margin: "none",
      appearance: "none",
      cursor: "pointer",
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
      _disabled: { cursor: "not-allowed", opacity: 0.5 },
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
