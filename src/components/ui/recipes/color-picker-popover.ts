import { defineRecipe } from "@pandacss/dev";

// Where that panel sits: hard against the docked properties rail, two
// pixels off it, and level with the swatch that opened it.
//
// The two axes come from different places ON PURPOSE. Horizontally it
// is pinned to the rail, not to its trigger — every colour field in the
// app lives in that rail, so the picker always appears in the same
// column whichever row was clicked, and it never lands ON the rail it
// is editing through.
//
// Vertically it is PINNED at the position the swatch had when it opened
// — a number handed in by `usePickerPin`, not `anchor(top)`. An anchor
// is tracked, so the picker used to travel with its row as the rail
// scrolled: the panel is docked two pixels off that rail and reads as
// part of the same strip, and half a strip sliding while the other half
// holds still reads as a fault. The clamp that `@position-try` was
// buying moved into that hook with it, since a fallback only applies to
// an anchor-positioned element.
export const colorPickerPopover = defineRecipe({
  className: "color-picker-popover",
  description:
    "The colour picker's shell: docked 2px inside the properties rail's leading edge at the rail's own width, opening level with the swatch that opened it and then HOLDING there while the rail scrolls under it (the `top` comes from `usePickerPin`, which also keeps it clear of the viewport foot). On a phone, where the rail is a sheet along the BOTTOM edge, 'beside the rail' has no meaning and it centres over the canvas instead.",
  base: {
    position: "fixed",
    // Over the rail (50), because it is opened FROM the rail and must
    // not slide under it.
    zIndex: 60,
    // `top` is supplied inline by `usePickerPin`. Zero is the floor it
    // corrects from and never what is painted — the hook sets a real
    // one in the same commit the panel mounts in.
    top: 0,
    insetInlineEnd:
      "calc(token(sizes.propertiesPanelWidth) + token(spacing.xs))",
    width: "token(sizes.propertiesPanelWidth)",
    backgroundColor: "bg.surface",
    "--colors-field-bg-default":
      "var(--colors-field-bg-default-on-surface)",
    color: "text.body",
    borderRadius: "md",
    borderWidth: "token(spacing.3xs)",
    borderStyle: "solid",
    borderColor: "border.divider",
    // Deliberately NOT clipped, which is the usual bargain for a
    // rounded panel. The format menu covers its trigger and runs past
    // the footer, and it has to live INSIDE this panel to be anchorable
    // at all (see `Combobox`'s `portal`). Nothing here needs the clip:
    // the parts are hairline-divided rows with no fill of their own, so
    // none of them reaches a corner for the radius to cut.
    overflow: "visible",
    display: "flex",
    flexDirection: "column",
    boxShadow:
      "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
    // The rail has moved to the bottom edge and taken the whole width,
    // so there is no column beside it to stand in. The picker becomes a
    // floating panel over what is left of the canvas — the half of the
    // screen the sheet deliberately leaves showing.
    _bottomSheet: {
      positionAnchor: "auto",
      top: "token(spacing.lg)",
      insetInline: "token(spacing.lg)",
      width: "auto",
      positionTryFallbacks: "none",
    },
  },
});
