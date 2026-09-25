import { defineRecipe } from "@pandacss/dev";

export const sidenoteCard = defineRecipe({
  className: "sidenote-card",
  description:
    "Margin note, CSS-anchored via anchor() and revealed only when its annotation is active (caret in the editor; hover/click in the reader). `side` (default): 100px right of the text-content column (via the --sidenote-rail anchor) and 2px above the annotated line. `stacked` (no room): centred on the content column, 4px below/above the line with flip-block — like the slash menu. Vertical/default anchor is the annotation's --sn-<id> (set inline via --sn-anchor).",
  base: {
    // Fixed, not absolute, so the flip-block fallback measures against the viewport.
    position: "fixed",
    zIndex: 40,
    positionAnchor: "var(--sn-anchor)",
    maxWidth: "token(sizes.sidenoteMaxWidth)",
    display: "flex",
    flexDirection: "column",
    gap: "sm",
    padding: "md",
    backgroundColor: "bg.surface",
    "--colors-field-bg-default":
      "var(--colors-field-bg-default-on-surface)",
    borderRadius: "md",
    borderWidth: "token(spacing.3xs)",
    borderStyle: "solid",
    borderColor: "border.divider",
    boxShadow:
      "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
    color: "text.default",
    opacity: 0,
    visibility: "hidden",
    pointerEvents: "none",
    transitionProperty: "opacity, visibility",
    transitionDuration: "120ms",
    transitionTimingFunction: "ease-out",
    // So `visibility` flips at the start of the reveal, or Edit's auto-focus lands on nothing.
    transitionBehavior: "allow-discrete",
    "&[data-active='true']": {
      opacity: 1,
      visibility: "visible",
      pointerEvents: "auto",
    },
  },
  variants: {
    // Horizontal geometry is inline (SidenoteLayer): WebKit fails a second named-anchor query.
    placement: {
      side: {
        top: "anchor(top)",
        marginTop: "calc(-1 * token(spacing.md))",
      },
      stacked: {
        translate: "-50% 0",
        top: "anchor(bottom)",
        marginTop: "sm",
        positionTryFallbacks: "flip-block",
      },
    },
  },
  defaultVariants: { placement: "side" },
});
