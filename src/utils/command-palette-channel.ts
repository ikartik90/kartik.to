const listeners = new Set<() => void>();

/** A no-op if no palette is mounted. */
export function openCommandPalette(): void {
  for (const listener of listeners) listener();
}

export function subscribeCommandPalette(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
