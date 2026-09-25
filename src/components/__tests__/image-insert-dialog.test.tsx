// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ImageInsertDialog } from "../image-insert-dialog";

const mockDeleteSelectedAsset = vi.fn();
const mockProcessFiles = vi.fn();
const mockUpdateFilename = vi.fn();
const mockSelectAsset = vi.fn();
const mockToggleAsset = vi.fn();
const mockGetInsertPayload = vi.fn();
const mockGetInsertPayloads = vi.fn();

const asset = (name: string) => ({
  key: `media/${name}.png`,
  url: `https://cdn/${name}.png`,
  filename: `${name}.png`,
  contentType: "image/png",
  size: 100,
});

// Deliberately extensionless: the dialog must go by `contentType`, not the filename.
const videoAsset = (name: string) => ({
  key: `media/8f2c-${name}`,
  url: `https://cdn/8f2c-${name}`,
  filename: `${name}.mp4`,
  contentType: "video/mp4",
  size: 4_000,
});

let hookState: Record<string, unknown> = {};
let hookOptions: { selectionMode?: string; maxSelection?: number } | undefined;

function defaultHook() {
  return {
    phase: "library",
    assets: [asset("a")],
    hasLibraryImages: true,
    selectedKey: "media/a.png",
    selectedKeys: [],
    selectedAsset: asset("a"),
    altText: "",
    filenameText: "favicon.png",
    uploadProgress: 0,
    uploadIndex: 0,
    uploadTotal: 0,
    isDragOver: false,
    setIsDragOver: vi.fn(),
    error: null,
    isBusy: false,
    processFiles: mockProcessFiles,
    openLibrary: vi.fn(),
    goToUpload: vi.fn(),
    selectAsset: mockSelectAsset,
    toggleAsset: mockToggleAsset,
    updateAltText: vi.fn(),
    updateFilename: mockUpdateFilename,
    deleteSelectedAsset: mockDeleteSelectedAsset,
    getInsertPayload: mockGetInsertPayload,
    getInsertPayloads: mockGetInsertPayloads,
  };
}

vi.mock("@/hooks/use-image-insert", () => ({
  useImageInsert: (options: { selectionMode?: string }) => {
    hookOptions = options;
    return { ...defaultHook(), ...hookState };
  },
}));

beforeEach(() => {
  hookState = {};
  hookOptions = undefined;
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

afterEach(() => cleanup());

describe("ImageInsertDialog", () => {
  it("renders library delete action when open", async () => {
    const user = userEvent.setup();

    render(<ImageInsertDialog open onClose={vi.fn()} onInsert={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Insert Media" })).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Delete media" }));
    expect(mockDeleteSelectedAsset).toHaveBeenCalledOnce();
  });

  it("shows the file's own name in an editable field", async () => {
    const user = userEvent.setup();
    render(<ImageInsertDialog open onClose={vi.fn()} onInsert={vi.fn()} />);

    const field = screen.getByRole("textbox", { name: "File name" });
    expect((field as HTMLInputElement).value).toBe("favicon.png");

    // The hook is mocked, so the value stays put; only the reported edit matters.
    await user.type(field, "X");
    expect(mockUpdateFilename).toHaveBeenCalledWith("favicon.pngX");
  });

  it("previews a clip as a <video>, from its content type and not its url", () => {
    hookState = {
      assets: [videoAsset("demo")],
      selectedKey: "media/8f2c-demo",
      selectedAsset: videoAsset("demo"),
    };
    render(<ImageInsertDialog open onClose={vi.fn()} onInsert={vi.fn()} />);

    const clip = document.querySelector("video");
    expect(clip).not.toBeNull();
    expect(clip?.getAttribute("src")).toBe("https://cdn/8f2c-demo");
    expect(document.querySelectorAll("video")).toHaveLength(2);
    expect(document.querySelector("img")).toBeNull();
  });

  it("renders change mode title and confirm label", () => {
    render(
      <ImageInsertDialog
        open
        mode="change"
        initialPhase="library"
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Change Media" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Change Media" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Change Media" })).toBeDefined();
  });
});

describe("ImageInsertDialog (multi-select)", () => {
  function renderMultiple(maxSelection = 6) {
    const onInsert = vi.fn();
    render(
      <ImageInsertDialog
        open
        initialPhase="library"
        selectionMode="multiple"
        maxSelection={maxSelection}
        onClose={vi.fn()}
        onInsert={onInsert}
      />,
    );
    return onInsert;
  }

  it("asks the hook for a capped multiple selection", () => {
    renderMultiple();
    expect(hookOptions?.selectionMode).toBe("multiple");
    expect(hookOptions?.maxSelection).toBe(6);
  });

  it("titles itself for the batch", () => {
    renderMultiple();
    expect(screen.getByRole("heading", { name: "Insert Media" })).toBeDefined();
  });

  it("replaces the selection on a plain click", async () => {
    const user = userEvent.setup();
    renderMultiple();
    await user.click(screen.getByRole("option", { name: "a.png" }));
    expect(mockSelectAsset).toHaveBeenCalledWith("media/a.png");
    expect(mockToggleAsset).not.toHaveBeenCalled();
  });

  it("toggles one image on a shift-click", async () => {
    const user = userEvent.setup();
    renderMultiple();
    await user.keyboard("{Shift>}");
    await user.click(screen.getByRole("option", { name: "a.png" }));
    await user.keyboard("{/Shift}");
    expect(mockToggleAsset).toHaveBeenCalledWith("media/a.png");
    expect(mockSelectAsset).not.toHaveBeenCalled();
  });

  it("paints every selected row, not just the anchor", () => {
    hookState = {
      assets: [asset("a"), asset("b"), asset("c")],
      selectedKeys: ["media/a.png", "media/c.png"],
      selectedKey: "media/b.png",
    };
    renderMultiple();
    const selected = screen
      .getAllByRole("option")
      .filter((el) => el.getAttribute("aria-selected") === "true")
      .map((el) => el.textContent);
    expect(selected).toEqual(["a.png", "c.png"]);
  });

  it("counts the selection on the confirm button", () => {
    hookState = {
      assets: [asset("a"), asset("b")],
      selectedKeys: ["media/a.png", "media/b.png"],
    };
    renderMultiple();
    expect(screen.getByText("2 of 6 selected")).toBeDefined();
    expect(screen.getByRole("button", { name: "Insert 2 Media" })).toBeDefined();
  });

  it("leaves the noun alone for one file", () => {
    hookState = { selectedKeys: ["media/a.png"] };
    renderMultiple();
    expect(screen.getByRole("button", { name: "Insert 1 Media" })).toBeDefined();
  });

  it("refuses to confirm an empty selection", () => {
    renderMultiple();
    const confirm = screen.getByRole("button", { name: /^Insert \d+ Media/ });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("hands onInsert the batch, in selection order", async () => {
    const user = userEvent.setup();
    hookState = { selectedKeys: ["media/b.png", "media/a.png"] };
    mockGetInsertPayloads.mockReturnValue([
      { src: "https://cdn/b.png" },
      { src: "https://cdn/a.png" },
    ]);
    const onInsert = renderMultiple();

    await user.click(screen.getByRole("button", { name: "Insert 2 Media" }));
    expect(onInsert).toHaveBeenCalledWith([
      { src: "https://cdn/b.png" },
      { src: "https://cdn/a.png" },
    ]);
  });
});

describe("ImageInsertDialog (uploading)", () => {
  const file = (name: string) => new File(["x"], name, { type: "image/png" });

  const renderUploading = (state: Record<string, unknown> = {}) => {
    hookState = { phase: "upload", ...state };
    render(<ImageInsertDialog open onClose={vi.fn()} onInsert={vi.fn()} />);
  };

  const dropZone = () =>
    screen.getByText(/Drag and drop/).closest('[role="button"]')!;

  it("lets the file picker take more than one file", () => {
    renderUploading();
    const input = document.querySelector('input[type="file"]');
    expect((input as HTMLInputElement).multiple).toBe(true);
  });

  it("hands the whole drop to the hook, not just the first file", () => {
    renderUploading();

    fireEvent.drop(dropZone(), {
      dataTransfer: { files: [file("a.png"), file("b.png")] },
    });

    expect(mockProcessFiles).toHaveBeenCalledOnce();
    expect(mockProcessFiles.mock.calls[0][0]).toHaveLength(2);
  });

  it("says which file of the batch is on the wire", () => {
    renderUploading({ phase: "uploading", uploadIndex: 2, uploadTotal: 3 });
    expect(screen.getByText("Uploading 2 of 3")).toBeDefined();
  });

  it("counts nothing when there is only one file", () => {
    renderUploading({ phase: "uploading", uploadIndex: 1, uploadTotal: 1 });
    expect(screen.queryByText(/Uploading 1 of/)).toBeNull();
  });
});
