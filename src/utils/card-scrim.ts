// Shared by the card recipe and the OG image (Satori reads no tokens), so both shade alike.

export const CARD_SCRIM_MIN_SHARE = 0.25;

export const CARD_WASH_PEAK = 0.95;

export const CARD_WASH_STOPS = 9;

/** `6t⁵ − 15t⁴ + 10t³`: zero value and slope at both ends. */
export function smootherstep(t: number): number {
  return t ** 3 * (t * (t * 6 - 15) + 10);
}

export function cardWashStops(): { offset: number; alpha: number }[] {
  return Array.from({ length: CARD_WASH_STOPS }, (_, step) => {
    const offset = step / (CARD_WASH_STOPS - 1);
    return { offset, alpha: CARD_WASH_PEAK * smootherstep(offset) };
  });
}

/** `paint` maps an alpha (0..1) to a colour: `color-mix()` for browsers, `rgba()` for Satori. */
export function cardWashGradient(paint: (alpha: number) => string): string {
  const stops = cardWashStops()
    .map(({ offset, alpha }) => `${paint(alpha)} ${(offset * 100).toFixed(1)}%`)
    .join(", ");
  return `linear-gradient(to bottom, ${stops})`;
}
