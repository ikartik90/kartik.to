import { defineRecipe } from "@pandacss/dev";

export const uploadBody = defineRecipe({
  className: "upload-body",
  description:
    "Upload / uploading content block (Figma Frame 25: 280×160).",
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "xs",
    width: "token(sizes.imagePreviewMax)",
    height: "160px",
    flexShrink: 0,
    cursor: "pointer",
    textAlign: "center",
  },
  variants: {
    dragOver: {
      true: {
        backgroundColor: "bg.itemHover",
        borderRadius: "sm",
      },
      false: {},
    },
  },
  defaultVariants: {
    dragOver: false,
  },
});
