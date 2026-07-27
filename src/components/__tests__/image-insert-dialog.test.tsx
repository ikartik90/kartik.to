// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ImageInsertDialog } from "../image-insert-dialog";

const mockDeleteSelectedAsset = vi.fn();
const mockUpdateFilename = vi.fn();

vi.mock("@/hooks/use-image-insert", () => ({
  useImageInsert: () => ({
    phase: "library",
    assets: [
      {
        key: "media/a.png",
        url: "https://cdn/a.png",
        filename: "a.png",
        contentType: "image/png",
        size: 100,
      },
    ],
    hasLibraryImages: true,
    selectedKey: "media/a.png",
    selectedAsset: {
      key: "media/a.png",
      url: "https://cdn/a.png",
      filename: "a.png",
      contentType: "image/png",
      size: 100,
    },
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
    selectAsset: vi.fn(),
    updateAltText: vi.fn(),
    updateFilename: mockUpdateFilename,
    deleteSelectedAsset: mockDeleteSelectedAsset,
    getInsertPayload: vi.fn(),
  }),
}));

beforeEach(() => {
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
