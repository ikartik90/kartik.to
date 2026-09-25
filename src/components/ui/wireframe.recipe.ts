import { defineRecipe, defineSlotRecipe } from "@pandacss/dev";

// The wireframe scope — the provider's root element. Turning text into
// bars is the primitives' job (only the component knows WHICH of its
// parts are text); this owns what is genuinely scope-wide — the
// dimming, the shimmer switch, the pointer suppression.
export const wireframe = defineRecipe({
  className: "wireframe",
  description:
    "The wireframe/skeleton scope. Wraps any subtree; the text-bearing primitives inside it read the matching React context and swap their text for a `skeleton` bar of the same line box. `mode` picks the intent: `placeholder` dims the block to 25% for demo layouts that present a shape rather than content (Figma 745:4375 / 745:4080), `loading` keeps it at full strength and shimmers while real content is pending. Interactivity and the aria semantics are set by the component, not here — a non-interactive scope is `inert`, a placeholder is `aria-hidden`, a loading scope is `aria-busy`.",
  base: {
    // The same box the scope renders when disabled, so flipping
    // `enabled` never shifts the layout around it. Bars draw from each
    // text node's own `currentColor`, so this needs no colour.
    display: "block",
  },
  variants: {
    // Four deliberate depths (background furniture → foreground
    // subject), not a free dial. 25 is the Figma's recessed demo block
    // (745:4383); 100 is for when the wireframe IS the subject.
    opacity: {
      25: { opacity: 0.25 },
      50: { opacity: 0.5 },
      75: { opacity: 0.75 },
      100: { opacity: 1 },
    },
    mode: {
      placeholder: {
        // A placeholder never advertises a hit target, even when the
        // scope stays interactive.
        cursor: "default",
        "& *": { cursor: "default" },
      },
      loading: {
        "& [data-skeleton]::after": {
          // The highlight is a translucent DIP in currentColor, not a
          // blend toward a named surface, so it reads correctly
          // wherever the bar sits. The flat fill has to go, or it would
          // back the dip and defeat it.
          backgroundColor: "transparent",
          backgroundImage:
            "linear-gradient(90deg, currentColor 0%, currentColor 35%, color-mix(in srgb, currentColor 30%, transparent) 50%, currentColor 65%, currentColor 100%)",
          backgroundSize: "200% 100%",
          animation: "wireframeShimmer 1.6s ease-in-out infinite",
        },
        "@media (prefers-reduced-motion: reduce)": {
          "& [data-skeleton]::after": { animation: "none" },
        },
      },
    },
  },
  defaultVariants: { mode: "placeholder", opacity: 50 },
  // Runtime variant values — force every branch to be emitted.
  staticCss: [{ mode: ["*"], opacity: ["*"] }],
});

// One skeleton bar — what a text node becomes inside a `wireframe`
// scope. The Figma "Line Height Wrapper" (745:4385/4389/4393) draws it
// at the font's CAP HEIGHT in every text style, which is one rule
// rather than a per-textStyle table: `height: 1cap`. Box and width both
// come from the real text, so swapping live ↔ wireframed shifts nothing.
export const skeleton = defineSlotRecipe({
  className: "skeleton",
  description:
    "A single skeleton bar standing in for a run of text. `root` reproduces the replaced text's line box (the string stays in the DOM under `text`, hidden with `visibility` so it still measures) and paints the bar as an ::after at `1cap` — the font's cap height, matching the Figma bars at every text style without a lookup table. The fill is `currentColor`, so the bar inherits the tone of the text it replaced: a muted `field.label` bar and a default-toned value bar come out two-tone exactly as drawn, in both themes, with no tokens of its own. `lines` stacks several for copy that has no text yet.",
  slots: ["root", "text", "lines"],
  base: {
    root: {
      position: "relative",
      // Hugs the string it replaced, which is what gives the bar the
      // width of the real text.
      display: "inline-block",
      maxWidth: "token(spacing.full)",
      verticalAlign: "top",
      "&::after": {
        content: '""',
        position: "absolute",
        insetInline: 0,
        top: "50%",
        transform: "translateY(-50%)",
        // The em fallback is the same ratio for the sans in use.
        height: "0.7em",
        borderRadius: "token(radii.full)",
        backgroundColor: "currentcolor",
        pointerEvents: "none",
      },
      "@supports (height: 1cap)": {
        "&::after": { height: "1cap" },
      },
    },
    text: {
      // `visibility`, not `color: transparent`: it keeps the box
      // measuring, drops the string from the a11y tree, and leaves the
      // root's `currentColor` intact for the bar to paint with.
      visibility: "hidden",
      userSelect: "none",
    },
    lines: {
      display: "flex",
      flexDirection: "column",
      width: "token(spacing.full)",
      "& > [data-skeleton]": { display: "block", width: "100%" },
      // The ragged last line every real paragraph has.
      "& > [data-skeleton]:last-child:not(:only-child)": {
        width: "65%",
      },
    },
  },
});
