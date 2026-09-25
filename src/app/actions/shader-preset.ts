"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin, requireAdmin } from "@/lib/auth/server";
import {
  ShaderPresetContentSchema,
  type ShaderPreset,
  type ShaderPresetContent,
} from "@/domain/shader-preset";
import type { ShaderId } from "@/data/shader-specs";

// Deliberately public: the reads, which show visitors published presets only.

function parseShaderPreset(row: {
  id: string;
  title: string | null;
  untitledIndex: number | null;
  shaderId: string;
  settings: unknown;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ShaderPreset & ShaderPresetContent {
  const content = ShaderPresetContentSchema.parse({
    shaderId: row.shaderId,
    settings: row.settings,
  });
  return { ...row, ...content };
}

/** Published presets, plus the author's drafts. */
export async function getShaderPresets(): Promise<(ShaderPreset & ShaderPresetContent)[]> {
  return readShaderPresets(!(await isAdmin()));
}

/** Published only, even for the author: for surfaces that display presets. */
export async function getPublishedShaderPresets(): Promise<
  (ShaderPreset & ShaderPresetContent)[]
> {
  return readShaderPresets(true);
}

async function readShaderPresets(
  publishedOnly: boolean,
): Promise<(ShaderPreset & ShaderPresetContent)[]> {
  const rows = await prisma.shaderPreset.findMany({
    where: publishedOnly ? { publishedAt: { not: null } } : {},
    orderBy: { createdAt: "desc" },
  });
  return rows.map(parseShaderPreset);
}

/** Null for an unpublished preset to a visitor, so the route 404s without confirming it exists. */
export async function getShaderPreset(
  id: string,
): Promise<(ShaderPreset & ShaderPresetContent) | null> {
  const row = await prisma.shaderPreset.findUnique({ where: { id } });
  if (!row) return null;
  if (!row.publishedAt && !(await isAdmin())) return null;
  return parseShaderPreset(row);
}

export async function createShaderPreset({
  title,
  shaderId,
  settings,
}: {
  title?: string | null;
  shaderId: ShaderId;
  settings: unknown;
}): Promise<ShaderPreset & ShaderPresetContent> {
  await requireAdmin();
  const content = ShaderPresetContentSchema.parse({ shaderId, settings });

  let untitledIndex: number | null = null;
  if (!title?.trim()) {
    const result = await prisma.shaderPreset.aggregate({
      _max: { untitledIndex: true },
    });
    untitledIndex = (result._max.untitledIndex ?? 0) + 1;
  }

  const row = await prisma.shaderPreset.create({
    data: {
      title: title?.trim() || null,
      untitledIndex,
      shaderId: content.shaderId,
      settings: content.settings as object,
    },
  });
  return parseShaderPreset(row);
}

export async function saveShaderPreset({
  id,
  title,
  shaderId,
  settings,
}: {
  id: string;
  title?: string | null;
  shaderId: ShaderId;
  settings: unknown;
}): Promise<ShaderPreset & ShaderPresetContent> {
  await requireAdmin();
  const content = ShaderPresetContentSchema.parse({ shaderId, settings });

  const row = await prisma.shaderPreset.update({
    where: { id },
    data: {
      ...(title === undefined ? {} : { title: title?.trim() || null }),
      shaderId: content.shaderId,
      settings: content.settings as object,
    },
  });
  return parseShaderPreset(row);
}

export async function publishShaderPreset(
  id: string,
): Promise<ShaderPreset & ShaderPresetContent> {
  await requireAdmin();
  const row = await prisma.shaderPreset.update({
    where: { id },
    data: { publishedAt: new Date() },
  });
  return parseShaderPreset(row);
}

export async function unpublishShaderPreset(
  id: string,
): Promise<ShaderPreset & ShaderPresetContent> {
  await requireAdmin();
  const row = await prisma.shaderPreset.update({
    where: { id },
    data: { publishedAt: null },
  });
  return parseShaderPreset(row);
}

export async function deleteShaderPreset(id: string): Promise<void> {
  await requireAdmin();
  await prisma.shaderPreset.delete({ where: { id } });
}
