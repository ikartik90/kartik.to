import { defineRecipe, defineSlotRecipe } from "@pandacss/dev";

export const wireframe = defineRecipe({
  className: "wireframe",
  description:
    "The wireframe/skeleton scope. Wraps any subtree; the text-bearing primitives inside it read the matching React context and swap their text for a `skeleton` bar of the same line box. `mode` picks the intent: `placeholder` dims the block to 25% for demo layouts that present a shape rather than content (Figma 745:4375 / 745:4080), `loading` keeps it at full strength and shimmers while real content is pending. Interactivity and the aria semantics are set by the component, not here — a non-interactive scope is `inert`, a placeholder is `aria-hidden`, a loading scope is `aria-busy`.",
  base: {
    // The same box the scope renders when disabled, so toggling never shifts the layout.
    display: "block",
  },
  variants: {
    opacity: {
      25: { opacity: 0.25 },
      50: { opacity: 0.5 },
      75: { opacity: 0.75 },
      100: { opacity: 1 },
    },
    mode: {
      placeholder: {
        cursor: "default",
        "& *": { cursor: "default" },
      },
      loading: {
        "& [data-skeleton]::after": {
          // The flat fill must go, or it would back the translucent dip and hide it.
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

export const skeleton = defineSlotRecipe({
  className: "skeleton",
  description:
    "A single skeleton bar standing in for a run of text. `root` reproduces the replaced text's line box (the string stays in the DOM under `text`, hidden with `visibility` so it still measures) and paints the bar as an ::after at `1cap` — the font's cap height, matching the Figma bars at every text style without a lookup table. The fill is `currentColor`, so the bar inherits the tone of the text it replaced: a muted `field.label` bar and a default-toned value bar come out two-tone exactly as drawn, in both themes, with no tokens of its own. `lines` stacks several for copy that has no text yet.",
  slots: ["root", "text", "lines"],
  base: {
    root: {
      position: "relative",
      // Hugs the replaced string, which gives the bar its width.
      display: "inline-block",
      maxWidth: "token(spacing.full)",
      verticalAlign: "top",
      "&::after": {
        content: '""',
        position: "absolute",
        insetInline: 0,
        top: "50%",
        transform: "translateY(-50%)",
        // Fallback for `1cap`: the same ratio for the sans in use.
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
      // `visibility`, not `color: transparent`: the box keeps measuring and the bar keeps `currentColor`.
      visibility: "hidden",
      userSelect: "none",
    },
    lines: {
      display: "flex",
      flexDirection: "column",
      width: "token(spacing.full)",
      "& > [data-skeleton]": { display: "block", width: "100%" },
      "& > [data-skeleton]:last-child:not(:only-child)": {
        width: "65%",
      },
    },
  },
});
