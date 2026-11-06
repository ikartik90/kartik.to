// The first fold's own work (the homepage's project cards) holds back what can wait: work below the fold, and the
// hero's leaves. Each hold lets go when its work is done, or after its timeout at the latest.

let holds = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Holds the first fold until the returned release is called, or `timeoutMs` has passed. */
export function holdFirstFold(timeoutMs: number): () => void {
  holds += 1;
  notify();
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    clearTimeout(timer);
    holds -= 1;
    notify();
  };
  const timer = setTimeout(release, timeoutMs);
  return release;
}

export const firstFoldHeld = () => holds > 0;

export function subscribeFirstFold(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
