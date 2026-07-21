// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { DemoComponent, DemoPreloader } from "../demo-component";
import { __resetDemoAssetCache } from "@/utils/demo-assets";
import type { DemoComponentEntry } from "@/components/demo/registry";

beforeEach(() => {
  __resetDemoAssetCache();
  vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
});

afterEach(() => cleanup());

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

    // The preloader is shown while the module load is pending.
    expect(screen.getByRole("progressbar")).toBeDefined();
    expect(screen.queryByTestId("loaded-demo")).toBeNull();

    resolveLoad(() => <div data-testid="loaded-demo">Loaded</div>);

    await waitFor(() => expect(screen.getByTestId("loaded-demo")).toBeDefined());
    // Preloader is gone once the demo is ready.
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
