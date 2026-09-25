import { defineSlotRecipe } from "@pandacss/dev";

// A single-field editor that takes over a floating toolbar's interior:
// leading glyph ▸ chrome-stripped input ▸ "Esc to exit" key-cap. Two
// toolbars share it — the selection toolbar's link editor (Figma
// 422:833) and a collection cell's caption editor (828:6870) — because
// they are the same gesture: the buttons step aside, one value is
// typed, Enter commits. The row owns no surface of its own; the pill
// around it does, and this fills it edge to edge.
export const inlineEditRow = defineSlotRecipe({
  className: "inline-edit-row",
  description:
    "Inline single-field editor that replaces a floating toolbar's buttons — leading icon, bare input, and an Esc hint. Shared by the link editor and the collection caption editor.",
  slots: ["root", "input", "options", "hint", "hintKey", "hintLabel"],
  base: {
    root: {
      display: "flex",
      // Fill the pill, and stay shrinkable — the input's default
      // intrinsic width would otherwise push the toolbar wider than
      // the cell it is centred in.
      flex: "1 0 0",
      minWidth: 0,
      alignItems: "center",
      // 4px between the field, the link editor's toggle group and the
      // hint; the icon keeps 8px to the field through the input's own
      // inset (Figma 424:857).
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
      // The pill is the focus indicator; a ring inside it would read as
      // a second, nested control.
      focusVisibleRing: "none",
      _placeholder: { color: "text.default/40" },
    },
    // Trailing controls between the field and the hint (the link
    // editor's dividers + new-tab toggle). The box is the button's
    // height, so a stretched divider stops at 28px, not the rail's 40.
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
