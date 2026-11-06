// @vitest-environment jsdom
import React from "react";
import { act, render, screen, waitFor, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { DemoComponent, DemoPreloader } from "../demo-component";
import { __resetDemoAssetCache } from "@/utils/demo-assets";
import type { DemoComponentEntry } from "@/components/demo/registry";

beforeEach(() => {
  __resetDemoAssetCache();
  vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
  // Settled at once: the page loaded, idle, and nothing in the first fold holding it.
  vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) =>
    callback({ didTimeout: false, timeRemaining: () => 50 }),
  );
  vi.stubGlobal("cancelIdleCallback", () => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DemoPreloader", () => {
  it("renders the shared progress bar", () => {
    render(<DemoPreloader value={30} />);
    expect(
      screen.getByRole("progressbar", { name: "Loading component demo" }),
    ).toBeDefined();
  });
});

describe("DemoComponent", () => {
  it("shows the preloader while pending, then swaps in the loaded demo", async () => {
    let resolveLoad!: (c: () => React.ReactElement) => void;
    const entry: DemoComponentEntry = {
      id: "demo",
      label: "Demo",
      load: () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        }),
    };

    render(<DemoComponent entry={entry} />);

    expect(screen.getByRole("progressbar")).toBeDefined();
    expect(screen.queryByTestId("loaded-demo")).toBeNull();

    resolveLoad(() => <div data-testid="loaded-demo">Loaded</div>);

    await waitFor(() => expect(screen.getByTestId("loaded-demo")).toBeDefined());
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("fetches nothing until it comes near the screen", async () => {
    const callbacks: IntersectionObserverCallback[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          callbacks.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    const Loaded = () => <div data-testid="loaded-demo">Loaded</div>;
    const load = vi.fn(async () => Loaded);
    render(<DemoComponent entry={{ id: "far-demo", label: "Far demo", load }} />);
    await act(async () => {});
    expect(load).not.toHaveBeenCalled();

    act(() =>
      callbacks.forEach((callback) =>
        callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver),
      ),
    );
    await waitFor(() => expect(screen.getByTestId("loaded-demo")).toBeDefined());
    expect(load).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
