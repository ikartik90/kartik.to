import { defineSlotRecipe } from "@pandacss/dev";

export const sliderField = defineSlotRecipe({
  className: "slider-field",
  description:
    "A slider's track, ticks, thumb and numeric readout, the control of a `field`, in three `size`s.",
  slots: ["track", "tick", "thumb", "output"],
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
    output: {
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
