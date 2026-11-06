/** Runs `task` when the browser is next idle, or `timeout` ms from now at the latest; returns a cancel. */
export function whenIdle(task: () => void, timeout: number): () => void {
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(() => task(), { timeout });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(task, 0);
  return () => clearTimeout(handle);
}
