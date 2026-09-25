import { defineRecipe } from "@pandacss/dev";

// The Select counterpart to datePopover, sized to the option list
// (Figma 629:1416 dark / 630:1702 light).
export const comboboxPopover = defineRecipe({
  className: "combobox-popover",
  description:
    "Covering option-list popover for the Combobox input: anchored over the trigger frame (top/left) with an opaque brand-tinted surface + brand inset border, ≥ the option-list width and ≥ the trigger width. The Select sibling of datePopover.",
  base: {
    // Absolute for the same reason as datePopover — same shell, same
    // covering geometry, same scroll flutter if it were fixed.
    position: "absolute",
    zIndex: 50,
    positionAnchor: "--combobox-popover",
    top: "anchor(top)",
    left: "anchor(left)",
    width: "token(sizes.optionListWidth)",
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
