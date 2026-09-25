import { defineRecipe } from "@pandacss/dev";

// Shared with `ConfirmDialog`, so a confirm opening as the palette closes reads as one panel.
export const commandHeader = defineRecipe({
  className: "command-header",
  description:
    "The command palette's top row, with a divider under it: the search field in the palette, the question's title in a confirm. Its 12px inset lands the row's content on the same line as the icons in the rows below (group 4px + row 8px).",
  base: {
    display: "flex",
    alignItems: "center",
    gap: "md",
    height: "token(spacing.4xl)",
    paddingInline: "lg",
    borderBottomWidth: "token(spacing.3xs)",
    borderBottomStyle: "solid",
    borderColor: "border.divider",
    flexShrink: 0,
    color: "text.body",
  },
});

export const commandList = defineRecipe({
  className: "command-list",
  description:
    "The scrolling column of groups under the command palette's top row.",
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "sm",
    paddingBlock: "md",
    overflowY: "auto",
    // cmdk focuses the list itself; the highlighted row, not a ring, shows where focus is.
    outline: "none",
  },
});

export const commandGroup = defineRecipe({
  className: "command-group",
  description:
    "A run of `menuItem` rows in the command palette, inset 4px from the panel's edge.",
  base: {
    display: "flex",
    flexDirection: "column",
    paddingInline: "sm",
  },
});
