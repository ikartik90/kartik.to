import { defineRecipe } from "@pandacss/dev";

export const demoFrameControls = defineRecipe({
  className: "demo-frame__controls",
  description:
    "The frame's controls for a demo that performs itself (replay / reset) — the bare pair of icon buttons in its bottom-right corner, with no rail under them. Deliberately NOT the shared `toolbar` chrome it used to compose: these sit on the frame's own surface, which is already a bounded box, and a second bordered box inside it was one frame too many. What is left is the row itself, and each button draws its own chip on hover. It belongs to the frame rather than to the demo's own layout, which is why it is placed here: the demo is centred inside the area's 20px padding band and so never reaches this corner. Out of flow, so it costs the frame's content measurement nothing.",
  base: {
    position: "absolute",
    // 12px in, because it is now the BUTTON that sits in the corner
    // rather than a rail around it: the frame's own corner is
    // `radii.xl` and the icon chip's is `radii.sm`, and 16 − 12 = 4
    // makes those two curves concentric. The rail this replaces was
    // inset 8px on exactly the same arithmetic against its own 8px
    // corner.
    right: "lg",
    bottom: "lg",
    // The demo below can carry stacking contexts of its own (any
    // element with opacity < 1 makes one at level 0), so `auto` would
    // leave the row's order to the DOM.
    zIndex: 1,
    // The row, which is all the chrome there is now. 4px apart, the
    // spacing the rail used to hold them at — at zero the two hover
    // chips would meet and read as one lozenge, which is the frame
    // coming back in by the side door.
    display: "flex",
    alignItems: "center",
    gap: "sm",
    // The `icon` action is `color: inherit` — its SURFACE owns the
    // glyph hue — so a row that sets nothing inherits `text.default`
    // off the body. That is prose colour, and prose runs to the far end
    // of the ramp in dark (neutral.200) while merely sitting heavy in
    // light (neutral.700): the same omission reads as fine in one theme
    // and as two glaring white glyphs in the other. It matters more
    // now that there is no surface behind the glyphs to hold them
    // down. This is the pair the calendar's own chevrons take, so the
    // frame's controls and the demo's read as one class of control in
    // both themes.
    color: "field.text.default",
    // Down until the visitor is actually in the frame. The demo plays
    // itself the moment it comes on screen, so for most of an article
    // these are controls nobody is reaching for, sitting in the corner
    // of a picture — the same call the clip's transport makes, and the
    // same terms: a fade, and up for as long as focus is inside, so a
    // keyboard can reach them at all.
    opacity: 0,
    transition: "opacity 150ms ease",
    "[data-demo-frame]:hover &, [data-demo-frame]:focus-within &": {
      opacity: 1,
    },
    // No pointer to hover with, so no reveal to wait for.
    "@media (hover: none)": { opacity: 1 },
  },
});
