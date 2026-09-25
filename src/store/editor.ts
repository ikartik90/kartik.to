import { create } from "zustand";
import type { Document, PostCategory } from "@/domain/post";

export const EMPTY_DOCUMENT: Document = { type: "doc", content: [] };

const MAX_HISTORY = 100;

export interface PostAddress {
  category: PostCategory;
  slug: string;
}

export interface HistorySnapshot {
  title: string;
  document: Document;
}

interface EditorStore {
  title: string;
  draftId: string | null;
  category: PostCategory;
  /** Null until the first save mints one from the title. */
  slug: string | null;
  /** Null falls back to the summary read off the opening. */
  description: string | null;
  /** The address as last loaded or saved; `category` and `slug` hold unsaved edits. */
  savedAddress: PostAddress | null;
  document: Document;
  isPublished: boolean;
  isDirty: boolean;
  history: HistorySnapshot[];
  historyIndex: number;

  setTitle: (title: string) => void;
  setDocument: (document: Document) => void;
  setDraftId: (id: string) => void;
  setCategory: (category: PostCategory) => void;
  setSlug: (slug: string) => void;
  setDescription: (description: string | null) => void;
  setSavedAddress: (address: PostAddress) => void;
  setDirty: (dirty: boolean) => void;
  setPublished: (published: boolean) => void;
  pushHistory: (snapshot: HistorySnapshot) => void;
  undo: () => void;
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
  setCategory: (category) => set({ category, isDirty: true }),
  setSlug: (slug) => set({ slug, isDirty: true }),
  setDescription: (description) => set({ description, isDirty: true }),
  setSavedAddress: (savedAddress) => set({ savedAddress }),
  setDirty: (isDirty) => set({ isDirty }),
  setPublished: (isPublished) => set({ isPublished }),

  pushHistory: ({ title, document }) => {
    const { history, historyIndex } = get();
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
