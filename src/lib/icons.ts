import { DOMParser } from "@xmldom/xmldom";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { IconAssetSchema, iconTitleFrom, iconNameFromKey, type IconAsset } from "@/domain/icon";
import { listR2IconKeys, headR2Object, publicUrlForKey } from "@/lib/storage/r2";
import { readIconSvg, type IconSvg } from "@/utils/icon-svg";

// Server-side icon reads the playground prerenders from. Must stay session-blind: reading the
// session (e.g. `isAdmin`) would make the route dynamic. Held icons come via `listHeldIcons`.

// `readIconSvg` is shared with the browser and needs a global DOMParser, which Node lacks.
const globals = globalThis as { DOMParser?: unknown };
globals.DOMParser ??= DOMParser;

export interface IconLabels {
  title: string;
  aliases: string[];
}

/** Metadata may be missing (hand-uploaded objects); each field falls back safely, review to `held`. */
export async function keyToIcon(
  key: string,
  labels?: IconLabels,
): Promise<IconAsset | null> {
  const url = publicUrlForKey(key);
  if (!url) return null;

  const { metadata } = await headR2Object(key);
  const native = Number.parseInt(metadata.native ?? "", 10);
  const name = metadata.filename || iconNameFromKey(key);

  return IconAssetSchema.parse({
    key,
    url,
    name,
    native: Number.isInteger(native) && native > 0 ? native : 20,
    flattened: metadata.flattened === "1",
    review: metadata.review === "approved" ? "approved" : "held",
    title: labels?.title || iconTitleFrom(name),
    aliases: labels?.aliases ?? [],
  });
}

/** The whole bucket as icons, in name order — approved and held alike. */
export async function listAllIcons(): Promise<IconAsset[]> {
  if (!env.R2_PUBLIC_BASE_URL) throw new Error("Icon storage is not configured");

  const keys = await listR2IconKeys();

  // Labels live in a table, not object metadata, because search filters on them.
  const rows = await prisma.icon.findMany({ where: { key: { in: keys } } });
  const labels = new Map(
    rows.map((row) => [row.key, { title: row.title, aliases: row.aliases }]),
  );

  const icons = await Promise.all(keys.map((key) => keyToIcon(key, labels.get(key))));

  return icons
    .filter((icon): icon is IconAsset => icon !== null)
    // By name: keys carry a uuid, and a stable order lets the grid be learned.
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface PrerenderedIcon {
  icon: IconAsset;
  /** `null` when the file did not come or would not parse — the tile says so. */
  svg: IconSvg | null;
}

/** Approved icons with parsed SVGs, for prerendering; a failed read keeps its tile with `svg: null`. */
export async function listApprovedIconsWithSvg(): Promise<PrerenderedIcon[]> {
  const icons = (await listAllIcons()).filter((icon) => icon.review === "approved");

  return Promise.all(
    icons.map(async (icon) => {
      try {
        const response = await fetch(icon.url);
        if (!response.ok) return { icon, svg: null };
        return { icon, svg: readIconSvg(await response.text()) };
      } catch {
        return { icon, svg: null };
      }
    }),
  );
}
