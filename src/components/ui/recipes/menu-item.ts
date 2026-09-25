import { defineRecipe } from "@pandacss/dev";

export const menuItem = defineRecipe({
  className: "menu-item",
  description: "A row in the command palette or the slash menu.",
  base: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    gap: "md",
    height: "token(spacing.3xl)",
    paddingInline: "md",
    borderRadius: "sm",
    cursor: "default",
    textStyle: "bodySmall",
    color: "text.body",
    // cmdk sets data-selected; the slash menu uses aria-selected.
    "&[data-selected='true'], &[aria-selected='true']": {
      backgroundColor: "field.bg.hover",
    },
  },
});
