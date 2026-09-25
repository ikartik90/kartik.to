import { create } from "zustand";
import {
  emptyGridDraft,
  type GridDraft,
  type PendingComponentInsert,
} from "@/utils/grid-draft";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";
import type { LinkCardConfig } from "@/domain/link-card";
import type { PostCardConfig } from "@/domain/post";

interface GridDraftStore extends GridDraft {
  setPin: (key: string, index: number | null) => void;
  setSpan: (key: string, span: number) => void;
  setAspect: (key: string, aspect: DemoFrameAspectRatio) => void;
  setLogger: (key: string, logger: boolean) => void;
  setProps: (key: string, props: LinkCardConfig) => void;
  setCard: (key: string, card: PostCardConfig) => void;
  addInsert: (insert: PendingComponentInsert) => void;
  remove: (key: string) => void;
  reset: () => void;
}

/** Unsaved grid layout edits. Not persisted: restored pin indexes go stale once posts change. */
export const useGridDraftStore = create<GridDraftStore>()((set) => ({
  ...emptyGridDraft(),

  setPin: (key, index) =>
    set((s) => ({ pins: { ...s.pins, [key]: index } })),

  // Callers clamp the span.
  setSpan: (key, span) => set((s) => ({ spans: { ...s.spans, [key]: span } })),

  setAspect: (key, aspect) =>
    set((s) => ({ aspects: { ...s.aspects, [key]: aspect } })),

  setLogger: (key, logger) =>
    set((s) => ({ loggers: { ...s.loggers, [key]: logger } })),

  // Replaces the whole config: a merge would make an emptied field un-emptiable.
  setProps: (key, props) => set((s) => ({ props: { ...s.props, [key]: props } })),

  setCard: (key, card) => set((s) => ({ cards: { ...s.cards, [key]: card } })),

  addInsert: (insert) => set((s) => ({ inserts: [...s.inserts, insert] })),

  // An unsaved insert is dropped; recording a removal would still create its row on publish.
  remove: (key) =>
    set((s) =>
      s.inserts.some((i) => i.key === key)
        ? { inserts: s.inserts.filter((i) => i.key !== key) }
        : { removals: [...s.removals, key] },
    ),

  reset: () => set({ ...emptyGridDraft() }),
}));
