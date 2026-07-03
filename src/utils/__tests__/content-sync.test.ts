import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifyContentUpdated, subscribeContentUpdated } from "../content-sync";

class MockBroadcastChannel {
  static channels = new Map<string, Set<MockBroadcastChannel>>();

  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name)!.add(this);
  }

  postMessage(data: unknown) {
    for (const channel of MockBroadcastChannel.channels.get(this.name) ?? []) {
      channel.onmessage?.({ data } as MessageEvent);
    }
  }

  close() {
    MockBroadcastChannel.channels.get(this.name)?.delete(this);
  }
}

describe("content-sync", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    MockBroadcastChannel.channels.clear();
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
  });

  it("does not refresh the tab that sent the update", () => {
    const onUpdate = vi.fn();
    const unsubscribe = subscribeContentUpdated(onUpdate);

    notifyContentUpdated();

    expect(onUpdate).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("notifies subscribers in other tabs", () => {
    const onUpdate = vi.fn();
    subscribeContentUpdated(onUpdate);

    for (const channel of MockBroadcastChannel.channels.get(
      "kartik-content-updated",
    ) ?? []) {
      channel.onmessage?.({
        data: { type: "content-updated", sourceId: "other-tab-id" },
      } as MessageEvent);
    }

    expect(onUpdate).toHaveBeenCalledOnce();
  });
});
