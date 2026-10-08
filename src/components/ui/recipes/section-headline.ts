import { defineRecipe } from "@pandacss/dev";

export const sectionHeadline = defineRecipe({
  className: "section-headline",
  description: "A homepage section's headline, over the cards it introduces.",
  base: {
    maxWidth: "articleContent",
    textStyle: "subheadingLarge",
    textWrap: "balance",
    color: "text.title",
  },
});
