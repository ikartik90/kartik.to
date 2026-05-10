---
tokens:
  breakpoint:
    lg:
      min-width: 1200px
    md:
      min-width: 820px

  spacing:
    none: 0px
    3xs: 0.5px
    xxs: 1px
    xs: 2px
    sm: 4px
    md: 8px
    lg: 12px
    xl: 16px
    xxl: 20px
    3xl: 40px
    full: 100%

  palette:
    neutral-100: "#EEF2F6"
    neutral-200: "#CFD9E2"
    neutral-300: "#A9BFD6"
    neutral-600: "#576675"
    neutral-700: "#414244"
    neutral-800: "#2E3338"
    neutral-900: "#1F2123"

    brand-orange: "#FFAB6F"
    brand-pink: "#FF4D97"

    brand-gradient: "linear-gradient(135deg, {palette.brand-pink} 0%, {palette.brand-orange} 100%)"

  colors:
    light:
      background:
        canvas: "{palette.neutral-100}"
        branded-emphasis: "{palette.brand-gradient}"
        selection: "{palette.brand-orange}"
      text:
        default: "{palette.neutral-700}"
        title: "{palette.neutral-900}"
        paragraph: "{palette.neutral-600}"
        branded-emphasis: "{palette.neutral-900}"
        selection: "{palette.neutral-900}"
      border:
        divider: "{palette.neutral-200}"

    dark:
      background:
        canvas: "{palette.neutral-900}"
        branded-emphasis: "{palette.brand-gradient}"
        selection: "{palette.brand-pink}"
      text:
        default: "{palette.neutral-200}"
        title: "{palette.neutral-100}"
        paragraph: "{palette.neutral-300}"
        branded-emphasis: "{palette.neutral-900}"
        selection: "{palette.neutral-900}"
      border:
        divider: "{palette.neutral-800}"

  typography:
    fontFamily: switzer
    fontWeight: 400

    title:
      fontSize: 2rem
      lineHeight: 1.5
      letterSpacing: -1.5%

    subheading:
      fontSize: 1.25rem
      lineHeight: 1.4

    paragraph:
      fontSize: 1rem
      lineHeight: 1.75

    quote:
      fontSize: 1.25rem
      lineHeight: 1.4
      letterSpacing: -1%

    caption:
      fontSize: 0.5rem
      lineHeight: 1.75
      letterSpacing: 0.5%

    sidenote:
      fontSize: 0.75rem
      lineHeight: 1.67

  border:
    divider:
      border-width: "{spacing.xxs}"
      border-style: "solid"
      border-color: "{colors.{theme}.border.divider}"
---

## Colors

- **text.default** Everything that is not a designated article or section paragraph, such as caption, sidenote, quote, subheading, etc. should use `text.default` color.
- use the tokens under **colors.light** if the user has `prefers-color-scheme: light`, and **colors.dark** when they have `prefers-color-scheme: dark` set on their client. If no preferences are set, default to light.

## Typography

- Use **paragraph** for multi-line content in the main section unless explicitly stated otherwise.

## Spacing

- **padding**, **margin**, **gap**, **border-radius**, and **border-width** should all inherit their values from `spacing` tokens.

## Border

- Use `divider` for horizontal rule.

## Sections

- The `main` section should have `max-width: 1200px` with `inline-padding: 20px` and `margin: 0 auto` set on it.
- `article` inside the main section would have `width: min(100%, 960px)` set on it.
- Text content inside `article` such as `paragraph`s should have `width: min(100%, 640px)`
