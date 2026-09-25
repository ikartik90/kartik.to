import { defineSlotRecipe } from "@pandacss/dev";

export const optionList = defineSlotRecipe({
  className: "option-list",
  description:
    "Option list: an optional search/filter row above a scrollable listbox of option buttons on a 28px row pitch. Options carry their state as attributes (aria-selected / data-active / :disabled), so the look is fully re-skinnable off selectors. `tone` swaps which half of the palette reads brand: `default` is a self-framed neutral surface with a brand selected chip; `onBrand` drops into the Combobox popover (which owns the surface) and inverts — options brand, selected chip neutral.",
  slots: ["root", "search", "list", "option", "empty", "divider"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      width: "token(sizes.optionListWidth)",
      borderRadius: "sm",
      overflow: "hidden",
    },
    search: {
      flexShrink: 0,
      width: "token(spacing.full)",
      height: "token(spacing.4xl)",
      paddingInline: "md",
      paddingBlock: "none",
      border: "none",
      borderBottomWidth: "token(spacing.3xs)",
      borderBottomStyle: "solid",
      borderBottomColor: "field.border.default",
      background: "transparent",
      appearance: "none",
      color: "field.text.default",
      textStyle: "bodyLarge",
      caretColor: "field.text.active",
      "&::placeholder": { color: "field.text.placeholder" },
      "&::-webkit-search-cancel-button": { display: "none" },
    },
    list: {
      display: "flex",
      flexDirection: "column",
      gap: "none",
      padding: "sm",
      overflowX: "hidden",
      overflowY: "auto",
      // 7 rows plus a half-row peek that signals there is more to scroll.
      maxHeight:
        "calc(7 * token(sizes.optionRow) + 2 * token(spacing.sm) + token(spacing.lg))",
    },
    option: {
      display: "flex",
      alignItems: "center",
      gap: "md",
      width: "token(spacing.full)",
      flexShrink: 0,
      // No fixed height: the inset defines the box, so an icon-only chip comes out 28px.
      padding: "sm",
      borderRadius: "sm",
      position: "relative",
      border: "none",
      background: "transparent",
      appearance: "none",
      textAlign: "left",
      textStyle: "bodySmall",
      color: "field.text.default",
      cursor: "pointer",
      userSelect: "none",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      "& svg": {
        width: "token(spacing.xxl)",
        height: "token(spacing.xxl)",
        flexShrink: 0,
        display: "block",
      },
      "& svg path[stroke]": { stroke: "currentColor" },
      "& svg path[fill]": { fill: "currentColor" },
      transition:
        "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
      // `:not` guards the selected row (also the roving target), or the hover tint wins at equal specificity.
      "&[data-active]:not([aria-selected='true']):not([aria-pressed='true'])":
        { backgroundColor: "field.bg.hover" },
      // Hover tints only while the pointer is the live device, except in a toolbar, which has no roving
      // highlight. `:where()` keeps the specificity of a single rule.
      ":where([role='toolbar']) &:hover:not([aria-selected='true']):not([aria-pressed='true']), :where(html:not([data-input-modality='keyboard'])) &:hover:not([aria-selected='true']):not([aria-pressed='true'])":
        { backgroundColor: "field.bg.hover" },
      "&[aria-selected='true'], &[aria-pressed='true']": {
        backgroundColor: "field.bg.active",
        color: "field.text.active",
      },
      // On a pseudo, not box-shadow (the focus ring uses that); `segmentedControl` narrows it.
      "&[aria-selected='true']::after, &[aria-pressed='true']::after": {
        content: '""',
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        borderWidth: "token(spacing.3xs)",
        borderStyle: "solid",
        borderColor: "field.border.active",
        pointerEvents: "none",
      },
      "&:disabled": {
        color: "field.text.muted",
        opacity: 0.4,
        cursor: "not-allowed",
        "&:hover, &[data-active]": { backgroundColor: "transparent" },
      },
      "html[data-keyboard-focus] &:focus-visible": {
        boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
      },
    },
    empty: {
      display: "flex",
      alignItems: "center",
      height: "token(sizes.optionRow)",
      paddingInline: "sm",
      textStyle: "bodySmall",
      color: "field.text.muted",
      userSelect: "none",
    },
    divider: {
      flexShrink: 0,
      backgroundColor: "border.divider",
      width: "token(spacing.full)",
      height: "token(spacing.xxs)",
    },
  },
  variants: {
    tone: {
      default: {
        // Edge as box-shadow, so it takes no layout.
        root: {
          backgroundColor: "field.bg.default",
          boxShadow:
            "inset 0 0 0 0.5px var(--colors-field-border-default)",
        },
      },
      onBrand: {
        root: { width: "token(spacing.full)" },
        search: {
          color: "field.text.active",
          borderBottomColor: "field.border.active",
          "&::placeholder": { color: "field.text.activeMuted" },
        },
        option: {
          color: "field.text.active",
          // Must repeat the base's split: a combined, ungated :hover would outrank the base rule.
          "&[data-active]:not([aria-selected='true']):not([aria-pressed='true'])":
            { backgroundColor: "field.bg.hoverBrand" },
          ":where([role='toolbar']) &:hover:not([aria-selected='true']):not([aria-pressed='true']), :where(html:not([data-input-modality='keyboard'])) &:hover:not([aria-selected='true']):not([aria-pressed='true'])":
            { backgroundColor: "field.bg.hoverBrand" },
          "&[aria-selected='true'], &[aria-pressed='true']": {
            backgroundColor: "field.bg.selected",
            color: "field.text.default",
          },
          "&[aria-selected='true']::after, &[aria-pressed='true']::after":
            { borderWidth: 0 },
          "&:disabled": {
            "&:hover, &[data-active]": {
              backgroundColor: "transparent",
            },
          },
        },
        empty: { color: "field.text.activeMuted" },
      },
      plain: {
        // For a Popover that already owns the surface (the slash menu): the root collapses.
        root: { display: "contents" },
      },
    },
    // `scroll` caps at 7 rows plus a peek; `content` hugs the rows, bounded by the viewport.
    fit: {
      scroll: {},
      content: {
        list: { maxHeight: "calc(100dvh - token(spacing.5xl))" },
      },
    },
    size: {
      md: {},
      sm: {
        search: {
          height: "token(sizes.optionSearchSm)",
          textStyle: "bodySmall",
        },
        list: {
          gap: "xs",
          paddingInline: "sm",
          paddingBlock: "sm",
          maxHeight:
            "calc(9 * token(sizes.optionRowSm) + 8 * token(spacing.xs) + 2 * token(spacing.sm) + token(spacing.lg))",
        },
        option: { paddingInline: "sm", paddingBlock: "none" },
        empty: { height: "token(sizes.optionRowSm)" },
      },
    },
    direction: {
      block: {},
      inline: {
        root: { display: "contents" },
        list: {
          flexDirection: "row",
          alignItems: "center",
          gap: "xs",
          maxHeight: "none",
          overflow: "visible",
          width: "max-content",
          padding: "none",
        },
        option: { width: "auto" },
        divider: {
          width: "token(spacing.xxs)",
          height: "auto",
          alignSelf: "stretch",
        },
      },
    },
  },
  defaultVariants: {
    tone: "default",
    direction: "block",
    fit: "scroll",
    size: "md",
  },
  // Variants are chosen at runtime, so emit every branch.
  staticCss: [
    { tone: ["*"], direction: ["*"], fit: ["*"], size: ["*"] },
  ],
});
