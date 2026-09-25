import { getPublishedShaderPresets } from "@/app/actions/shader-preset";
import {
  ShaderPresetReelPlayer,
  toReelPresets,
} from "./shader-preset-reel-player";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";

export interface ShaderPresetReelProps {
  aspect?: DemoFrameAspectRatio;
}

export async function ShaderPresetReel({ aspect }: ShaderPresetReelProps) {
  // Published presets only, so the author sees exactly what visitors see.
  const reel = toReelPresets(await getPublishedShaderPresets());

  // Checked here too so an empty reel never emits the client boundary.
  if (reel.length === 0) return null;

  return <ShaderPresetReelPlayer presets={reel} aspect={aspect} />;
}
