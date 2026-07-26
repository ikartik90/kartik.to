import { cva } from "../../../styled-system/css";

// ---------------------------------------------------------------------------
// The one look shared by the two actionable primitives: `Button` (a <button>
// that ACTS) and `Link` (an <a>/next-link that NAVIGATES). They differ only in
// semantics/behavior, so their skin lives here once — a single recipe both
// consume — rather than one owning it and the other reaching across a file.
//
//   text  — the standalone CTA: a filled secondary chip, 8px radius, a FIXED
//           40px height (icon + label hug-centered inside it).
//   icon  — the compact square: looks exactly like a toolbar icon button
//           (OptionList.Option's chip — 4px inset around a 20px glyph = 28px,
//           4px radius, a neutral hover fill). `color: inherit` so the surface
//           it sits on owns the glyph hue (the calendar Period row's chevrons,
//           its onBrand retint) instead of this recipe hard-coding one. Hugs
//           its content, so it also carries an optional label (the ← Home link).
//   link   — an inline underlined text link (the "browse to upload" affordance);
//           a <button> that reads like an anchor. No box, no height.
// ---------------------------------------------------------------------------
export const actionRecipe = cva({
  base: {
    cursor: "pointer",
    border: "none",
    appearance: "none",
    textDecoration: "none",
    // Hug the content — never stretch to fill. A flex item's display is
    // blockified (inline-flex → flex), so a flex-column / grid parent's default
    // `stretch` would otherwise pull the control across the cross axis; a
    // definite `fit-content` width opts out. Ignored by the inline `link` variant.
    width: "fit-content",
    transition:
      "transform 100ms ease, background-color 150ms ease, color 150ms ease",
    _active: { transform: "scale(0.97)" },
    _disabled: {
      opacity: 0.5,
      cursor: "not-allowed",
      pointerEvents: "none",
    },
    // Composed icons track the resolved text colour and hold a fixed 20px box.
    "& svg": {
      width: "token(spacing.xxl)",
      height: "token(spacing.xxl)",
      flexShrink: 0,
      display: "block",
    },
    "& svg path[stroke]": { stroke: "currentColor" },
    "& svg path[fill]": { fill: "currentColor" },
  },
  variants: {
    variant: {
      text: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        // Space a leading icon from the label when a text button composes both.
        gap: "md",
        height: "token(spacing.4xl)",
        // Floor a short label (Cancel / OK) to a substantial chip; a longer
        // label grows past it since the width is fit-content.
        minWidth: "token(spacing.5xl)",
        paddingInline: "lg",
        borderRadius: "md",
        backgroundColor: "bg.button.secondary.default",
        color: "text.body",
        textStyle: "bodyLarge",
        _hover: { backgroundColor: "bg.button.secondary.hover" },
      },
      icon: {
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        // Space icon ∣ optional label (the ← Home link) the way the toolbar
        // chip spaces its glyph and text.
        gap: "sm",
        padding: "sm",
        borderRadius: "sm",
        color: "inherit",
        // Matches the toolbar chip so an icon+label case (the ← Home link) reads
        // right; harmless for the icon-only majority.
        textStyle: "bodySmall",
        backgroundColor: "transparent",
        _hover: { backgroundColor: "field.bg.hover" },
        "html[data-keyboard-focus] &:focus-visible": {
          boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
        },
      },
      link: {
        display: "inline",
        padding: "none",
        background: "none",
        color: { base: "brand.pink", _dark: "brand.orange" },
        textStyle: "bodySmall",
        textDecoration: "underline",
        textUnderlineOffset: "3px",
        verticalAlign: "baseline",
        _active: { transform: "none" },
      },
    },
  },
  defaultVariants: {
    variant: "text",
  },
});

export type ActionVariant = "text" | "icon" | "link";
