// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { iconTitleFrom, type IconAsset } from "@/domain/icon";

// The bucket's two doors, mocked: one signs a PUT, the other stamps what
// landed. The upload is the whole point of this file, because an upload is
// TWO calls with a direct-to-R2 PUT between them and nothing in the page
// notices if the second one is missing — which is exactly how every icon in
// the set came to be marked for review.
const mockListIcons = vi.fn();
const mockCreateIconUploadUrl = vi.fn();
const mockFinalizeIconUpload = vi.fn();
const mockSetIconReview = vi.fn();
const mockDeleteIcon = vi.fn();

/** Both the PUT and the read-back of each listed file go through this. */
const mockFetch = vi.fn();

vi.mock("@/app/actions/icon-set", () => ({
  listIcons: () => mockListIcons(),
  createIconUploadUrl: (...args: unknown[]) => mockCreateIconUploadUrl(...args),
  finalizeIconUpload: (...args: unknown[]) => mockFinalizeIconUpload(...args),
  setIconReview: (...args: unknown[]) => mockSetIconReview(...args),
  deleteIcon: (...args: unknown[]) => mockDeleteIcon(...args),
}));

const { useIconLibrary } = await import("../use-icon-library");

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
    // The order is the fix. A presigned PUT cannot carry `x-amz-meta-*` to R2
    // — they are hoisted into the query string and dropped without an error —
    // so what the file measures as is sent once the object exists.
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
