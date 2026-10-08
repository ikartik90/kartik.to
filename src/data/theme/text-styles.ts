import { defineTextStyles } from "@pandacss/dev";
import { fluidFontSize, fluidLineHeight } from "../../utils/fluid-type";
import { tokens } from "./tokens";
import { TYPE_SIZES, TYPE_VIEWPORTS } from "./type-sizes";

// Line heights between the two viewports round to the grid's smallest step.
const grid = parseFloat(tokens.spacing.sm.value);

const fluidType = (name: keyof typeof TYPE_SIZES) => ({
  fontSize: fluidFontSize(TYPE_SIZES[name], TYPE_VIEWPORTS),
  lineHeight: fluidLineHeight(TYPE_SIZES[name], TYPE_VIEWPORTS, grid),
});

export const textStyles = defineTextStyles({
  title: {
    value: {
      fontFamily: "{fonts.switzer}",
      fontWeight: "{fontWeights.base}",
      ...fluidType("title"),
      letterSpacing: "-1.5%",
    },
  },
  subheadingLarge: {
    value: {
      fontFamily: "{fonts.switzer}",
      fontWeight: "{fontWeights.base}",
      ...fluidType("subheadingLarge"),
    },
  },
  subheading: {
    value: {
      fontFamily: "{fonts.switzer}",
      fontWeight: "{fontWeights.base}",
      ...fluidType("subheading"),
    },
  },
  bodyLarge: {
    value: {
      fontFamily: "{fonts.switzer}",
      fontWeight: "{fontWeights.base}",
      ...fluidType("bodyLarge"),
    },
  },
  quote: {
    value: {
      fontFamily: "{fonts.switzer}",
      fontWeight: "{fontWeights.base}",
      ...fluidType("quote"),
      letterSpacing: "-1%",
    },
  },
  caption: {
    value: {
      fontFamily: "{fonts.switzer}",
      fontWeight: "{fontWeights.base}",
      ...fluidType("caption"),
      letterSpacing: "0.5%",
    },
  },
  sidenote: {
    value: {
      fontFamily: "{fonts.switzer}",
      fontWeight: "{fontWeights.base}",
      ...fluidType("sidenote"),
      letterSpacing: "0.5%",
    },
  },
  bodySmall: {
    value: {
      fontFamily: "{fonts.switzer}",
      fontWeight: "{fontWeights.base}",
      ...fluidType("bodySmall"),
    },
  },
  fineprint: {
    value: {
      fontFamily: "{fonts.switzer}",
      fontWeight: "{fontWeights.base}",
      ...fluidType("fineprint"),
      letterSpacing: "0.5%",
    },
  },
  inlineCode: {
    value: {
      fontFamily: "{fonts.jetbrainsMono}",
      fontSize: "0.875em",
    },
  },
  code: {
    value: {
      fontFamily: "{fonts.jetbrainsMono}",
      ...fluidType("code"),
    },
  },
});
