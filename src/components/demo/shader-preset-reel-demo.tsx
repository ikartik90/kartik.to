"use client";

import { getPublishedShaderPresets } from "@/app/actions/shader-preset";
import {
  ShaderPresetReelPlayer,
  toReelPresets,
} from "@/components/shader-preset-reel-player";
import type { DemoProps } from "@/components/demo/registry";

// ---------------------------------------------------------------------------
// The reel's BROWSER half — the same player, fed from the browser instead of
// from the page.
//
// A second entry point rather than a second component: `ShaderPresetReel` is
// what the grid renders, on the server, and it is strictly better — the presets
// arrive in the initial HTML and the card paints its colours with no round trip
// at all. This exists for the two places that render is not available, both of
// them client-only by nature:
//
//   - the insert dialog's preview, which is a live demo inside a `<dialog>` in
//     a client component, chosen from the registry a keystroke at a time;
//   - a card just inserted into an unsaved layout, which the server has never
//     seen and cannot have rendered.
//
// The PUBLISHED read, the same one the server half makes: the insert dialog is
// the author's, and a preview that showed drafts would be previewing a card
// nobody else would ever see.
//
// The fetch happens in the LOAD, not on mount, which is the same bargain
// `calchemy-demo` strikes with its engine warm-up: `useDemoLoader` awaits this
// promise behind the frame's preloader, so the reel arrives with its presets in
// hand rather than opening on an empty box and filling a round trip later. That
// loader also caches the result per session, so a second card, a re-mount or a
// scroll back costs no further query.
// ---------------------------------------------------------------------------

export async function prepareShaderPresetReel() {
  const presets = toReelPresets(await getPublishedShaderPresets());

  return function ShaderPresetReelDemo({ aspect }: DemoProps) {
    return <ShaderPresetReelPlayer presets={presets} aspect={aspect} />;
  };
}
