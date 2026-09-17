import { create } from "zustand";
import type { Document, PostCategory } from "@/domain/post";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const EMPTY_DOCUMENT: Document = { type: "doc", content: [] };

/** Maximum number of undo steps retained. */
const MAX_HISTORY = 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Where a post is read — a category and a slug. */
export interface PostAddress {
  category: PostCategory;
  slug: string;
}

export interface HistorySnapshot {
  title: string;
  document: Document;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface EditorStore {
  title: string;
  draftId: string | null;
  category: PostCategory;
  /**
   * The post's address, or null for a draft that has none yet — its first
   * save mints one from the title unless the author types one first.
   */
  slug: string | null;
  /**
   * The search description the author wrote, or null for the summary read off
   * the opening. The save stores an emptied one as null too.
   */
  description: string | null;
  /**
   * Where the post is read as its ROW has it, or null for a draft never
   * written. Not the buffer: `category` and `slug` above are what the sidebar
   * has been told, this is what was last saved. Leaving the editor goes here,
   * and a save that changes it is how the editor knows to follow the post.
   */
  savedAddress: PostAddress | null;
  document: Document;
  /**
   * Whether the post being edited is live. The palette needs it to decide
   * which of Publish / Unpublish it can honestly offer — a post that has never
   * been published has nothing to withdraw.
   */
  isPublished: boolean;
  isDirty: boolean;
  /** Ordered list of snapshots from oldest to newest. */
  history: HistorySnapshot[];
  /** Index of the currently active snapshot, or -1 when history is empty. */
  historyIndex: number;

  setTitle: (title: string) => void;
  setDocument: (document: Document) => void;
  setDraftId: (id: string) => void;
  /** File the post under another category — the metadata sidebar's choice. */
  setCategory: (category: PostCategory) => void;
  setSlug: (slug: string) => void;
  setDescription: (description: string | null) => void;
  /** Record where the row now reads — after a load or a save, never a change. */
  setSavedAddress: (address: PostAddress) => void;
  setDirty: (dirty: boolean) => void;
  setPublished: (published: boolean) => void;
  /**
   * Append a snapshot to the history stack. Any snapshots that were ahead of
   * the current index (the "redo stack") are trimmed first.
   */
  pushHistory: (snapshot: HistorySnapshot) => void;
  /** Restore the previous snapshot. No-op when already at the oldest entry. */
  undo: () => void;
  /** Restore the next snapshot. No-op when already at the newest entry. */
  redo: () => void;
  reset: () => void;
}

const INITIAL_STATE = {
  title: "",
  draftId: null as string | null,
  category: "ARTICLE" as PostCategory,
  slug: null as string | null,
  description: null as string | null,
  savedAddress: null as PostAddress | null,
  document: EMPTY_DOCUMENT,
  isPublished: false,
  isDirty: false,
  history: [] as HistorySnapshot[],
  historyIndex: -1,
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...INITIAL_STATE,

  setTitle: (title) => set({ title, isDirty: true }),
  setDocument: (document) => set({ document, isDirty: true }),
  setDraftId: (draftId) => set({ draftId }),
  // The metadata is buffered like the words: each change is unsaved work that
  // Save and Publish write and Discard throws away. None of it is in the undo
  // history, which is the document's — a sidebar value is changed back in the
  // sidebar.
  setCategory: (category) => set({ category, isDirty: true }),
  setSlug: (slug) => set({ slug, isDirty: true }),
  setDescription: (description) => set({ description, isDirty: true }),
  setSavedAddress: (savedAddress) => set({ savedAddress }),
  setDirty: (isDirty) => set({ isDirty }),
  setPublished: (isPublished) => set({ isPublished }),

  pushHistory: ({ title, document }) => {
    const { history, historyIndex } = get();
    // Trim the redo stack (everything after the current index) then append.
    const trimmed = history.slice(0, historyIndex + 1);
    const next = [...trimmed, { title, document }].slice(-MAX_HISTORY);
    set({ history: next, historyIndex: next.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const idx = historyIndex - 1;
    const snap = history[idx];
    set({ title: snap.title, document: snap.document, historyIndex: idx, isDirty: true });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const idx = historyIndex + 1;
    const snap = history[idx];
    set({ title: snap.title, document: snap.document, historyIndex: idx, isDirty: true });
  },

  reset: () => set({ ...INITIAL_STATE }),
}));
