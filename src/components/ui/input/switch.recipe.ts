import { defineSlotRecipe } from "@pandacss/dev";

// Named `switchField`, not `switch` — a reserved word breaks the
// generated `export const switch`. Owns only the track + thumb; the
// surrounding grid and the label/hint come from `field`, which the
// Switch plugs into as its control (Figma 607:1166).
export const switchField = defineSlotRecipe({
  className: "switch-field",
  description:
    "The track + thumb of a toggle switch — the control slot of a `field`. Off = neutral, on = brand accent (keyed off `aria-checked` on the <button role=switch>), reusing the field tokens the text input uses. `size` scales the track geometry and thumb travel (sm/lg); the label/hint and the control ∣ text layout come from the `field` recipe. Geometry derives from spacing tokens — track height = thumb + 2·inset, travel = width − 2·inset − thumb — so nothing is arbitrary.",
  slots: ["control", "thumb"],
  base: {
    control: {
      // First column of the grid `field` sets up for a toggle.
      gridColumn: 1,
      gridRow: 1,
      position: "relative",
      flexShrink: 0,
      display: "inline-block",
      padding: "none",
      margin: "none",
      appearance: "none",
      cursor: "pointer",
      // 12px ≥ half of either track height, so both sizes read as pills.
      borderRadius: "lg",
      backgroundColor: "field.bg.default",
      // An inset box-shadow, NOT a `border`: a real border is
      // subtracted from the interior (24→23px) and the thumb is offset
      // from the padding edge, so top:4 would land 4.5px above / 3.5px
      // below. A shadow takes no layout, so 4+16+4 centres exactly.
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
      // Between the two, on the same derivation: a 12px thumb on a 4px
      // inset — 12 + 2·4 = 20 tall, 4 + 12 + 12 + 4 = 32 wide, and a
      // travel of one thumb. For a switch that shares a row with
      // bodySmall text, where `lg` reads as the loudest thing in the
      // form and `sm` as a detail on it.
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
  // Runtime variant values — force every branch to be emitted.
  staticCss: [{ size: ["*"] }],
});
