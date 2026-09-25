import { defineSlotRecipe } from "@pandacss/dev";

// Nothing inside may be interactive: `select` covers the card, and the profile link is its sibling.
export const testimonialCard = defineSlotRecipe({
  className: "testimonial-card",
  description:
    "A testimonial card: the quote and a byline of avatar, name, tagline and profile link. `surface` is the edit board or the public page; `selected` marks it chosen.",
  slots: [
    "root",
    "select",
    "quote",
    "byline",
    "avatar",
    "identity",
    "name",
    "tagline",
    "profile",
  ],
  base: {
    root: {
      position: "relative",

      display: "flex",
      flexDirection: "column",
      // Not `space-between`: a short quote would hang at the bottom of a stretched card.
      justifyContent: "flex-start",
      gap: "lg",
      width: "token(spacing.full)",
      // No height: the card is as tall as its words.

      padding: "xl",
      borderRadius: "lg",
      borderWidth: "token(spacing.xxs)",
      borderStyle: "solid",
      borderColor: "border.divider/50",
      backgroundColor: "bg.surface",
      transition: "background-color 150ms ease, border-color 150ms ease",
      _hover: { backgroundColor: "bg.itemHover" },
    },
    // Covers the card, under the profile link.
    select: {
      appearance: "none",
      margin: "none",
      padding: "none",
      borderWidth: "0",
      backgroundColor: "transparent",
      font: "inherit",
      color: "inherit",
      cursor: "pointer",
      position: "absolute",
      inset: 0,
      zIndex: 1,
      borderRadius: "inherit",
    },
    quote: {
      textStyle: "sidenote",
      color: "text.body",
      margin: "none",
      // Not clamped: a quote is capped at 280 characters, so it always fits.
    },
    // `flex-start` keeps the avatar level with the first line of a wrapped name.
    byline: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "lg",
      minWidth: 0,
    },
    avatar: {
      flexShrink: 0,
      display: "grid",
      placeItems: "center",
      width: "token(spacing.4xl)",
      height: "token(spacing.4xl)",
      borderRadius: "full",
      overflow: "hidden",
      boxShadow: "inset 0 0 0 token(spacing.xxs) token(colors.border.imageOutline)",
      backgroundColor: "bg.surfaceRaised",
      // The initial, shown while there is no picture.
      textStyle: "bodySmall",
      color: "text.body/50",
      textTransform: "uppercase",
      "& img": {
        width: "token(spacing.full)",
        height: "token(spacing.full)",
        objectFit: "cover",
        display: "block",
      },
    },
    identity: {
      display: "flex",
      flexDirection: "column",
      gap: "3xs",
      minWidth: 0,
      flex: "1 1 auto",
    },
    name: {
      textStyle: "bodySmall",
      color: "text.default",
      margin: "none",
      wordBreak: "break-word",
    },
    tagline: {
      textStyle: "fineprint",
      color: "text.body/50",
      margin: "none",
      minWidth: 0,
      wordBreak: "break-word",
    },
    // Above `select`'s overlay, so it stays clickable.
    profile: {
      position: "relative",
      zIndex: 2,
      flexShrink: 0,
      // Sized by the link's `size="sm"`: slot styles here lose to the chip's un-nested `recipes` layer.
      alignSelf: "flex-start",
    },
  },
  variants: {
    /** Drawn on the border, so selection moves nothing. */
    selected: {
      true: {
        root: {
          borderColor: "border.focusRing",
          backgroundColor: "bg.itemHover",
        },
      },
    },
    /** `board`: the admin board, where the card opens the rail. `page`: the homepage wall. */
    surface: {
      board: { root: { cursor: "pointer" } },
      page: {
        root: {
          cursor: "auto",
          // Undoes the base hover wash, which means "about to be edited".
          _hover: { backgroundColor: "bg.surface" },

          // Only a card with a profile is a link, so only it answers the pointer.
          "&[data-linked]:hover": {
            borderColor: "border.divider",
          },
        },
        quote: {
          textStyle: "bodySmall",
        },
      },
    },
  },
  defaultVariants: {
    selected: false,
    surface: "board",
  },
});
