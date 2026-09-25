import { defineSlotRecipe } from "@pandacss/dev";

// No grid of its own: the replace chip is a sibling that the properties row places.
export const imageField = defineSlotRecipe({
  className: "image-field",
  description:
    "Image input inside a `field` frame: a thumbnail, a hairline and the file name; the frame is a button that opens the media library.",
  slots: [
    "frame",
    "trigger",
    "thumbnail",
    "media",
    "separator",
    "name",
  ],
  base: {
    frame: { cursor: "pointer" },
    // Fills the frame, so the separator can stretch to its full height.
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
      "& svg": {
        width: "token(spacing.lg)",
        height: "token(spacing.lg)",
        color: "field.text.muted",
      },
    },
    media: {
      width: "token(spacing.full)",
      height: "token(spacing.full)",
      objectFit: "cover",
    },
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
    // Typography comes from the field's `control` slot, worn alongside; don't set it here.
    name: {
      flex: "1 1 auto",
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});
