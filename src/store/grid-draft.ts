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

/**
 * Unsaved changes to the grid's layout — the grid's answer to `useEditorStore`.
 *
 * Global for the same reason the editor's is: the palette owns the two exits
 * ("Publish and exit", "Discard and exit") and the grid owns the edits, and the
 * two are nowhere near each other in the tree.
 *
 * Not persisted. An article's draft survives a refresh because losing typing
 * would be cruel; a handful of reorderings is a few seconds of work, and a
 * layout quietly restored days later — over a grid whose posts have changed
 * underneath it — would seat cards by indexes that no longer mean what they did.
 */
export const useGridDraftStore = create<GridDraftStore>()((set) => ({
  ...emptyGridDraft(),

  setPin: (key, index) =>
    set((s) => ({ pins: { ...s.pins, [key]: index } })),

  // The caller has already clamped — the toolbar disables the control at each
  // end — so this records what it is given rather than re-deriving the bounds
  // from a column count it does not have.
  setSpan: (key, span) => set((s) => ({ spans: { ...s.spans, [key]: span } })),

  // Recorded against the CARD key, which for a component is its publication
  // row rather than its registry entry — the same demo published twice can be
  // reshaped in one place and left alone in the other.
  setAspect: (key, aspect) =>
    set((s) => ({ aspects: { ...s.aspects, [key]: aspect } })),

  // Recorded against the card key like the shape above, and for the same
  // reason: the same demo published twice can show its log output in one
  // showing and hide it in the other.
  setLogger: (key, logger) =>
    set((s) => ({ loggers: { ...s.loggers, [key]: logger } })),

  // The WHOLE configuration, replacing whatever was there. The rail edits a
  // card the way the media panel edits a picture — it owns no draft of its own
  // and hands back the complete object on every change — so a merge here would
  // make an emptied field un-emptiable. See `GridDraft.props`.
  setProps: (key, props) => set((s) => ({ props: { ...s.props, [key]: props } })),

  // A post's card, replaced whole for the reason `props` is — see
  // `GridDraft.cards`.
  setCard: (key, card) => set((s) => ({ cards: { ...s.cards, [key]: card } })),

  addInsert: (insert) => set((s) => ({ inserts: [...s.inserts, insert] })),

  // Removing a card that was itself an unsaved insert has to drop the insert,
  // not record a removal against a row that does not exist. `applyGridDraft`
  // tolerates either, but leaving the insert in would send it to the server on
  // publish and create the very row the user just took away.
  remove: (key) =>
    set((s) =>
      s.inserts.some((i) => i.key === key)
        ? { inserts: s.inserts.filter((i) => i.key !== key) }
        : { removals: [...s.removals, key] },
    ),

  reset: () => set({ ...emptyGridDraft() }),
}));
