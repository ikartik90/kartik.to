import { defineRecipe } from "@pandacss/dev";

export const libraryBody = defineRecipe({
  className: "library-body",
  description: "Two-column library layout between header and footer.",
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
  description:
    "Library sidebar column in the insert dialogs — the frame around an OptionList.Listbox (component list / image list). Owns the width, divider and inset; the listbox inside owns the scrolling, since it keeps its own active row in view by nudging its scrollTop.",
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
  description:
    "Right column of library view with preview and metadata.",
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
