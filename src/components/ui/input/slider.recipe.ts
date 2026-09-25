import { defineSlotRecipe } from "@pandacss/dev";
import { fieldValueBox } from "../recipes/shared";

export const sliderField = defineSlotRecipe({
  className: "slider-field",
  description:
    "The ruler + thumb + numeric readout of a slider — the control slot of a `field`, drawn inside the shared `frame` rather than bringing a surface of its own. `track` is the focusable `role=\"slider\"` element (full frame height, so the hit target is the whole strip, not the 4px rule); `tick` marks the evenly spaced stops as 1px hairlines on `field.border.*`; `thumb` is the 4×20 pill at the current value; `separator` is the 0.5px rule dividing the ruler from the `output` — the value as an editable numeric input, so the number can be typed as well as dragged. Thumb and readout paint in `currentColor` so the frame's resting → active colour shift carries them, exactly as it carries a leading icon. Like the checkbox, the geometry is drawn at ONE size (Figma 842:7179); `size` scales only the readout's type, so it keeps step with the field's label and hint.",
  slots: ["track", "tick", "thumb", "separator", "output"],
  base: {
    track: {
      position: "relative",
      flex: "1 1 0",
      minWidth: 0,
      alignSelf: "stretch",
      cursor: "pointer",
      // Otherwise a touch drag scrolls the page instead of moving the thumb.
      touchAction: "none",
      // `_disabled` also matches [aria-disabled=true], the only form a div role=slider can carry.
      _disabled: { cursor: "not-allowed", opacity: 0.5 },
    },
    tick: {
      position: "absolute",
      top: "token(spacing.half)",
      transform: "translate(-50%, -50%)",
      width: "token(spacing.xxs)",
      height: "token(spacing.sm)",
      borderRadius: "full",
      backgroundColor: "field.border.default",
      pointerEvents: "none",
      transition: "background-color 150ms ease",
      "[data-field]:has([data-control]:focus-visible, [data-control][role='slider']:focus) &":
        {
          backgroundColor: "field.border.active",
        },
    },
    thumb: {
      position: "absolute",
      top: "token(spacing.half)",
      transform: "translate(-50%, -50%)",
      width: "token(spacing.sm)",
      height: "token(spacing.xxl)",
      borderRadius: "full",
      backgroundColor: "currentColor",
      pointerEvents: "none",
    },
    separator: {
      alignSelf: "stretch",
      flexShrink: 0,
      width: "token(spacing.3xs)",
      backgroundColor: "field.border.default",
      transition: "background-color 150ms ease",
      "[data-field]:has([data-control]:focus-visible, [data-control][role='slider']:focus) &":
        {
          backgroundColor: "field.border.active",
        },
    },
    output: {
      ...fieldValueBox,
      color: "inherit",
      // The value sits outside the track, so the track's own dimming can't reach it.
      "[data-field]:has([role='slider'][aria-disabled='true']) &": {
        opacity: 0.5,
      },
    },
  },
  variants: {
    size: {
      sm: { output: { textStyle: "bodySmall" } },
      md: { output: { textStyle: "bodyLarge" } },
      lg: { output: { textStyle: "subheading" } },
    },
  },
  defaultVariants: { size: "sm" },
  // Called with the field's runtime size, so emit every branch.
  staticCss: [{ size: ["*"] }],
});
