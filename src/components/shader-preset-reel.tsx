import { getShaderPresets } from "@/app/actions/shader-preset";
import {
  ShaderPresetReelPlayer,
  toReelPresets,
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
//
// This is the half the GRID renders — `server-demos.tsx` puts it on the page,
// so a published reel card arrives with its presets already in it and paints
// its colours out of the initial HTML. The demo registry's entry loads the
// other half instead, for the two places a server render is not available: the
// insert dialog's preview, and a card inserted into an unsaved layout.
// ---------------------------------------------------------------------------

export interface ShaderPresetReelProps {
  /** The shape the host is drawing the reel in. See the player's own note. */
  aspect?: DemoFrameAspectRatio;
}

export async function ShaderPresetReel({ aspect }: ShaderPresetReelProps) {
  const reel = toReelPresets(await getShaderPresets());

  // Nothing published, nothing drawn — and NOT an empty box. The reel is a
  // ground the host stands something on; a host whose ground has nothing in it
  // should see its own background, not a transparent layer over it. Decided
  // here as well as in the player so the client boundary is never emitted at
  // all: a serialised empty array is still a chunk the browser goes and gets.
  if (reel.length === 0) return null;

  return <ShaderPresetReelPlayer presets={reel} aspect={aspect} />;
}
