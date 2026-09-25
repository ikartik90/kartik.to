import { defineRecipe } from "@pandacss/dev";

// The "Add Image" call to action filling an unused collection slot. A
// real button, so it takes the OptionList row's state ladder — the same
// gesture (pick this thing) should look the same whether it's a 32px
// row or a 312px cell. Two differences from that slot, both deliberate:
//
//   • It has a RESTING fill (`bg.itemHover`, Figma 828:6860/827:6511 —
//     the same 25% neutral in both themes). An option row can rest
//     transparent because the list around it frames it; an empty cell
//     has nothing to sit in, so the fill IS what makes the slot legible
//     as a slot. Hover then lifts to the secondary button's hover wash,
//     which is the only neutral above it in both themes.
//   • No `:not([aria-selected])` guards on the hover rule. Those exist
//     in `optionList` because a selected row is ALSO the roving
//     highlight and the two states collide on one element; nothing here
//     is ever selected or pressed, so there is nothing to guard against.
export const collectionEmptyCell = defineRecipe({
  className: "collection-empty-cell",
  description:
    "Add Image CTA occupying an empty collection slot in the editor — OptionList's state ladder (rest ▸ hover ▸ active ▸ keyboard focus) scaled up to a grid cell (Figma 828:6860 light / 827:6511 dark).",
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "sm",
    width: "token(spacing.full)",
    height: "token(spacing.full)",
    // The filled cell's corner — an empty slot is the same card with
    // nothing in it, and the two sit side by side in one grid.
    borderRadius: "xl",
    borderWidth: "token(spacing.3xs)",
    borderStyle: "solid",
    borderColor: "border.divider",
    backgroundColor: "bg.itemHover",
    appearance: "none",
    color: "field.text.default",
    textStyle: "bodySmall",
    cursor: "pointer",
    userSelect: "none",
    transition:
      "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
    "& svg": {
      width: "token(spacing.xxl)",
      height: "token(spacing.xxl)",
      flexShrink: 0,
      display: "block",
    },
    "& svg path[stroke]": { stroke: "currentColor" },
    "& svg path[fill]": { fill: "currentColor" },
    "&:hover": { backgroundColor: "bg.button.secondary.hover" },
    "&:active": {
      backgroundColor: "field.bg.active",
      color: "field.text.active",
    },
    "html[data-keyboard-focus] &:focus-visible": {
      boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
    },
  },
});
