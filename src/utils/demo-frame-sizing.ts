export type DemoFrameAspectRatio = "sm" | "md" | "lg";

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

const ASPECT_RATIOS: Record<DemoFrameAspectRatio, [number, number]> = {
  sm: [2, 1],
  md: [3, 2],
  lg: [5, 6],
};

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
