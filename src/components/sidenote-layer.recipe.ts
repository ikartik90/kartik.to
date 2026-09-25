import { defineRecipe } from "@pandacss/dev";

export const sidenoteCard = defineRecipe({
  className: "sidenote-card",
  description:
    "Margin note, CSS-anchored via anchor() and revealed only when its annotation is active (caret in the editor; hover/click in the reader). `side` (default): 100px right of the text-content column (via the --sidenote-rail anchor) and 2px above the annotated line. `stacked` (no room): centred on the content column, 4px below/above the line with flip-block — like the slash menu. Vertical/default anchor is the annotation's --sn-<id> (set inline via --sn-anchor).",
  base: {
    // Fixed (not absolute) so anchor()'s flip-block fallback measures
    // overflow against the VIEWPORT. Absolute would measure against the
    // tall <article> — always room below — and never flip above.
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
    // Hidden until its annotation is active.
    opacity: 0,
    visibility: "hidden",
    pointerEvents: "none",
    transitionProperty: "opacity, visibility",
    transitionDuration: "120ms",
    transitionTimingFunction: "ease-out",
    // allow-discrete so `visibility` flips at the START of the reveal —
    // otherwise the card is unfocusable and Edit auto-focus lands on
    // nothing.
    transitionBehavior: "allow-discrete",
    "&[data-active='true']": {
      opacity: 1,
      visibility: "visible",
      pointerEvents: "auto",
    },
  },
  variants: {
    // Horizontal geometry (`left`/`width`) comes from inline styles
    // SidenoteLayer computes: it is scroll-invariant, and it avoids a
    // SECOND named-anchor query, which WebKit silently fails (only the
    // default `position-anchor` resolves there). Vertical stays
    // CSS-anchored to `--sn-anchor` so it tracks scroll.
    placement: {
      side: {
        top: "anchor(top)",
        marginTop: "calc(-1 * token(spacing.md))",
      },
      // Centred on the content column (left computed inline).
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

export const sidenoteCardContent = defineRecipe({
  className: "sidenote-card-content",
  description:
    "Text row of a margin-note card — the ordinal marker followed by the note body.",
  base: {
    display: "flex",
    gap: "xs",
    flex: "1 0 0",
    minWidth: 0,
    textStyle: "sidenote",
    color: "text.default",
  },
});

export const sidenoteCardMarker = defineRecipe({
  className: "sidenote-card-marker",
  description:
    "Leading ordinal in a margin-note card (matches the annotation's superscript), painted in the brand gradient.",
  base: {
    fontWeight: "medium",
    background: "bg.brandedEmphasis",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    color: "transparent",
    WebkitTextFillColor: "transparent",
    userSelect: "none",
  },
});

export const sidenoteCardBody = defineRecipe({
  className: "sidenote-card-body",
  description:
    "Editable/read note body inside a margin-note card. Paragraphs are block children separated by 4px (Shift+Enter in the editor). Shows a placeholder while empty and unfocused.",
  base: {
    // inline-block + a min width gives an EMPTY contentEditable a line
    // box, so the caret is placeable on click.
    display: "inline-block",
    minWidth: "token(spacing.md)",
    caretColor: "text.default",
    focusVisibleRing: "none",
    "& > * + *": { marginTop: "sm" },
    "&[data-placeholder]:empty::after": {
      content: "attr(data-placeholder)",
      color: "text.default/40",
    },
  },
});
