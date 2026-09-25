import { defineRecipe } from "@pandacss/dev";

export const toolbar = defineRecipe({
  className: "toolbar",
  description:
    "A horizontal rail of controls. `tone` sets its fill, `fit` whether it hugs its content or fills the row, `size` its height.",
  base: {
    display: "flex",
    alignItems: "center",
  },
  variants: {
    tone: {
      surface: {
        backgroundColor: "bg.surface",
        "--colors-field-bg-default":
          "var(--colors-field-bg-default-on-surface)",
      },
      field: {
        backgroundColor: "field.bg.default",
        // An inset ring, not a border: a border would leave the rail a pixel shorter than its neighbours.
        boxShadow:
          "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
      },
    },
    fit: {
      hug: {
        // Also beats the `article > *` width rule (@layer base).
        width: "max-content",
      },
      fill: { flex: "1 1 0", minWidth: 0 },
    },
    size: {
      md: {
        gap: "sm",
        height: "token(spacing.4xl)",
        // 6px: the scale has no step between 4 and 8.
        paddingInline: "calc(token(spacing.sm) + token(spacing.xs))",
        borderRadius: "md",
      },
      sm: {
        gap: "none",
        height: "token(sizes.toolbarButton)",
        paddingInline: "none",
        borderRadius: "sm",
        // Also zeroes the gap of a nested `OptionList` row. Not `:where()`, which would tie with
        // the option list's own rule.
        "& :is([role='toolbar'], [role='listbox'])": { gap: "none" },
        "& :is(button, [role='button'])": { borderRadius: 0 },
        // Load-bearing: the square end chips would otherwise square off the rail's corner.
        overflow: "hidden",
      },
    },
  },
  defaultVariants: { size: "md", tone: "surface", fit: "hug" },
  // Runtime variant values — force every branch to be emitted.
  staticCss: [{ size: ["*"], tone: ["*"], fit: ["*"] }],
});
