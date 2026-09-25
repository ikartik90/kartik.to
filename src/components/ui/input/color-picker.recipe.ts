import { defineSlotRecipe } from "@pandacss/dev";

/** The 4px-square checkerboard an alpha ramp fades over. */
const ALPHA_CHECKERBOARD =
  "conic-gradient(var(--colors-border-divider) 0deg 90deg, transparent 90deg 180deg, var(--colors-border-divider) 180deg 270deg, transparent 270deg 360deg)";

/**
 * One end-cap of a colour ramp.
 *
 * The field frame keeps 8px of inset at each end of a slider track, and a ramp
 * that stopped at the track's edge leaves two flat bands of field fill inside a
 * control whose entire job is to be a picture of a range. These fill them with
 * the value the ramp ARRIVES at — the first colour on the left, the last on the
 * right — so the ramp reads corner to corner.
 *
 * Drawn OUTSIDE the track rather than by insetting the gradient within it,
 * which is the load-bearing part: the track stays exactly the width the thumb
 * travels and the pointer reads, so the colour under the thumb is still the
 * colour the thumb names. Insetting the gradient instead would slide the ramp
 * out of step with the value by up to a pad's width. The frame's own
 * `overflow: hidden` clips them to its rounded corner.
 */
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

// ---------------------------------------------------------------------
// The panel the colour swatch opens (Figma 1066:2338).
//
// Its width is `propertiesPanelWidth` and its footer carries the
// panel's own 212px field column, because the picker stands two pixels
// off the docked rail and the two are read as one strip. Deriving it
// rather than restating 360px means widening a property field widens
// the picker with it, exactly as it widens the rail.
//
// What the footer does NOT take is the rail's reserved action column:
// that column is the rail's, held open for a button on a property row,
// and a popover has no rows to hang one off. The format menu is `flex`
// and absorbs the width instead.
//
// Everything the picker DRAWS in — the map's gradients, the hue ramp —
// is stated in plain `white` / `black` / sRGB primaries rather than in
// theme tokens. Those are not colour decisions: they are the axes of
// the HSB solid the control is a picture of, and a themed "white" would
// put the wrong colour under the author's cursor. The chrome around
// them is tokenised like everything else.
// ---------------------------------------------------------------------
export const colorPicker = defineSlotRecipe({
  className: "color-picker",
  description:
    "The colour picker's innards — a title strip, a saturation/brightness map over a hue ramp and an alpha ramp, and a footer of format menu ∣ channel fields. The map is a live picture of the HSB solid at the current hue (`--color-picker-hue`) and the alpha ramp fades to the current colour (`--color-picker-alpha-to`) over the swatch's checkerboard, both handed in as custom properties because they change with the value. Slots are drawn to the docked properties rail's own metrics — a 40px header, a 12px body, a 48px footer carrying the property row's own 212px field column — since the picker opens 2px off that rail and the two read as one strip (Figma 1066:2338).",
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
    // The column the parts stack in. The picker owns a wrapper of its
    // own rather than sitting straight in the popover because the hue
    // and the colour are handed to CSS as custom properties on it, and
    // a shell that is only ever a shell has nowhere to put them.
    root: {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
    },
    // The rail's header strip, not the dialog's: this panel stands
    // beside the rail, so it takes the rail's 12px inset rather than
    // the 8px a floating dialog curves at.
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
      // One ink for the strip, so the close chip (an icon `action`,
      // painted in `currentColor`) matches the title beside it.
      color: "text.body",
    },
    title: {
      // Takes the slack, rather than the strip spreading its children
      // apart. `space-between` on the header divided the space between
      // ALL of them, so a second chip landed midway between the title
      // and Close instead of beside it; the panel's own header groups
      // its chips at the end and this one has to read the same way.
      flex: 1,
      minWidth: 0,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    // The chips at the end of the strip, in the gap the properties
    // panel's own header actions use (`headerActionsStyle`) rather than
    // the header's 12px — these are one cluster, not separate controls.
    actions: {
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      gap: "xs",
    },
    // Between the chips, and the same hairline a tooltip puts between
    // its label and a trailing glyph: a zero-width box carrying one
    // border, so it takes no space of its own beyond the rule.
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

    // The (saturation, brightness) plane at one hue: saturation runs
    // left to right, brightness bottom to top. Three layers, painted
    // back to front — the hue itself, white washing it out towards the
    // left, black taking it down towards the bottom. That IS the
    // definition of the plane, which is why the two gradients are
    // white and black rather than surface tokens: the corner the
    // author drags into has to be the colour they picked.
    map: {
      position: "relative",
      width: "token(spacing.full)",
      aspectRatio: "1 / 1",
      borderRadius: "sm",
      cursor: "crosshair",
      // Claim the pan gesture, exactly as the slider's track does —
      // otherwise a touch drag scrolls the rail instead of picking.
      touchAction: "none",
      backgroundColor: "var(--color-picker-hue)",
      backgroundImage:
        "linear-gradient(to top, black, transparent), linear-gradient(to right, white, transparent)",
      // A pale colour needs an edge against a pale surface — the same
      // hairline the swatch draws around itself.
      boxShadow: "inset 0 0 0 0.5px var(--colors-field-border-default)",
      _disabled: { cursor: "not-allowed", opacity: 0.5 },
    },
    // A ring, not a dot: the colour under it is the thing being
    // chosen, so the cursor must not cover it. Light ring, dark halo —
    // one of the two always has contrast, on any colour in the plane.
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

    // The two ramps are `Slider`s wearing their own track. The track is
    // left at the width the frame gives it — the ramp reaches the
    // frame's corners through the end-caps below, not by growing.
    sliderTrack: {
      // Pinned to the field's RESTING ink, and it does NOT follow the
      // frame into the brand accent on focus as every other slider's
      // thumb does: an orange handle halfway along a rainbow is a
      // handle you cannot find. Nothing else about the focus state
      // changes — frame, hairline and number all still light up.
      //
      // Above the end-caps, so a thumb parked at either end of the
      // range is not half-covered by the pad it is standing against.
      "& [data-slider-thumb]": {
        backgroundColor: "field.text.default",
        zIndex: 1,
      },
    },
    // Hue is an angle, so the ramp ends where it begins — and both
    // end-caps are therefore the same red.
    hue: {
      backgroundImage:
        "linear-gradient(to right, #FF0000 0%, #FFFF00 16.667%, #00FF00 33.333%, #00FFFF 50%, #0000FF 66.667%, #FF00FF 83.333%, #FF0000 100%)",
      "&::before": { ...rampPadStart, backgroundColor: "#FF0000" },
      "&::after": { ...rampPadEnd, backgroundColor: "#FF0000" },
    },
    // Transparent → the colour itself, over the swatch's checkerboard
    // so the transparent end reads as transparent rather than as the
    // field's own fill. The caps carry the same two ends: bare
    // checkerboard on the left, the colour at full strength on the
    // right.
    alpha: {
      backgroundColor: "field.bg.default",
      backgroundImage: `linear-gradient(to right, transparent, var(--color-picker-alpha-to)), ${ALPHA_CHECKERBOARD}`,
      backgroundSize: "auto, token(spacing.md) token(spacing.md)",
      "&::before": {
        ...rampPadStart,
        backgroundColor: "field.bg.default",
        backgroundImage: ALPHA_CHECKERBOARD,
        // One whole tile to the left of the track's own, so the two
        // patterns stay in phase across the seam.
        backgroundSize: "token(spacing.md) token(spacing.md)",
      },
      "&::after": {
        ...rampPadEnd,
        backgroundColor: "var(--color-picker-alpha-to)",
      },
    },

    // 48px = the 40px strip plus the 8px the taller row needs, the same
    // arithmetic the `lg` field height uses.
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
    // The property row, one column each: the label's width for the
    // format menu, the field's for the channels.
    //
    // Doubled, and it is load-bearing for the same reason
    // `fieldValueBox` is: both of these land on a `<Field>` root, which
    // carries the `field` recipe's own `width: 100%`. Panda emits slot
    // recipes ALPHABETICALLY inside `@layer recipes.slots`, so
    // `.field__root` lands after `.color-picker__fields` and wins on
    // source order at equal specificity — the channel box would take
    // the whole footer and squeeze the format menu to nothing.
    format: { "&&": { flex: "1 1 0", minWidth: 0, width: "auto" } },
    fields: {
      "&&": {
        flex: "0 0 auto",
        width: "token(sizes.propertyRowField)",
      },
    },
    // One channel of however many the current format has. Tabular,
    // because three of them change together under a dragging cursor.
    channel: {
      flex: "1 1 0",
      minWidth: 0,
      fontVariantNumeric: "tabular-nums",
      textTransform: "uppercase",
    },
  },
});
