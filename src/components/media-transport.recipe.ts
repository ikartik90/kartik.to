import { defineRecipe } from "@pandacss/dev";

export const mediaTransport = defineRecipe({
  className: "media-transport",
  description:
    "The play/pause chip pinned to a bottom corner of a video, the one `corner` names.",
  base: {
    position: "absolute",
    bottom: "lg",
    // Above the clip, which sits at 1 over its ground.
    zIndex: 2,
    opacity: 0,
    transition: "opacity 150ms ease",
    "[data-media-surface]:hover &, [data-media-surface]:focus-within &":
      { opacity: 1 },
    "@media (hover: none)": { opacity: 1 },
  },
  variants: {
    corner: {
      start: { left: "lg" },
      end: { right: "lg" },
    },
  },
  defaultVariants: { corner: "end" },
  staticCss: [{ corner: ["*"] }],
});
