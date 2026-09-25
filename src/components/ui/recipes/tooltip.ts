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
    // Shown by its host toggling `data-visible`. The cursor trails the
    // box by its offset, so `pointer-events: auto` never intercepts the
    // pointer yet still lets an interactive tooltip be hit.
    "&[data-visible]": {
      opacity: 1,
      visibility: "visible",
      pointerEvents: "auto",
      filter: "blur(0)",
    },
    // The one placement this box has of its own, for the one case with
    // no cursor to hang from: the demos' invitation on a touch device,
    // where the coordinates of the last thing a finger touched are not
    // a place anybody is looking. Bottom centre, over the page.
    //
    // Placed HERE rather than written onto the element, because a phone
    // is the one viewport that changes height while the box is up — the
    // URL bar slides away as the visitor scrolls — and `bottom` follows
    // that edge where a `top` computed once from `innerHeight` would be
    // stranded. `useCursorTooltip` leaves the inline `left`/`top` off
    // while docked so this rule is unopposed.
    //
    // 50px is a clearance, not a step on the spacing scale: far enough
    // up to read as floating over the page rather than stuck to its
    // edge, plus whatever the home indicator is holding, so it sits the
    // same height above the glass on a phone that has one and a phone
    // that doesn't. And nothing to press — the box is over content the
    // visitor is being invited to touch.
    "&[data-docked]": {
      top: "auto",
      left: "token(spacing.half)",
      bottom: "calc(50px + env(safe-area-inset-bottom, 0px))",
      translate: "-50% 0",
      maxWidth: "calc(100% - token(spacing.3xl))",
    },
    "&[data-docked][data-visible]": { pointerEvents: "none" },
    // A composed trailing glyph, sized and tinted with no className.
    "& svg": {
      flexShrink: 0,
      width: "token(sizes.tooltipIcon)",
      height: "token(sizes.tooltipIcon)",
    },
    "& svg path[stroke]": { stroke: "currentColor" },
    "& svg path[fill]": { fill: "currentColor" },
  },
  variants: {
    // Opt-in, for the tooltip that makes an OFFER rather than naming a
    // control — the demos' "Try it yourself". Brand type on the opaque
    // brand surface the popovers already use (rosemilk/rust): the box
    // covers whatever it is drawn over, so the fill can't be a
    // translucent brand wash the way an inline emphasis is.
    tone: {
      brand: {
        backgroundColor: {
          base: "brand.rosemilk",
          _dark: "brand.rust",
        },
        color: { base: "brand.pink", _dark: "brand.orange" },
        // The bright hue again at 25%, exactly as `field.border.active`
        // draws a focused frame — a neutral hairline is the one part of
        // the box that would still read as the default tooltip.
        borderColor: {
          base: "color-mix(in srgb, var(--colors-brand-pink) 25%, transparent)",
          _dark:
            "color-mix(in srgb, var(--colors-brand-orange) 25%, transparent)",
        },
      },
    },
  },
  // The variant reaches the recipe through `Tooltip`'s rest props, which
  // is a runtime value Panda cannot read statically — without this the
  // class lands on the box and no rule is ever emitted for it.
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
