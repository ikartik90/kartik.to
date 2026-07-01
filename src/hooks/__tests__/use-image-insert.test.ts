import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useImageInsert } from "../use-image-insert";

const mockListMediaAssets = vi.fn();
const mockCreateMediaUploadUrl = vi.fn();
const mockUpdateMediaAlt = vi.fn();
const mockDeleteMedia = vi.fn();

vi.mock("@/app/actions/media", () => ({
  listMediaAssets: (...args: unknown[]) => mockListMediaAssets(...args),
  createMediaUploadUrl: (...args: unknown[]) => mockCreateMediaUploadUrl(...args),
  updateMediaAlt: (...args: unknown[]) => mockUpdateMediaAlt(...args),
  deleteMedia: (...args: unknown[]) => mockDeleteMedia(...args),
}));

describe("useImageInsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListMediaAssets.mockResolvedValue([]);
  });

  it("loads library when open", async () => {
    mockListMediaAssets.mockResolvedValue([
      {
        key: "media/a.png",
        url: "https://cdn/a.png",
        filename: "a.png",
        contentType: "image/png",
        size: 100,
      },
    ]);

    const { result } = renderHook(() => useImageInsert({ open: true }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockListMediaAssets).toHaveBeenCalled();
    expect(result.current.hasLibraryImages).toBe(true);
  });

  it("opens directly in library phase when requested", async () => {
    mockListMediaAssets.mockResolvedValue([
      {
        key: "media/a.png",
        url: "https://cdn/a.png",
        filename: "a.png",
        contentType: "image/png",
        size: 100,
      },
    ]);

    const { result } = renderHook(() =>
      useImageInsert({ open: true, initialPhase: "library" }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.phase).toBe("library");
  });

  it("resets when closed", async () => {
    const { result, rerender } = renderHook(
      ({ open }) => useImageInsert({ open }),
      { initialProps: { open: true } },
    );

    await act(async () => {
      await Promise.resolve();
    });

    rerender({ open: false });

    expect(result.current.phase).toBe("upload");
    expect(result.current.assets).toEqual([]);
  });

  it("deleteSelectedAsset removes the current image and selects the next one", async () => {
    mockListMediaAssets.mockResolvedValue([
      {
        key: "media/a.png",
        url: "https://cdn/a.png",
        filename: "a.png",
        contentType: "image/png",
        size: 100,
      },
      {
        key: "media/b.png",
        url: "https://cdn/b.png",
        filename: "b.png",
        contentType: "image/png",
        size: 200,
      },
    ]);
    mockDeleteMedia.mockResolvedValue(undefined);

    const { result } = renderHook(() => useImageInsert({ open: true }));

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.selectAsset("media/a.png");
    });

    await act(async () => {
      await result.current.deleteSelectedAsset();
    });

    expect(mockDeleteMedia).toHaveBeenCalledWith({ key: "media/a.png" });
    expect(result.current.assets).toHaveLength(1);
    expect(result.current.selectedKey).toBe("media/b.png");
  });
});
