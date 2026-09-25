"use client";

import { getPublishedShaderPresets } from "@/app/actions/shader-preset";
import {
  ShaderPresetReelPlayer,
  toReelPresets,
} from "@/components/shader-preset-reel-player";
import type { DemoProps } from "@/components/demo/registry";

// The reel's browser half, for the insert dialog's preview and unsaved inserts.

export async function prepareShaderPresetReel() {
  const presets = toReelPresets(await getPublishedShaderPresets());

  return function ShaderPresetReelDemo({ aspect }: DemoProps) {
    return <ShaderPresetReelPlayer presets={presets} aspect={aspect} />;
  };
}
