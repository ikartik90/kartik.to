---
tokens:
  breakpoint:
    md: 820px
    lg: 1200px

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
    3xl: 32px
    4xl: 40px
    5xl: 80px
    full: 100%

  sizes:
    contentColumn: 640px
    listingCardWidth: 304px
    articleWidth: 960px
    librarySidebar: 200px
    imagePreviewMax: 280px
    dialogFooter: 56px

  palette:
    brand-orange: "#FFAB6F"
    brand-pink: "#FF4D97"

    neutral:
      100: "#EEF2F6"
      200: "#CFD9E2"
      300: "#C3CDD7"
      400: "#A9BFD6"
      500: "#576675"
      600: "#414244"
      700: "#384047"
      800: "#2E3338"
      900: "#1F2123"

    brand-gradient: "linear-gradient(135deg, {palette.brand-pink} 0%, {palette.brand-orange} 100%)"

  colors:
    border:
      divider: "color-mix(in srgb, {palette.neutral.500} 25%, transparent)"
      imageOutline:
        light: "color-mix(in srgb, {palette.neutral.900} 10%, transparent)"
        dark: "color-mix(in srgb, {palette.neutral.100} 10%, transparent)"

    light:
      bg:
        canvas: "{palette.neutral.100}"
        surface: "{palette.neutral.200}"
        itemHover: "color-mix(in srgb, {palette.neutral.500} 25%, transparent)"
        brandedEmphasis: "{palette.brand-gradient}"
        selection: "{palette.brand-orange}"
      text:
        default: "{palette.neutral.600}"
        title: "{palette.neutral.900}"
        paragraph: "{palette.neutral.500}"
        brandedEmphasis: "{palette.neutral.900}"
        selection: "{palette.neutral.900}"
        commandItem: "{palette.neutral.600}"
      logo:
        default: "{palette.neutral.500}"

    dark:
      bg:
        canvas: "{palette.neutral.900}"
        surface: "{palette.neutral.800}"
        itemHover: "color-mix(in srgb, {palette.neutral.500} 25%, transparent)"
        brandedEmphasis: "{palette.brand-gradient}"
        selection: "{palette.brand-pink}"
      text:
        default: "{palette.neutral.200}"
        title: "{palette.neutral.100}"
        paragraph: "{palette.neutral.400}"
        brandedEmphasis: "{palette.neutral.900}"
        selection: "{palette.neutral.900}"
        commandItem: "{palette.neutral.400}"
      logo:
        default: "{palette.neutral.400}"

  fonts:
    switzer: "var(--font-switzer), Helvetica, sans-serif"
    jetbrainsMono: "var(--font-jetbrains-mono), ui-monospace, monospace"

  fontWeights:
    base: 400

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
      fontSize: 0.75rem
      lineHeight: 1.75
      letterSpacing: 0.5%

    sidenote:
      fontSize: 0.75rem
      lineHeight: 1.67
      letterSpacing: 0.5%

    fineprint:
      fontSize: 0.625rem
      lineHeight: 1.6
      letterSpacing: 0.5%

    commandItem:
      fontSize: 0.875rem
      lineHeight: 1.5rem

    commandLabel:
      fontSize: 0.75rem
      lineHeight: 1.25rem

    inlineCode:
      fontFamily: jetbrainsMono
      fontSize: 0.875em

    link:
      textDecoration: underline
      textUnderlineOffset: 3px

    code:
      fontFamily: jetbrainsMono
      fontSize: 0.875rem
      lineHeight: 1.7

  radii:
    sm: "{spacing.sm}"
    md: "{spacing.md}"

  borders:
    divider:
      border-width: "{spacing.3xs}"
      border-style: solid
      border-color: "{colors.border.divider}"
---

## Colors

- **text.default** Everything that is not a designated article or section paragraph, such as caption, sidenote, quote, subheading, etc. should use `text.default` color.
- Semantic colors automatically resolve to their `base` (light) or `dark` value based on the `[data-theme="dark"]` attribute on `<html>`. Default is light.
- **bg.itemHover** — hover/selected row background for menus and library lists.
- **border.imageOutline** — inset outline on images (interface-design rule 11).

## Typography

- Use **paragraph** for multi-line content in the main section unless explicitly stated otherwise.

## Spacing

- **padding**, **margin**, **gap**, **border-radius**, and **border-width** should all inherit their values from `spacing` tokens.

## Border

- Use `border.divider` color for horizontal rules and separators. It is theme-invariant — a 25% opacity neutral-600 via `color-mix()`.

## Sections

- The `main` section should have `max-width: {breakpoints.lg}` with `padding-inline: {spacing.xxl}` and `margin: 0 auto` set on it.
- `article` inside the main section would have `width: min(100%, {sizes.articleWidth})` set on it.
- Text content inside `article` such as `paragraph`s should have `width: min(100%, {sizes.contentColumn})`
