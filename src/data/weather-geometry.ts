// ---------------------------------------------------------------------------
// Weather graphics — the drawing itself, lifted verbatim from Figma 1995:24.
//
// The eleven variants in that frame are ELEVEN ARRANGEMENTS OF FIVE SHAPES, not
// eleven drawings. Cloud Big is the same path in Cloudy, Rain, Snow,
// Thundershower and Fog — half scale in Cloudy, shifted a couple of units
// between the precipitating three, dropped and enlarged in Fog. Cloud Small is
// the same again. The sun and the moon are the same circle under two different
// fills. That is what makes the transitions possible: a state change here moves
// and re-tints shapes that are already on screen, so clear → cloudy is a cloud
// arriving from off-frame rather than one picture being swapped for another.
//
// Every path below is quoted in the coordinates of the 250×250 frame, taken
// from ONE variant (named per constant) which then acts as the canonical
// position. Where the other variants differ, the difference is expressed as a
// transform in the `weatherGraphic` recipe — never as a second copy of the
// path. Two paths that are meant to be the same shape and are written out
// twice will drift the first time one of them is nudged.
//
// The Figma export flattens each variant to a single <svg> with baked-in
// filters. None of that is used: the effects (blur, glow, the big cloud's
// progressive bottom blur, the frosting behind a cloud) are CSS on live SVG
// nodes instead, so they can be interpolated between states.
// ---------------------------------------------------------------------------

/** The frame the whole graphic is drawn in. Square, and the only fixed size. */
export const WEATHER_VIEWBOX = 250;

/**
 * One frame unit as a share of the graphic's own width, for the effects that
 * are expressed in CSS rather than in the viewBox.
 *
 * WebKit does not apply CSS `filter` FUNCTIONS to SVG child elements at all —
 * `blur()` on a `<g>`, a `<path>` or a `<circle>` renders as if it were not
 * there, silently, so in Safari every blur, glow and the whole progressive
 * dissolve simply vanished and the drawing came out as hard-edged shapes. Only
 * the `<svg>` ROOT (a CSS box, not an SVG node) takes them. That is why each
 * layer is its own absolutely-positioned root `<svg>`: it is the one place a
 * variable, interpolating blur can live and still work everywhere.
 *
 * The cost is that those blurs are now in CSS pixels of the rendered box rather
 * than in viewBox units, so they would NOT scale with the graphic — a 10-unit
 * blur drawn at 120px and at 400px would be two different pictures. Container
 * query units put the relationship back: the root declares
 * `container-type: inline-size`, 100cqw is the graphic's width, and the width
 * spans 250 units — so one unit is 0.4cqw, whatever size it renders at.
 */
export const WEATHER_UNIT = "0.4cqw";

/**
 * Cloud Big, quoted from `Weather=Rain, Time=Anytime` (1767:6).
 * Bounding box: x 76.0137, y 73.75, 116.002 × 75.
 */
export const CLOUD_BIG_PATH =
  "M154.516 73.75C175.226 73.75 192.016 90.5393 192.016 111.25C192.016 131.961 175.226 148.75 154.516 148.75H101.015C87.207 148.75 76.0137 137.557 76.0137 123.749C76.0137 109.941 87.207 98.7481 101.015 98.748C107.349 98.748 113.132 101.105 117.538 104.988C120.519 87.2585 135.939 73.75 154.516 73.75Z";

/** Where `CLOUD_BIG_PATH` sits in the frame, for the blur ramp below. */
export const CLOUD_BIG_TOP = 73.75;
export const CLOUD_BIG_HEIGHT = 75;

/**
 * Cloud Small, quoted from `Weather=Rain, Time=Anytime` (1768:62).
 * Bounding box: x 58, y 68, 68.0547 × 44.
 */
export const CLOUD_SMALL_PATH =
  "M80 68C67.8498 68.0001 58 77.8498 58 90C58 101.96 67.5447 111.692 79.4326 111.993L80 112H111.388L111.766 111.995C119.691 111.795 126.055 105.307 126.055 97.333C126.055 89.2326 119.488 82.6661 111.388 82.666C107.671 82.666 104.278 84.0479 101.693 86.3262C99.9447 75.9249 90.8984 68 80 68Z";

/**
 * Plasma Glow (1767:18) — the twelve-point rounded star behind a clear day's
 * sun. Centred on the frame at 125,125, so it can be spun about its middle
 * without a measured origin.
 */
export const PLASMA_GLOW_PATH =
  "M119.491 53.636C122.833 51.4306 127.167 51.4306 130.509 53.636L147.785 65.0392C148.849 65.7417 150.038 66.2341 151.287 66.49L171.567 70.6428C175.489 71.446 178.554 74.5111 179.357 78.4333L183.51 98.7126C183.766 99.962 184.258 101.151 184.961 102.215L196.364 119.491C198.569 122.833 198.569 127.167 196.364 130.509L184.961 147.785C184.258 148.849 183.766 150.038 183.51 151.287L179.357 171.567C178.554 175.489 175.489 178.554 171.567 179.357L151.287 183.51C150.038 183.766 148.849 184.258 147.785 184.961L130.509 196.364C127.167 198.569 122.833 198.569 119.491 196.364L102.215 184.961C101.151 184.258 99.962 183.766 98.7126 183.51L78.4333 179.357C74.5111 178.554 71.446 175.489 70.6428 171.567L66.49 151.287C66.2341 150.038 65.7417 148.849 65.0392 147.785L53.636 130.509C51.4306 127.167 51.4306 122.833 53.636 119.491L65.0392 102.215C65.7417 101.151 66.2341 99.962 66.49 98.7126L70.6428 78.4333C71.446 74.5111 74.5111 71.446 78.4333 70.6428L98.7126 66.49C99.962 66.2341 101.151 65.7417 102.215 65.0392L119.491 53.636Z";

/**
 * One raindrop (1767:57), quoted from `Weather=Rain`. The other two in that
 * variant are this path translated — see `RAINDROPS` — which is also what lets
 * all three ride one fall animation at three delays.
 */
export const RAINDROP_PATH =
  "M117.444 159.14C116.372 163.141 112.259 165.515 108.258 164.443C104.257 163.371 101.883 159.259 102.955 155.258C104.027 151.257 112.917 147.057 112.917 147.057C112.917 147.057 118.516 155.139 117.444 159.14Z";

/**
 * Where each drop hangs, and how far into the fall cycle it starts. The offsets
 * are measured off 1767:57; the delays are chosen so no two drops leave the
 * cloud together (a shower reads as rain, three drops in lockstep read as a
 * blink).
 */
export const RAINDROPS = [
  { x: 0, y: 0, delay: "0s" },
  { x: 19.074, y: 15.634, delay: "-0.55s" },
  { x: 41.074, y: 0, delay: "-1.1s" },
] as const;

/**
 * The three snowflakes (1768:110 / :113 / :116) — three DIFFERENT glyphs, four,
 * six and eight-pointed, at the positions Figma places them. Unlike the
 * raindrops these are not one shape repeated, so each is quoted whole.
 */
export const SNOWFLAKES = [
  {
    path: "M111.01 143.116C112.246 143.116 113.249 144.118 113.249 145.355V150.432L117.649 147.891C118.721 147.272 120.091 147.64 120.709 148.711C121.327 149.782 120.96 151.151 119.889 151.77L115.492 154.308L119.894 156.85C120.965 157.468 121.331 158.837 120.713 159.908C120.094 160.979 118.725 161.347 117.654 160.729L113.249 158.185V163.272C113.249 164.508 112.246 165.511 111.01 165.511C109.773 165.511 108.771 164.509 108.771 163.272V158.19L104.373 160.729C103.302 161.347 101.932 160.979 101.313 159.908C100.695 158.837 101.063 157.468 102.134 156.85L106.534 154.308L102.138 151.77C101.067 151.151 100.7 149.782 101.318 148.711C101.937 147.64 103.307 147.272 104.378 147.891L108.771 150.426V145.355C108.771 144.118 109.773 143.116 111.01 143.116Z",
    delay: "0s",
    // Slightly different clocks per flake, so the three never line up into a
    // pulse. Prime-ish ratios rather than round ones for the same reason.
    duration: "7.3s",
  },
  {
    path: "M135.683 160.248C136.754 160.867 137.121 162.237 136.502 163.308L133.964 167.704L139.045 167.704C140.282 167.704 141.285 168.707 141.285 169.944C141.285 171.18 140.282 172.183 139.045 172.183L133.968 172.183L136.51 176.584C137.128 177.655 136.761 179.025 135.689 179.644C134.618 180.261 133.249 179.895 132.631 178.824L130.087 174.419L127.544 178.823C126.926 179.894 125.556 180.262 124.485 179.644C123.414 179.025 123.047 177.655 123.666 176.584L126.207 172.183L121.129 172.183C119.892 172.183 118.889 171.18 118.889 169.944C118.889 168.707 119.892 167.704 121.129 167.704L126.211 167.704L123.672 163.308C123.054 162.237 123.421 160.867 124.492 160.248C125.563 159.63 126.933 159.997 127.552 161.069L130.088 165.46L132.624 161.068C133.242 159.997 134.612 159.63 135.683 160.248Z",
    delay: "-2.6s",
    duration: "8.9s",
  },
  {
    path: "M160.002 146.392C160.876 147.267 160.877 148.685 160.003 149.56L156.413 153.149L161.321 154.465C162.515 154.785 163.224 156.012 162.904 157.207C162.584 158.401 161.356 159.111 160.162 158.791L155.257 157.476L156.573 162.385C156.893 163.58 156.184 164.809 154.989 165.129C153.795 165.449 152.567 164.739 152.247 163.545L150.931 158.632L147.334 162.228C146.46 163.103 145.041 163.103 144.166 162.228C143.292 161.354 143.292 159.936 144.167 159.061L147.76 155.468L142.855 154.153C141.661 153.833 140.952 152.606 141.272 151.411C141.592 150.217 142.82 149.507 144.015 149.827L148.923 151.142L147.61 146.239C147.29 145.045 147.999 143.816 149.193 143.496C150.388 143.176 151.616 143.885 151.936 145.08L153.249 149.978L156.835 146.392C157.71 145.518 159.127 145.518 160.002 146.392Z",
    delay: "-5.1s",
    duration: "6.7s",
  },
] as const;

/**
 * The bolt (1768:81), quoted from `Weather=Thundershower`. Drawn twice by the
 * component — once soft and wide as its own bloom, once tight as the core —
 * because a single blurred copy loses the zigzag that makes it read as
 * lightning rather than as a smear.
 */
export const LIGHTNING_PATH =
  "M137.469 155.787L114.093 181.85L124.871 158.757L112.509 155.444L137.054 134.482L126.457 152.837L137.469 155.787Z";

/**
 * The progressive blur down Cloud Big, as a set of differently-blurred copies
 * that ADD UP.
 *
 * A single `blur()` is a FIXED blur — the same at the cloud's crown as at its
 * underside — and that is not what the Fog and precipitation variants draw:
 * their cloud is defined along its top arc and dissolves toward the bottom, so
 * the sun can sit behind it and the deck can read as having no floor.
 *
 * The bands PARTITION the cloud's height — every one of them fades out exactly
 * as the next fades in, so the mask values sum to 1 at every y — and the rungs
 * are composited with `mix-blend-mode: plus-lighter`, which adds. The result is
 * therefore a true weighted blend between blur levels: `Σ mask(y) · blur(shape)`.
 *
 * It is worth saying why the obvious construction is wrong, because it looks
 * right until you put it on a dark ground. Stacking blurred copies with normal
 * `over` compositing ACCUMULATES alpha wherever two of them overlap, and
 * blurred copies overlap most at the soft periphery — which is the entire
 * bottom edge of the shape. The cloud grows a bright halo exactly where it is
 * supposed to be dissolving. Cumulative masks (each holding at full opacity
 * below its ramp) don't fix it either: they only guarantee the INTERIOR stays
 * at alpha 1, and the interior was never the problem. Adding is the fix,
 * partitioned masks are what make adding correct, and isolating the group is
 * what stops the addition leaking into the page behind it.
 *
 * Offsets are fractions of the cloud's own height, resolved against
 * CLOUD_BIG_TOP/HEIGHT into the canonical coordinates the masks live in, so
 * the ramp travels and scales with the cloud instead of being pinned to the
 * frame. `blur` is a multiple of `--wx-cloud-big-blur` on top of a uniform
 * `--wx-cloud-big-base`: ONE transitioning variable drives the whole ramp,
 * which is why the cloud can melt from cloudy's hard edge to fog's smoke
 * without four values having to be kept in step.
 */
export const CLOUD_BLUR_BANDS = [
  { blur: 0, stops: [[0.3, 1], [0.5, 0]] },
  { blur: 0.34, stops: [[0.3, 0], [0.5, 1], [0.52, 1], [0.7, 0]] },
  { blur: 0.67, stops: [[0.52, 0], [0.7, 1], [0.72, 1], [0.9, 0]] },
  { blur: 1, stops: [[0.72, 0], [0.9, 1]] },
] as const;


/**
 * The two cloud shapes as CSS mask images.
 *
 * The light a strike puts inside a cloud is "this layer, but only where the
 * cloud is". An SVG `<clipPath>` is the obvious
 * tool and it is the wrong one here: WebKit ignores a CSS `transform` on a
 * clip path's children, so the clip would sit at the cloud's canonical position
 * while the cloud itself moved away from it. A mask image is positioned and
 * sized by CSS — `mask-position` and `mask-size` are both animatable — so it
 * can follow a travelling cloud on the same clock the cloud travels on.
 *
 * Authored in the full 250 frame rather than cropped to the shape, so
 * `mask-size: <scale> * 100%` and `mask-position: <x,y>` reproduce exactly the
 * `translate() scale()` the cloud itself is under, with no second set of
 * numbers to keep in step.
 */
const silhouette = (d: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WEATHER_VIEWBOX} ${WEATHER_VIEWBOX}"><path d="${d}" fill="#fff"/></svg>`,
  )}")`;

export const CLOUD_BIG_MASK = silhouette(CLOUD_BIG_PATH);

/**
 * One band's `mask-image` gradient: opaque across its own slab, gone outside
 * it. The bands are stated as fractions of the SHAPE's own height, and this is
 * the one conversion into the percentages of the whole frame that the gradient
 * is actually drawn in.
 *
 * The gradient pads past its first and last stop, which is what holds the
 * first band opaque above the shape and the last one opaque below it.
 */
/**
 * A smoothstep between two heights, as gradient stops.
 *
 * A two-stop linear gradient has a CORNER where it meets the flat region at
 * either end — the value is continuous but its slope jumps — and the eye reads
 * that as an edge even when the fade across the middle is perfectly gradual.
 * Sampling `t²(3−2t)` instead makes both ends tangential, so the ramp arrives
 * and departs without a seam. The same reasoning as easing a crop fade rather
 * than leaving it linear; here it is the difference between light spreading
 * into a cloud and a line drawn across one.
 */
function easedRamp(from: number, to: number, steps = 6): [number, number][] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return [
      +(from + (to - from) * t).toFixed(4),
      +(t * t * (3 - 2 * t)).toFixed(4),
    ] as [number, number];
  });
}

function bandMask(
  band: { readonly stops: readonly (readonly [number, number])[] },
  top: number,
  height: number,
): string {
  const stops = band.stops.map(
    ([fraction, on]) =>
      `rgb(255 255 255 / ${on}) ${((((top + fraction * height) / WEATHER_VIEWBOX) * 100).toFixed(2))}%`,
  );
  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

export function cloudBandMask(band: (typeof CLOUD_BLUR_BANDS)[number]): string {
  return bandMask(band, CLOUD_BIG_TOP, CLOUD_BIG_HEIGHT);
}

/**
 * Where the sun and the moon are DRAWN, before any condition moves them: the
 * middle of the frame, at Figma's 50-unit radius. Every condition's placement
 * is a transform off this, applied to the layer rather than to the shape — see
 * the `orbLayer` slot for why that matters.
 */
export const ORB_CENTRE = WEATHER_VIEWBOX / 2;
export const ORB_RADIUS = 50;

/**
 * The same partition, laid over the sun or the moon — which is how the hazy
 * sky gets a disc that is defined along its crown and dissolves toward its
 * underside rather than being evenly smeared. Haze sits ON something; a
 * uniformly blurred disc reads as a photograph out of focus, and this is the
 * variant where that difference is the whole point.
 *
 * Constants, because the body is drawn where it is drawn and it is the LAYER
 * that moves — mask and content travel together, so the ramp cannot come
 * unstuck from the disc it is ramping.
 */
export function orbBandMask(band: (typeof CLOUD_BLUR_BANDS)[number]): string {
  return bandMask(band, ORB_CENTRE - ORB_RADIUS, ORB_RADIUS * 2);
}

/**
 * The half of the cloud a strike lights up.
 *
 * The bolt is below the deck, so the light it throws back into the cloud
 * belongs to the underside. Banked around the whole perimeter — which is what
 * a stroke clipped to the silhouette gives you — the crown lights up too, and
 * a cloud glowing along its top edge reads as being lit from ABOVE, which is
 * the one direction the light is certainly not coming from.
 *
 * Intersected with the silhouette rather than replacing it: the glow still has
 * to stop at the cloud's edge, this only decides how far up the cloud it runs.
 *
 * EASED, not linear — see `easedRamp`. A straight ramp meets the lit half at a
 * corner, and that discontinuity is legible as a hard line across the cloud
 * however gradual the ramp itself is. Widening it does not help; only taking
 * the corners off does. The layer's own blur cannot do the job either: CSS
 * applies a filter BEFORE a mask, so the blur softens the fill and never
 * touches this edge.
 * A wide, eased ramp rather than a narrow one: the top of a smoothstep is
 * imperceptible, so stretching it costs nothing in how high the light reads as
 * reaching and is what stops there being a place where it begins. It only has
 * to fade the light off the crown — the SHAPE of the lit region comes from the
 * stroke following the cloud's own outline (see `innerGlow`), which is why
 * nothing here draws a horizontal edge across a round object.
 */
export const CLOUD_LIT_MASK = bandMask(
  { stops: easedRamp(0.32, 0.78, 10) },
  CLOUD_BIG_TOP,
  CLOUD_BIG_HEIGHT,
);

/** Where `LIGHTNING_PATH` sits in the frame, for the ramp below. */
export const LIGHTNING_TOP = 134.482;
export const LIGHTNING_HEIGHT = 47.368;

/**
 * The bolt's blur, ramped the OPPOSITE way to the cloud's: heaviest at the
 * crown and gone by a third of the way down.
 *
 * Same reasoning as the cloud, applied to a shape that crosses the same edge
 * from the other side. The bolt's head is inside the deck, where everything is
 * diffuse; the two-thirds hanging below it are in open air and have to be as
 * hard-edged as the raindrops beside them. A single blur over the whole bolt
 * makes the free end look like a smear of light rather than a strike — and it
 * is the only part of it a viewer actually reads as lightning.
 *
 * Three bands rather than the cloud's four: the ramp has a third of the height
 * to happen in, and a fourth rung inside it would be finer than the blur it is
 * interpolating.
 */
export const BOLT_BLUR_BANDS = [
  { blur: 1, stops: [[0.05, 1], [0.18, 0]] },
  { blur: 0.45, stops: [[0.05, 0], [0.18, 1], [0.2, 1], [0.33, 0]] },
  { blur: 0, stops: [[0.2, 0], [0.33, 1]] },
] as const;

export function boltBandMask(band: (typeof BOLT_BLUR_BANDS)[number]): string {
  return bandMask(band, LIGHTNING_TOP, LIGHTNING_HEIGHT);
}
