/** Matches `spacing.4xl` — vertical breathing room around demo content. */
export const DEMO_FRAME_CONTENT_PADDING_PX = 40;

/** Logger footer height when expanded (section padding + panel). */
export const DEMO_FRAME_LOGGER_SECTION_EXPANDED_PX = 320;

/** Logger footer height when collapsed (section padding + 40px header). */
export const DEMO_FRAME_LOGGER_SECTION_COLLAPSED_PX = 56;

/** @deprecated Use DEMO_FRAME_LOGGER_SECTION_EXPANDED_PX */
export const DEMO_FRAME_LOGGER_SECTION_PX = DEMO_FRAME_LOGGER_SECTION_EXPANDED_PX;

export function getDemoFrameLoggerOffset(
  logger: boolean,
  loggerExpanded = false,
): number {
  if (!logger) return 0;
  return loggerExpanded
    ? DEMO_FRAME_LOGGER_SECTION_EXPANDED_PX
    : DEMO_FRAME_LOGGER_SECTION_COLLAPSED_PX;
}

// Every aspect ratio a demo frame can take, as `[W, H]` — the same order as the
// CSS `aspect-ratio` this feeds, so `"6/5"` is LANDSCAPE and `"5/6"` is the
// portrait of the same shape.
//
// The keys are the RATIOS because the sizes they replaced (`sm`/`md`/`lg`) were
// a false ordering: 4:3 is not smaller than 16:9, it is a different shape, so
// the names ranked things that do not rank and said nothing about what you would
// actually get. They also gave a real bug somewhere to hide — `lg` sat at [5, 6]
// for a while, and "large" reads as perfectly plausible for a portrait frame
// claiming 1152px of height where 800px was meant. `"6/5"` could not have hidden
// it, because the key states the answer. Slashes rather than `6-5` so they match
// CSS and the form `project-card.tsx` already writes; Panda escapes the slash in
// generated class names, which is generated code nobody reads.
//
// This is the ONLY place a demo-frame ratio is written down. `panda.config.ts`
// imports this map and derives both CSS forms the `demoFrameDemoArea` recipe
// needs — the `aspect-ratio` variant, and the `cqw` height floor that stands in
// for it on logger frames, which drop `aspect-ratio` outright. It was three
// hand-kept copies until recently, and the third one is why this is derived:
// when the 6:5 correction was made, its brief listed only two sites. The floor
// was the one it missed — buried in `compoundVariants`, stating the ratio
// INVERTED (height over width), applying to a single variant combination, and
// covered by no test — so logger frames would have quietly kept the old portrait
// height with everything still green. A twelfth ratio is now one line here.
export const ASPECT_RATIOS = {
  "1/1": [1, 1],
  "4/3": [4, 3],
  "3/4": [3, 4],
  "16/9": [16, 9],
  "9/16": [9, 16],
  "2/1": [2, 1],
  "1/2": [1, 2],
  "3/2": [3, 2],
  "2/3": [2, 3],
  "6/5": [6, 5],
  "5/6": [5, 6],
} satisfies Record<string, [number, number]>;

// Derived, so the type and the map can never disagree — a new entry above is
// immediately assignable at every call site with no second edit.
export type DemoFrameAspectRatio = keyof typeof ASPECT_RATIOS;

export function getAspectRatioHeight(
  width: number,
  aspectRatio: DemoFrameAspectRatio,
): number {
  if (width <= 0) return 0;

  const [ratioWidth, ratioHeight] = ASPECT_RATIOS[aspectRatio];
  return width * (ratioHeight / ratioWidth);
}

export function getDemoFrameMinHeight(
  contentHeight: number,
  logger = false,
  loggerExpanded = false,
): number {
  return (
    contentHeight +
    DEMO_FRAME_CONTENT_PADDING_PX +
    getDemoFrameLoggerOffset(logger, loggerExpanded)
  );
}

export function shouldOverrideDemoFrameAspectRatio(
  contentHeight: number,
  frameWidth: number,
  aspectRatio: DemoFrameAspectRatio,
  logger = false,
  loggerExpanded = false,
): boolean {
  return (
    getDemoFrameMinHeight(contentHeight, logger, loggerExpanded) >
    getAspectRatioHeight(frameWidth, aspectRatio) +
      getDemoFrameLoggerOffset(logger, loggerExpanded)
  );
}

export function getDemoFrameAspectMinHeight(
  frameWidth: number,
  aspectRatio: DemoFrameAspectRatio,
  logger = false,
  loggerExpanded = false,
): number {
  return (
    getAspectRatioHeight(frameWidth, aspectRatio) +
    getDemoFrameLoggerOffset(logger, loggerExpanded)
  );
}
