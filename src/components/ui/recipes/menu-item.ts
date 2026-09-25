import { defineRecipe } from "@pandacss/dev";

export const menuItem = defineRecipe({
  className: "menu-item",
  description:
    "Shared item row for the command palette (cmdk) and the slash menu.",
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
    //
    // `field.bg.hover`, not `bg.itemHover`: the two match in dark, but
    // itemHover stays a flat 25% in light where the field wash drops to
    // 15%, which read as a heavy grey band beside every other option
    // list. A menu row and a listbox row are the same gesture.
    "&[data-selected='true'], &[aria-selected='true']": {
      backgroundColor: "field.bg.hover",
    },
  },
});
