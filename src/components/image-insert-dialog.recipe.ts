import { defineRecipe } from "@pandacss/dev";

export const dialogFooterGroup = defineRecipe({
  className: "dialog-footer-group",
  description: "Left-aligned button cluster in dialog footer.",
  base: {
    display: "flex",
    alignItems: "center",
    gap: "md",
  },
});

export const uploadBodySlot = defineRecipe({
  className: "upload-body-slot",
  description:
    "Flex-grow region that centers the upload block in the dialog content area (Figma y=156 in 480px shell).",
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: "1 1 0%",
    width: "100%",
    minHeight: 0,
  },
});

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

export const mediaPreview = defineRecipe({
  className: "media-preview",
  description:
    "Large image preview in insert-image library view. HEIGHT is the only fixed dimension (280px) — the width hugs the image's own aspect ratio and stretches at most to the pane's content box (`maxWidth: 100%` resolves against the flex container's content box, so the pane's padding is excluded). Fixed rather than max height so the metadata rows below hold their position as you switch images; `object-fit: contain` letterboxes anything the width clamp squeezes. The library holds clips as well as pictures, so the inner rule names both elements — a <video> is a replaced element with the same box model, and the rule is about the BOX, not about what fills it.",
  base: {
    height: "token(sizes.imagePreviewMax)",
    width: "auto",
    maxWidth: "token(spacing.full)",
    flexShrink: 0,
    margin: "none",
    "& :is(img, video)": {
      height: "100%",
      width: "auto",
      maxWidth: "token(spacing.full)",
      objectFit: "contain",
      display: "block",
      borderRadius: "sm",
      outline: "[none]",
    },
  },
});

export const mediaMetadataRow = defineRecipe({
  className: "media-metadata-row",
  description: "Filename and file-size row below preview.",
  base: {
    display: "flex",
    alignItems: "center",
    gap: "xl",
    width: "100%",
    maxWidth: "token(sizes.imagePreviewMax)",
    minWidth: 0,
    textStyle: "caption",
  },
});

export const mediaAltRow = defineRecipe({
  className: "media-alt-row",
  description: "Alt-text field row below metadata.",
  base: {
    width: "100%",
    maxWidth: "token(sizes.imagePreviewMax)",
    minWidth: 0,
    alignSelf: "center",
  },
});

export const mediaDeleteRow = defineRecipe({
  className: "media-delete-row",
  description: "Delete action row below alt text in media preview.",
  base: {
    display: "flex",
    justifyContent: "center",
    width: "100%",
    maxWidth: "token(sizes.imagePreviewMax)",
    minWidth: 0,
    alignSelf: "center",
  },
});

export const mediaThumbnail = defineRecipe({
  className: "media-thumbnail",
  description:
    "Small thumbnail in image library sidebar. Names <video> alongside <img> — a clip's row shows a live thumbnail of itself, filling the same square.",
  base: {
    position: "relative",
    flexShrink: 0,
    width: "token(spacing.xxl)",
    height: "token(spacing.xxl)",
    borderRadius: "xs",
    borderWidth: "token(spacing.3xs)",
    borderStyle: "solid",
    borderColor: "border.divider",
    overflow: "hidden",
    "& :is(img, video)": {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block",
    },
  },
});
