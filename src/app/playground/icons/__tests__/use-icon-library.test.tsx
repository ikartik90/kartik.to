// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { iconTitleFrom, type IconAsset } from "@/domain/icon";

const mockListIcons = vi.fn();
const mockCreateIconUploadUrl = vi.fn();
const mockFinalizeIconUpload = vi.fn();
const mockSetIconReview = vi.fn();
const mockDeleteIcon = vi.fn();

/** Both the PUT and the read-back of each listed file go through this. */
const mockFetch = vi.fn();

const mockListHeldIcons = vi.fn();

vi.mock("@/app/actions/icon-set", () => ({
  listIcons: () => mockListIcons(),
  listHeldIcons: () => mockListHeldIcons(),
  createIconUploadUrl: (...args: unknown[]) => mockCreateIconUploadUrl(...args),
  finalizeIconUpload: (...args: unknown[]) => mockFinalizeIconUpload(...args),
  setIconReview: (...args: unknown[]) => mockSetIconReview(...args),
  deleteIcon: (...args: unknown[]) => mockDeleteIcon(...args),
}));

const { useIconLibrary, svgFilesFrom } = await import("../use-icon-library");

const STROKED = `<svg viewBox="0 0 16 16" fill="none"><path d="M2 8H14" stroke="white" stroke-width="1"/></svg>`;
const FLATTENED = `<svg viewBox="0 0 20 20"><path d="M4 10L9 15L16 5L15 4Z" fill="#000"/></svg>`;
const NOT_SQUARE = `<svg viewBox="0 0 32 20" fill="none"><path d="M2 8H14" stroke="white"/></svg>`;

function file(name: string, source: string): File {
  return new File([source], name, { type: "image/svg+xml" });
}

function asset(name: string): IconAsset {
  return {
    key: `icons/${name}`,
    url: `https://cdn.example.com/icons/${name}`,
    name,
    native: 16,
    flattened: false,
    review: "approved",
    title: iconTitleFrom(name),
    aliases: [],
  };
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mockListIcons.mockResolvedValue([]);
  mockCreateIconUploadUrl.mockResolvedValue({
    uploadUrl: "https://upload.example/signed",
    publicUrl: "https://cdn.example.com/icons/minted.svg",
    key: "icons/uuid-minted.svg",
  });
  mockFinalizeIconUpload.mockResolvedValue(asset("minted.svg"));
  mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve(STROKED) });
  vi.stubGlobal("fetch", mockFetch);
});

async function libraryReady() {
  const view = renderHook(() => useIconLibrary());
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}

describe("uploading", () => {
  it("stamps the measurements on after the bytes have landed", async () => {
    const { result } = await libraryReady();

    await act(async () => {
      await result.current.upload([file("dash.svg", STROKED)]);
    });

    expect(mockCreateIconUploadUrl).toHaveBeenCalledWith({
      filename: "dash.svg",
      size: expect.any(Number),
    });
    expect(mockFinalizeIconUpload).toHaveBeenCalledWith({
      key: "icons/uuid-minted.svg",
      native: 16,
      flattened: false,
    });

    const put = mockFetch.mock.calls.find(
      ([url]) => url === "https://upload.example/signed",
    );
    expect(put?.[1]).toMatchObject({ method: "PUT" });
  });

  it("sends the PUT before the stamp, not after it", async () => {
    const order: string[] = [];
    mockFetch.mockImplementation((url: string) => {
      if (url === "https://upload.example/signed") order.push("put");
      return Promise.resolve({ ok: true, text: () => Promise.resolve(STROKED) });
    });
    mockFinalizeIconUpload.mockImplementation(() => {
      order.push("finalize");
      return Promise.resolve(asset("minted.svg"));
    });

    const { result } = await libraryReady();
    await act(async () => {
      await result.current.upload([file("dash.svg", STROKED)]);
    });

    expect(order).toEqual(["put", "finalize"]);
  });

  it("reports a flattened file as flattened, so the server can hold it", async () => {
    const { result } = await libraryReady();

    await act(async () => {
      await result.current.upload([file("solid.svg", FLATTENED)]);
    });

    expect(mockFinalizeIconUpload).toHaveBeenCalledWith(
      expect.objectContaining({ native: 20, flattened: true }),
    );
  });

  it("never stamps an object the PUT did not store", async () => {
    mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve("") });

    const { result } = await libraryReady();
    await act(async () => {
      await result.current.upload([file("dash.svg", STROKED)]);
    });

    expect(mockFinalizeIconUpload).not.toHaveBeenCalled();
    expect(result.current.problem).toMatch(/could not be stored/);
  });

  it("says so when the stamp fails, since the icon will be held without it", async () => {
    mockFinalizeIconUpload.mockRejectedValue(new Error("Unauthorized"));

    const { result } = await libraryReady();
    await act(async () => {
      await result.current.upload([file("dash.svg", STROKED)]);
    });

    expect(result.current.problem).toBe("Unauthorized");
  });

  it("refuses a file the grid could not draw, before signing anything", async () => {
    const { result } = await libraryReady();

    await act(async () => {
      await result.current.upload([file("wide.svg", NOT_SQUARE)]);
    });

    expect(mockCreateIconUploadUrl).not.toHaveBeenCalled();
    expect(result.current.problem).toMatch(/not a square SVG icon/);
  });
});

describe("what counts as an icon file", () => {
  const named = (name: string, type: string) => new File([STROKED], name, { type });

  it("takes an SVG the system typed for us", () => {
    expect(svgFilesFrom([named("check.svg", "image/svg+xml")])).toHaveLength(1);
  });

  it("takes an SVG the system typed as nothing at all", () => {
    expect(svgFilesFrom([named("check.svg", "")])).toHaveLength(1);
  });

  it("does not care how the extension was capitalised", () => {
    expect(svgFilesFrom([named("Check.SVG", "")])).toHaveLength(1);
  });

  it("keeps the icons out of a mixed drop and leaves the rest", () => {
    const kept = svgFilesFrom([
      named("logo.png", "image/png"),
      named("icons", ""),
      named("arrow.svg", "image/svg+xml"),
    ]);
    expect(kept.map((file) => file.name)).toEqual(["arrow.svg"]);
  });
});

describe("a batch that is not all icons", () => {
  it("uploads the icons in it rather than stopping at the first stranger", async () => {
    const { result } = await libraryReady();

    await act(async () => {
      await result.current.upload([
        new File(["x"], "logo.png", { type: "image/png" }),
        file("dash.svg", STROKED),
      ]);
    });

    expect(mockCreateIconUploadUrl).toHaveBeenCalledTimes(1);
    expect(mockCreateIconUploadUrl).toHaveBeenCalledWith({
      filename: "dash.svg",
      size: expect.any(Number),
    });
  });

  it("says what it left behind, by name", async () => {
    const { result } = await libraryReady();

    await act(async () => {
      await result.current.upload([
        new File(["x"], "logo.png", { type: "image/png" }),
        file("dash.svg", STROKED),
      ]);
    });

    expect(result.current.problem).toBe("logo.png is not an SVG");
  });

  it("counts them when there are several, rather than listing a folder", async () => {
    const { result } = await libraryReady();

    await act(async () => {
      await result.current.upload([
        new File(["x"], "logo.png", { type: "image/png" }),
        new File(["x"], "mark.jpg", { type: "image/jpeg" }),
        new File(["x"], "seal.gif", { type: "image/gif" }),
      ]);
    });

    expect(result.current.problem).toBe("logo.png and 2 more are not SVGs");
    expect(mockCreateIconUploadUrl).not.toHaveBeenCalled();
  });

  it("lets a real failure have the last word", async () => {
    mockCreateIconUploadUrl.mockRejectedValue(new Error("Not signed in"));
    const { result } = await libraryReady();

    await act(async () => {
      await result.current.upload([
        new File(["x"], "logo.png", { type: "image/png" }),
        file("dash.svg", STROKED),
      ]);
    });

    expect(result.current.problem).toBe("Not signed in");
  });
});


describe("the set the page arrived with", () => {
  const prerendered = (name: string) => ({
    icon: asset(name),
    svg: { viewBox: 16, flattened: false, nodes: [{ tag: "path", attrs: { d: "M2 8H14" }, children: [] }] },
  });

  beforeEach(() => {
    mockListHeldIcons.mockResolvedValue([]);
  });

  it("opens drawable, with nothing to wait for", async () => {
    const { result } = renderHook(() => useIconLibrary([prerendered("dash.svg")]));

    expect(result.current.loading).toBe(false);
    expect(result.current.preloading).toBe(false);
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].svg).toMatchObject({ viewBox: 16 });
  });

  it("asks the bucket for nothing at all", async () => {
    renderHook(() => useIconLibrary([prerendered("dash.svg"), prerendered("plus.svg")]));
    await waitFor(() => expect(mockListHeldIcons).toHaveBeenCalled());

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockListIcons).not.toHaveBeenCalled();
  });

  it("adds the author's held icons to what the HTML carried", async () => {
    mockListHeldIcons.mockResolvedValue([asset("draft.svg")]);
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve(STROKED) });

    const { result } = renderHook(() => useIconLibrary([prerendered("dash.svg")]));

    await waitFor(() => expect(result.current.entries).toHaveLength(2));
    expect(result.current.entries.map((entry) => entry.icon.name).sort()).toEqual([
      "dash.svg",
      "draft.svg",
    ]);
  });

  it("says nothing when a visitor is refused the held slice", async () => {
    mockListHeldIcons.mockRejectedValue(new Error("Unauthorized"));

    const { result } = renderHook(() => useIconLibrary([prerendered("dash.svg")]));

    await waitFor(() => expect(mockListHeldIcons).toHaveBeenCalled());
    expect(result.current.problem).toBeNull();
    expect(result.current.entries).toHaveLength(1);
  });

  it("still reads the set itself when the page sent none", async () => {
    mockListIcons.mockResolvedValue([asset("dash.svg")]);
    const { result } = await libraryReady();

    expect(mockListIcons).toHaveBeenCalled();
    expect(result.current.entries).toHaveLength(1);
  });
});
