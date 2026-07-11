import type { Document, PostCategory } from "@/domain/post";

// ---------------------------------------------------------------------------
// Editor autosave — persists in-progress article edits to localStorage so an
// accidental refresh or tab close doesn't lose unsaved work. This is a purely
// client-side safety net; the source of truth is still the DB draft saved via
// the command palette (see use-command-palette.ts).
// ---------------------------------------------------------------------------

const KEY_PREFIX = "kartik-editor-autosave";

/** Bump when the snapshot shape changes to invalidate stale localStorage entries. */
const SCHEMA_VERSION = 1;

/** A restorable snapshot of the editor store's persistable fields. */
export interface AutosaveSnapshot {
  version: number;
  title: string;
  draftId: string | null;
  category: PostCategory;
  document: Document;
  /** Epoch millis the snapshot was written — for diagnostics / future conflict UX. */
  savedAt: number;
}

/**
 * Stable localStorage key for an edit session. Existing posts are keyed by
 * their draft id; a brand-new post (no id yet) is keyed by its category so a
 * refresh mid-compose restores into the same "new" editor.
 */
export function autosaveKey(
  draftId: string | null,
  category: PostCategory,
): string {
  return draftId
    ? `${KEY_PREFIX}:${draftId}`
    : `${KEY_PREFIX}:new:${category}`;
}

/** Read and validate a snapshot for `key`, or null when absent/corrupt/stale. */
export function readAutosave(key: string): AutosaveSnapshot | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    // Storage can throw in private-mode / disabled-storage contexts.
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

/** Persist a snapshot under `key`. Silently no-ops when storage is unavailable. */
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
    // Quota exceeded / storage disabled — autosave is best-effort.
  }
}

/** Remove the snapshot for `key` (call after an explicit save/publish/discard). */
export function clearAutosave(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore — nothing to clean up if storage is unavailable.
  }
}
