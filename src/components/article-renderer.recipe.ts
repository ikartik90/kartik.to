import { defineRecipe } from "@pandacss/dev";

export const articleList = defineRecipe({
  className: "article-list",
  description:
    "Ordered-list wrapper for read-only article prose — resets native list styling and stacks items with the same rhythm as sibling blocks. No width: inherits the `article > *` content-column width so the list aligns with prose, not showcase blocks.",
  base: {
    listStyle: "none",
    margin: "none",
    padding: "none",
    display: "flex",
    flexDirection: "column",
    gap: "xl",
  },
});
