import { defineSlotRecipe } from "@pandacss/dev";

// Sized in `cqw` against the card's width, so one composition scales across every column span.
// On a square card the column must stay under 100cqw tall or it stretches the frame; this totals ~90.
export const weatherWidget = defineSlotRecipe({
  className: "weather-widget",
  description:
    "A square weather card: the place, the weather illustration, the temperature and the condition; `available: false` fades the illustration.",
  slots: [
    "root",
    "place",
    "art",
    "drawing",
    "readout",
    "temperature",
    "degree",
    "condition",
  ],
  base: {
    root: {
      // Makes every `cqw` below the card's width.
      containerType: "inline-size",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      justifyContent: "center",
      // `DemoFrame` measures in a `fit-content` box, where 100% resolves to nothing.
      width: "token(sizes.articleShowcase)",
      maxWidth: "token(spacing.full)",
      // Flex gap is between margin boxes, so it spaces from the drawing's painted picture.
      gap: "3.5cqw",
    },

    place: {
      fontFamily: "switzer",
      fontWeight: "base",
      fontSize: "4.5cqw",
      lineHeight: "1.4",
      color: "text.paragraph",
    },

    art: {
      width: "token(spacing.full)",
      display: "flex",
      justifyContent: "center",
      // Transitions off for the entry's single starting frame, so the settle has somewhere to travel from.
      "&[data-entry='resting'] *": {
        transition: "none !important",
      },
    },

    // Negative block margin trims the drawing's transparent margin; not `scale`, which resamples filters.
    drawing: {
      width: "66cqw",
      marginBlock: "-6cqw",
    },

    readout: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "1.5cqw",
      // So a long condition wraps rather than widening the card.
      minWidth: "0",
    },

    temperature: {
      fontFamily: "switzer",
      fontWeight: "base",
      fontSize: "15cqw",
      // 1, not 1.5: at this size the leading would push the readout off the drawing.
      lineHeight: "1",
      letterSpacing: "-3%",
      color: "text.default",
    },

    // Absolute with no offsets: it keeps its static position but leaves the digits alone on the axis.
    degree: {
      position: "absolute",
    },

    condition: {
      fontFamily: "switzer",
      fontWeight: "base",
      fontSize: "5cqw",
      lineHeight: "1.2",
      letterSpacing: "-1.5%",
      textTransform: "lowercase",
      color: "text.default",
    },
  },
  variants: {
    /** Without a reading the default sky is dimmed, so it makes no claim. */
    available: {
      false: {
        art: { opacity: "0.2" },
      },
    },
  },
  defaultVariants: {
    available: true,
  },
});
