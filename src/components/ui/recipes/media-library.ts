import { defineRecipe } from "@pandacss/dev";

export const libraryBody = defineRecipe({
  className: "library-body",
  description: "The two-column body of a media library dialog.",
  base: {
    display: "flex",
    flex: "1 1 auto",
    alignItems: "stretch",
    width: "100%",
    minHeight: 0,
  },
});

export const mediaLibrarySidebar = defineRecipe({
  className: "media-library-sidebar",
  description: "The list column of a media library dialog.",
  base: {
    width: "token(sizes.librarySidebar)",
    flexShrink: 0,
    alignSelf: "stretch",
    borderRightWidth: "token(spacing.3xs)",
    borderRightStyle: "solid",
    borderColor: "border.divider",
    paddingBlock: "md",
    paddingInline: "sm",
    display: "flex",
    flexDirection: "column",
    gap: "none",
    minHeight: 0,
    overflow: "hidden",
  },
});

export const mediaPreviewPane = defineRecipe({
  className: "media-preview-pane",
  description: "The preview column of a media library dialog.",
  base: {
    flex: "1 1 auto",
    alignSelf: "stretch",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "xs",
    paddingBlock: "md",
    paddingInline: "md",
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
  },
});
