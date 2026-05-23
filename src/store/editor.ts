import { create } from "zustand";
import type { Document } from "@/domain/post";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const EMPTY_DOCUMENT: Document = { type: "doc", content: [] };

/** Maximum number of undo steps retained. */
const MAX_HISTORY = 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  document: Document;
  isDirty: boolean;
  /** Ordered list of snapshots from oldest to newest. */
  history: HistorySnapshot[];
  /** Index of the currently active snapshot, or -1 when history is empty. */
  historyIndex: number;

  setTitle: (title: string) => void;
  setDocument: (document: Document) => void;
  setDraftId: (id: string) => void;
  setDirty: (dirty: boolean) => void;
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
  document: EMPTY_DOCUMENT,
  isDirty: false,
  history: [] as HistorySnapshot[],
  historyIndex: -1,
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...INITIAL_STATE,

  setTitle: (title) => set({ title, isDirty: true }),
  setDocument: (document) => set({ document, isDirty: true }),
  setDraftId: (draftId) => set({ draftId }),
  setDirty: (isDirty) => set({ isDirty }),

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
