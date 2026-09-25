import { defineSlotRecipe } from "@pandacss/dev";

// The same field, one part along: a FILE as the thing being edited
// (Figma 1233:2639). The layer names in that frame are the colour
// field's, unchanged, and deliberately so — a 16px cell, a hairline,
// and the value beside it is one shape, and a picture slot in the rail
// has no business being a different one.
//
// What differs is what each part holds. The cell draws the file itself
// rather than a colour, so it carries no checkerboard: a picture is
// opaque, and the thing a thumbnail must not be confused with is the
// EMPTY slot, which shows a glyph instead. The value is static text
// rather than an input, because a file's name is not editable here —
// it is edited in the library, where the file is (`updateMediaFilename`).
//
// THE FRAME IS A FIELD AND NOTHING MORE. The design draws the replace
// button OUTSIDE it — field, 8px, a 28px chip — which is the properties
// row the panel already lays out: `propertyRowField` then the reserved
// `propertyRowAction` column, the one kept empty "the day a row needs a
// reset or an overflow button". So the control hands the panel two
// children and the row places them; it holds no grid of its own. Its
// first two attempts both did, and both cost the field width: a
// sub-grid inside the field column squeezed the frame 36px narrower
// than every other field in the rail, and folding the button into the
// frame only hid that by making the field a different shape from the
// one the design draws.
//
// One act, two targets: the whole frame is the trigger, which is the
// big and obvious one, and the chip beside it is the one that says out
// loud what pressing does.
export const imageField = defineSlotRecipe({
  className: "image-field",
  description:
    "Image input — a 16px thumbnail of the file, a hairline, and the file's name inside the shared `field` frame, with a replace chip in the properties row's action column beside it (Figma 1233:2639). The frame is a button: pressing it opens the media library. An empty slot draws a glyph in the cell and asks in the family's placeholder tone; it has nothing to replace, so no chip is drawn and the column simply stays empty.",
  slots: [
    "frame",
    "trigger",
    "thumbnail",
    "media",
    "separator",
    "name",
  ],
  base: {
    // The frame keeps its inset, its 28px height and its column's width
    // from `field`; all it is told here is that it is pressed rather
    // than typed in.
    frame: { cursor: "pointer" },
    // One child filling the frame, so the hairline can run the frame's
    // full height — `alignSelf: stretch` has nothing to stretch to
    // inside a button that is only as tall as its text.
    trigger: {
      appearance: "none",
      margin: "none",
      padding: "none",
      borderWidth: "0",
      backgroundColor: "transparent",
      color: "inherit",
      font: "inherit",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      alignSelf: "stretch",
      gap: "md",
      flex: "1 1 auto",
      minWidth: 0,
      textAlign: "start",
      _disabled: { cursor: "not-allowed" },
    },
    // The colour field's swatch at the same size and corner, holding a
    // picture instead of a colour. The hairline is the swatch's, for
    // the swatch's reason: a pale screenshot on a pale field would
    // otherwise have no edge at all.
    thumbnail: {
      position: "relative",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "token(spacing.xl)",
      height: "token(spacing.xl)",
      borderRadius: "sm",
      overflow: "hidden",
      backgroundColor: "field.bg.default",
      boxShadow: "inset 0 0 0 0.5px var(--colors-field-border-default)",
      // The glyph an empty slot (or a document, which nothing draws)
      // shows instead of a picture.
      "& svg": {
        width: "token(spacing.lg)",
        height: "token(spacing.lg)",
        color: "field.text.muted",
      },
    },
    // The file itself, filling the cell. `cover` because the cell is
    // square and almost nothing in the library is.
    media: {
      width: "token(spacing.full)",
      height: "token(spacing.full)",
      objectFit: "cover",
    },
    // The colour field's hairline, to the letter — the two fields stack
    // in one rail and must divide themselves identically.
    separator: {
      alignSelf: "stretch",
      flexShrink: 0,
      width: "token(spacing.3xs)",
      backgroundColor: "field.border.default",
      transition: "background-color 150ms ease",
      "[data-field]:has([data-control]:focus-visible) &": {
        backgroundColor: "field.border.active",
      },
    },
    // One line, ellipsised: a library name is as long as it is, and the
    // field column is 212px. Everything about how it is SET — size,
    // face, weight, and the placeholder tone an empty slot asks in —
    // comes from the field's own `control` slot, which the component
    // wears alongside this one. Setting type here is how it ended up
    // 16px in a row of 14px values: the slot had no typography, so it
    // took the page's.
    name: {
      flex: "1 1 auto",
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});
