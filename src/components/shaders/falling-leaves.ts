import { getShaderColorFromString } from "@paper-design/shaders";

// Maple leaves falling through a dithering ground: each leaf's motion, stepped a frame at a time, and what the shader
// reads to draw it.

export type LeafSettings = {
  /** Leaves on a wide screen; a narrow one gets fewer. */
  count: number;
  /** The nearest leaf's square, in CSS px. */
  size: number;
  /** 0–1: how much smaller, slower and sparser the farthest leaves are. */
  depth: number;
  /** The nearest leaf's fall, in CSS px/s. */
  fall: number;
  /** The swing to each side, in CSS px. */
  sway: number;
  /** 0–1: how far leaves flutter and rock; at 1 they turn edge on. */
  tumble: number;
  /** How quickly they flutter and rock, as a share of their natural pace. */
  tumblePace: number;
  /** Drift, in CSS px/s; + is to the right. */
  wind: number;
  /** 0–1: the dither's cover on the nearest leaf facing you. */
  density: number;
  /** 0–1: how far the veins thin the dither. */
  veins: number;
  /** The CSS variables leaves are inked from, one or the other each. */
  inks: readonly [string, string];
  /** The inks' share against the canvas colour, 0–1. */
  inkStrength: number;
  /** Behind the heading and lede: the shares of density and ink a leaf keeps, 0–1, and how far out that eases in, in CSS px. */
  behindWords: { density: number; ink: number; margin: number };
};

export type Leaf = {
  /** Centre, in CSS px from the ground's top left. */
  x: number;
  y: number;
  /** 0 the farthest, 1 the nearest. */
  near: number;
  /** The side-to-side swing: phase, and rate in rad/s. */
  swing: number;
  swingRate: number;
  /** The rock, on the swing's rate times the tumble pace, so at the natural pace it rocks with the swing. */
  tilt: number;
  /** The flutter about the leaf's long axis and across it: phases, and rates in rad/s. */
  yaw: number;
  yawRate: number;
  pitch: number;
  pitchRate: number;
  /** Its resting angle in the screen's plane, in rad. */
  spin: number;
  ink: 0 | 1;
};

export type LeafRows = { place: number[][]; look: number[][] };

export const MAX_LEAVES = 16;
export const MAX_WORD_LINES = 24;

type Random = () => number;

const between = (random: Random, min: number, max: number) => min + random() * (max - min);
const either = (random: Random) => (random() < 0.5 ? -1 : 1);

/** A narrow screen gets smaller leaves and fewer of them. */
export const narrowScale = (width: number) => Math.min(1, Math.max(0.55, width / 1440));

/** Size, fall, sway and drift for a leaf at `near`, as a share of the nearest leaf's. */
export const nearScale = (near: number, depth: number) => 1 - 0.6 * depth * (1 - near);

export function newLeaf(width: number, y: number, random: Random = Math.random): Leaf {
  const swing = between(random, 0, Math.PI * 2);
  return {
    x: between(random, 0, width),
    y,
    near: random(),
    swing,
    swingRate: between(random, 1.1, 1.8),
    tilt: swing,
    yaw: between(random, 0, Math.PI * 2),
    yawRate: between(random, 0.6, 1.2) * either(random),
    pitch: between(random, 0, Math.PI * 2),
    pitchRate: between(random, 0.3, 0.7) * either(random),
    spin: between(random, 0, Math.PI * 2),
    ink: random() < 0.5 ? 0 : 1,
  };
}

/** Grows or shrinks `leaves` to `count`, nearest last so they draw on top. New ones start anywhere on the ground. */
export function populate(leaves: Leaf[], count: number, width: number, height: number, random: Random = Math.random) {
  const kept = leaves.slice(0, Math.min(count, MAX_LEAVES));
  while (kept.length < Math.min(count, MAX_LEAVES)) kept.push(newLeaf(width, between(random, -0.1, 1) * height, random));
  return kept.sort((a, b) => a.near - b.near);
}

/** Moves every leaf on by `dt` s. One that falls past the foot comes back above the top, and one blown out at a side comes in at the other. */
export function stepLeaves(
  leaves: Leaf[],
  settings: LeafSettings,
  dt: number,
  width: number,
  height: number,
  scale: number,
  random: Random = Math.random,
) {
  const { size, depth, fall, sway, wind, tumblePace } = settings;
  for (const leaf of leaves) {
    const k = nearScale(leaf.near, depth) * scale;
    leaf.swing += leaf.swingRate * dt;
    // Fastest through the bottom of each swing, slowest at its ends.
    const glide = 0.55 + 0.7 * Math.abs(Math.cos(leaf.swing));
    leaf.x += (wind * k + sway * k * leaf.swingRate * Math.cos(leaf.swing)) * dt;
    leaf.y += fall * k * glide * dt;
    leaf.yaw += leaf.yawRate * tumblePace * dt;
    leaf.pitch += leaf.pitchRate * tumblePace * dt;
    leaf.tilt += leaf.swingRate * tumblePace * dt;

    // Past this, the leaf's square is wholly out of sight.
    const margin = 0.75 * size * k;
    if (leaf.x < -margin) leaf.x += width + 2 * margin;
    if (leaf.x > width + margin) leaf.x -= width + 2 * margin;
    if (leaf.y - margin > height) Object.assign(leaf, newLeaf(width, -margin * between(random, 1, 2), random), { near: leaf.near });
  }
}

/** Per leaf, what the shader reads: centre, square and angle; then its turn about each axis (cosines), tone and ink. */
export function leafRows(leaves: Leaf[], settings: LeafSettings, scale: number): LeafRows {
  const { size, depth, density, tumble } = settings;
  const flutter = tumble * (Math.PI / 2);
  const rock = tumble * 0.35;
  const place: number[][] = [];
  const look: number[][] = [];
  for (const leaf of leaves) {
    const yaw = Math.cos(flutter * Math.sin(leaf.yaw));
    const pitch = Math.cos(0.6 * flutter * Math.sin(leaf.pitch));
    const facing = Math.abs(yaw * pitch);
    const far = 1 - 0.45 * depth * (1 - leaf.near);
    // Sparser as it turns away, and on its paler underside.
    const tone = density * far * (0.7 + 0.3 * facing) * (yaw < 0 ? 0.85 : 1);
    place.push([leaf.x, leaf.y, size * nearScale(leaf.near, depth) * scale, leaf.spin + rock * Math.sin(leaf.tilt)]);
    look.push([yaw, pitch, tone, leaf.ink]);
  }
  return { place, look };
}

const pad = (rows: number[][], length: number) => [...rows, ...Array.from({ length: length - rows.length }, () => [0, 0, 0, 0])];

/** The uniforms that change each frame. */
export function leafFrameUniforms({ place, look }: LeafRows, words: number[][]) {
  return {
    u_leafCount: place.length,
    u_leaf: pad(place, MAX_LEAVES),
    u_leafLook: pad(look, MAX_LEAVES),
    u_wordCount: words.length,
    u_words: pad(words, MAX_WORD_LINES),
  };
}

/** The uniforms that change with the settings: `inks` as `rgb()`, `texture` as `leafTexture()`'s data URL. */
export function leafSettingUniforms({ veins, behindWords }: LeafSettings, inks: readonly [string, string], texture: string) {
  return {
    u_leafShape: texture,
    u_leafVeins: veins,
    u_leafInk0: getShaderColorFromString(inks[0]),
    u_leafInk1: getShaderColorFromString(inks[1]),
    u_wordDensity: behindWords.density,
    u_wordInk: behindWords.ink,
    u_wordMargin: behindWords.margin,
  };
}

/**
 * The heading's and lede's text under `root`, line by line, as x, y, width, height from `ground`'s top left. The pills
 * and buttons aren't counted, nor text inside `[aria-hidden]`.
 */
export function wordLineRects(root: Element, ground: { left: number; top: number }): number[][] {
  const rows: number[][] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node && rows.length < MAX_WORD_LINES; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!node.textContent?.trim() || !parent?.closest("h1, p") || parent.closest("[aria-hidden]")) continue;
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (rows.length === MAX_WORD_LINES) break;
      if (rect.width && rect.height) rows.push([rect.left - ground.left, rect.top - ground.top, rect.width, rect.height]);
    }
  }
  return rows;
}

// The leaf in a 100-unit box (y down): the right half from the tip round to the stalk, then the left, mirrored.
const HALF: [number, number][] = [
  [50, 2], [54, 10], [57.5, 8.5], [58, 15], [65, 12.5], [62, 22], [65.5, 23], [61.5, 31], [60.5, 38], [61.5, 42],
  [64, 42.5], [67, 38], [70, 30], [73, 32], [76, 24], [79.5, 28.5], [94, 27], [86, 34.5], [90.5, 39], [81, 42],
  [82, 48], [74, 50], [71, 54.5], [73, 56.5], [80, 57], [86, 63], [77, 66], [68, 66.5], [60, 66], [54, 64.5],
  [51.5, 65.5],
];
export const MAPLE_LEAF_OUTLINE: readonly [number, number][] = [
  ...HALF,
  ...HALF.slice(1).reverse().map(([x, y]) => [100 - x, y] as [number, number]),
];
const STALK_BASE: [number, number] = [50, 63];
const VEINS: [number, number][] = [[50, 8], [90, 28], [10, 28], [82, 62], [18, 62]];
const SIDE_VEINS: [[number, number], [number, number]][] = [
  [[50, 34], [63, 14]], [[50, 34], [37, 14]],
  [[70, 46], [76, 26]], [[30, 46], [24, 26]],
  [[72, 44], [88, 39]], [[28, 44], [12, 39]],
];

/**
 * The leaf as a texture's data URL: red is the leaf and its stalk, green its veins. Drawn on opaque black, since a
 * PNG keeps full red under a transparent edge and the shader would read that edge as leaf.
 */
export function leafTexture(): string {
  const side = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = side;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.fillStyle = "rgb(0 0 0)";
  context.fillRect(0, 0, side, side);
  context.translate(side / 2, side / 2);
  context.scale(2.4, 2.4);
  context.translate(-50, -49);

  context.fillStyle = "rgb(255 0 0)";
  context.beginPath();
  MAPLE_LEAF_OUTLINE.forEach(([x, y], i) => (i ? context.lineTo(x, y) : context.moveTo(x, y)));
  context.closePath();
  context.fill();
  context.strokeStyle = "rgb(255 0 0)";
  context.lineWidth = 4;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(...STALK_BASE);
  context.quadraticCurveTo(50, 82, 55, 96);
  context.stroke();

  context.globalCompositeOperation = "lighter";
  context.strokeStyle = "rgb(0 255 0)";
  context.lineWidth = 3;
  context.beginPath();
  VEINS.forEach((tip) => {
    context.moveTo(...STALK_BASE);
    context.lineTo(...tip);
  });
  context.stroke();
  context.lineWidth = 2.4;
  context.beginPath();
  SIDE_VEINS.forEach(([from, to]) => {
    context.moveTo(...from);
    context.lineTo(...to);
  });
  context.stroke();
  return canvas.toDataURL("image/png");
}
