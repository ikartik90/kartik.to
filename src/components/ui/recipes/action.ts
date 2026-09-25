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
    // Hug the content. A flex item's display is blockified, so a
    // flex-column / grid parent's `stretch` would otherwise pull the
    // control across the cross axis; `fit-content` opts out.
    width: "fit-content",
    transition:
      "transform 100ms ease, background-color 150ms ease, color 150ms ease",
    _active: { transform: "scale(0.97)" },
    _disabled: {
      opacity: 0.5,
      cursor: "not-allowed",
      pointerEvents: "none",
    },
    // Composed icons track the resolved text colour and hold a 20px box.
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
        // Space a leading icon from the label when both compose.
        gap: "md",
        height: "token(spacing.4xl)",
        // Floor a short label (Cancel / OK) to a substantial chip.
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
        // Space icon ∣ optional label. No app surface composes the pair
        // any more — an icon button names itself on hover instead — but
        // the recipe still supports it.
        gap: "sm",
        padding: "sm",
        borderRadius: "sm",
        color: "inherit",
        // For the icon+label case; harmless for the icon-only majority.
        textStyle: "bodySmall",
        backgroundColor: "transparent",
        // The wash is for buttons that are NOT on. Scoped rather than
        // left to source order: a bare `_hover` and the pressed rule
        // below carry the SAME specificity, and Panda emits hover
        // last — so pointing at an on toggle repainted the brand chip
        // neutral grey and left the glyph brand-coloured on top of it.
        // `icon-tile` scopes its own hover for exactly this reason.
        //
        // `:is(:hover, [data-hover])` rather than `_hover` because the
        // condition has to be written into one selector with the
        // `:not()`; this is what that shortcut expands to.
        "&:not([aria-pressed='true']):is(:hover, [data-hover])": {
          backgroundColor: "field.bg.hover",
        },
        // ON — a toggle whose state is worth seeing at rest (a rail
        // that is showing, a mark that is applied), in the brand chip
        // every pressed toggle in the system wears; see the option
        // list. Hover cannot reach past it now, and the press still
        // can, so an on button still answers a click.
        "&[aria-pressed='true']": {
          backgroundColor: "field.bg.active",
          color: "field.text.active",
        },
        // The press, as a fill rather than the base's `scale(0.97)` —
        // see `field.bg.pressed`. The glyph is the whole content of one
        // of these, and scaling the chip drags it off the pixel grid.
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
    // Fill prominence — orthogonal to `variant` (the shape). All three
    // are empty here: `secondary` is what `text` already draws, and the
    // other two are applied by the compounds below. `tertiary` is inert
    // for `icon`, which is tertiary by nature.
    emphasis: {
      secondary: {},
      tertiary: {},
      glass: {},
      accent: {},
    },
    // The chip's scale — the third axis, orthogonal to both of the
    // above. Empty for the same reason `emphasis` is: `md` is what
    // `text` already draws, and `sm` is applied by the compound below.
    // Inert for `icon` (one inset, whatever the glyph in it measures)
    // and `link` (inline text that takes the surrounding line box, not
    // a box of its own).
    size: {
      md: {},
      sm: {},
    },
  },
  compoundVariants: [
    {
      variant: "text",
      emphasis: "accent",
      // The secondary chip in the brand's colours, fill and label
      // alike — a button link set to its accent. Same override mechanic
      // as the tertiary compound below.
      css: {
        backgroundColor: "bg.button.accent.default",
        color: "field.text.active",
        _hover: { backgroundColor: "bg.button.accent.hover" },
      },
    },
    {
      variant: "text",
      emphasis: "tertiary",
      // Overrides the secondary fill/hover the `text` variant supplies:
      // both land as atomic utilities (later cascade layer), so they win.
      css: {
        backgroundColor: "transparent",
        _hover: { backgroundColor: "field.bg.hover" },
      },
    },
    {
      variant: "icon",
      emphasis: "glass",
      // The one icon chip that floats ON a picture rather than on a
      // surface of the app's own, so it cannot rest transparent: the
      // `icon` variant's `color: inherit` and bare glyph are legible
      // because a surface behind them holds them down, and over a video
      // frame there is no such surface — a pale still swallows the
      // glyph outright.
      //
      // The material is the one every other chip over an image already
      // uses (the collection's surplus badge): `surfaceGlass` is
      // `surface` at 75%, and the blur is what keeps the glyph legible
      // over whatever happens to be moving underneath it. Same override
      // mechanic as the compounds around it — a compound's declarations
      // land in a later layer than the variant's, so the transparent
      // fill and inherited colour they replace are the ones that lose.
      css: {
        backgroundColor: "bg.surfaceGlass",
        // Panda's `backdropFilter` utility emits only the -webkit-
        // form, which Chromium does not recognise, so the raw key is
        // the one that lands; the prefixed spelling stays for older
        // WebKit. The 8px radius is the app's one blur strength.
        backdropFilter: "blur(token(spacing.md))",
        "-webkit-backdrop-filter": "blur(token(spacing.md))",
        "backdrop-filter": "blur(token(spacing.md))",
        color: "text.body",
        // Opaque on hover — the chip comes forward as you reach for it,
        // and `surface` is exactly what `surfaceGlass` is 75% of.
        _hover: { backgroundColor: "bg.surface" },
      },
    },
    {
      variant: "text",
      size: "sm",
      // Same override mechanic as the tertiary compound above — atomic
      // utilities in a later layer beat the `text` variant's own height
      // and text style.
      css: {
        height: "token(spacing.3xl)",
        // Tightened from the 40px chip's 12px: at 32px the wider inset
        // reads as a stretched pill rather than a smaller button. The
        // 8px gap between a leading icon and the label is ALREADY what
        // `text` sets (`gap: md`) and deliberately does not shrink —
        // one inset all the way round the content.
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
  // Runtime variant values — force every branch to be emitted.
  staticCss: [{ variant: ["*"], emphasis: ["*"], size: ["*"] }],
});
