import { defineRecipe } from "@pandacss/dev";

// The command palette's frame, shared with `ConfirmDialog`, which asks
// its question in the palette's shape: a 40px top row, then groups of
// `menuItem` rows. One definition so the two cannot drift apart — a
// confirm that opens as the palette closes should read as the same
// panel changing what it says.
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
    // cmdk makes the list `tabindex="-1"`, and moves the focus onto it
    // once the arrows are used in a panel with no field to hold it —
    // where the browser's own ring then circled the whole list. The
    // highlighted row is what says where the focus is.
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
