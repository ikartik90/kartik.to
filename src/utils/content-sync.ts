const CHANNEL = "kartik-content-updated";

/** Stable per-tab id so the originating tab can ignore its own broadcast. */
const TAB_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2)}`;

export function notifyContentUpdated(): void {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage({ type: "content-updated", sourceId: TAB_ID });
  channel.close();
}

export function subscribeContentUpdated(onUpdate: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event) => {
    if (event.data?.sourceId === TAB_ID) return;
    onUpdate();
  };
  return () => channel.close();
}
