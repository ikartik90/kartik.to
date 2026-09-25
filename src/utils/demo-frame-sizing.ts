/** Matches `spacing.4xl`. */
export const DEMO_FRAME_CONTENT_PADDING_PX = 40;

export const DEMO_FRAME_LOGGER_SECTION_EXPANDED_PX = 320;

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

// `[W, H]`, as CSS `aspect-ratio` reads it. The only place a ratio is written:
// panda.config.ts derives every CSS form from this map.
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

export type DemoFrameAspectRatio = keyof typeof ASPECT_RATIOS;

/** 16:9 ↔ 9:16; returns `aspect` itself if the flip names no ratio. */
export function aspectCounterpart(
  aspect: DemoFrameAspectRatio,
): DemoFrameAspectRatio {
  const [w, h] = aspect.split("/");
  const flipped = `${h}/${w}`;
  return flipped in ASPECT_RATIOS ? (flipped as DemoFrameAspectRatio) : aspect;
}

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
