// Five shared shapes in a 250-unit frame, each quoted from one canonical variant. Other
// variants differ by transforms in the `weatherGraphic` recipe; never copy a path.

export const WEATHER_VIEWBOX = 250;

// One frame unit in container units (250 units = 100cqw). Blurs sit on each layer's root
// <svg> in CSS px because WebKit ignores CSS filter functions on SVG child elements.
export const WEATHER_UNIT = "0.4cqw";

export const CLOUD_BIG_PATH =
  "M154.516 73.75C175.226 73.75 192.016 90.5393 192.016 111.25C192.016 131.961 175.226 148.75 154.516 148.75H101.015C87.207 148.75 76.0137 137.557 76.0137 123.749C76.0137 109.941 87.207 98.7481 101.015 98.748C107.349 98.748 113.132 101.105 117.538 104.988C120.519 87.2585 135.939 73.75 154.516 73.75Z";

/** Must match CLOUD_BIG_PATH's bounding box. */
export const CLOUD_BIG_TOP = 73.75;
export const CLOUD_BIG_HEIGHT = 75;

export const CLOUD_SMALL_PATH =
  "M80 68C67.8498 68.0001 58 77.8498 58 90C58 101.96 67.5447 111.692 79.4326 111.993L80 112H111.388L111.766 111.995C119.691 111.795 126.055 105.307 126.055 97.333C126.055 89.2326 119.488 82.6661 111.388 82.666C107.671 82.666 104.278 84.0479 101.693 86.3262C99.9447 75.9249 90.8984 68 80 68Z";

/** Centred on 125,125, so it spins about the frame's centre. */
export const PLASMA_GLOW_PATH =
  "M119.491 53.636C122.833 51.4306 127.167 51.4306 130.509 53.636L147.785 65.0392C148.849 65.7417 150.038 66.2341 151.287 66.49L171.567 70.6428C175.489 71.446 178.554 74.5111 179.357 78.4333L183.51 98.7126C183.766 99.962 184.258 101.151 184.961 102.215L196.364 119.491C198.569 122.833 198.569 127.167 196.364 130.509L184.961 147.785C184.258 148.849 183.766 150.038 183.51 151.287L179.357 171.567C178.554 175.489 175.489 178.554 171.567 179.357L151.287 183.51C150.038 183.766 148.849 184.258 147.785 184.961L130.509 196.364C127.167 198.569 122.833 198.569 119.491 196.364L102.215 184.961C101.151 184.258 99.962 183.766 98.7126 183.51L78.4333 179.357C74.5111 178.554 71.446 175.489 70.6428 171.567L66.49 151.287C66.2341 150.038 65.7417 148.849 65.0392 147.785L53.636 130.509C51.4306 127.167 51.4306 122.833 53.636 119.491L65.0392 102.215C65.7417 101.151 66.2341 99.962 66.49 98.7126L70.6428 78.4333C71.446 74.5111 74.5111 71.446 78.4333 70.6428L98.7126 66.49C99.962 66.2341 101.151 65.7417 102.215 65.0392L119.491 53.636Z";

export const RAINDROP_PATH =
  "M117.444 159.14C116.372 163.141 112.259 165.515 108.258 164.443C104.257 163.371 101.883 159.259 102.955 155.258C104.027 151.257 112.917 147.057 112.917 147.057C112.917 147.057 118.516 155.139 117.444 159.14Z";

export const RAINDROPS = [
  { x: 0, y: 0, delay: "0s" },
  { x: 19.074, y: 15.634, delay: "-0.55s" },
  { x: 41.074, y: 0, delay: "-1.1s" },
] as const;

export const SNOWFLAKES = [
  {
    path: "M111.01 143.116C112.246 143.116 113.249 144.118 113.249 145.355V150.432L117.649 147.891C118.721 147.272 120.091 147.64 120.709 148.711C121.327 149.782 120.96 151.151 119.889 151.77L115.492 154.308L119.894 156.85C120.965 157.468 121.331 158.837 120.713 159.908C120.094 160.979 118.725 161.347 117.654 160.729L113.249 158.185V163.272C113.249 164.508 112.246 165.511 111.01 165.511C109.773 165.511 108.771 164.509 108.771 163.272V158.19L104.373 160.729C103.302 161.347 101.932 160.979 101.313 159.908C100.695 158.837 101.063 157.468 102.134 156.85L106.534 154.308L102.138 151.77C101.067 151.151 100.7 149.782 101.318 148.711C101.937 147.64 103.307 147.272 104.378 147.891L108.771 150.426V145.355C108.771 144.118 109.773 143.116 111.01 143.116Z",
    delay: "0s",
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

export const LIGHTNING_PATH =
  "M137.469 155.787L114.093 181.85L124.871 158.757L112.509 155.444L137.054 134.482L126.457 152.837L137.469 155.787Z";

// Progressive blur down Cloud Big. Band masks must sum to 1 at every y: the layers are
// added with `plus-lighter`, so overlaps would glow. Stops are fractions of the cloud's height.
export const CLOUD_BLUR_BANDS = [
  { blur: 0, stops: [[0.3, 1], [0.5, 0]] },
  { blur: 0.34, stops: [[0.3, 0], [0.5, 1], [0.52, 1], [0.7, 0]] },
  { blur: 0.67, stops: [[0.52, 0], [0.7, 1], [0.72, 1], [0.9, 0]] },
  { blur: 1, stops: [[0.72, 0], [0.9, 1]] },
] as const;

// Mask images, not <clipPath>: WebKit ignores CSS transforms on clip-path children. Drawn
// in the full frame so mask-size/position mirror the cloud's own translate() scale().
const silhouette = (d: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WEATHER_VIEWBOX} ${WEATHER_VIEWBOX}"><path d="${d}" fill="#fff"/></svg>`,
  )}")`;

export const CLOUD_BIG_MASK = silhouette(CLOUD_BIG_PATH);

/** Smoothstep ramp as gradient stops: a linear ramp's corners read as an edge. */
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

export const ORB_CENTRE = WEATHER_VIEWBOX / 2;
export const ORB_RADIUS = 50;

export function orbBandMask(band: (typeof CLOUD_BLUR_BANDS)[number]): string {
  return bandMask(band, ORB_CENTRE - ORB_RADIUS, ORB_RADIUS * 2);
}

// Fades a strike's glow off the cloud's crown. Eased, as a linear ramp shows a line; the
// layer's blur can't soften it because CSS applies filters before masks.
export const CLOUD_LIT_MASK = bandMask(
  { stops: easedRamp(0.32, 0.78, 10) },
  CLOUD_BIG_TOP,
  CLOUD_BIG_HEIGHT,
);

/** Must match LIGHTNING_PATH's bounding box. */
export const LIGHTNING_TOP = 134.482;
export const LIGHTNING_HEIGHT = 47.368;

// Blur heaviest at the bolt's head, gone a third of the way down; same partition rule as above.
export const BOLT_BLUR_BANDS = [
  { blur: 1, stops: [[0.05, 1], [0.18, 0]] },
  { blur: 0.45, stops: [[0.05, 0], [0.18, 1], [0.2, 1], [0.33, 0]] },
  { blur: 0, stops: [[0.2, 0], [0.33, 1]] },
] as const;

export function boltBandMask(band: (typeof BOLT_BLUR_BANDS)[number]): string {
  return bandMask(band, LIGHTNING_TOP, LIGHTNING_HEIGHT);
}
