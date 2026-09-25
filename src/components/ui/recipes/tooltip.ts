import { defineRecipe } from "@pandacss/dev";

export const tooltip = defineRecipe({
  className: "tooltip",
  description:
    "Cursor-following hover tooltip shared by the social links, Button and Link — Figma node 389:318 (20px tall, 4px padding/gap, a leading label ∣ hairline ∣ trailing 14px glyph). Positioned imperatively (fixed + a ref that tracks the pointer), so it carries no anchor of its own.",
  base: {
    position: "fixed",
    zIndex: 50,
    top: 0,
    left: 0,
    display: "flex",
    alignItems: "center",
    gap: "sm",
    height: "token(spacing.xxl)",
    paddingInline: "sm",
    paddingBlock: "none",
    overflow: "hidden",
    borderRadius: "sm",
    borderWidth: "token(spacing.3xs)",
    borderStyle: "solid",
    borderColor: "border.divider",
    backgroundColor: { base: "neutral.200", _dark: "neutral.800" },
    color: "text.body",
    textStyle: "caption",
    whiteSpace: "nowrap",
    opacity: 0,
    visibility: "hidden",
    pointerEvents: "none",
    filter: "blur(1px)",
    transitionProperty: "opacity, filter, visibility",
    transitionDuration: "150ms",
    transitionTimingFunction: "ease-out",
    transitionBehavior: "allow-discrete",
    _starting: {
      opacity: 0,
      filter: "blur(1px)",
    },
    // The cursor trails the box by its offset, so `pointer-events: auto` never intercepts it.
    "&[data-visible]": {
      opacity: 1,
      visibility: "visible",
      pointerEvents: "auto",
      filter: "blur(0)",
    },
    // Touch fallback with no cursor to follow: bottom centre. In CSS, not inline, so `bottom`
    // tracks a phone's collapsing URL bar.
    "&[data-docked]": {
      top: "auto",
      left: "token(spacing.half)",
      bottom: "calc(50px + env(safe-area-inset-bottom, 0px))",
      translate: "-50% 0",
      maxWidth: "calc(100% - token(spacing.3xl))",
    },
    "&[data-docked][data-visible]": { pointerEvents: "none" },
    "& svg": {
      flexShrink: 0,
      width: "token(sizes.tooltipIcon)",
      height: "token(sizes.tooltipIcon)",
    },
    "& svg path[stroke]": { stroke: "currentColor" },
    "& svg path[fill]": { fill: "currentColor" },
  },
  variants: {
    tone: {
      brand: {
        backgroundColor: {
          base: "brand.rosemilk",
          _dark: "brand.rust",
        },
        color: { base: "brand.pink", _dark: "brand.orange" },
        borderColor: {
          base: "color-mix(in srgb, var(--colors-brand-pink) 25%, transparent)",
          _dark:
            "color-mix(in srgb, var(--colors-brand-orange) 25%, transparent)",
        },
      },
    },
  },
  // `tone` arrives at runtime through rest props, so every value must be emitted.
  staticCss: [{ tone: ["*"] }],
});

export const tooltipIcon = defineRecipe({
  className: "tooltip-icon",
  description:
    "Icons inside tooltips — fixed 14px size, never shrinks. For icons that need an explicit class (the social copy/check crossfade layers); a bare tooltip glyph is already sized by the `tooltip` recipe's `& svg`.",
  base: {
    flexShrink: 0,
    width: "token(sizes.tooltipIcon)",
    height: "token(sizes.tooltipIcon)",
    "& path[stroke]": { stroke: "currentColor" },
    "& path[fill]": { fill: "currentColor" },
  },
});
