import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getShaderPreset } from "@/app/actions/shader-preset";
import { ShaderPlayground } from "../shader-playground";

// ---------------------------------------------------------------------------
// A SAVED preset, reopened.
//
// Public for a PUBLISHED preset and a 404 for anything else, and that decision
// is the action's rather than this file's: `getShaderPreset` hands a visitor a
// published preset and answers null for one that is still the author's, which
// arrives here indistinguishable from a preset that does not exist. Tuning a
// shader is not a privilege — a visitor may open a published preset and play
// with it, and nothing they do is written anywhere.
// ---------------------------------------------------------------------------

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Shader Playground",
};

export default async function EditShaderPresetPage({ params }: Props) {
  const { id } = await params;

  // Null presets both cases on purpose — no such preset, and a preset a visitor
  // may not see — because the two must answer identically. A caught throw would
  // have been the same protection; `getShaderPreset` returning null is what
  // makes the catch unnecessary rather than what makes it safe.
  const preset = await getShaderPreset(id);
  if (!preset) notFound();

  return (
    <ShaderPlayground
      preset={{
        id: preset.id,
        title: preset.title ?? null,
        shaderId: preset.shaderId,
        settings: preset.settings,
        publishedAt: preset.publishedAt,
      }}
    />
  );
}
