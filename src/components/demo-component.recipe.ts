import { defineRecipe } from "@pandacss/dev";

export const demoPreloader = defineRecipe({
  className: "demo-preloader",
  description:
    "Centers the shared progress bar while a component demo loads.",
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "md",
    width: "token(sizes.imagePreviewMax)",
    maxWidth: "token(spacing.full)",
    minHeight: "token(spacing.5xl)",
    paddingInline: "lg",
  },
});
