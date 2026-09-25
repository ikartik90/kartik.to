import { defineRecipe } from "@pandacss/dev";
import { aspectRatioEntries } from "./ui/recipes/shared";

const demoFrameAspectRatioVariants = Object.fromEntries(
  aspectRatioEntries.map(([tier, [w, h]]) => [
    tier,
    { aspectRatio: `${w} / ${h}` },
  ]),
);

// `cqw` is a share of the container's width, so a height floor uses the ratio inverted.
const demoFrameAspectRatioFloors = aspectRatioEntries.map(([tier, [w, h]]) => ({
  logger: true,
  aspectRatio: tier,
  css: {
    // Must be the compound, not the `logger` variant: Panda emits `aspectRatio` after `logger`.
    aspectRatio: "auto",
    minHeight: `calc(${h * 100}cqw / ${w})`,
  },
}));

export const demoFrame = defineRecipe({
  className: "demo-frame",
  description:
    "Frame around a live demo: a column holding the demo area and, with `logger`, the log below it. `chrome: none` hides its border.",
  base: {
    width: "token(spacing.full)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    overflow: "hidden",
    // Containing block for `demoFrameControls`.
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
    chrome: {
      none: {
        borderColor: "transparent",
      },
    },
  },
  // Both variants are chosen at runtime, so Panda can't find their values by scanning.
  staticCss: [{ logger: ["*"], chrome: ["*"] }],
});

export const demoFrameDemoArea = defineRecipe({
  className: "demo-frame__demo-area",
  description:
    "The area a demo renders in, shaped by `aspectRatio`; `logger` sizes it to its content above the log.",
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "token(spacing.full)",
    maxWidth: "token(spacing.full)",
    flexShrink: 0,
    // Must total the 40px `getDemoFrameMinHeight` reserves.
    paddingBlock: "xxl",
    paddingInline: "xxl",
  },
  variants: {
    aspectRatio: demoFrameAspectRatioVariants,
    logger: {
      true: {
        height: "auto",
        // 12px plus the logger section's 8px inset matches the 20px top.
        paddingBlockEnd: "lg",
        "& > *": {
          width: "token(spacing.full)",
          maxWidth: "token(spacing.full)",
          // A demo taller than the min-height floor must raise it, not be squashed to it.
          flexShrink: 0,
        },
      },
    },
  },
  compoundVariants: demoFrameAspectRatioFloors,
  defaultVariants: {
    aspectRatio: "2/1",
  },
  // Runtime variant values: every branch and compound has to be generated up front.
  staticCss: [
    { aspectRatio: ["*"] },
    { aspectRatio: ["*"], logger: ["*"] },
  ],
});
