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

// Every aspect ratio anything in the app can take, as `[W, H]` — the same order
// as the CSS `aspect-ratio` this feeds, so `"6/5"` is LANDSCAPE and `"5/6"` is
// the portrait of the same shape.
//
// It is named and filed for the demo frame because that is what first needed
// it, and it has since outgrown that: `LinkCard` shapes its tile from the same
// map, which is deliberate — a listing card's ratios and a demo frame's are the
// same eleven shapes, and a second list of them would be a second place to add
// the twelfth. See the note at the foot of this comment for what happened the
// last time this quantity was written down more than once. `DemoFrameAspectRatio`
// therefore now reads narrower than what it describes; renaming it is a rename
// of a widely-used type and has been left for its own change.
//
// The keys are the RATIOS because the sizes they replaced (`sm`/`md`/`lg`) were
// a false ordering: 4:3 is not smaller than 16:9, it is a different shape, so
// the names ranked things that do not rank and said nothing about what you would
// actually get. They also gave a real bug somewhere to hide — `lg` sat at [5, 6]
// for a while, and "large" reads as perfectly plausible for a portrait frame
// claiming 1152px of height where 800px was meant. `"6/5"` could not have hidden
// it, because the key states the answer. Slashes rather than `6-5` so they match
// CSS, which is the form every consumer of this ends up writing; Panda escapes
// the slash in generated class names, which is generated code nobody reads.
//
// This is the ONLY place a ratio is written down. `panda.config.ts` imports this
// map and derives every CSS form the recipes need — `demoFrameDemoArea`'s
// `aspect-ratio` variant, the `cqw` height floor that stands in for it on logger
// frames (which drop `aspect-ratio` outright), and `linkCard`'s own slot-shaped
// variant. It was three hand-kept copies until recently, and the third one is
// why they are all derived:
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

/**
 * The same shape the other way up — 16:9 ↔ 9:16, and 1:1 unchanged.
 *
 * DERIVED from the key rather than written out as an eleven-entry lookup, for
 * the reason the whole module exists: a second list of the ratios is a second
 * place to add the twelfth, and the one that gets forgotten is the one no test
 * covers. Every key here is literally `"w/h"`, so the counterpart is `"h/w"`,
 * and the map is closed under that swap — a fact `demo-frame-sizing.test.ts`
 * asserts over the whole set rather than leaving to inspection.
 *
 * Falls back to the ratio itself if the swap names nothing, which can only
 * happen if an unpaired shape is added. That is a real dead end for the
 * picker's orientation toggle, and the test above is what catches it; returning
 * the input keeps the UI coherent in the meantime instead of rendering
 * `undefined` as a shape.
 */
export function aspectCounterpart(
  aspect: DemoFrameAspectRatio,
): DemoFrameAspectRatio {
  const [w, h] = aspect.split("/");
  const flipped = `${h}/${w}`;
  return flipped in ASPECT_RATIOS ? (flipped as DemoFrameAspectRatio) : aspect;
}

/**
 * Whether a shape is taller than it is wide.
 *
 * The square answers NO. It is neither orientation, and the picker has to open
 * on one of the two — treating 1:1 as landscape gives it a definite answer and
 * costs nothing, since flipping a square only flips the list it is shown in.
 */
export function isPortraitAspect(aspect: DemoFrameAspectRatio): boolean {
  const [w, h] = ASPECT_RATIOS[aspect];
  return h > w;
}

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
