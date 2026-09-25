import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SITE_PAGES } from "@/data/site-paths";
import { getShaderPreset } from "@/app/actions/shader-preset";
import { ShaderPlayground } from "../shader-playground";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: SITE_PAGES.shader.title,
};

export default async function EditShaderPresetPage({ params }: Props) {
  const { id } = await params;

  // Null for both a missing preset and an unpublished one, which must answer identically.
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
