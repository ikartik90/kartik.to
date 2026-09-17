import { create } from "zustand";

// ---------------------------------------------------------------------------
// Whether the open editor's metadata sidebar is showing.
//
// Global because the two ends of it live in different trees: the command
// palette (in the root layout) opens it, and the article editor (in the page)
// draws it. Offered only while an editor is open — the sidebar's changes are
// buffered with the words, so a page being read has nowhere to hold them.
//
// Not part of the editor store, whose `reset()` is the document's: throwing
// the buffer away is not the same act as closing the panel, and the editor
// resets on its way IN for a new draft.
// ---------------------------------------------------------------------------

interface MetadataPanelStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useMetadataPanelStore = create<MetadataPanelStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
