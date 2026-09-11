import { hexToRgb, parseColor } from "@/utils/color-value";
import type { BackgroundEffect } from "@/domain/nodes";

// ---------------------------------------------------------------------------
// The ground a picture sits on, drawn with CSS instead of with the shader.
//
// The real one is a `StaticMeshGradient` — a WebGL fragment shader, one draw,
// a canvas. That is available on every surface a BROWSER renders, and on
// exactly none of the surfaces that matter here: an Open Graph image is a PNG
// composed on a server by Satori, which has flexbox, gradients, and no GPU,
// no canvas and no WebGL. A card whose ground is a shader would arrive as a
// blank plate with a picture floating on it.
//
// So the ground is APPROXIMATED, and it is worth being exact about what that
// costs, because it is not much. What the shader draws is a handful of soft
// colour spots blended into each other and turned; what survives into a link
// preview at 1200px wide, behind a picture that covers most of it, is which
// colours and roughly where. The grain, the wave distortion and the spot seed
// do not survive being looked at in a LinkedIn card, and none of them are
// reproduced. The colours, their order, the turn and the offset are, because
// those are what the eye reads as "this is that card".
//
// It is a fallback and it is only ever used where the shader cannot run. The
// reader's own card goes on drawing the real thing.
// ---------------------------------------------------------------------------

/**
 * How far the colours spread from the middle, as a share of the box.
 *
 * Under 100 by a long way, on purpose: a mesh gradient's colours are spots
 * inside the frame rather than stops on its edges, so the outermost colour
 * still has some of the frame beyond it. Pushed to the edges the ground reads
 * as a hard two-colour ramp, which is the one thing a mesh gradient does not
 * look like.
 */
const SPREAD = 70;

/**
 * How wide each spot is, as a share of the box — generous, so neighbours
 * overlap and the seams between them are never findable.
 */
const SPOT_SIZE = 85;

/** One colour of the ground, and where on the box it sits. */
export interface EffectSpot {
  /** `rgba()`, because Satori does not read an eight-digit hex. */
  color: string;
  /**
   * The same colour at zero alpha — what the spot fades OUT to.
   *
   * Not `transparent`, which is transparent BLACK: a gradient to it is
   * interpolated through progressively darker and greyer pixels, and a ground
   * of pale blue spots fading to it comes out grey in the middle. It read as
   * the wrong colours entirely rather than as a soft edge.
   */
  fade: string;
  /** Percentages of the box, from its top-left. */
  x: number;
  y: number;
}

/** A stored `#RRGGBBAA` as the `rgba()` Satori can actually parse. */
function toRgba(value: string, alpha?: number): string {
  const { hex, opacity } = parseColor(value);
  const { r, g, b } = hexToRgb(hex);
  const a = alpha ?? Number((opacity / 100).toFixed(3));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * The colours of an effect, laid out across the box along the turn the author
 * gave it.
 *
 * Screen coordinates, so `y` grows DOWNWARD — which is why a three-quarter turn
 * (-90°) puts the first colour at the foot of the card and the last at its
 * head, exactly as the shader does.
 */
export function effectSpots(effect: BackgroundEffect): EffectSpot[] {
  const colors = effect.colors;
  const radians = (effect.rotation * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);

  // The offset is the shader's, on -1..1 of the frame; here it is half the
  // frame either way, which is the same journey across the same box. Both
  // signs follow the vertex shader's `graphicOffset`, which SHIFTS THE SAMPLING
  // COORDINATE and therefore moves the picture the way the sign reads: a
  // positive offset moves the ground right and down.
  const centreX = 50 + effect.offsetX * 50;
  const centreY = 50 + effect.offsetY * 50;

  return colors.map((color, index) => {
    // A single colour has no ramp to be laid out along and sits in the middle;
    // `length - 1` would be a division by zero saying the same thing badly.
    const along = colors.length === 1 ? 0 : index / (colors.length - 1) - 0.5;
    return {
      color: toRgba(color),
      fade: toRgba(color, 0),
      x: centreX + dx * along * SPREAD,
      y: centreY + dy * along * SPREAD,
    };
  });
}

/**
 * The ground as two CSS declarations — a flat fill, and the spots over it.
 *
 * The fill is the LAST colour rather than a blend of them: a radial spot fades
 * to transparent at its edge, so whatever the fill is shows through in the
 * corners the spots do not reach, and the last colour is the one the ramp was
 * heading towards. A blended average would introduce a colour the author never
 * chose.
 */
export function effectStyle(effect: BackgroundEffect): {
  backgroundColor: string;
  backgroundImage: string;
} {
  const spots = effectSpots(effect);
  const fill = spots[spots.length - 1]?.color ?? "rgba(0, 0, 0, 0)";

  // One colour is one flat plate. Drawing a spot of a colour on a ground of the
  // same colour is a gradient the compositor resolves to nothing.
  if (spots.length === 1) {
    return { backgroundColor: fill, backgroundImage: "" };
  }

  // PAINTED IN REVERSE, because CSS stacks the first background layer on top
  // and the colours are authored front to back — the first colour is the one
  // the ramp starts at and has to be the one you can see at that end.
  return {
    backgroundColor: fill,
    backgroundImage: spots
      .map(
        ({ color, fade, x, y }) =>
          `radial-gradient(${SPOT_SIZE}% ${SPOT_SIZE}% at ${x.toFixed(1)}% ${y.toFixed(1)}%, ${color} 0%, ${fade} 100%)`,
      )
      .join(", "),
  };
}
