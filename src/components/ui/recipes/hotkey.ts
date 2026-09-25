import { defineRecipe } from "@pandacss/dev";

export const hotkey = defineRecipe({
  className: "hotkey",
  description:
    "A keyboard shortcut drawn as the key itself — the palette's `Esc` and the home header's `⌘K`. The `tooltip`'s box: same 20px height, 4px radius, hairline and caption type, sized by its content, one key or a combination. `surface` is the fill, and it belongs to whatever the shortcut is drawn among rather than to the chip. Whether a shortcut is worth SHOWING is the caller's call (`_hasCursor`), not the chip's.",
  base: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    height: "token(spacing.xxl)",
    paddingInline: "sm",
    borderRadius: "sm",
    borderWidth: "token(spacing.3xs)",
    borderStyle: "solid",
    borderColor: "border.divider",
    color: "text.body",
    // Overrides the UA's monospace default on <kbd>, the element this
    // is nearly always worn by.
    textStyle: "caption",
    whiteSpace: "nowrap",
  },
  variants: {
    // What the chip is standing among, which is what its fill answers
    // to. A shortcut is a label, not a control, so it should look like
    // the furniture around it and never like something to press.
    surface: {
      // Out in the layout, beside a tooltip — the home header, where the
      // two are one button's two labels and the cursor swaps one for the
      // other. Same fill, so it reads as a single box changing what it
      // says rather than as two chips trading places.
      page: {
        backgroundColor: { base: "neutral.200", _dark: "neutral.800" },
      },
      // Inside a menu, where the rows are what the eye is calibrated to:
      // the palette's `Esc` takes the wash a hovered row wears, so the
      // hint sits at the same depth as the thing it is a hint about.
      menu: { backgroundColor: "field.bg.hover" },
    },
  },
  defaultVariants: { surface: "page" },
});
