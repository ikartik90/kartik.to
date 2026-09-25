// A clip's poster is its frame with the most picture in it, docked for motion against its neighbours.

export const POSTER_SAMPLE_COUNT = 12;

/** Share of each end to skip: fade-ups and title cards at the head, fade-outs at the tail. */
const EDGE_SHARE = 0.08;

/** At 1, busy mid-scroll frames beat settled ones; at 2, motion decides between comparable frames. */
const MOTION_PENALTY = 2;

export interface FrameSample {
  /** In seconds. */
  time: number;
  /** RGBA, row-major, from a downscaled frame. */
  pixels: Uint8ClampedArray;
}

/** Rec. 709 luma, on 0..1. */
function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Mean deviation from the frame's own mean luma (0..1): light and dark UIs measure alike, flat colour zero. */
export function frameEnergy(pixels: Uint8ClampedArray): number {
  const count = pixels.length / 4;
  if (count === 0) return 0;

  let total = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    total += luminance(pixels[i], pixels[i + 1], pixels[i + 2]);
  }
  const mean = total / count;

  let deviation = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    deviation += Math.abs(
      luminance(pixels[i], pixels[i + 1], pixels[i + 2]) - mean,
    );
  }
  return deviation / count;
}

/** 0 for a held frame, 1 for black against white. */
export function frameChange(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
): number {
  const length = Math.min(a.length, b.length);
  const count = length / 4;
  if (count === 0) return 0;

  let total = 0;
  for (let i = 0; i < length; i += 4) {
    total += Math.abs(
      luminance(a[i], a[i + 1], a[i + 2]) - luminance(b[i], b[i + 1], b[i + 2]),
    );
  }
  return total / count;
}

/** One sample at 0 when the duration is unknown (a stream, `Infinity`). */
export function posterSampleTimes(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [0];

  const start = duration * EDGE_SHARE;
  const end = duration * (1 - EDGE_SHARE);
  const step = (end - start) / (POSTER_SAMPLE_COUNT - 1);

  return Array.from(
    { length: POSTER_SAMPLE_COUNT },
    (_, index) => start + step * index,
  );
}

/** `-1` when there is nothing to choose from; ties go to the earlier frame. */
export function pickPosterFrame(samples: FrameSample[]): number {
  if (samples.length === 0) return -1;

  // Against both neighbours, so a frame a transition settles into isn't docked for it.
  const motion = samples.map((sample, index) => {
    const neighbours = [samples[index - 1], samples[index + 1]].filter(Boolean);
    if (neighbours.length === 0) return 0;
    const total = neighbours.reduce(
      (sum, other) => sum + frameChange(sample.pixels, other.pixels),
      0,
    );
    return total / neighbours.length;
  });

  let best = 0;
  let bestScore = -Infinity;
  samples.forEach((sample, index) => {
    const score = frameEnergy(sample.pixels) - MOTION_PENALTY * motion[index];
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}
