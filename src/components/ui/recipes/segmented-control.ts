import { defineSlotRecipe } from "@pandacss/dev";

// Composes with `toolbar` and `optionList` in one layer, so it only sets properties neither does,
// as longhands: `flex` would collide with the option's own `flex-shrink: 0`.
export const segmentedControl = defineSlotRecipe({
  className: "segmented-control",
  description:
    "Equal-width segments for a short horizontal choice — the stretch an `OptionList` behavior container needs to become a segmented control inside a `toolbar({ size: 'sm', tone: 'field' })` rail (Figma 885:1963). `list` fills the rail; `option` takes an equal share of it and centres its label. Everything else — the 28px height, the squared abutting items, the active chip — already comes from those two recipes. It serves the single-select `Listbox` (SegmentedControl) and the multi-toggle `Toolbar` (ToggleBar) alike; which of the two a row is, is a question about semantics rather than about the box. The one thing it adds beyond layout is the SEAM between adjacent segments — a hairline between two that agree (the active border where both are on, the resting one where both are off) and nothing between two that differ, where the chip's own fill already divides them.",
  slots: ["list", "option"],
  base: {
    // `alignSelf: stretch` too: the rail centres its children, so the segments need a real box.
    list: {
      flexGrow: 1,
      flexBasis: 0,
      minWidth: 0,
      alignSelf: "stretch",
    },
    option: {
      flexGrow: 1,
      flexBasis: 0,
      minWidth: 0,
      justifyContent: "center",
      // Stretch to the rail's 28px; the option's own padding would stand 2px proud of it.
      alignSelf: "stretch",
      position: "relative",

      // The seam, drawn by the right segment of each pair: a hairline between two that are off,
      // nothing where they differ (the fill divides them) or both are on (the ring does).
      "&::before": {
        content: '""',
        position: "absolute",
        insetBlock: "none",
        insetInlineStart: 0,
        width: "token(spacing.3xs)",
        backgroundColor: "transparent",
      },
      '&[aria-selected="false"] + [aria-selected="false"]::before, &[aria-pressed="false"] + [aria-pressed="false"]::before':
        {
          backgroundColor: "field.border.default",
        },

      // The ring is stated in full, not inherited from `optionList`'s. Per-side longhands, so the
      // corner rules below can add to it.
      '&[aria-selected="true"]::after, &[aria-pressed="true"]::after': {
        content: '""',
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        borderStyle: "solid",
        borderColor: "field.border.active",
        borderWidth: "token(spacing.3xs)",
      },
      // Carries the rail's corner so the border curves inside the clip instead of being sliced.
      '&[aria-selected="true"]:first-child::after, &[aria-pressed="true"]:first-child::after':
        {
          borderInlineStartWidth: "token(spacing.3xs)",
          borderStartStartRadius: "sm",
          borderEndStartRadius: "sm",
        },
      '&[aria-selected="true"]:last-child::after, &[aria-pressed="true"]:last-child::after':
        {
          borderInlineEndWidth: "token(spacing.3xs)",
          borderStartEndRadius: "sm",
          borderEndEndRadius: "sm",
        },
      // Abutting chips: the right one drops its leading edge, leaving a single hairline.
      '&[aria-selected="true"] + [aria-selected="true"]::after, &[aria-pressed="true"] + [aria-pressed="true"]::after':
        {
          borderInlineStartWidth: 0,
        },
    },
  },
});
