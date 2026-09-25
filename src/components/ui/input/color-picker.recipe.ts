import { defineSlotRecipe } from "@pandacss/dev";

const ALPHA_CHECKERBOARD =
  "conic-gradient(var(--colors-border-divider) 0deg 90deg, transparent 90deg 180deg, var(--colors-border-divider) 180deg 270deg, transparent 270deg 360deg)";

// End-caps filling the frame's inset past each end of a ramp. Outside the track, not by
// insetting the gradient, so the colour under the thumb stays the one it names.
const rampPad = {
  content: '""',
  position: "absolute",
  insetBlock: 0,
  width: "token(spacing.md)",
  pointerEvents: "none",
} as const;

const rampPadStart = {
  ...rampPad,
  insetInlineStart: "calc(token(spacing.md) * -1)",
} as const;

const rampPadEnd = {
  ...rampPad,
  insetInlineEnd: "calc(token(spacing.md) * -1)",
} as const;

// The map and ramps use literal white/black/sRGB primaries: they are the HSB axes, not theme colours.
export const colorPicker = defineSlotRecipe({
  className: "color-picker",
  description:
    "Colour picker panel: a header, a saturation/brightness map, hue and alpha sliders, and a footer of format menu and channel fields.",
  slots: [
    "root",
    "header",
    "title",
    "actions",
    "divider",
    "body",
    "map",
    "mapThumb",
    "sliderTrack",
    "hue",
    "alpha",
    "footer",
    "format",
    "fields",
    "channel",
  ],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
    },
    header: {
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      gap: "md",
      height: "token(spacing.4xl)",
      paddingInline: "lg",
      borderBottomWidth: "token(spacing.3xs)",
      borderBottomStyle: "solid",
      borderBottomColor: "border.divider",
      color: "text.body",
    },
    title: {
      flex: 1,
      minWidth: 0,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    actions: {
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      gap: "xs",
    },
    divider: {
      flexShrink: 0,
      width: 0,
      alignSelf: "stretch",
      marginBlock: "xs",
      borderLeftWidth: "token(spacing.3xs)",
      borderLeftStyle: "solid",
      borderLeftColor: "border.divider",
    },
    body: {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: "md",
      padding: "lg",
    },

    map: {
      position: "relative",
      width: "token(spacing.full)",
      aspectRatio: "1 / 1",
      borderRadius: "sm",
      cursor: "crosshair",
      // Otherwise a touch drag scrolls the rail instead of picking.
      touchAction: "none",
      backgroundColor: "var(--color-picker-hue)",
      backgroundImage:
        "linear-gradient(to top, black, transparent), linear-gradient(to right, white, transparent)",
      boxShadow: "inset 0 0 0 0.5px var(--colors-field-border-default)",
      _disabled: { cursor: "not-allowed", opacity: 0.5 },
    },
    mapThumb: {
      position: "absolute",
      width: "token(spacing.xl)",
      height: "token(spacing.xl)",
      borderRadius: "full",
      transform: "translate(-50%, -50%)",
      boxShadow:
        "inset 0 0 0 2px token(colors.neutral.100), 0 0 0 0.5px color-mix(in srgb, var(--colors-neutral-900) 40%, transparent), inset 0 0 0 2.5px color-mix(in srgb, var(--colors-neutral-900) 40%, transparent)",
      pointerEvents: "none",
    },

    sliderTrack: {
      // Resting ink even on focus (an accent thumb is lost on a rainbow), above the end-caps.
      "& [data-slider-thumb]": {
        backgroundColor: "field.text.default",
        zIndex: 1,
      },
    },
    hue: {
      backgroundImage:
        "linear-gradient(to right, #FF0000 0%, #FFFF00 16.667%, #00FF00 33.333%, #00FFFF 50%, #0000FF 66.667%, #FF00FF 83.333%, #FF0000 100%)",
      "&::before": { ...rampPadStart, backgroundColor: "#FF0000" },
      "&::after": { ...rampPadEnd, backgroundColor: "#FF0000" },
    },
    alpha: {
      backgroundColor: "field.bg.default",
      backgroundImage: `linear-gradient(to right, transparent, var(--color-picker-alpha-to)), ${ALPHA_CHECKERBOARD}`,
      backgroundSize: "auto, token(spacing.md) token(spacing.md)",
      "&::before": {
        ...rampPadStart,
        backgroundColor: "field.bg.default",
        backgroundImage: ALPHA_CHECKERBOARD,
        // Same tile size as the track's, so the pattern stays in phase across the seam.
        backgroundSize: "token(spacing.md) token(spacing.md)",
      },
      "&::after": {
        ...rampPadEnd,
        backgroundColor: "var(--color-picker-alpha-to)",
      },
    },

    footer: {
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      gap: "md",
      height: "calc(token(spacing.4xl) + token(spacing.md))",
      paddingInline: "lg",
      borderTopWidth: "token(spacing.3xs)",
      borderTopStyle: "solid",
      borderTopColor: "border.divider",
    },
    // Doubled: `.field__root` (width: 100%) is emitted later in `recipes.slots` and would win.
    format: { "&&": { flex: "1 1 0", minWidth: 0, width: "auto" } },
    fields: {
      "&&": {
        flex: "0 0 auto",
        width: "token(sizes.propertyRowField)",
      },
    },
    channel: {
      flex: "1 1 0",
      minWidth: 0,
      fontVariantNumeric: "tabular-nums",
      textTransform: "uppercase",
    },
  },
});
