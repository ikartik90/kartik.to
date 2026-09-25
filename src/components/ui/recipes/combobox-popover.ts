import { defineRecipe } from "@pandacss/dev";

export const comboboxPopover = defineRecipe({
  className: "combobox-popover",
  description:
    "The popover a Select opens: an option list laid over its field, at least as wide as the field.",
  base: {
    // Absolute, not fixed: a fixed anchored popover lags its trigger on scroll.
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
