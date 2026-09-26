import { defineRecipe, defineSlotRecipe } from "@pandacss/dev";

export const wireframe = defineRecipe({
  className: "wireframe",
  description:
    "Wraps content so its text shows as skeleton bars, dimmed by `opacity`; `mode: placeholder` keeps the default cursor over it.",
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
      loading: {},
    },
  },
  defaultVariants: { mode: "placeholder", opacity: 50 },
  // Runtime variant values — force every branch to be emitted.
  staticCss: [{ mode: ["*"], opacity: ["*"] }],
});

export const skeleton = defineSlotRecipe({
  className: "skeleton",
  description:
    "A skeleton bar standing in for a line of text, the same size as the text it replaces; `mode: loading` shimmers it.",
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
  variants: {
    mode: {
      placeholder: {},
      loading: {
        root: {
          "&::after": {
            // The flat fill must go, or it would back the translucent dip and hide it.
            backgroundColor: "transparent",
            backgroundImage:
              "linear-gradient(90deg, currentColor 0%, currentColor 35%, color-mix(in srgb, currentColor 30%, transparent) 50%, currentColor 65%, currentColor 100%)",
            backgroundSize: "200% 100%",
            animation: "wireframeShimmer 1.6s ease-in-out infinite",
          },
          "@media (prefers-reduced-motion: reduce)": {
            "&::after": { animation: "none" },
          },
        },
      },
    },
  },
  // The mode comes from the enclosing scope at runtime.
  staticCss: [{ mode: ["*"] }],
});
