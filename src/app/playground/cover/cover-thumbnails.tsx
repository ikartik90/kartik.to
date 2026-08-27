"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { css } from "../../../../styled-system/css";
import { SHADER_SPECS } from "@/data/shader-specs";
import {
  paletteFor,
  shaderParamsFor,
  type Cover,
  type CoverContent,
  type CoverTheme,
} from "@/domain/cover";
import { ShaderStage } from "./shader-stage";

// ---------------------------------------------------------------------------
// Pictures of saved covers, drawn once each and kept.
//
// The strip has to show what a preset ACTUALLY looks like, and it cannot do
// that by mounting one: every paper-shaders mount holds its own webgl2 context,
// the library pools nothing, `dispose()` does not call `loseContext`, and there
// is no `webglcontextlost` handler anywhere — so a strip of live covers would
// spend a context per tile and go permanently blank somewhere around the
// browser's sixteen, taking the playground's own preview down with it (the
// oldest context is the one a browser drops).
//
// So exactly ONE cover is mounted at a time, off-screen, and photographed:
// render it, read the canvas out as a PNG, move on to the next. The tiles show
// the photographs, which cost nothing to keep on screen.
//
// Two details make the context count safe rather than merely smaller:
//
//   • The queue is grouped by SHADER. The React wrapper creates its mount in an
//     effect keyed on `fragmentShader` and updates everything else through
//     `setUniforms`, so consecutive presets that share a shader reuse one
//     context. A library of forty covers over six shaders costs six.
//   • The renderer UNMOUNTS itself when the queue is empty, so the strip holds
//     no context at rest.
//
// And one makes the photograph possible at all: `preserveDrawingBuffer`, or the
// buffer is cleared on composite and `toDataURL` returns an empty picture.
// ---------------------------------------------------------------------------

/** A saved cover as the action hands it over: the row, with its blob parsed. */
type Preset = Cover & CoverContent;

/**
 * A picture is of a preset AT AN EDIT, not of a preset — retuning one leaves the
 * id alone and changes everything about how it looks, and a cache that could not
 * tell those apart would keep showing the old picture until a reload.
 */
export function thumbnailKey(
  preset: Preset,
  theme: CoverTheme = "light",
): string {
  // The THEME is part of the identity of a picture, not merely of the request
  // for one. A cover holds a colour per ground, so the same preset at the same
  // `updatedAt` is two different photographs — and without this the strip would
  // keep showing the light one after the site went dark, with nothing to
  // invalidate it but an edit.
  return `${preset.id}:${new Date(preset.updatedAt).getTime()}:${theme}`;
}

/**
 * What is left to draw, in the order that costs the fewest contexts.
 *
 * Grouped by shader rather than sorted — the incoming order is the strip's own
 * (newest first), and within a shader it is kept, so the tiles nearest the add
 * button tend to fill in first.
 */
export function captureOrder(
  presets: Preset[],
  captured: ReadonlySet<string>,
  theme: CoverTheme = "light",
): Preset[] {
  const pending = presets.filter(
    (preset) => !captured.has(thumbnailKey(preset, theme)),
  );
  const byShader = new Map<string, Preset[]>();
  for (const preset of pending) {
    const group = byShader.get(preset.shaderId);
    if (group) group.push(preset);
    else byShader.set(preset.shaderId, [preset]);
  }
  return [...byShader.values()].flat();
}

// Survives the component, which is the point: the strip re-reads its list every
// time the draft opens a different cover, and re-photographing the whole library
// on each of those would be the expensive half of this feature happening over
// and over. Pruned against the current list on every pass, so an edited preset's
// old picture does not sit here for the rest of the session.
const cache = new Map<string, string>();

/** Every picture taken so far, for a consumer that wants to start from them. */
export function thumbnailSnapshot(): Record<string, string> {
  return Object.fromEntries(cache);
}

/** Tests only — module state outlives a component, so it outlives a test too. */
export function clearThumbnailCache(): void {
  cache.clear();
}

// Off-screen but ON-SCREEN: the mount sizes itself from a ResizeObserver and
// draws into a canvas the browser has to be willing to composite, so this is a
// real 80px box at the top-left corner, merely invisible. `display: none` would
// give it no size and nothing to photograph.
const rendererStyle = css({
  position: "fixed",
  insetBlockStart: 0,
  insetInlineStart: 0,
  // The tile's own size (`TILE_PX`). What is captured is this box at
  // `THUMBNAIL_SCALE`, so the two have to agree or the picture is drawn for a
  // different square than the one it ends up in.
  width: "token(spacing.5xl)",
  height: "token(spacing.5xl)",
  opacity: 0,
  pointerEvents: "none",
  zIndex: -1,
});

/**
 * The tile's CSS size, in pixels — `spacing.5xl`, the same 80 the strip lays
 * out. Repeated as a number because the buffer below is derived from it and
 * CSS cannot do that arithmetic for us.
 */
const TILE_PX = 80;

/**
 * How many device pixels per CSS pixel the picture is drawn at.
 *
 * PINNED at 3 rather than left at the library's floor of 2, and this is the
 * difference between a live shader and a kept photograph. A live one re-renders
 * at `max(devicePixelRatio, 2)` whenever the screen changes, so it is always
 * exactly 1:1; a photograph is taken once, on whatever screen happened to be
 * there, and shown on whatever screen comes later. Taken at 2 it is UPSCALED on
 * a 3× display — soft, in a strip whose whole job is showing what a cover
 * actually looks like. Taken at 3 the worst case is a downscale, which is
 * supersampling and looks better than the alternative.
 *
 * The library's rule is `max(devicePixelRatio, minPixelRatio)` scaled to fit
 * `maxPixelCount`, so 3 with a ceiling of exactly 240² lands on 240 square from
 * a 1× screen to a 4× one.
 */
const THUMBNAIL_SCALE = 3;
const THUMBNAIL_SIZE = TILE_PX * THUMBNAIL_SCALE;
const THUMBNAIL_PIXELS = THUMBNAIL_SIZE * THUMBNAIL_SIZE;

/**
 * How many frames to give one capture before moving on.
 *
 * The first draw is a `requestAnimationFrame` behind an async uniform pass, and
 * the canvas has to have been sized by a ResizeObserver before there is anything
 * to read — so the capture is a poll rather than a timeout. Half a second is far
 * more than either takes; running out means something is wrong with this cover
 * in particular, and the tile keeps its colour swatch.
 */
const CAPTURE_FRAMES = 30;

export interface CoverThumbnailsProps {
  presets: Preset[];
  onCaptured: (key: string, dataUrl: string) => void;
  /** Which ground to photograph on — the strip's, which is the page's. */
  theme: CoverTheme;
}

export function CoverThumbnails({
  presets,
  onCaptured,
  theme,
}: CoverThumbnailsProps) {
  // Where the queue was up to. An index rather than a shrinking list, so a
  // capture that fails cannot leave its preset at the head of the queue forever.
  const [index, setIndex] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  // The picture taken for the preset BEFORE this one, which is the only thing a
  // too-early read could return: a reused mount keeps its last frame (that is
  // what `preserveDrawingBuffer` is for), so a capture that beat the redraw
  // would quietly photograph the wrong cover. Two presets that genuinely look
  // identical cost this one the rest of its frame budget and are then accepted.
  const lastCapture = useRef<string | null>(null);

  const queue = useMemo(() => {
    // An edited preset leaves a picture of its old self behind; nothing else
    // will ever ask for it again.
    // Both grounds stay live: flipping the site's theme must not throw away the
    // pictures taken on the other one, or every flip back costs the whole strip
    // a re-photograph.
    const live = new Set([
      ...presets.map((preset) => thumbnailKey(preset, "light")),
      ...presets.map((preset) => thumbnailKey(preset, "dark")),
    ]);
    for (const key of cache.keys()) if (!live.has(key)) cache.delete(key);
    return captureOrder(presets, new Set(cache.keys()), theme);
  }, [presets, theme]);

  // A new queue starts at its own beginning. Written as a state reset keyed on
  // the queue rather than as an effect, so the render that receives a new list
  // is already the one drawing its first preset.
  const [queueRef, setQueueRef] = useState(queue);
  if (queueRef !== queue) {
    setQueueRef(queue);
    setIndex(0);
  }

  const current = queue[index];

  useEffect(() => {
    if (!current) return;
    let frames = 0;
    let raf = 0;

    const tick = () => {
      frames += 1;
      const canvas = hostRef.current?.querySelector("canvas");
      // Three frames of grace before the first read: the mount's own render is
      // one frame behind the uniforms it was given, and reading earlier would
      // photograph the PREVIOUS preset — `preserveDrawingBuffer` keeps those
      // pixels around precisely so they can be read late.
      if (canvas && canvas.width > 0 && frames > 3) {
        try {
          const url = canvas.toDataURL("image/png");
          if (url !== lastCapture.current || frames > CAPTURE_FRAMES) {
            lastCapture.current = url;
            cache.set(thumbnailKey(current), url);
            onCaptured(thumbnailKey(current), url);
            setIndex((was) => was + 1);
            return;
          }
        } catch {
          // A canvas that will not hand over its pixels is not worth stalling
          // the queue for — the tile keeps its colour swatch.
          setIndex((was) => was + 1);
          return;
        }
      }
      if (frames > CAPTURE_FRAMES) {
        setIndex((was) => was + 1);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [current, onCaptured]);

  // Nothing left to draw, so nothing mounted — and no context held.
  if (!current) return null;

  const spec = SHADER_SPECS[current.shaderId];
  // Resolved onto the ground the strip is painting on — see `thumbnailKey`,
  // which is what keeps the picture and the cache entry in step.
  const palette = paletteFor(current.settings, theme);
  return (
    <div ref={hostRef} className={rendererStyle} aria-hidden>
      <ShaderStage
        spec={spec}
        // A still, whatever the cover was saved at: the tile is a photograph,
        // and an animating one would be a rAF per frame spent on a picture
        // nobody is watching. Zero also stops the library's loop outright.
        // Framed for the SQUARE, because the tile is one. A cover holds a
        // placement per shape and names none of them as its own, so the shape
        // the picture is drawn in is what picks — and that is this 80px square.
        params={{ ...shaderParamsFor(current.settings, "1/1"), speed: 0 }}
        colors={palette.colors}
        // Spelled out rather than spread: `paletteFor` leaves the key OFF a
        // shader with no ground, and the stage's prop is required-but-optional.
        colorBack={palette.colorBack}
        extraColors={palette.extraColors}
        maxPixelCount={THUMBNAIL_PIXELS}
        minPixelRatio={THUMBNAIL_SCALE}
        webGlContextAttributes={{ preserveDrawingBuffer: true }}
      />
    </div>
  );
}
