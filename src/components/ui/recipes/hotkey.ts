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
    // Overrides the UA's monospace default on <kbd>.
    textStyle: "caption",
    whiteSpace: "nowrap",
  },
  variants: {
    surface: {
      page: {
        backgroundColor: { base: "neutral.200", _dark: "neutral.800" },
      },
      menu: { backgroundColor: "field.bg.hover" },
    },
  },
  defaultVariants: { surface: "page" },
});
