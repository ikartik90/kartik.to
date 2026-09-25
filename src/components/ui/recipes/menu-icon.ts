import { defineRecipe } from "@pandacss/dev";

export const menuIcon = defineRecipe({
  className: "menu-icon",
  description:
    "Shared icon style for menu items — fixed 20px size, never shrinks.",
  base: {
    flexShrink: 0,
    width: "token(spacing.xxl)",
    height: "token(spacing.xxl)",
  },
});
