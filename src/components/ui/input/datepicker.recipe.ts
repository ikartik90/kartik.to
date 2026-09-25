import { defineRecipe } from "@pandacss/dev";

// Anchor-name `--date-popover` is set on the frame only while open, so
// exactly one element ever carries it (Figma 563:2486).
export const datePopover = defineRecipe({
  className: "date-popover",
  description:
    "Covering calendar popover for the Date input: anchored over the trigger frame (top/left, ≥ its width) with an opaque brand-tinted surface + brand inset border. Distinct from the below-anchored menu popovers. Absolute (not fixed) so it scrolls WITH the page rather than being re-offset against it each frame.",
  base: {
    // ABSOLUTE, not fixed — the difference is everything on scroll. A
    // fixed anchored element is positioned against the viewport, so the
    // browser has to push it back by the scroller's offset every frame,
    // and that offset is a once-per-frame SNAPSHOT: set `scrollTop` and
    // read both boxes in the same tick and the popover is still exactly
    // where it was, the full scroll delta away from its anchor. Under a
    // real (compositor-driven) scroll that lag is the flutter. Absolute
    // against the `position: relative` <body> — which is the app's
    // scroll container (see globals.css) — puts the popover in the same
    // scrolled space as its trigger, so the two move together in one
    // pass and the delta is 0 at every offset. `anchor()` resolves the
    // same either way: the anchor is a descendant of the containing
    // block. The menu popovers below stay fixed on purpose — they need
    // `position-try-fallbacks` measured against the viewport.
    position: "absolute",
    zIndex: 50,
    positionAnchor: "--date-popover",
    top: "anchor(top)",
    left: "anchor(left)",
    minWidth: "anchor-size(width)",
    backgroundColor: "field.bg.popover",
    borderRadius: "sm",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow:
      "inset 0 0 0 0.5px var(--colors-field-border-active), 0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
  },
});
