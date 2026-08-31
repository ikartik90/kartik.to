import { getShaderPresets } from "@/app/actions/shader-preset";
import {
  ShaderPresetReelPlayer,
  type ReelPreset,
} from "./shader-preset-reel-player";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";

// ---------------------------------------------------------------------------
// The latest saved shader presets, played one at a time as a ground.
//
// A SERVER component over a client one, split at the fetch: this half asks the
// database what the newest presets are, and the half it hands them to owns the
// canvas, the timers and the theme. Nothing about which presets exist is the
// browser's business, and fetching them in an effect would mean the reel opens
// on an empty box and fills in a round trip later.
//
// WHICH presets is `getShaderPresets`' decision rather than this file's, and
// that is the point of calling it instead of querying: it already answers
// newest-first, and it already answers a VISITOR with the published ones alone.
// A query here would be a second place for both of those rules to live, and the
// one that would go stale is the one about what a visitor may see.
// ---------------------------------------------------------------------------

/**
 * How many presets a full reel plays.
 *
 * A CEILING, not a quota. Fewer than this is the ordinary case for a young
 * library and not a shortfall to pad out — the reel plays two, or one, or
 * draws nothing at all, and none of those is a different component.
 */
export const REEL_LENGTH = 3;

export interface ShaderPresetReelProps {
  /** The shape the host is drawing the reel in. See the player's own note. */
  aspect?: DemoFrameAspectRatio;
}

export async function ShaderPresetReel({ aspect }: ShaderPresetReelProps) {
  const presets = await getShaderPresets();

  // Narrowed to what the reel reads, rather than passed whole. Everything that
  // crosses this boundary is serialised into the page, and a preset's row
  // carries a title, two timestamps and a publication date that the ground has
  // no use for.
  const reel: ReelPreset[] = presets
    .slice(0, REEL_LENGTH)
    .map(({ id, shaderId, settings }) => ({ id, shaderId, settings }));

  // Nothing published, nothing drawn — and NOT an empty box. The reel is a
  // ground the host stands something on; a host whose ground has nothing in it
  // should see its own background, not a transparent layer over it.
  if (reel.length === 0) return null;

  return <ShaderPresetReelPlayer presets={reel} aspect={aspect} />;
}
