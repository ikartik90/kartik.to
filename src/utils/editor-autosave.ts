import type { Document, PostCategory } from "@/domain/post";

// A best-effort, client-side safety net; the DB draft is the source of truth.

const KEY_PREFIX = "kartik-editor-autosave";

/** Bump when the snapshot shape changes. */
const SCHEMA_VERSION = 1;

export interface AutosaveSnapshot {
  version: number;
  title: string;
  draftId: string | null;
  category: PostCategory;
  /** Optional: older snapshots lack them, and read as "unchanged". */
  slug?: string | null;
  description?: string | null;
  document: Document;
  savedAt: number;
}

export function autosaveKey(
  draftId: string | null,
  category: PostCategory,
): string {
  return draftId
    ? `${KEY_PREFIX}:${draftId}`
    : `${KEY_PREFIX}:new:${category}`;
}

export function readAutosave(key: string): AutosaveSnapshot | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AutosaveSnapshot>;
    if (
      parsed.version !== SCHEMA_VERSION ||
      typeof parsed.document !== "object" ||
      parsed.document === null
    ) {
      return null;
    }
    return parsed as AutosaveSnapshot;
  } catch {
    return null;
  }
}

export function writeAutosave(
  key: string,
  snapshot: Omit<AutosaveSnapshot, "version">,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({ version: SCHEMA_VERSION, ...snapshot }),
    );
  } catch {
    // Best-effort.
  }
}

export function clearAutosave(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable.
  }
}
