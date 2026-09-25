import { defineTextStyles } from "@pandacss/dev";

export const textStyles = defineTextStyles({
  title: {
    value: {
      fontFamily: "{fonts.switzer}",
      fontWeight: "{fontWeights.base}",
      fontSize: "2rem",
      lineHeight: "1.5",
      letterSpacing: "-1.5%",
    },
  },
  subheading: {
    value: {
      fontFamily: "{fonts.switzer}",
      fontWeight: "{fontWeights.base}",
      fontSize: "1.25rem",
      lineHeight: "1.8",
    },
  },
  bodyLarge: {
    value: {
      fontFamily: "{fonts.switzer}",
      fontWeight: "{fontWeights.base}",
      fontSize: "1rem",
      lineHeight: "1.75",
    },
  },
  quote: {
    value: {
      fontFamily: "{fonts.switzer}",
      fontWeight: "{fontWeights.base}",
      fontSize: "1.25rem",
      lineHeight: "1.8",
      letterSpacing: "-1%",
    },
  },
  caption: {
    value: {
      fontFamily: "{fonts.switzer}",
      fontWeight: "{fontWeights.base}",
      fontSize: "0.75rem",
      lineHeight: "2",
      letterSpacing: "0.5%",
    },
  },
  sidenote: {
    value: {
      fontFamily: "{fonts.switzer}",
      fontWeight: "{fontWeights.base}",
      fontSize: "0.75rem",
      lineHeight: "1.67",
      letterSpacing: "0.5%",
    },
  },
  bodySmall: {
    value: {
      fontFamily: "{fonts.switzer}",
      fontWeight: "{fontWeights.base}",
      fontSize: "0.875rem",
      lineHeight: "1.72",
    },
  },
  // The smallest step in the scale — 10/16, below `caption`/`sidenote`.
  // Reserved for the subordinate line that must not compete with the
  // value it annotates: the small field's hint. Carries the same 0.5%
  // tracking the rest of the sub-14px family does, since tight glyphs
  // need the extra air to stay legible at this size.
  fineprint: {
    value: {
      fontFamily: "{fonts.switzer}",
      fontWeight: "{fontWeights.base}",
      fontSize: "0.625rem",
      lineHeight: "1.6",
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
      fontSize: "0.875rem",
      lineHeight: "1.72",
    },
  },
});
