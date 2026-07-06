// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCustomCursor } from "../use-custom-cursor";

describe("useCustomCursor", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("pointer: fine"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    document.querySelectorAll("[data-custom-cursor]").forEach((node) => {
      node.remove();
    });
    vi.unstubAllGlobals();
  });

  it("mounts a canvas cursor on fine pointers and removes it on unmount", async () => {
    const { unmount } = renderHook(() => useCustomCursor());

    await waitFor(() => {
      expect(document.querySelector("[data-custom-cursor]")).not.toBeNull();
    });

    unmount();

    expect(document.querySelector("[data-custom-cursor]")).toBeNull();
  });

  it("does not mount a canvas cursor on coarse pointers", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        media: "",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    renderHook(() => useCustomCursor());

    expect(document.querySelector("[data-custom-cursor]")).toBeNull();
  });
});
