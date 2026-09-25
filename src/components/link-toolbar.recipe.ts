import { defineRecipe } from "@pandacss/dev";

export const toolbarSwatch = defineRecipe({
  className: "toolbar-swatch",
  description:
    "A colour option in a toolbar: a tile of the colour inside an option chip, ringed when chosen; `tone` is neutral or accent.",
  base: {
    display: "block",
    width: "token(spacing.xl)",
    height: "token(spacing.xl)",
    margin: "xs",
    borderRadius: "xs",
    borderWidth: "token(spacing.xxs)",
    borderStyle: "solid",
    borderColor: "bg.surface",
    backgroundColor: "currentColor",
    transition: "box-shadow 150ms ease",
    "[aria-checked='true'] > &": {
      boxShadow: "0 0 0 1.25px currentColor",
    },
  },
  variants: {
    tone: {
      neutral: { color: "field.text.default" },
      accent: { color: "field.text.active" },
    },
  },
  defaultVariants: { tone: "neutral" },
  staticCss: [{ tone: ["*"] }],
});
