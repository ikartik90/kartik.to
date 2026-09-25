import { ASPECT_RATIOS } from "../../../utils/demo-frame-sizing";

// Generated from `ASPECT_RATIOS` so every ratio-derived CSS value agrees.
export const aspectRatioEntries = Object.entries(ASPECT_RATIOS);

/**
 * The value box at the end of a field frame (slider readout, colour opacity). One fixed width
 * so rows line up; negative margins reclaim the frame's padding so a click near it focuses it.
 */
export const fieldValueBox = {
  // Doubled class: Panda emits slots alphabetically, so the `field` recipe's `control` reset
  // would otherwise win on source order.
  "&&": {
    flex: "0 0 auto",
    width: "token(sizes.fieldValue)",
    alignSelf: "stretch",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    "&:not(:first-child)": {
      marginInlineStart: "calc(token(spacing.md) * -1)",
      paddingInlineStart: "md",
    },
    "&:last-child": {
      marginInlineEnd: "calc(token(spacing.md) * -1)",
      paddingInlineEnd: "md",
    },
  },
} as const;
