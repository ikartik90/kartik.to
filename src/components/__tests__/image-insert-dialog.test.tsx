// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ImageInsertDialog } from "../image-insert-dialog";

const mockDeleteSelectedAsset = vi.fn();
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

/** Per-test overrides merged over the default hook shape. */
let hookState: Record<string, unknown> = {};
/** What the dialog asked the hook for — how the selection mode is threaded. */
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
    isDragOver: false,
    setIsDragOver: vi.fn(),
    error: null,
    isBusy: false,
    processFile: vi.fn(),
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
  HTMLDialogElement.prototype.close = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.removeAttribute("open");
  });
});

afterEach(() => cleanup());

describe("ImageInsertDialog", () => {
  it("renders library delete action when open", async () => {
    const user = userEvent.setup();

    render(
      <ImageInsertDialog
        open
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Insert Image" })).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Delete image" }));
    expect(mockDeleteSelectedAsset).toHaveBeenCalledOnce();
  });

  it("shows the file's own name in an editable field", async () => {
    const user = userEvent.setup();
    render(<ImageInsertDialog open onClose={vi.fn()} onInsert={vi.fn()} />);

    const field = screen.getByRole("textbox", { name: "File name" });
    // The original upload name, not the uuid-stamped storage key.
    expect((field as HTMLInputElement).value).toBe("favicon.png");

    // Clicking straight into the name lets you edit it, like the alt field.
    // (The hook is mocked, so the controlled value stays put — what matters is
    // that the edit is reported.)
    await user.type(field, "X");
    expect(mockUpdateFilename).toHaveBeenCalledWith("favicon.pngX");
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

    expect(screen.getByRole("dialog", { name: "Change Image" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Change Image" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Change Image" })).toBeDefined();
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

  it("titles itself for the plural", () => {
    renderMultiple();
    expect(screen.getByRole("heading", { name: "Insert Images" })).toBeDefined();
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

  it("counts the selection and pluralizes the confirm button", () => {
    hookState = {
      assets: [asset("a"), asset("b")],
      selectedKeys: ["media/a.png", "media/b.png"],
    };
    renderMultiple();
    expect(screen.getByText("2 of 6 selected")).toBeDefined();
    expect(screen.getByRole("button", { name: "Insert 2 Images" })).toBeDefined();
  });

  it("uses the singular for one image", () => {
    hookState = { selectedKeys: ["media/a.png"] };
    renderMultiple();
    expect(screen.getByRole("button", { name: "Insert 1 Image" })).toBeDefined();
  });

  it("refuses to confirm an empty selection", () => {
    renderMultiple();
    const confirm = screen.getByRole("button", { name: /^Insert \d+ Image/ });
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

    await user.click(screen.getByRole("button", { name: "Insert 2 Images" }));
    expect(onInsert).toHaveBeenCalledWith([
      { src: "https://cdn/b.png" },
      { src: "https://cdn/a.png" },
    ]);
  });
});
