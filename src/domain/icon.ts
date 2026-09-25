import { z } from "zod";

/** Both scales must stay the same length: the size/stroke lock pairs them by index. */
export const ICON_SIZES = [
  16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64,
] as const;
export const ICON_STROKES = [
  1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4,
] as const;

export const ICON_ZOOMS = [1, 1.5, 2, 2.5, 3, 3.5, 4] as const;

export interface IconSettings {
  size: number;
  stroke: number;
}

export interface IconViewSettings extends IconSettings {
  zoom: number;
}

export const DEFAULT_ICON_SETTINGS: IconViewSettings = {
  size: 20,
  stroke: 1.25,
  zoom: 1,
};

/** Both scales moved to `lead`'s step; a value on neither scale is returned as is. */
export function iconSettingsLockedTo<Settings extends IconSettings>(
  settings: Settings,
  lead: "size" | "stroke",
): Settings {
  const scale: readonly number[] = lead === "size" ? ICON_SIZES : ICON_STROKES;
  const step = scale.indexOf(lead === "size" ? settings.size : settings.stroke);
  if (step < 0) return settings;

  return { ...settings, size: ICON_SIZES[step], stroke: ICON_STROKES[step] };
}

/** `held` icons are shown to the author only. */
export const IconReviewSchema = z.enum(["held", "approved"]);

export type IconReview = z.infer<typeof IconReviewSchema>;

export const MAX_ICON_ALIASES = 12;

export const MAX_ICON_TITLE_LENGTH = 80;

export const MAX_ICON_BYTES = 128 * 1024;

export const IconAssetSchema = z.object({
  /** Immutable once anything points at it. */
  key: z.string().min(1),
  url: z.string().url(),
  name: z.string().min(1),
  /** The square grid the drawing was made on. */
  native: z.number().int().positive(),
  flattened: z.boolean(),
  review: IconReviewSchema,
  /** Display name; defaults to {@link iconTitleFrom} of the filename. */
  title: z.string().min(1),
  aliases: z.array(z.string().min(1)),
});

export type IconAsset = z.infer<typeof IconAssetSchema>;

export const CreateIconUploadInputSchema = z.object({
  filename: z.string().min(1),
  size: z.number().int().positive().max(MAX_ICON_BYTES),
});

export type CreateIconUploadInput = z.infer<typeof CreateIconUploadInputSchema>;

/** No review state or filename: both are the server's to decide. */
export const FinalizeIconUploadInputSchema = z.object({
  key: z.string().min(1),
  native: z.number().int().positive(),
  flattened: z.boolean(),
});

export type FinalizeIconUploadInput = z.infer<typeof FinalizeIconUploadInputSchema>;

export const IconKeyInputSchema = z.object({ key: z.string().min(1) });

export const SetIconReviewInputSchema = z.object({
  key: z.string().min(1),
  review: IconReviewSchema,
});

/** An empty title resets to the filename (the action deletes the row). */
export const SetIconLabelsInputSchema = z.object({
  key: z.string().min(1),
  title: z.string().trim().max(MAX_ICON_TITLE_LENGTH),
  aliases: z.array(z.string().trim().max(MAX_ICON_TITLE_LENGTH)).max(MAX_ICON_ALIASES),
});

export type SetIconLabelsInput = z.infer<typeof SetIconLabelsInputSchema>;

/** Server-side only: a client that set its own review state could publish anything. */
export function reviewForUpload(flattened: boolean): IconReview {
  return flattened ? "held" : "approved";
}

/** Always ends `.svg`: the extension is appended, not replaced. */
export function sanitizeIconFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const cleaned = base
    .replace(/[^\w.\-()+]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
  if (cleaned.length === 0 || cleaned === "." || cleaned === "-") return "icon.svg";
  return cleaned.toLowerCase().endsWith(".svg") ? cleaned : `${cleaned}.svg`;
}

const ICON_KEY_UUID_PREFIX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

export function iconNameFromKey(key: string): string {
  const last = key.split("/").pop() ?? key;
  return last.replace(ICON_KEY_UUID_PREFIX, "");
}

function iconNameWords(value: string): string {
  return value
    .replace(/\.svg$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Every query term must appear as a substring; an empty query matches all. */
export function matchesIconName(name: string, query: string): boolean {
  const terms = iconNameWords(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;

  const words = iconNameWords(name);
  return terms.every((term) => words.includes(term));
}

/** `chevron-down.svg` → `Chevron Down`; only first letters are touched. */
export function iconTitleFrom(name: string): string {
  return name
    .replace(/\.svg$/i, "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function cleanIconAliases(aliases: string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const alias of aliases) {
    const trimmed = alias.trim();
    const folded = trimmed.toLowerCase();
    if (!trimmed || seen.has(folded)) continue;
    seen.add(folded);
    kept.push(trimmed);
  }

  return kept.slice(0, MAX_ICON_ALIASES);
}

/** Aliases every list shares (case-insensitive), in the first list's spelling. */
export function commonIconAliases(lists: string[][]): string[] {
  const [first, ...rest] = lists;
  if (!first) return [];

  return first.filter((alias) =>
    rest.every((other) =>
      other.some((word) => word.toLowerCase() === alias.toLowerCase()),
    ),
  );
}

/**
 * Applies an edit of the common list (`base` → `draft`) to one icon's `own`
 * aliases; aliases that weren't on screen stay untouched.
 */
export function applyAliasEdit(
  own: string[],
  base: string[],
  draft: string[],
): string[] {
  const fold = (value: string) => value.trim().toLowerCase();
  const shown = new Set(base.map(fold));
  const asked = new Set(draft.map(fold).filter(Boolean));

  const kept = own.filter(
    (alias) => !shown.has(fold(alias)) || asked.has(fold(alias)),
  );

  return cleanIconAliases([...kept, ...draft]);
}

export function matchesIcon(
  icon: { name: string; title: string; aliases: string[] },
  query: string,
): boolean {
  return matchesIconName(
    [icon.name, icon.title, ...icon.aliases].join(" "),
    query,
  );
}

export function iconLabelFor(name: string): string {
  return name.replace(/\.svg$/i, "");
}

export function downloadNameFor(name: string, settings: IconSettings): string {
  return `${iconLabelFor(name)}-${settings.size}-${settings.stroke}.svg`;
}
