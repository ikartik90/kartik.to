import { defineRecipe } from "@pandacss/dev";

export const sectionHeadline = defineRecipe({
  className: "section-headline",
  description: "A homepage section's headline, over the cards it introduces.",
  base: {
    maxWidth: "calc(token(sizes.articleShowcase) * 2 / 3)",
    textStyle: "subheadingLarge",
    textWrap: "balance",
    color: "text.title",
  },
});
