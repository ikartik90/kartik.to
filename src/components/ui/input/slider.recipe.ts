import { defineSlotRecipe } from "@pandacss/dev";
import { fieldValueBox } from "../recipes/shared";

// The third control archetype of the field family, after the text input
// and the toggles: a ruler and a numeric readout sharing one frame
// (Figma 842:7179). It owns NO surface of its own — the 28px shell, its
// fill, border and focus accent are the `field` recipe's `frame` at
// `size="sm"`, and the 8px padding + 8px gap the frame already carries
// place the track, separator and readout at exactly the drawn offsets.
// So this recipe is only the marks inside: ruler ticks and separator on
// the border token (the same hairline the frame's own edge uses), the
// thumb and readout on `currentColor` — which the frame flips to the
// brand accent on focus, so the whole active state comes for free.
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
      // Full height rather than the 4px of the rule: the whole strip is
      // the drag target, so a grab anywhere in the frame lands on the
      // slider instead of the frame's dead padding.
      alignSelf: "stretch",
      cursor: "pointer",
      // Claim the horizontal pan gesture — without it a touch drag
      // scrolls the page instead of moving the thumb.
      touchAction: "none",
      // `_disabled` covers [aria-disabled=true] as well as :disabled,
      // which is what a <div role="slider"> can actually carry.
      _disabled: { cursor: "not-allowed", opacity: 0.5 },
    },
    // Ticks and thumb are both centred on the track's midline and on
    // their own value, so they share the same centring transform and
    // differ only in size and colour.
    tick: {
      position: "absolute",
      top: "token(spacing.half)",
      transform: "translate(-50%, -50%)",
      width: "token(spacing.xxs)",
      height: "token(spacing.sm)",
      // Rounds the 1px hairline's ends, matching the round cap the
      // drawn vector has.
      borderRadius: "full",
      backgroundColor: "field.border.default",
      pointerEvents: "none",
      transition: "background-color 150ms ease",
      // The frame's own border goes accent on focus; the hairlines drawn
      // inside it follow, keyed off the same selector the `field` recipe
      // uses so the whole field flips in one step.
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
      // The frame owns the resting → active colour for everything it
      // contains; the thumb rides it like the leading icon does.
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
      // The value sits OUTSIDE the track, so the track's own dimming
      // can't reach it — without this a disabled slider greys its ruler
      // and leaves the number at full strength.
      "[data-field]:has([role='slider'][aria-disabled='true']) &": {
        opacity: 0.5,
      },
    },
  },
  variants: {
    // Only the readout's type: the ruler is drawn at one geometry (the
    // checkbox's bargain), so a bigger field grows label, hint and value
    // around an unchanged rule. Mirrors the `field` recipe's control.
    size: {
      sm: { output: { textStyle: "bodySmall" } },
      md: { output: { textStyle: "bodyLarge" } },
      lg: { output: { textStyle: "subheading" } },
    },
  },
  defaultVariants: { size: "sm" },
  // Slider calls sliderField({ size }) with the field's runtime size, so
  // the extractor only sees the default — force all three.
  staticCss: [{ size: ["*"] }],
});
