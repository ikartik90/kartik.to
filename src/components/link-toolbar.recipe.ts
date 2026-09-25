import { defineRecipe } from "@pandacss/dev";

export const toolbarSwatch = defineRecipe({
  className: "toolbar-swatch",
  description:
    "A colour choice in a toolbar, drawn as the colour itself: a 16px tile inside an option chip (Figma 425:940/425:905, the button link's neutral ∣ accent). Its 1px edge is the toolbar's own surface, so the tile reads as set into the rail; the chosen one wears a 1.25px ring in its own colour outside that edge. The chip marks the choice with `aria-checked` (a radio), not `aria-pressed`, so the option list's brand chip stays off — the ring is the selection.",
  base: {
    display: "block",
    width: "token(spacing.xl)",
    height: "token(spacing.xl)",
    // Inset to the 20px box a glyph fills, so its chip is the
    // toolbar's 28px like every icon beside it.
    margin: "xs",
    borderRadius: "xs",
    borderWidth: "token(spacing.xxs)",
    borderStyle: "solid",
    borderColor: "bg.surface",
    // The fill is `currentColor`, so the ring below can be too.
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
