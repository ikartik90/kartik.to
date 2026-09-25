import { defineSlotRecipe } from "@pandacss/dev";

// The picture's own background, so it clips, scales and rides the drag clone with it.
const transparencyCheckerboard = {
  backgroundColor: "bg.canvas",
  backgroundImage:
    "conic-gradient(token(colors.bg.surface) 25%, transparent 0 50%, token(colors.bg.surface) 0 75%, transparent 0)",
  backgroundSize: "token(spacing.xl) token(spacing.xl)",
} as const;

export const collectionGrid = defineSlotRecipe({
  className: "collection-grid",
  description:
    "A grid of images: the editor's slots, or the reader's arrangement set by `layout` (uniform, featured, pair or single).",
  slots: [
    "root",
    "slot",
    "cell",
    "tile",
    "image",
    "backgroundEffect",
    "dragPreview",
    "surplus",
    "surplusDivider",
    "surplusLabel",
  ],
  base: {
    root: {
      display: "grid",
      // 20px: the editor's 40px control rail is centred on a cell's top edge, so half hangs into the gap.
      gap: "xxl",
      width: "token(spacing.full)",
      maxWidth: "token(sizes.articleShowcase)",
      "&[data-reordering]": { cursor: "grabbing", userSelect: "none" },
    },
    // A cell and its control rail as siblings: the cell clips, and the rail overhangs its top edge.
    slot: { position: "relative", display: "grid" },
    cell: {
      position: "relative",
      overflow: "hidden",
      borderRadius: "xl",
      "&[data-media-cell]": { cursor: "grab" },
      // Pressed: stops clipping so the picture can tilt out, raised over the next cell. The picture
      // carries the same radius itself, so its corners survive.
      "&[data-pressed]": { overflow: "visible", zIndex: 1 },
      // Photo and ground scale together about `--press-origin`. Keep in step with `dragPreview`'s
      // `[data-carried]`, which takes this press over mid-gesture.
      "&[data-pressed] > :is(img, video), &[data-pressed] > [data-background-effect]":
        {
          scale: "0.94",
          rotate: "2deg",
          transformOrigin: "var(--press-origin, center)",
        },
      borderWidth: "token(spacing.3xs)",
      borderStyle: "solid",
      borderColor: "border.divider",
      // No transitions: reordering is direct manipulation.
      "&[data-dragging]": {
        borderStyle: "dashed",
        borderWidth: "token(spacing.xxs)",
        borderColor: "field.border.default",
        "& > *": { opacity: 0 },
      },
      // `data-landing` must stay unstyled: hiding its photo mid-flight shows the page through the hole.
      // Arriving matches the flight's LANDING_MS / LANDING_EASE in collection-grid.tsx.
      "&[data-arriving] > *": {
        animation: "collectionArrive 100ms ease-out",
      },
      // On a pseudo-element at rung 2: an inset shadow on the cell would sit under the photo.
      "&[data-drop-target]::after": {
        content: '""',
        position: "absolute",
        inset: 0,
        zIndex: 2,
        borderRadius: "inherit",
        backgroundColor: "field.bg.activeVeil",
        boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
        pointerEvents: "none",
      },
      // The badge is a sibling of the photo's button: one interactive control can't contain another.
      "&[data-surplus]": {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gridTemplateRows: "repeat(2, minmax(0, 1fr))",
        padding: "sm",
        gap: "sm",
        "& > [data-media-tile]": {
          position: "absolute",
          inset: 0,
        },
        "& [data-media-transport]": { right: "auto", left: "lg" },
      },
    },
    tile: {
      display: "block",
      width: "token(spacing.full)",
      height: "token(spacing.full)",
      padding: "none",
      border: "none",
      background: "none",
      appearance: "none",
      cursor: "zoom-in",
      "html[data-keyboard-focus] &:focus-visible": {
        boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
      },
    },
    image: {
      display: "block",
      width: "token(spacing.full)",
      height: "token(spacing.full)",
      objectFit: "cover",
      // No radius: the picture's own arrives inline (`mediaObjectStyle`).
      // `scale`/`rotate`, never `transform`: the drag preview's `translate` must not transition.
      scale: "1",
      rotate: "0deg",
      transition: "scale 100ms ease, rotate 100ms ease",
      // Rung 1 of the paint ladder; see `backgroundEffect`.
      position: "relative",
      zIndex: 1,
      "&[data-checkered]": transparencyCheckerboard,
    },
    // Sized by the cell, so a change of crop can't shift it.
    // Paint ladder, every rung explicit: 0 ground, 1 image, 2 cell ::after, 3 control rail.
    backgroundEffect: {
      position: "absolute",
      inset: 0,
      zIndex: 0,
      // Its own copy of the cell's corner, since a pressed cell stops clipping.
      borderRadius: "inherit",
      pointerEvents: "none",
      // Must match the image's transition, or the ground snaps while the picture eases.
      scale: "1",
      rotate: "0deg",
      transition: "scale 100ms ease, rotate 100ms ease",
    },
    // The reorder clone, parented to the body. An inset picture's corner is written inline in px,
    // since its `cqw` would resolve against the viewport here.
    dragPreview: {
      position: "fixed",
      left: 0,
      top: 0,
      zIndex: 60,
      pointerEvents: "none",
      objectFit: "cover",
      borderRadius: "xl",
      // Position on `translate`, press on `scale`, so the pointer tracking never transitions.
      translate: "0 0",
      // Born mid-press with no transition; must equal the cell's pressed scale and tilt.
      "&[data-carried]": { scale: "0.94", rotate: "2deg" },
      // Restated because the clone's className is replaced; an inline snapshot background overrides it.
      "&[data-checkered]": transparencyCheckerboard,
      willChange: "translate, scale, rotate",
      boxShadow:
        "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 24%, transparent)",
    },
    surplus: {
      gridColumn: 2,
      gridRow: 2,
      justifySelf: "stretch",
      alignSelf: "stretch",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "sm",
      minWidth: 0,
      paddingBlock: "sm",
      paddingInline: "md",
      borderRadius: "xxl",
      borderWidth: "token(spacing.xxs)",
      borderStyle: "solid",
      borderColor: "border.divider",
      backgroundColor: "bg.surfaceGlass",
      color: "field.text.default",
      cursor: "zoom-in",
      appearance: "none",
      "html[data-keyboard-focus] &:focus-visible": {
        boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
      },
      // Joins the positioned layer, or the absolutely positioned photo paints over it.
      position: "relative",
      zIndex: 1,
      // Panda's `backdropFilter` emits only the -webkit- form; the raw key is what Chromium reads.
      backdropFilter: "blur(token(spacing.md))",
      "-webkit-backdrop-filter": "blur(token(spacing.md))",
      "backdrop-filter": "blur(token(spacing.md))",
      "& svg": {
        width: "token(spacing.xxl)",
        height: "token(spacing.xxl)",
        flexShrink: 0,
        display: "block",
      },
      "& svg path[stroke]": { stroke: "currentColor" },
      "& svg path[fill]": { fill: "currentColor" },
    },
    surplusDivider: {
      flexShrink: 0,
      width: "token(spacing.xxs)",
      height: "token(sizes.toolbarButton)",
      backgroundColor: "border.divider",
    },
    surplusLabel: {
      textStyle: "bodyLarge",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  },
  variants: {
    layout: {
      uniform: {
        root: {
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gridTemplateRows: "repeat(2, minmax(0, 1fr))",
          aspectRatio: "3 / 2",
        },
      },
      featured: {
        root: {
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gridTemplateRows: "repeat(2, minmax(0, 1fr))",
          aspectRatio: "3 / 2",
          // The 20px gutter is the editor's; the reader closes it on phones.
          mdDown: { gap: "md" },
          "& > *:first-child": {
            gridColumn: "1 / 3",
            gridRow: "1 / 3",
          },
        },
      },
      pair: {
        root: {
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          // See `featured`.
          mdDown: { gap: "md" },
        },
        cell: { aspectRatio: "1" },
      },
      single: {
        root: { gridTemplateColumns: "minmax(0, 1fr)" },
        tile: { height: "auto" },
        image: { height: "auto" },
      },
    },
  },
  defaultVariants: { layout: "featured" },
  // `layout` is picked at runtime from the item count.
  staticCss: [{ layout: ["*"] }],
});
