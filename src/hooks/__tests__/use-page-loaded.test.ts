// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePageLoaded } from "../use-page-loaded";

describe("usePageLoaded", () => {
  it("reports loaded when the document is already complete", () => {
    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
    const { result } = renderHook(() => usePageLoaded());
    expect(result.current).toBe(true);
  });

  it("flips to loaded when the window load event fires", () => {
    const readyState = vi
      .spyOn(document, "readyState", "get")
      .mockReturnValue("loading");
    const { result } = renderHook(() => usePageLoaded());
    expect(result.current).toBe(false);

    act(() => {
      // `readyState` is "complete" by the time the load event fires.
      readyState.mockReturnValue("complete");
      window.dispatchEvent(new Event("load"));
    });
    expect(result.current).toBe(true);
  });
});
