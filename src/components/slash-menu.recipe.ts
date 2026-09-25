import { defineRecipe } from "@pandacss/dev";

export const slashMenuPopover = defineRecipe({
  className: "slash-menu-popover",
  description:
    "Slash menu — positioned with CSS anchor() against the active block's anchor-name. Fixed (not absolute) so position-try-fallbacks measures overflow against the viewport — otherwise flip-block never fires (the containing block is taller than the viewport, so there's always 'room below').",
  base: {
    position: "fixed",
    zIndex: 50,
    width: "200px",
    positionAnchor: "--slash-menu",
    top: "anchor(bottom)",
    left: "anchor(left)",
    marginTop: "xs",
    positionTryFallbacks: "flip-block",
    backgroundColor: "bg.surface",
    "--colors-field-bg-default":
      "var(--colors-field-bg-default-on-surface)",
    borderRadius: "md",
    borderWidth: "token(spacing.3xs)",
    borderStyle: "solid",
    borderColor: "border.divider",
    display: "flex",
    flexDirection: "column",
    overflow: "visible",
    // No internal padding — the listbox's own 4px inset is the only gap
    // to the rows (its root collapses via the `plain` tone).
    boxShadow:
      "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
  },
});
