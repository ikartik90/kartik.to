import { defineRecipe } from "@pandacss/dev";

export const hotkey = defineRecipe({
  className: "hotkey",
  description:
    "A keyboard shortcut drawn as a key, filled for a page or menu `surface`.",
  base: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    height: "token(spacing.xxl)",
    paddingInline: "sm",
    borderRadius: "sm",
    borderWidth: "token(spacing.3xs)",
    borderStyle: "solid",
    borderColor: "border.divider",
    color: "text.body",
    // Overrides the UA's monospace default on <kbd>.
    textStyle: "caption",
    whiteSpace: "nowrap",
  },
  variants: {
    surface: {
      page: {
        backgroundColor: { base: "neutral.200", _dark: "neutral.800" },
      },
      menu: { backgroundColor: "field.bg.hover" },
    },
  },
  defaultVariants: { surface: "page" },
});
