import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useImageInsert } from "../use-image-insert";

const mockListMediaAssets = vi.fn();
const mockCreateMediaUploadUrl = vi.fn();
const mockUpdateMediaAlt = vi.fn();
const mockUpdateMediaFilename = vi.fn();
const mockDeleteMedia = vi.fn();

vi.mock("@/app/actions/media", () => ({
  listMediaAssets: (...args: unknown[]) => mockListMediaAssets(...args),
  createMediaUploadUrl: (...args: unknown[]) => mockCreateMediaUploadUrl(...args),
  updateMediaAlt: (...args: unknown[]) => mockUpdateMediaAlt(...args),
  updateMediaFilename: (...args: unknown[]) =>
    mockUpdateMediaFilename(...args),
  deleteMedia: (...args: unknown[]) => mockDeleteMedia(...args),
}));

// Mocked: jsdom loads nothing, so the real measurement would sit out its timeout on every upload.
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

  // Extensionless urls on purpose: the kind must come from the content type.
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

describe("useImageInsert file validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListMediaAssets.mockResolvedValue([]);
    mockMeasureMediaFile.mockResolvedValue(null);
    // Refused here so no test reaches jsdom's XHR, which would put a real PUT on the wire.
    mockCreateMediaUploadUrl.mockRejectedValue(new Error("no upload here"));
  });

  const fileOf = (name: string, type: string, size: number) => {
    const file = new File(["x"], name, { type });
    Object.defineProperty(file, "size", { value: size });
    return file;
  };

  const drop = async (file: File) => {
    const { result } = renderHook(() => useImageInsert({ open: true }));
    await act(async () => {
      await result.current.processFiles([file]);
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
      folder: "media",
    });
  });

  it("records the file's own shape with the upload", async () => {
    mockMeasureMediaFile.mockResolvedValue({ width: 1600, height: 900 });
    await drop(fileOf("shot.png", "image/png", 1024));
    expect(mockCreateMediaUploadUrl).toHaveBeenCalledWith({
      filename: "shot.png",
      contentType: "image/png",
      size: 1024,
      folder: "media",
      width: 1600,
      height: 900,
    });
  });

  it("uploads a file it could not measure, with no shape at all", async () => {
    mockMeasureMediaFile.mockResolvedValue(null);
    await drop(fileOf("odd.svg", "image/svg+xml", 1024));
    expect(mockCreateMediaUploadUrl).toHaveBeenCalledWith({
      filename: "odd.svg",
      contentType: "image/svg+xml",
      size: 1024,
      folder: "media",
    });
  });

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

  it("returns payloads in selection order", async () => {
    const { result } = await openMultiple();
    act(() => result.current.toggleAsset("media/c.png"));
    act(() => result.current.toggleAsset("media/a.png"));

    expect(result.current.getInsertPayloads()).toEqual([
      { src: "https://cdn/c.png", alt: undefined, kind: "image" },
      { src: "https://cdn/a.png", alt: undefined, kind: "image" },
    ]);
  });

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
    act(() => result.current.toggleAsset("media/b.png"));

    await act(async () => {
      await result.current.deleteSelectedAsset();
    });

    expect(mockDeleteMedia).toHaveBeenCalledWith({ key: "media/b.png" });
    expect(result.current.selectedKeys).toEqual(["media/a.png"]);
  });
});

describe("uploading several files at once", () => {
  class FakeXhr {
    upload: {
      onprogress:
        | ((e: { lengthComputable: boolean; loaded: number; total: number }) => void)
        | null;
    } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    status = 200;
    open() {}
    setRequestHeader() {}
    send() {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
      this.onload?.();
    }
  }

  const fileOf = (name: string, type = "image/png", size = 100) => {
    const file = new File(["x"], name, { type });
    Object.defineProperty(file, "size", { value: size });
    return file;
  };

  const storedAsset = (name: string) => ({
    key: `media/uuid-${name}`,
    url: `https://cdn/${name}`,
    filename: name,
    contentType: "image/png",
    size: 100,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockListMediaAssets.mockResolvedValue([]);
    mockMeasureMediaFile.mockResolvedValue(null);
    mockCreateMediaUploadUrl.mockImplementation(
      async ({ filename }: { filename: string }) => ({
        uploadUrl: `https://upload.example/${filename}`,
        publicUrl: `https://cdn/${filename}`,
        key: `media/uuid-${filename}`,
      }),
    );
    mockUpdateMediaAlt.mockResolvedValue({ key: "media/uuid-a.png" });
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
  });

  afterEach(() => vi.unstubAllGlobals());

  const dropAll = async (
    files: File[],
    options: { selectionMode?: "single" | "multiple"; maxSelection?: number } = {},
  ) => {
    const { result } = renderHook(() => useImageInsert({ open: true, ...options }));
    await act(async () => {
      await result.current.processFiles(files);
    });
    return result;
  };

  it("uploads every file it was handed", async () => {
    await dropAll([fileOf("a.png"), fileOf("b.png"), fileOf("c.png")]);

    expect(mockCreateMediaUploadUrl).toHaveBeenCalledTimes(3);
    expect(mockCreateMediaUploadUrl).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ filename: "b.png" }),
    );
  });

  it("measures progress across the batch, not across one file", async () => {
    class HeldXhr {
      static landings: (() => void)[] = [];
      upload: {
        onprogress:
          | ((e: { lengthComputable: boolean; loaded: number; total: number }) => void)
          | null;
      } = { onprogress: null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      status = 200;
      open() {}
      setRequestHeader() {}
      send() {
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: 50,
          total: 100,
        });
        HeldXhr.landings.push(() => this.onload?.());
      }
    }
    HeldXhr.landings = [];
    vi.stubGlobal("XMLHttpRequest", HeldXhr);
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    const { result } = renderHook(() => useImageInsert({ open: true }));
    let batch: Promise<void>;

    await act(async () => {
      batch = result.current.processFiles([fileOf("a.png"), fileOf("b.png")]);
      await flush();
    });
    expect(result.current.uploadProgress).toBe(25);

    await act(async () => {
      HeldXhr.landings.shift()?.();
      await flush();
    });
    expect(result.current.uploadProgress).toBe(75);

    await act(async () => {
      HeldXhr.landings.shift()?.();
      await batch;
    });
    expect(result.current.uploadProgress).toBe(100);
    expect(result.current.phase).toBe("library");
  });

  it("carries on past a file it cannot take, and names the one it skipped", async () => {
    const result = await dropAll([
      fileOf("a.png"),
      fileOf("clip.mov", "video/quicktime"),
      fileOf("b.png"),
    ]);

    expect(mockCreateMediaUploadUrl).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe("library");
    expect(result.current.error).toContain("clip.mov");
  });

  it("still refuses a lone file the plain way", async () => {
    const result = await dropAll([fileOf("clip.mov", "video/quicktime")]);

    expect(result.current.error).toBe("Unsupported file type");
    expect(result.current.phase).toBe("upload");
    expect(mockCreateMediaUploadUrl).not.toHaveBeenCalled();
  });

  it("joins the whole upload to a multiple selection, in the order dropped", async () => {
    mockListMediaAssets.mockResolvedValue([
      storedAsset("b.png"),
      storedAsset("a.png"),
    ]);

    const result = await dropAll([fileOf("a.png"), fileOf("b.png")], {
      selectionMode: "multiple",
      maxSelection: 6,
    });

    expect(result.current.selectedKeys).toEqual([
      "media/uuid-a.png",
      "media/uuid-b.png",
    ]);
  });

  it("stops joining at the cap, and keeps what fits", async () => {
    mockListMediaAssets.mockResolvedValue([
      storedAsset("b.png"),
      storedAsset("a.png"),
    ]);

    const result = await dropAll([fileOf("a.png"), fileOf("b.png")], {
      selectionMode: "multiple",
      maxSelection: 1,
    });

    expect(result.current.selectedKeys).toEqual(["media/uuid-a.png"]);
  });

  it("uploads a batch into a single-select dialog and anchors on the first", async () => {
    mockListMediaAssets.mockResolvedValue([
      storedAsset("b.png"),
      storedAsset("a.png"),
    ]);

    const result = await dropAll([fileOf("a.png"), fileOf("b.png")]);

    expect(mockCreateMediaUploadUrl).toHaveBeenCalledTimes(2);
    expect(result.current.selectedKey).toBe("media/uuid-a.png");
    expect(result.current.selectedKeys).toEqual([]);
  });

  const FACE = {
    key: "profiles/550e8400-e29b-41d4-a716-446655440000-face.png",
    url: "https://cdn/profiles/face.png",
    filename: "face.png",
    contentType: "image/png",
    size: 100,
  };

  async function renderWithFace() {
    mockListMediaAssets.mockResolvedValue([FACE]);
    const view = renderHook(() =>
      useImageInsert({ open: true, initialPhase: "library" }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    act(() => view.result.current.selectAsset(FACE.key));
    return view;
  }

  it("renames the anchored file under whichever folder it lives in", async () => {
    vi.useFakeTimers();
    try {
      mockUpdateMediaFilename.mockResolvedValue({
        ...FACE,
        filename: "Rajat Saxena",
      });
      const { result } = await renderWithFace();

      act(() => result.current.updateFilename("Rajat Saxena"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(mockUpdateMediaFilename).toHaveBeenCalledWith({
        key: FACE.key,
        filename: "Rajat Saxena",
      });
      expect(result.current.filenameText).toBe("Rajat Saxena");
      expect(result.current.error).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("says so when a rename is refused, rather than failing quietly", async () => {
    vi.useFakeTimers();
    try {
      mockUpdateMediaFilename.mockRejectedValue(new Error("Invalid media key"));
      const { result } = await renderWithFace();

      act(() => result.current.updateFilename("Rajat Saxena"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(result.current.error).toBe("Invalid media key");
    } finally {
      vi.useRealTimers();
    }
  });

  it("says so when a description is refused too", async () => {
    vi.useFakeTimers();
    try {
      mockUpdateMediaAlt.mockRejectedValue(new Error("Invalid media key"));
      const { result } = await renderWithFace();

      act(() => result.current.updateAltText("A face"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(result.current.error).toBe("Invalid media key");
    } finally {
      vi.useRealTimers();
    }
  });
});
