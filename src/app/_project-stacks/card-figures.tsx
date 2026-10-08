"use client";

import type { RefObject } from "react";
import { CHECK_INS_CLOCK, CHECK_INS_FRAMING, CheckInsDrawing } from "./check-ins-figure";
import { FADE } from "./figure";
import { ONBOARDING_CLOCK, ONBOARDING_FRAMING, OnboardingDrawing } from "./onboarding-figure";
import { PLAY, ShiftFigure, TRACK } from "./shift-figure";
import { SpecFigure } from "./spec-figure";

// How every cover draws.
const DRAWING = { line: 1, dots: true, fade: FADE };

const DESIGN_SYSTEM = {
  ...DRAWING,
  scale: 0.75,
  shift: -16,
  drop: 12,
  motion: { move: 1200, hold: 3000 },
  explode: { spread: 20, ms: 700, nudge: { card: -8, chips: 36, avatar: 0, text: -16, icons: -16 } },
};
const SHIFT_SCHEDULING = { ...DRAWING, scale: 1, shift: -16, play: PLAY, track: TRACK };
const CHECK_INS = { ...DRAWING, ...CHECK_INS_FRAMING, clock: CHECK_INS_CLOCK };
const ONBOARDING = { ...DRAWING, ...ONBOARDING_FRAMING, clock: ONBOARDING_CLOCK };

// Each fills its card's face under the card's heading (`headingRef`); the card carries `figureHost` to turn it on.
type CoverProps = { headingRef?: RefObject<HTMLElement | null> };

export function DesignSystemFigure({ headingRef }: CoverProps) {
  return (
    <SpecFigure
      {...DESIGN_SYSTEM}
      headingRef={headingRef}
      label="A component with its values named as tokens, coming apart into its layers"
    />
  );
}

export function ShiftSchedulingFigure({ headingRef }: CoverProps) {
  return (
    <ShiftFigure
      {...SHIFT_SCHEDULING}
      headingRef={headingRef}
      label="A week of shifts, repeated over the weeks after as the schedule’s end slides out, but for a holiday"
    />
  );
}

export function CheckInsFigure({ headingRef }: CoverProps) {
  return (
    <CheckInsDrawing
      {...CHECK_INS}
      headingRef={headingRef}
      label="A dial clocked in at seven, its hand sweeping round to three as the hours worked fill in"
    />
  );
}

export function OnboardingFigure({ headingRef }: CoverProps) {
  return (
    <OnboardingDrawing
      {...ONBOARDING}
      headingRef={headingRef}
      label="Speed gates with a badge over the reader; it presses onto the reader and the glass wings slide open"
    />
  );
}
