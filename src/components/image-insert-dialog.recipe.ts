import { defineRecipe } from "@pandacss/dev";

export const uploadBody = defineRecipe({
  className: "upload-body",
  description:
    "The upload area of the image dialog; `dragOver` highlights it while a file is dragged over it.",
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
