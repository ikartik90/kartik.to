import { defineRecipe } from "@pandacss/dev";

export const menuIcon = defineRecipe({
  className: "menu-icon",
  description: "A 20px icon in a menu row.",
  base: {
    flexShrink: 0,
    width: "token(spacing.xxl)",
    height: "token(spacing.xxl)",
  },
});
