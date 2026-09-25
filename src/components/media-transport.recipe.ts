import { defineRecipe } from "@pandacss/dev";

export const mediaTransport = defineRecipe({
  className: "media-transport",
  description:
    "The box that holds a clip's own transport — the single play/pause chip in the bottom-right corner of the surface showing it, for the places a visitor should be able to stop a loop without the browser's full control strip laid across the foot of the picture. Positioned exactly like `demoFrameControls`, and on the same terms: it is absolute against whatever positioned box the SURFACE provides (the lightbox's frame), so it costs that box's measurement nothing and nothing enters the media's own flow. It is a box around the button rather than the button's own class for the same reason the frame's controls are: `action`'s `icon` variant is itself `position: relative`, and one recipe cannot out-rank another recipe's variant. The chip inside wears the `glass` emphasis rather than the frame controls' bare glyph, because this one floats on a picture rather than on a surface of the app's own.",
  base: {
    position: "absolute",
    // The same 12px the frame's controls take, so the two read as one
    // class of control wherever they turn up. Anchored to the FRAME,
    // like every other control in this app that sits in a corner —
    // never to the picture inside it, which moves as its inset changes.
    right: "lg",
    bottom: "lg",
    // Above the clip, which is itself raised over the ground behind it
    // (the lightbox's `image` slot sits at 1 to clear its gradient).
    zIndex: 2,
    // Down until you reach for the picture. A clip is shown to be
    // WATCHED, and a chip parked in the corner of every one of them is
    // permanent chrome over content that has none — the same call the
    // collection cell's controls make. It fades rather than snapping,
    // and it stays up for as long as focus is inside the surface, so a
    // keyboard can reach it at all.
    opacity: 0,
    transition: "opacity 150ms ease",
    "[data-media-surface]:hover &, [data-media-surface]:focus-within &":
      { opacity: 1 },
    // Where there is no pointer to hover with, there is no reveal to
    // wait for — a touch visitor would otherwise have no way to stop a
    // clip at all.
    "@media (hover: none)": { opacity: 1 },
  },
});
