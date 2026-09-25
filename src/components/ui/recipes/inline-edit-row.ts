import { defineSlotRecipe } from "@pandacss/dev";

export const inlineEditRow = defineSlotRecipe({
  className: "inline-edit-row",
  description:
    "An inline editor that replaces a toolbar's buttons: an icon, a text input and an Esc hint.",
  slots: ["root", "input", "options", "hint", "hintKey", "hintLabel"],
  base: {
    root: {
      display: "flex",
      // Shrinkable, or the input's intrinsic width pushes the toolbar wider than its cell.
      flex: "1 0 0",
      minWidth: 0,
      alignItems: "center",
      gap: "sm",
      height: "token(spacing.4xl)",
      paddingInline: "xs",
    },
    input: {
      flex: "1 0 0",
      minWidth: 0,
      paddingInlineStart: "sm",
      background: "transparent",
      border: "none",
      color: "text.default",
      textStyle: "bodySmall",
      // The pill is the focus indicator.
      focusVisibleRing: "none",
      _placeholder: { color: "text.default/40" },
    },
    // Button height, so a stretched divider stops at 28px, not the rail's 40.
    options: {
      display: "flex",
      alignItems: "center",
      gap: "sm",
      flexShrink: 0,
      height: "token(sizes.toolbarButton)",
    },
    hint: {
      display: "flex",
      alignItems: "center",
      gap: "sm",
      flexShrink: 0,
    },
    hintKey: {
      display: "flex",
      alignItems: "center",
      paddingInline: "sm",
      height: "token(spacing.xxl)",
      borderRadius: "sm",
      borderWidth: "token(spacing.3xs)",
      borderStyle: "solid",
      borderColor: "border.divider",
      backgroundColor: "bg.itemHover",
      color: "text.default",
      textStyle: "caption",
      whiteSpace: "nowrap",
    },
    hintLabel: {
      color: "text.default/50",
      textStyle: "caption",
      whiteSpace: "nowrap",
    },
  },
});
