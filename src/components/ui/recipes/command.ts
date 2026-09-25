import { defineRecipe } from "@pandacss/dev";

// Shared with `ConfirmDialog`, so a confirm opening as the palette closes reads as one panel.
export const commandHeader = defineRecipe({
  className: "command-header",
  description: "The command palette's top row, with a divider under it.",
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
  description: "The scrolling list of groups in the command palette.",
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
  description: "A group of rows in the command palette.",
  base: {
    display: "flex",
    flexDirection: "column",
    paddingInline: "sm",
  },
});
