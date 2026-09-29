import type { FluidTypeSize, TypeViewports } from "../../utils/fluid-type";

export const TYPE_VIEWPORTS: TypeViewports = { mobile: 375, desktop: 1920 };

/** Size and line height in px at each viewport; `textStyles` runs each in a straight line between them. */
export const TYPE_SIZES = {
  title: {
    mobile: { size: 28, lineHeight: 36 },
    desktop: { size: 48, lineHeight: 60 },
  },
  subheadingLarge: {
    mobile: { size: 24, lineHeight: 32 },
    desktop: { size: 36, lineHeight: 48 },
  },
  subheading: {
    mobile: { size: 20, lineHeight: 28 },
    desktop: { size: 30, lineHeight: 40 },
  },
  quote: {
    mobile: { size: 18, lineHeight: 32 },
    desktop: { size: 24, lineHeight: 36 },
  },
  bodyLarge: {
    mobile: { size: 14, lineHeight: 24 },
    desktop: { size: 16, lineHeight: 28 },
  },
  bodySmall: {
    mobile: { size: 12, lineHeight: 20 },
    desktop: { size: 14, lineHeight: 24 },
  },
  code: {
    mobile: { size: 12, lineHeight: 20 },
    desktop: { size: 14, lineHeight: 24 },
  },
  caption: {
    mobile: { size: 11, lineHeight: 20 },
    desktop: { size: 12, lineHeight: 24 },
  },
  sidenote: {
    mobile: { size: 10, lineHeight: 20 },
    desktop: { size: 12, lineHeight: 20 },
  },
  fineprint: {
    mobile: { size: 9, lineHeight: 16 },
    desktop: { size: 10, lineHeight: 16 },
  },
} satisfies Record<string, FluidTypeSize>;
