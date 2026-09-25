import { defineSlotRecipe } from "@pandacss/dev";

// The reader's enlarged-image view.
//
// The size rule — "natural size, or 85vh/85vw, whichever is smaller" —
// needs no JavaScript branch on orientation. With both maxima in play
// and the natural width set inline, `width: auto` resolves to exactly
// min(natural, 85vw, 85vh × ratio): a tall image is caught by the
// height cap, a wide one by the width cap, and a small one by neither.
export const mediaLightbox = defineSlotRecipe({
  className: "media-lightbox",
  description:
    "An enlarged media object — clamped to its natural size or 85% of the viewport, whichever is smaller, with the object's caption beneath. Shared by a collection's tiles and a standalone media block, which enlarge the same object.",
  slots: [
    "panel",
    "figure",
    "frame",
    "backgroundEffect",
    "image",
    "caption",
  ],
  base: {
    panel: {
      background: "transparent",
      border: "none",
      padding: "none",
      overflow: "visible",
      maxWidth: "none",
      maxHeight: "none",
      // A modal <dialog> is focusable, and this one holds focus on
      // ITSELF — it has no focusable children to hand off to, and it
      // needs the focus to receive the arrow keys. So the moment you
      // press one, `:focus-visible` matches and the UA paints its
      // default ring around a panel that is transparent and hugs the
      // photo, which reads as a border drawn on the image.
      //
      // globals.css's outline reset doesn't cover it: that list is
      // `a, button, input, select, textarea, summary, [tabindex]` and a
      // modal dialog is focusable without matching any of them. Every
      // other dialog in the app escapes this only because focus lands
      // on a child instead.
      //
      // Suppressing it costs no affordance — the dialog is a container,
      // not a control, so the ring marks nothing you could activate.
      focusVisibleRing: "none",
    },
    figure: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "md",
      margin: "none",
    },
    // Wraps the image so the gradient has a box to fill. It cannot fill
    // the FIGURE — that column also holds the caption, and the ground
    // would run out behind the text. `flex` (not block) so the wrapper
    // shrink-wraps whatever size the image's own maxima resolve to.
    // No corner of its own — the enlarged picture keeps the one it was
    // authored with, like every other surface showing it. The clip
    // stays: it is what holds the gradient to the picture's shape,
    // since the ground fills this box exactly.
    frame: {
      position: "relative",
      display: "flex",
      minWidth: 0,
      overflow: "hidden",
    },
    backgroundEffect: {
      position: "absolute",
      inset: 0,
      zIndex: 0,
      pointerEvents: "none",
      // The same card corner a collection cell draws, for the same
      // reason: this is the container the picture and its ground sit
      // in, and a container's corner is a constant of the design system
      // rather than a per-image property. The picture in front of it
      // wears its own, which grows with the enlargement (see
      // `mediaRadiusPx`) while this does not.
      borderRadius: "xl",
    },
    image: {
      display: "block",
      // BOTH auto, so the two maxima below scale the image on its own
      // aspect ratio instead of cropping or stretching its box. The
      // component narrows `maxWidth` to the natural width once the
      // image has loaded, which is the third term of the size rule.
      width: "auto",
      height: "auto",
      maxWidth: "85vw",
      // Leave the caption room to sit under the image without pushing
      // the pair past the viewport.
      maxHeight: "calc(85vh - token(spacing.4xl))",
      objectFit: "contain",
      borderWidth: "token(spacing.3xs)",
      borderStyle: "solid",
      borderColor: "border.divider",
      // Above the gradient behind it — see the grid's `image` slot for
      // why a positioned sibling would otherwise win.
      position: "relative",
      zIndex: 1,
    },
    caption: {
      // Never wider than the showcase block the picture was enlarged
      // FROM (960px): a picture may run to 85% of a wide screen, but
      // the words under it keep a prose measure. Below that width the
      // caption keeps the same 85vw margin the picture does.
      maxWidth: "min(85vw, token(sizes.articleShowcase))",
      textAlign: "center",
      // No `textWrap` here — `Typography`'s `caption` type balances
      // the lines from the utilities layer, which outranks this one,
      // so a value set here is dead (see `articleShowcase`'s note).
    },
  },
});
