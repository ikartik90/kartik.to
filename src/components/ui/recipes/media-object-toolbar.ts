import { defineRecipe } from "@pandacss/dev";

// The control rail that surfaces over a filled collection cell in the
// editor (Figma 828:6697 dark / 828:6838 light).
//
// Reveal is pure CSS off the cell beside it — no hover state in React —
// and keys on focus as well, so tabbing into the buttons brings it up.
// `opacity: 0` (rather than `display: none` or unmounting) is what makes
// that possible: a transparent element is still focusable.
//
// A SIBLING of the cell, never a child of it, which is what every `+`
// below is about: the cell CLIPS — that is what rounds a photo filling
// its slot — and this rail is centred on the cell's top edge with half
// of it hanging outside. A child would be sliced off along that edge.
// The pair sits in the `slot` box, so the rail is always the element
// directly after the cell it belongs to.
//
// It used to sit dead-centre over the photo on a blurred wash, and both
// halves of that were wrong: the wash defocused the very picture the
// controls exist to work on, and the rail covered the middle of it. On
// the edge it covers a strip of nothing and the photo stays sharp —
// which is how a home-grid card carries its toolbar too
// (`grid-item-toolbar.tsx`), so the two editors now agree.
//
// With no wash under it the rail has to separate itself from the photo,
// so it takes the hairline and the elevation the home grid's rail
// spends on exactly that job — the same values, because this is the
// same problem and two chrome treatments for it would read as two
// materials. (The Figma frame carries neither, on the reasoning that
// the scrim already did the separating. Without the scrim it doesn't.)
export const mediaObjectToolbar = defineRecipe({
  className: "media-object-toolbar",
  description:
    "The hover/focus-revealed control pill for an object on the editor's canvas — a collection slot, a standalone media block (the same object in two positions), or the demo frame of a component block — centred on the cell's top edge (Figma 828:6697 dark / 828:6838 light). Composes the shared `toolbar` recipe for the box and adds only what floating costs — position, hairline, elevation, clip — plus a cell-relative width cap. Everything the pill cannot say in icons — caption, background, fit, inset, corner — is edited in the docked `propertiesPanel`.",
  base: {
    position: "absolute",
    // Centred on the cell's TOP EDGE — half above it, half over the
    // photo. Written as "put my centre on the edge" rather than as a
    // -20px offset, so it stays correct if the rail's height ever
    // changes; the grid's 20px gap is sized to swallow the half that
    // hangs out (see the `root` slot).
    insetBlockStart: 0,
    insetInlineStart: "half",
    transform: "translate(-50%, -50%)",
    // Rung 3 of the cell's paint ladder — see `collectionGrid`'s
    // `backgroundEffect` slot. Over the photo, and over a neighbouring
    // cell's drop-target ring, which the overhang reaches into.
    zIndex: 3,
    // What floating costs, in the same values `gridItemToolbar` and
    // `selectionPopover` spend on it — see the note above.
    borderWidth: "token(spacing.3xs)",
    borderStyle: "solid",
    borderColor: "border.divider",
    boxShadow:
      "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
    // The box — 40px tall, 6px inset, 4px gap, on `bg.surface` — is the
    // shared `toolbar` recipe this composes with; only the clip and the
    // cell-relative width cap are the pill's own.
    overflow: "hidden",
    maxWidth: "calc(100% - token(spacing.lg) * 2)",
    opacity: 0,
    // Inert as well as invisible while it is down: the rail straddles
    // the gap above the cell, and a control you cannot see must not be
    // a control you can hit. It is also what keeps `&:hover` below from
    // firing on a rail nobody can see.
    pointerEvents: "none",
    transition: "opacity 150ms ease",
    // Up while the cell is under the pointer, while the pointer is on
    // the rail's own overhanging half (the cell is NOT hovered there,
    // so without this the rail would drop out from under the hand
    // reaching for it), and while anything in it holds focus.
    //
    // And while anything in the CELL holds focus, which is the
    // standalone block's case rather than the grid's: a media block's
    // own tab stop is the picture (`[data-showcase-media]`), so a
    // keyboard reaching the block has to be shown what can be done to
    // it. A collection's cells hold nothing focusable — the grid root
    // is the tab stop — so this costs the grid nothing.
    "[data-media-cell]:hover + &, [data-media-cell]:focus-within + &, &:hover, &:focus-within":
      {
        opacity: 1,
        pointerEvents: "auto",
      },
    // Down for the whole reorder, and back up once the dropped photo
    // has landed.
    //
    // `transition: none` makes this leave AT ONCE rather than fading:
    // the press lifts the cell's clip in the same frame so the photo
    // can tilt out of its slot, and chrome still dissolving over a
    // picture that has left is the wrong thing in the wrong place. Out
    // instantly, back in once the state clears — grabbing is abrupt,
    // letting go is not.
    //
    // The extra `[data-media-cell]` is specificity, not reach:
    // without it this ties with the reveal rule above and would be
    // decided by source order alone.
    "[data-collection-grid][data-reordering] [data-media-cell] + &": {
      opacity: 0,
      pointerEvents: "none",
      transition: "none",
    },
    // And it STAYS down once the gesture is over, for as long as the
    // pointer has not moved. A drag necessarily ends with the cursor
    // over the photo it dropped, so `:hover` matches the moment the
    // rule above lets go — reporting where the gesture finished as
    // though it were a reach for the controls. See `pointerIdle` in
    // `collection-grid.tsx`.
    //
    // No `transition` of its own, deliberately: this state is entered
    // from a rail that is ALREADY down, so there is nothing to animate
    // on the way in, and the fade on the way out should be the ordinary
    // hover fade.
    "[data-collection-grid][data-pointer-idle] [data-media-cell] + &": {
      opacity: 0,
      pointerEvents: "none",
    },
    // In the cell a photo is FLYING INTO, the rail comes back over the
    // length of that flight rather than the shorter hover fade, so it
    // arrives exactly as the photo settles into the slot instead of
    // finishing early and waiting for it. Duration and curve match
    // `LANDING_MS` / `LANDING_EASE` in `collection-grid.tsx`. Never
    // conflicts with the rule above: `data-landing` is set in the same
    // commit that clears `data-reordering`, so the two are never on
    // together.
    "[data-media-cell][data-landing] + &": {
      transition: "opacity 100ms ease-out",
    },
  },
});
