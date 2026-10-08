import { defineSlotRecipe } from "@pandacss/dev";

// Composes with `toolbar` and `optionList` in one layer, so it only sets properties neither does,
// as longhands: `flex` would collide with the option's own `flex-shrink: 0`.
export const segmentedControl = defineSlotRecipe({
  className: "segmented-control",
  description: "Equal-width segments for a short choice, inside a toolbar.",
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
      // The end segments carry the rail's corner (`toolbar` passes it down), and their rings take it from
      // them, so a ring curves inside the clip instead of being sliced, a pill's included.
      '&[aria-selected="true"]:first-child::after, &[aria-pressed="true"]:first-child::after':
        {
          borderInlineStartWidth: "token(spacing.3xs)",
          borderStartStartRadius: "inherit",
          borderEndStartRadius: "inherit",
        },
      '&[aria-selected="true"]:last-child::after, &[aria-pressed="true"]:last-child::after':
        {
          borderInlineEndWidth: "token(spacing.3xs)",
          borderStartEndRadius: "inherit",
          borderEndEndRadius: "inherit",
        },
      // Abutting chips: the right one drops its leading edge, leaving a single hairline.
      '&[aria-selected="true"] + [aria-selected="true"]::after, &[aria-pressed="true"] + [aria-pressed="true"]::after':
        {
          borderInlineStartWidth: 0,
        },
    },
  },
  variants: {
    // Pairs with `toolbar`'s `fit`. `hug` squares each segment to the rail's height, for icons.
    fit: {
      fill: {},
      hug: {
        list: { flexGrow: 0, flexBasis: "auto" },
        option: {
          flexGrow: 0,
          flexBasis: "auto",
          width: "token(sizes.toolbarButton)",
        },
      },
    },
  },
  defaultVariants: { fit: "fill" },
});
