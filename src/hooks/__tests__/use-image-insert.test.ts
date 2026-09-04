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

// The measurement is the DOM's answer about a real file, and jsdom loads
// nothing — an <img> pointed at a blob URL fires neither `load` nor `error`,
// so the real one would sit out its whole timeout on every upload here. Its
// own behaviour is covered in `utils/__tests__/measure-media.test.ts`; what
// this file cares about is that whatever it answers reaches the signing call.
const mockMeasureMediaFile = vi.fn();
vi.mock("@/utils/measure-media", () => ({
  measureMediaFile: (...args: unknown[]) => mockMeasureMediaFile(...args),
}));

describe("useImageInsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListMediaAssets.mockResolvedValue([]);
    mockMeasureMediaFile.mockResolvedValue(null);
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

  // The content type is validated on the way in and stored on the asset, and
  // until now it stopped here — the payload carried an src and an alt, and the
  // renderer was left to work the rest out from the URL. Passing it through is
  // what stops the untyped set from growing: every node inserted from this
  // dialog states its own kind, so the filename guess only ever has to answer
  // for documents written before there was a field to write it in.
  //
  // The urls below carry NO extension on purpose. That is the case the sniffer
  // cannot get right — a bare R2 key reads as a picture whatever it holds — so
  // it is the case that proves the answer came from the content type.
  it("hands the insert its kind, read from the stored content type", async () => {
    mockListMediaAssets.mockResolvedValue([
      {
        key: "media/demo",
        url: "https://cdn/demo",
        filename: "demo.mp4",
        contentType: "video/mp4",
        size: 2048,
      },
      {
        key: "media/shot",
        url: "https://cdn/shot",
        filename: "shot.png",
        contentType: "image/png",
        size: 100,
      },
    ]);

    const { result } = renderHook(() => useImageInsert({ open: true }));
    await act(async () => {
      await Promise.resolve();
    });

    act(() => result.current.selectAsset("media/demo"));
    expect(result.current.getInsertPayload()).toEqual({
      src: "https://cdn/demo",
      alt: undefined,
      kind: "video",
    });

    act(() => result.current.selectAsset("media/shot"));
    expect(result.current.getInsertPayload()?.kind).toBe("image");
  });

  it("has nothing to insert when nothing is selected", async () => {
    const { result } = renderHook(() => useImageInsert({ open: true }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.getInsertPayload()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// What the drop zone will take — the same allow-list and the same per-format
// ceilings the server enforces, answered here without the round trip.
// ---------------------------------------------------------------------------

describe("useImageInsert file validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListMediaAssets.mockResolvedValue([]);
    mockMeasureMediaFile.mockResolvedValue(null);
    // Reaching the signing call at all is the proof that the gates let the file
    // through, and refusing there stops the test short of jsdom's XHR — which
    // would put a real PUT on the wire.
    mockCreateMediaUploadUrl.mockRejectedValue(new Error("no upload here"));
  });

  /** A file of `size` bytes without allocating any of them. */
  const fileOf = (name: string, type: string, size: number) => {
    const file = new File(["x"], name, { type });
    Object.defineProperty(file, "size", { value: size });
    return file;
  };

  const drop = async (file: File) => {
    const { result } = renderHook(() => useImageInsert({ open: true }));
    await act(async () => {
      await result.current.processFile(file);
    });
    return result;
  };

  it("refuses a format the library does not take", async () => {
    const result = await drop(fileOf("clip.mov", "video/quicktime", 1024));
    expect(result.current.error).toBe("Unsupported file type");
    expect(mockCreateMediaUploadUrl).not.toHaveBeenCalled();
  });

  it("takes an mp4", async () => {
    await drop(fileOf("clip.mp4", "video/mp4", 1024));
    expect(mockCreateMediaUploadUrl).toHaveBeenCalledWith({
      filename: "clip.mp4",
      contentType: "video/mp4",
      size: 1024,
    });
  });

  // The shape is measured from the file in hand and signed into the upload, so
  // the object carries it from the moment it exists — which is what lets a
  // surface reserve the right box for it before a byte has arrived. It rides
  // in the SIGNING call rather than a patch afterwards: the answer is already
  // in hand, so recording it costs no round trip of its own.
  it("records the file's own shape with the upload", async () => {
    mockMeasureMediaFile.mockResolvedValue({ width: 1600, height: 900 });
    await drop(fileOf("shot.png", "image/png", 1024));
    expect(mockCreateMediaUploadUrl).toHaveBeenCalledWith({
      filename: "shot.png",
      contentType: "image/png",
      size: 1024,
      width: 1600,
      height: 900,
    });
  });

  // A file the browser will not decode still uploads. The shape is an
  // optimisation — the box falls back to the house ratio without it — and an
  // upload is not worth failing over a measurement.
  it("uploads a file it could not measure, with no shape at all", async () => {
    mockMeasureMediaFile.mockResolvedValue(null);
    await drop(fileOf("odd.svg", "image/svg+xml", 1024));
    expect(mockCreateMediaUploadUrl).toHaveBeenCalledWith({
      filename: "odd.svg",
      contentType: "image/svg+xml",
      size: 1024,
    });
  });

  // The ceiling follows the FORMAT. A clip is allowed to be an order larger
  // than a picture, and a single shared limit would either refuse ordinary
  // videos or stop being a guard on images.
  it("holds each format to its own ceiling", async () => {
    const size = 20 * 1024 * 1024;

    const picture = await drop(fileOf("huge.png", "image/png", size));
    expect(picture.current.error).toBe("File is too large");
    expect(mockCreateMediaUploadUrl).not.toHaveBeenCalled();

    const clip = await drop(fileOf("clip.mp4", "video/mp4", size));
    expect(clip.current.error).not.toBe("File is too large");
    expect(mockCreateMediaUploadUrl).toHaveBeenCalledOnce();
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
    mockMeasureMediaFile.mockResolvedValue(null);
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
      { src: "https://cdn/c.png", alt: undefined, kind: "image" },
      { src: "https://cdn/a.png", alt: undefined, kind: "image" },
    ]);
  });

  // Same argument as the single-insert case above: a batch dropped into a
  // collection is exactly where a wall of untyped items used to come from.
  // The shape travels with the source through the batch, exactly as `kind`
  // does: both are things the library knows first-hand and the document could
  // never recover afterwards.
  it("carries each asset's recorded shape into its payload", async () => {
    mockListMediaAssets.mockResolvedValue([
      { ...asset("a"), width: 1600, height: 900 },
      asset("b"),
    ]);
    const { result } = await openMultiple();
    act(() => result.current.toggleAsset("media/a.png"));
    act(() => result.current.toggleAsset("media/b.png"));
    expect(result.current.getInsertPayloads()).toMatchObject([
      { src: "https://cdn/a.png", width: 1600, height: 900 },
      { src: "https://cdn/b.png", width: undefined, height: undefined },
    ]);
  });

  it("carries each asset's kind through the batch, in selection order", async () => {
    mockListMediaAssets.mockResolvedValue([
      asset("a"),
      {
        key: "media/demo",
        url: "https://cdn/demo",
        filename: "demo.mp4",
        contentType: "video/mp4",
        size: 2048,
      },
    ]);
    const { result } = await openMultiple();
    act(() => result.current.toggleAsset("media/demo"));
    act(() => result.current.toggleAsset("media/a.png"));

    expect(result.current.getInsertPayloads().map((p) => p.kind)).toEqual([
      "video",
      "image",
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
      { src: "https://cdn/a.png", alt: "An A", kind: "image" },
      { src: "https://cdn/b.png", alt: undefined, kind: "image" },
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
