import { defineRecipe } from "@pandacss/dev";

export const uploadProgress = defineRecipe({
  className: "upload-progress",
  description:
    "Shared progress-bar track (upload dialog + demo preloader).",
  base: {
    position: "relative",
    width: "token(sizes.imagePreviewMax)",
    maxWidth: "token(spacing.full)",
    height: "token(spacing.xxs)",
    borderRadius: "xs",
    backgroundColor: "border.divider",
    overflow: "hidden",
  },
});

export const progressBarFill = defineRecipe({
  className: "progress-bar-fill",
  description: "Animated fill inside the shared progress-bar track.",
  base: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "token(spacing.full)",
    borderRadius: "xs",
    transition: "width linear 100ms",
    backgroundColor: { base: "brand.pink", _dark: "brand.orange" },
  },
});
