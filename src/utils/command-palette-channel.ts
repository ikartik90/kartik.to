// ---------------------------------------------------------------------------
// The doorbell for the command palette.
//
// The palette's openness lives on a native `<dialog>` — `showModal()` on an
// element held by a ref inside `CommandPalette` — so there is no state for
// anything outside that component to set, and nothing to lift without rewriting
// how the dialog opens. A caller rings, the mounted palette answers.
//
// Deliberately not a store: there is no VALUE here, only a request. The same
// listener-set shape as `use-input-modality`, minus the snapshot.
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();

/** Ask for the command palette. A no-op if none is mounted. */
export function openCommandPalette(): void {
  for (const listener of listeners) listener();
}

/** Answer requests for the palette until the returned function is called. */
export function subscribeCommandPalette(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
