import { defineRecipe } from "@pandacss/dev";

export const mediaTransport = defineRecipe({
  className: "media-transport",
  description:
    "The box that holds a clip's own transport — the single play/pause chip in the bottom-right corner of the surface showing it, for the places a visitor should be able to stop a loop without the browser's full control strip laid across the foot of the picture. Positioned exactly like `demoFrameControls`, and on the same terms: it is absolute against whatever positioned box the SURFACE provides (the lightbox's frame), so it costs that box's measurement nothing and nothing enters the media's own flow. It is a box around the button rather than the button's own class for the same reason the frame's controls are: `action`'s `icon` variant is itself `position: relative`, and one recipe cannot out-rank another recipe's variant. The chip inside wears the `glass` emphasis rather than the frame controls' bare glyph, because this one floats on a picture rather than on a surface of the app's own.",
  base: {
    position: "absolute",
    right: "lg",
    bottom: "lg",
    // Above the clip, which sits at 1 over its ground.
    zIndex: 2,
    opacity: 0,
    transition: "opacity 150ms ease",
    "[data-media-surface]:hover &, [data-media-surface]:focus-within &":
      { opacity: 1 },
    "@media (hover: none)": { opacity: 1 },
  },
});
