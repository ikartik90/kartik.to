import { defineRecipe } from "@pandacss/dev";
import { aspectRatioEntries } from "./ui/recipes/shared";

const demoFrameAspectRatioVariants = Object.fromEntries(
  aspectRatioEntries.map(([tier, [w, h]]) => [
    tier,
    { aspectRatio: `${w} / ${h}` },
  ]),
);

// `cqw` is a percentage of the container's WIDTH, so reserving a height from it
// needs the ratio the other way up: h / w, written as `calc(h * 100 / w)` so it
// stays exact for tiers like 3:2 that no decimal expresses cleanly.
const demoFrameAspectRatioFloors = aspectRatioEntries.map(([tier, [w, h]]) => ({
  logger: true,
  aspectRatio: tier,
  css: {
    // Dropping the ratio has to happen HERE, in the compound, rather than in
    // the `logger` variant that reads like it does it. Both variants are a
    // single class, so neither outranks the other and source order decides —
    // and Panda emits `aspectRatio` after `logger`, so the variant's
    // `aspect-ratio: unset` lost every time. That went unnoticed for exactly
    // one reason: the floor below is derived from the same ratio and resolves
    // to the same pixel, so a logger frame measured correct while the ratio
    // sat on it as a CEILING. It is what capped the Calchemy demo at 232px in
    // a 296px demo and left it to hide its own calendar. Compounds are emitted
    // last, so this one wins.
    aspectRatio: "auto",
    minHeight: `calc(${h * 100}cqw / ${w})`,
  },
}));

export const demoFrame = defineRecipe({
  className: "demo-frame",
  description:
    "Column shell that hugs demo-area and optional logger footer.",
  base: {
    width: "token(spacing.full)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    overflow: "hidden",
    // The containing block for `demoFrameControls` — a demo that
    // performs itself pins its replay/reset rail to the FRAME's corner,
    // not to wherever its own content happens to end.
    position: "relative",
    borderRadius: "xl",
    backgroundColor: "bg.canvas",
    borderWidth: "token(spacing.3xs)",
    borderStyle: "solid",
    borderColor: "border.divider",
    containerType: "inline-size",
    containerName: "demoFrame",
    "& > *": {
      flexShrink: 0,
      maxWidth: "token(spacing.full)",
      width: "fit-content",
    },
  },
  variants: {
    logger: {
      true: {
        "& > *": {
          width: "token(spacing.full)",
        },
      },
    },
    /**
     * Whether the frame draws itself.
     *
     * A demo is a specimen and wants the box around it — it says where
     * the prototype ends and the page begins. A WIDGET is not a
     * specimen: it is the thing itself, and a hairline around it reads
     * as a screenshot of a widget rather than as one. `none` keeps
     * every measurement the frame makes (the shape, the padding, the
     * content sizing) and stops drawing the outline.
     */
    chrome: {
      none: {
        borderColor: "transparent",
      },
    },
  },
  // Both variants are chosen at RUNTIME — `logger` from the card's own
  // row, `chrome` from the demo's registry entry — so neither value is
  // ever written literally in a `demoFrame(...)` call for Panda to find
  // by scanning. Without this the class is on the element and the rule
  // behind it does not exist, which fails silently: the frame simply
  // keeps its outline.
  staticCss: [{ logger: ["*"], chrome: ["*"] }],
});

export const demoFrameDemoArea = defineRecipe({
  className: "demo-frame__demo-area",
  description:
    "Demo region with aspect ratio; sizes from ratio and content.",
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "token(spacing.full)",
    maxWidth: "token(spacing.full)",
    flexShrink: 0,
    // Even 20px top and bottom — the 40px `getDemoFrameMinHeight`
    // reserves for a frame, split in two. The logger variant is the one
    // case that trims the foot, and it says why.
    paddingBlock: "xxl",
    // The same 20px at the sides, but where the block padding is always
    // spent, this is only ever FELT when the demo is too wide for the
    // frame. A demo that fits is centred and never reaches the inset:
    // `demoFrameDemoMeasure` is `fit-content`, and a logger frame's
    // stretched child is still held by its own max-width. Below that
    // point the inset is what the demo is clamped to, so a narrow frame
    // gives it a gutter instead of running it into the edge.
    //
    // It costs the height arithmetic nothing: `aspect-ratio` sizes the
    // BORDER box, and `getDemoFrameMinHeight` counts only the 40px of
    // block padding, so the ratio-vs-content floor resolves exactly as
    // before — a squeezed demo simply measures taller, which is the
    // input that floor already takes.
    paddingInline: "xxl",
  },
  variants: {
    aspectRatio: demoFrameAspectRatioVariants,
    logger: {
      true: {
        height: "auto",
        // A logger footer follows, and `demoLoggerSection` carries an
        // 8px inset of its own. Trimming the area's foot to 12 lets the
        // two add back up to 20, so the demo still sits evenly between
        // the frame's top edge and the logger panel.
        paddingBlockEnd: "lg",
        "& > *": {
          width: "token(spacing.full)",
          maxWidth: "token(spacing.full)",
          // The floor below is a `min-height`, and a floor is only a
          // floor if the demo can push past it. This column's items
          // shrink by default, so a demo taller than the floor was
          // squashed down to it instead of raising it — and a demo
          // that hides its own overflow (Calchemy does) then quietly
          // cut its calendar off rather than showing it clipped. The
          // demo keeps its height and the AREA gives way, which is
          // exactly what `demoFrameDemoMeasure` guarantees the
          // non-logger path; a logger frame has no such wrapper, so
          // the guarantee has to be made here.
          flexShrink: 0,
        },
      },
    },
  },
  // A logger frame drops `aspect-ratio` (here, in the compound — see
  // `demoFrameAspectRatioFloors` for why it cannot be done in the
  // variant), so reserve that height as a floor in container-query
  // units — full height from SSR, no client-measured jump. A FLOOR,
  // which is the point: the ratio it replaces was a fixed height, and
  // a demo taller than it at the width it landed at raises the frame
  // instead of being cut off by it. cqw factor = ratioHeight / ratioWidth, which
  // is why these read as different numbers from the variant above even
  // though they are the same ratios; both are derived from the one map
  // in src/utils/demo-frame-sizing.ts rather than written out here.
  compoundVariants: demoFrameAspectRatioFloors,
  defaultVariants: {
    aspectRatio: "2/1",
  },
  // Runtime variant values — force every branch, compounds included, or
  // the area silently falls back to its content-height min-height.
  staticCss: [
    { aspectRatio: ["*"] },
    { aspectRatio: ["*"], logger: ["*"] },
  ],
});
