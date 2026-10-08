import { defineSlotRecipe } from "@pandacss/dev";

// The picture's own background, so it clips, scales and rides the drag clone with it.
const transparencyCheckerboard = {
  backgroundColor: "bg.canvas",
  backgroundImage:
    "conic-gradient(token(colors.bg.surface) 25%, transparent 0 50%, token(colors.bg.surface) 0 75%, transparent 0)",
  backgroundSize: "token(spacing.xl) token(spacing.xl)",
} as const;

export const carousel = defineSlotRecipe({
  className: "carousel",
  description:
    "A full-bleed, snapping row of slides at one of three heights, each captioned beneath if asked: a collection in the reader and the editor, whose `cell` also frames the lightbox.",
  slots: [
    "root",
    "scroller",
    "track",
    "controls",
    "slide",
    "stack",
    "picture",
    "caption",
    "slot",
    "cell",
    "tile",
    "image",
    "backgroundEffect",
    "dragPreview",
    "add",
  ],
  base: {
    // Must span a showcase-wide figure, which the scroller's margins' 50% measures.
    root: {
      display: "block",
      position: "relative",
      // A size container takes no width from its content, and the figure centres its children.
      width: "token(spacing.full)",
      containerType: "inline-size",
      containerName: "carousel",
      "&[data-reordering]": { cursor: "grabbing", userSelect: "none" },
    },
    // The page's width, less a docked properties panel. Keep the snap geometry in step with
    // `carouselRestOffsets`.
    scroller: {
      "--carousel-half": "calc((100vw - var(--page-inset-end, 0px)) / 2)",
      "--carousel-inset":
        "max(token(spacing.xxl), calc(var(--carousel-half) - token(sizes.articleContent) / 2))",
      // The snapport's width. A slide wider than it may rest anywhere across its overflow, which a
      // swipe back must cross before it reaches the slide before.
      "--carousel-fit":
        "calc(var(--carousel-half) * 2 - var(--carousel-inset) - token(spacing.xxl))",
      position: "relative",
      width: "calc(var(--carousel-half) * 2)",
      marginInline: "calc(50% - var(--carousel-half))",
      overflowX: "auto",
      overscrollBehaviorInline: "contain",
      scrollbarWidth: "none",
      scrollSnapType: "inline mandatory",
      scrollPaddingInlineStart: "var(--carousel-inset)",
      scrollPaddingInlineEnd: "xxl",
      // Off until the slides have glided back too: WebKit snaps to their transformed boxes.
      "[data-reordering] &, [data-settling] &": { scrollSnapType: "none" },
    },
    // Padding on the track, not the scroller: a scroller's end padding isn't scrollable everywhere.
    // Its height holds from script while a reorder halves the slides.
    track: {
      "--slide-height": "var(--carousel-slide)",
      "[data-reordering] &": {
        "--slide-height": "calc(var(--carousel-slide) / 2)",
      },
      display: "flex",
      alignItems: "flex-start",
      gap: "xxl",
      mdDown: { gap: "md" },
      width: "max-content",
      boxSizing: "content-box",
      paddingInline:
        "max(token(spacing.xxl), calc(var(--carousel-half) - token(sizes.articleShowcase) / 2))",
    },
    // Out of flow, so the page lays out as though they weren't there, until they'd reach the text.
    controls: {
      position: "absolute",
      // Over the editing scroller, whose raised top reaches them.
      zIndex: 1,
      insetInlineEnd: 0,
      bottom: "calc(100% + token(spacing.xl))",
      display: "none",
      _hasCursor: { display: "flex" },
      gap: "sm",
      _carouselStacked: {
        position: "relative",
        insetInlineEnd: "auto",
        bottom: "auto",
        width: "min(token(spacing.full), token(sizes.articleContent))",
        marginInline: "auto",
        marginBlockEnd: "xl",
      },
    },
    // Halved by a reorder, a slide keeps its middle where the whole one's was.
    slide: {
      position: "relative",
      flexShrink: 0,
      scrollSnapAlign: "start",
      "[data-reordering] &": {
        marginBlockStart: "calc(var(--carousel-slide) / 4)",
        transition: "translate 200ms cubic-bezier(0.2, 0, 0, 1)",
      },
    },
    // A picture and its caption; the width follows from the height and the inline `--slide-aspect`,
    // so a caption wraps within it. Too wide to fit, the picture is shortened instead.
    stack: {
      display: "flex",
      flexDirection: "column",
      gap: "md",
      width:
        "min(calc(var(--slide-height) * var(--slide-aspect)), var(--carousel-fit))",
    },
    picture: {
      position: "relative",
      width: "token(spacing.full)",
      height:
        "min(var(--slide-height), calc(var(--carousel-fit) / var(--slide-aspect)))",
    },
    caption: {
      textAlign: "start",
      "&[data-caption-style]": {
        marginBlockStart: "calc(token(spacing.xl) - token(spacing.md))",
      },
      "[data-reordering] &": { display: "none" },
    },
    // A cell and its control rail as siblings: the cell clips, and the rail overhangs its top edge.
    slot: { display: "grid" },
    cell: {
      position: "relative",
      overflow: "hidden",
      borderRadius: "xl",
      borderWidth: "token(spacing.3xs)",
      borderStyle: "solid",
      borderColor: "border.divider",
      "&[data-media-cell]": { cursor: "grab" },
      // Pressed, the slide tilts about `--press-origin`, raised over the next one. Keep in step with
      // `dragPreview`'s `[data-carried]`, which takes this press over mid-gesture.
      scale: "1",
      rotate: "0deg",
      transition: "scale 100ms ease, rotate 100ms ease",
      "&[data-pressed]:not([data-dragging])": {
        zIndex: 1,
        scale: "0.94",
        rotate: "2deg",
        transformOrigin: "var(--press-origin, center)",
      },
      // Where the carried slide will land; straight at once, as its copy takes the tilt.
      "&[data-dragging]": {
        transition: "none",
        borderStyle: "dashed",
        borderWidth: "token(spacing.xxs)",
        borderColor: "field.border.default",
        "& > *": { opacity: 0 },
      },
      // Under the carried photo as it flies in.
      "&[data-landing] > *": { visibility: "hidden" },
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
      // Rung 1 of the paint ladder; see `backgroundEffect`.
      position: "relative",
      zIndex: 1,
      "&[data-checkered]": transparencyCheckerboard,
    },
    // Sized by the cell, so a change of crop can't shift it.
    // Paint ladder, every rung explicit: 0 ground, 1 image, 3 control rail.
    backgroundEffect: {
      position: "absolute",
      inset: 0,
      zIndex: 0,
      borderRadius: "inherit",
      pointerEvents: "none",
    },
    // The carried copy of a slide, parented to the body: its ground and its picture, whose corner
    // is written inline in px, since its `cqw` would resolve against the viewport here.
    dragPreview: {
      position: "fixed",
      left: 0,
      top: 0,
      zIndex: 60,
      pointerEvents: "none",
      overflow: "hidden",
      borderRadius: "xl",
      borderWidth: "token(spacing.3xs)",
      borderStyle: "solid",
      borderColor: "border.divider",
      // Position on `translate`, press on `scale`, so the pointer tracking never transitions.
      translate: "0 0",
      // Born mid-press with no transition; must equal the cell's pressed scale and tilt.
      "&[data-carried]": { scale: "0.94", rotate: "2deg" },
      // Restated because the copied picture's className is dropped.
      "& [data-checkered]": transparencyCheckerboard,
      willChange: "translate, scale, rotate",
      boxShadow:
        "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 24%, transparent)",
    },
    add: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "sm",
      height: "var(--slide-height)",
      aspectRatio: "1",
      borderRadius: "xl",
      borderWidth: "token(spacing.3xs)",
      borderStyle: "solid",
      borderColor: "border.divider",
      backgroundColor: "bg.itemHover",
      appearance: "none",
      color: "field.text.default",
      textStyle: "bodySmall",
      cursor: "pointer",
      userSelect: "none",
      transition:
        "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
      "& svg": {
        width: "token(spacing.xxl)",
        height: "token(spacing.xxl)",
        flexShrink: 0,
        display: "block",
      },
      "& svg path[stroke]": { stroke: "currentColor" },
      "& svg path[fill]": { fill: "currentColor" },
      "&:hover": { backgroundColor: "bg.button.secondary.hover" },
      "&:active": {
        backgroundColor: "field.bg.active",
        color: "field.text.active",
      },
      "html[data-keyboard-focus] &": {
        "&:focus-visible": {
          boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
        },
      },
    },
  },
  variants: {
    size: {
      small: {
        root: { "--carousel-slide": "token(sizes.carouselSlideSmall)" },
      },
      medium: { root: { "--carousel-slide": "token(sizes.carouselSlide)" } },
      large: {
        root: { "--carousel-slide": "token(sizes.carouselSlideLarge)" },
      },
    },
    // The editor's control rail is centred on a slide's top edge, so half of it needs room above,
    // taken from the gap over the carousel so the slides sit where the reader's do.
    editing: {
      true: {
        scroller: { marginBlockStart: "calc(-1 * token(spacing.xxl))" },
        track: { paddingBlockStart: "xxl" },
      },
    },
    // In a box narrower than the page (a sheet): the strip spans the box, past the carousel's own
    // edges by the box's padding (`--carousel-gutter`). `cqw` is the root's, the nearest container
    // to every slot that reads these.
    contained: {
      true: {
        scroller: {
          "--carousel-half":
            "calc(50cqw + var(--carousel-gutter, token(spacing.xxl)))",
          "--carousel-inset": "var(--carousel-gutter, token(spacing.xxl))",
          "--carousel-fit": "100cqw",
          scrollPaddingInlineEnd: "var(--carousel-gutter, token(spacing.xxl))",
        },
        // The first slide rests on the start, the last on the end, and any between in the middle.
        // `--carousel-slide-height` sets the slides' height in place of the size's.
        track: {
          "--slide-height": "var(--carousel-slide-height, var(--carousel-slide))",
          "[data-reordering] &": {
            "--slide-height":
              "calc(var(--carousel-slide-height, var(--carousel-slide)) / 2)",
          },
          paddingInline: "var(--carousel-gutter, token(spacing.xxl))",
          "& > [data-carousel-slide]": { scrollSnapAlign: "center" },
          "& > [data-carousel-slide]:first-child": { scrollSnapAlign: "start" },
          "& > [data-carousel-slide]:last-child": { scrollSnapAlign: "end" },
        },
        // Centred on the last line of the heading `--carousel-heading-gap` above: a box of no height
        // on that line's middle. `lh` is the line height the root inherits, so the caller gives it
        // the heading's text style.
        controls: {
          bottom:
            "calc(100% + var(--carousel-heading-gap, token(spacing.xl)) + 0.5lh)",
          height: "0",
          alignItems: "center",
          _carouselStacked: { bottom: "auto", height: "auto" },
        },
      },
    },
  },
  defaultVariants: { size: "medium" },
  // Chosen at runtime, so emit every branch.
  staticCss: [{ size: ["*"], contained: ["*"] }],
});
