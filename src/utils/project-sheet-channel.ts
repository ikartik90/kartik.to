const listeners = new Set<(id: string) => void>();

/** False if no project sheet is mounted to open it. */
export function openProjectSheet(id: string): boolean {
  for (const listener of listeners) listener(id);
  return listeners.size > 0;
}

export function subscribeProjectSheet(
  listener: (id: string) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
