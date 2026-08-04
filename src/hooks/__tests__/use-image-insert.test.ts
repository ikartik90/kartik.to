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

// ---------------------------------------------------------------------------
// Multi-selection — the collection block picks several images at once
// ---------------------------------------------------------------------------

describe("useImageInsert (selectionMode: multiple)", () => {
  const asset = (name: string) => ({
    key: `media/${name}.png`,
    url: `https://cdn/${name}.png`,
    filename: `${name}.png`,
    contentType: "image/png",
    size: 100,
  });

  const LIBRARY = [asset("a"), asset("b"), asset("c")];

  beforeEach(() => {
    vi.clearAllMocks();
    mockListMediaAssets.mockResolvedValue(LIBRARY);
  });

  async function openMultiple(maxSelection = 6) {
    const view = renderHook(() =>
      useImageInsert({ open: true, selectionMode: "multiple", maxSelection }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    return view;
  }

  it("starts with nothing selected", async () => {
    const { result } = await openMultiple();
    expect(result.current.selectedKeys).toEqual([]);
  });

  it("replaces the whole selection on a plain select", async () => {
    const { result } = await openMultiple();
    act(() => result.current.toggleAsset("media/a.png"));
    act(() => result.current.toggleAsset("media/b.png"));
    act(() => result.current.selectAsset("media/c.png"));
    expect(result.current.selectedKeys).toEqual(["media/c.png"]);
  });

  it("adds then removes on toggle, and moves the anchor with it", async () => {
    const { result } = await openMultiple();
    act(() => result.current.toggleAsset("media/a.png"));
    act(() => result.current.toggleAsset("media/b.png"));
    expect(result.current.selectedKeys).toEqual(["media/a.png", "media/b.png"]);
    expect(result.current.selectedKey).toBe("media/b.png");

    act(() => result.current.toggleAsset("media/a.png"));
    expect(result.current.selectedKeys).toEqual(["media/b.png"]);
  });

  it("refuses to select past maxSelection and says why", async () => {
    const { result } = await openMultiple(2);
    act(() => result.current.toggleAsset("media/a.png"));
    act(() => result.current.toggleAsset("media/b.png"));
    act(() => result.current.toggleAsset("media/c.png"));

    expect(result.current.selectedKeys).toEqual(["media/a.png", "media/b.png"]);
    expect(result.current.error).toMatch(/2/);
  });

  it("still lets you deselect when full", async () => {
    const { result } = await openMultiple(2);
    act(() => result.current.toggleAsset("media/a.png"));
    act(() => result.current.toggleAsset("media/b.png"));
    act(() => result.current.toggleAsset("media/b.png"));
    expect(result.current.selectedKeys).toEqual(["media/a.png"]);
  });

  // Click order IS collection order — the first image picked becomes the
  // featured one, so the payloads must not fall back to library order.
  it("returns payloads in selection order", async () => {
    const { result } = await openMultiple();
    act(() => result.current.toggleAsset("media/c.png"));
    act(() => result.current.toggleAsset("media/a.png"));

    expect(result.current.getInsertPayloads()).toEqual([
      { src: "https://cdn/c.png", alt: undefined },
      { src: "https://cdn/a.png", alt: undefined },
    ]);
  });

  it("carries each asset's stored alt text", async () => {
    mockListMediaAssets.mockResolvedValue([
      { ...asset("a"), alt: "An A" },
      asset("b"),
    ]);
    const { result } = await openMultiple();
    act(() => result.current.toggleAsset("media/a.png"));
    act(() => result.current.toggleAsset("media/b.png"));

    expect(result.current.getInsertPayloads()).toEqual([
      { src: "https://cdn/a.png", alt: "An A" },
      { src: "https://cdn/b.png", alt: undefined },
    ]);
  });

  // The alt field debounces its save by 400ms, so the asset in state can still
  // be stale at the moment Insert is pressed — the anchor's live draft wins.
  it("prefers the anchor's in-flight alt draft over the stored value", async () => {
    const { result } = await openMultiple();
    act(() => result.current.toggleAsset("media/a.png"));
    act(() => result.current.updateAltText("Just typed"));

    expect(result.current.getInsertPayloads()[0].alt).toBe("Just typed");
  });

  it("drops a deleted image from the selection", async () => {
    mockDeleteMedia.mockResolvedValue(undefined);
    const { result } = await openMultiple();
    act(() => result.current.toggleAsset("media/a.png"));
    // Toggling makes b the anchor, so it is what the delete button acts on.
    act(() => result.current.toggleAsset("media/b.png"));

    await act(async () => {
      await result.current.deleteSelectedAsset();
    });

    expect(mockDeleteMedia).toHaveBeenCalledWith({ key: "media/b.png" });
    expect(result.current.selectedKeys).toEqual(["media/a.png"]);
  });
});
