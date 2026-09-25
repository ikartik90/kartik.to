import { create } from "zustand";

interface MetadataPanelStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useMetadataPanelStore = create<MetadataPanelStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
