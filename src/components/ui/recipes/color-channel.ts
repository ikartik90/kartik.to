import { defineRecipe } from "@pandacss/dev";

export const colorChannel = defineRecipe({
  className: "color-channel",
  description:
    "A colour value's text input, as in the colour input and picker: tabular digits, and hex in capitals.",
  base: {
    flex: "1 1 0",
    minWidth: 0,
    fontVariantNumeric: "tabular-nums",
    textTransform: "uppercase",
  },
});
