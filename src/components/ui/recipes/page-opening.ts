import { defineRecipe } from "@pandacss/dev";
import { PAGE_OPENING } from "../../../data/page-opening";

// From the first paint, before the page's script runs; held at its start through its wait (`backwards`). The caller
// sets `--opening-delay` (`openingLineDelay`, `openingStepDelay`).
export const pageOpening = defineRecipe({
  className: "page-opening",
  description:
    "A part of the homepage's opening stagger: a `line` of the hero, or a `step` after them.",
  base: {
    animationFillMode: "backwards",
    animationDelay: "var(--opening-delay, 0ms)",
  },
  variants: {
    part: {
      line: {
        animationName: "openingLine",
        animationDuration: `${PAGE_OPENING.lineMs}ms`,
        animationTimingFunction: PAGE_OPENING.lineEase,
      },
      step: {
        animationName: "openingStep",
        animationDuration: `${PAGE_OPENING.stepMs}ms`,
        animationTimingFunction: PAGE_OPENING.stepEase,
      },
    },
  },
});
