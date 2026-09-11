// ---------------------------------------------------------------------------
// Which frame of a clip stands in for it — asked of the frames themselves.
//
// A clip on a card is a moving picture, and everywhere it cannot move it needs
// a still: the poster a <video> shows before it has buffered, and the cover an
// Open Graph card is made of, where there is no browser to play anything at
// all. The obvious still is frame zero, and frame zero is very nearly always
// the worst one available — a screen recording opens on an empty state, a
// fade-up from the page's own background, or a title card, which is to say on
// the one frame that says least about what the clip contains.
//
// So the frame is CHOSEN, by two measurements taken of a dozen frames spread
// across the clip:
//
//   • ENERGY — how much is going on in the frame. A blank opening, a fade
//     through black, a solid plate: all of them measure nothing, and anything
//     with a populated interface in it measures a great deal.
//
//   • STILLNESS — how much the frame has in common with the frames either side
//     of it. A frame caught mid-transition is busy by the first measure and
//     still the wrong one to show: it is a sheet halfway on screen, a list
//     mid-scroll, a cross-fade with two states superimposed. A settled frame
//     is one a viewer would recognise.
//
// The pixel work is deliberately all in here, as plain arrays, so it can be
// reasoned about and tested without a canvas: `capture-poster.ts` is the part
// that needs a browser, and it does nothing but seek, draw and hand the bytes
// over. That split is what lets the rule that picks the frame have tests at
// all.
// ---------------------------------------------------------------------------

/**
 * How many frames to look at.
 *
 * Twelve, because each one costs a seek and a decode and the browser does them
 * one at a time — a dozen is around a second on a local file, which is inside
 * the upload it happens during. It is also plenty: the thing being looked for
 * is a settled state that the clip holds for a while, and a state too brief to
 * land in one of twelve samples is too brief to be what the clip is about.
 */
export const POSTER_SAMPLE_COUNT = 12;

/**
 * How much of each end to leave alone.
 *
 * The head is where the fade-up and the title card live, and the tail is where
 * a recording is either frozen on its last state or already fading out. Neither
 * is where the subject is, and sampling them only ever offers the picker frames
 * it then has to reject.
 */
const EDGE_SHARE = 0.08;

/**
 * What a frame mid-transition is docked, relative to what it is worth.
 *
 * At 1 the two measurements are equals, and that is the wrong balance: a busy
 * frame during a scroll would beat a quiet-but-settled one every time, because
 * motion in a screen recording is usually motion of something detailed. At 2
 * the penalty is what decides between frames of comparable content, which is
 * exactly the job — energy chooses WHICH PART of the clip, stillness chooses
 * WHERE IN IT.
 */
const MOTION_PENALTY = 2;

/** One frame, reduced to the two things the choice is made from. */
export interface FrameSample {
  /** Where in the clip it was taken, in seconds. */
  time: number;
  /** RGBA bytes, row-major — a canvas `getImageData` of a downscaled frame. */
  pixels: Uint8ClampedArray;
}

/** Rec. 709 luma, on 0..1. The channel weights the eye actually uses. */
function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * How much picture is in a frame, on 0..1 — the mean distance of its pixels
 * from its own average brightness.
 *
 * DEVIATION rather than brightness, contrast or edge count, and the choice
 * matters in both directions: a light interface and a dark one hold the same
 * amount of picture and must measure the same, while a frame of one flat colour
 * measures nothing whatever it that colour is. A plain range (max − min) would
 * be spent entirely by a single stray white pixel on an otherwise empty screen;
 * a mean says how much of the frame is occupied rather than whether anything in
 * it is.
 */
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

/**
 * How far apart two frames are, on 0..1 — nothing for a held frame, one for
 * black against white.
 *
 * Frames of different sizes compare over as much as they share, which is not a
 * case that arises from `capture-poster` (every sample is drawn into the same
 * canvas) and is worth not crashing on regardless.
 */
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

/**
 * Where to take the samples, in seconds.
 *
 * A clip whose duration the browser will not report — a stream, a file still
 * being read, an `Infinity` from a fragmented mp4 — gets one sample at the
 * start rather than none. That is the frame-zero behaviour this module exists
 * to improve on, and it is still better than no poster at all.
 */
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

/**
 * The index of the frame that best stands in for the clip, or `-1` when there
 * is nothing to choose from.
 *
 * Ties go to the EARLIER frame. A clip that holds one state throughout has no
 * better answer anywhere in it, and the earlier one is the one a reader
 * scrubbing to check would reach first.
 */
export function pickPosterFrame(samples: FrameSample[]): number {
  if (samples.length === 0) return -1;

  // Against the frames either side rather than against the previous one alone,
  // so the frame a transition SETTLES INTO is not docked for the transition it
  // came out of. Read from both ends the same way: a sample with one neighbour
  // is judged on that one, not given a second imaginary neighbour of zero.
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
