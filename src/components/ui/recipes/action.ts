import { defineRecipe } from "@pandacss/dev";

export const action = defineRecipe({
  className: "action",
  description:
    "The one look shared by the two actionable primitives — Button (a <button> that ACTS) and Link (an <a>/next-link that NAVIGATES) — so their skin lives in the design system once and both consume it. `text` = the standalone CTA (filled secondary chip, 8px radius, fixed 40px height, hugs content with an 80px floor); `icon` = the compact 28px toolbar chip (`color: inherit` so the surface owns the glyph hue — the calendar chevrons and their onBrand retint); `link` = an inline underlined text link. Orthogonal to that shape axis, `emphasis` sets the fill prominence: `secondary` (the filled chip drawn above), `accent` (that chip in the brand pigment, label included — a button link's accent) or `tertiary` (no fill at rest, the neutral `field.bg.hover` on hover — the same wash icon buttons use). Icon buttons are tertiary by nature. `size` is the third axis, and applies to the `text` chip: `md` is the 40px/`bodyLarge` default, `sm` a 32px/`bodySmall` chip on an 8px inline inset (the option row's pitch). An icon chip has ONE inset — a smaller icon is a smaller GLYPH in the same chip, which is the icon's business and not the chip's; see `SocialIconLink`.",
  base: {
    cursor: "pointer",
    border: "none",
    appearance: "none",
    textDecoration: "none",
    // A flex/grid parent's `stretch` would otherwise pull the control across the cross axis.
    width: "fit-content",
    transition:
      "transform 100ms ease, background-color 150ms ease, color 150ms ease",
    _active: { transform: "scale(0.97)" },
    _disabled: {
      opacity: 0.5,
      cursor: "not-allowed",
      pointerEvents: "none",
    },
    "& svg": {
      width: "token(spacing.xxl)",
      height: "token(spacing.xxl)",
      flexShrink: 0,
      display: "block",
    },
    "& svg path[stroke]": { stroke: "currentColor" },
    "& svg path[fill]": { fill: "currentColor" },
  },
  variants: {
    variant: {
      text: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "md",
        height: "token(spacing.4xl)",
        minWidth: "token(spacing.5xl)",
        paddingInline: "lg",
        borderRadius: "md",
        backgroundColor: "bg.button.secondary.default",
        color: "text.body",
        textStyle: "bodyLarge",
        _hover: { backgroundColor: "bg.button.secondary.hover" },
      },
      icon: {
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "sm",
        padding: "sm",
        borderRadius: "sm",
        color: "inherit",
        textStyle: "bodySmall",
        backgroundColor: "transparent",
        // Scoped to not-pressed: a bare `_hover` ties with the pressed rule, and Panda emits hover last.
        "&:not([aria-pressed='true']):is(:hover, [data-hover])": {
          backgroundColor: "field.bg.hover",
        },
        "&[aria-pressed='true']": {
          backgroundColor: "field.bg.active",
          color: "field.text.active",
        },
        // A fill, not the base's scale, which drags the glyph off the pixel grid.
        _active: {
          transform: "none",
          backgroundColor: "field.bg.pressed",
        },
        "html[data-keyboard-focus] &:focus-visible": {
          boxShadow:
            "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
        },
      },
      link: {
        display: "inline",
        padding: "none",
        background: "none",
        color: { base: "brand.pink", _dark: "brand.orange" },
        textStyle: "bodySmall",
        textDecoration: "underline",
        textUnderlineOffset: "3px",
        verticalAlign: "baseline",
        _active: { transform: "none" },
      },
    },
    // Empty: `secondary` is what `text` draws; the others are applied by the compounds below.
    emphasis: {
      secondary: {},
      tertiary: {},
      glass: {},
      accent: {},
    },
    // Empty: `md` is what `text` draws and `sm` is a compound. Inert for `icon` and `link`.
    size: {
      md: {},
      sm: {},
    },
  },
  compoundVariants: [
    {
      variant: "text",
      emphasis: "accent",
      css: {
        backgroundColor: "bg.button.accent.default",
        color: "field.text.active",
        _hover: { backgroundColor: "bg.button.accent.hover" },
      },
    },
    {
      variant: "text",
      emphasis: "tertiary",
      // Compound styles land in a later layer, so they beat the `text` variant's own.
      css: {
        backgroundColor: "transparent",
        _hover: { backgroundColor: "field.bg.hover" },
      },
    },
    {
      variant: "icon",
      emphasis: "glass",
      css: {
        backgroundColor: "bg.surfaceGlass",
        // Panda's `backdropFilter` emits only the -webkit- form; the raw key is what Chromium reads.
        backdropFilter: "blur(token(spacing.md))",
        "-webkit-backdrop-filter": "blur(token(spacing.md))",
        "backdrop-filter": "blur(token(spacing.md))",
        color: "text.body",
        _hover: { backgroundColor: "bg.surface" },
      },
    },
    {
      variant: "text",
      size: "sm",
      css: {
        height: "token(spacing.3xl)",
        paddingInline: "md",
        textStyle: "bodySmall",
      },
    },
  ],
  defaultVariants: {
    variant: "text",
    emphasis: "secondary",
    size: "md",
  },
  // Variants are chosen at runtime, so emit every branch.
  staticCss: [{ variant: ["*"], emphasis: ["*"], size: ["*"] }],
});
