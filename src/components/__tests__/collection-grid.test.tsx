// @vitest-environment jsdom
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COLLECTION_MAX_ITEMS, type CollectionItem } from "@/domain/nodes";
import { CollectionGrid } from "../collection-grid";

afterEach(() => cleanup());

const items = (...srcs: string[]): CollectionItem[] =>
  srcs.map((src) => ({ src }));

function setup(list: CollectionItem[]) {
  const handlers = {
    onFeature: vi.fn(),
    onEditCaption: vi.fn(),
    onReplace: vi.fn(),
    onRemove: vi.fn(),
    onAddImage: vi.fn(),
  };
  render(<CollectionGrid items={list} {...handlers} />);
  return { ...handlers, user: userEvent.setup() };
}

/** The toolbar belonging to the nth image (0-based). */
const toolbarFor = (index: number) =>
  screen.getByRole("toolbar", { name: `Image ${index + 1} actions` });

describe("CollectionGrid", () => {
  // The cap is shown rather than merely enforced: two images means two filled
  // slots and four empty ones, never a two-cell grid.
  it("always shows every slot, filled or not", () => {
    setup(items("a", "b"));
    expect(screen.getAllByRole("toolbar")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Add Image" })).toHaveLength(
      COLLECTION_MAX_ITEMS - 2,
    );
  });

  it("offers no empty slot once the collection is full", () => {
    setup(items("a", "b", "c", "d", "e", "f"));
    expect(screen.queryByRole("button", { name: "Add Image" })).toBeNull();
  });

  it("opens the picker from an empty slot", async () => {
    const { user, onAddImage } = setup(items("a"));
    await user.click(screen.getAllByRole("button", { name: "Add Image" })[0]);
    expect(onAddImage).toHaveBeenCalledOnce();
  });

  it("features the image whose toolbar was used", async () => {
    const { user, onFeature } = setup(items("a", "b", "c"));
    await user.click(
      within(toolbarFor(2)).getByRole("button", { name: "Feature image" }),
    );
    expect(onFeature).toHaveBeenCalledExactlyOnceWith(2);
  });

  // Index 0 IS the featured image, so its own button reads as already on.
  it("marks only the first slot's feature button as pressed", () => {
    setup(items("a", "b"));
    const pressed = (index: number) =>
      within(toolbarFor(index))
        .getByRole("button", { name: "Feature image" })
        .getAttribute("aria-pressed");
    expect(pressed(0)).toBe("true");
    expect(pressed(1)).toBe("false");
  });

  it("replaces and removes the addressed image", async () => {
    const { user, onReplace, onRemove } = setup(items("a", "b"));
    await user.click(
      within(toolbarFor(1)).getByRole("button", { name: "Replace image" }),
    );
    await user.click(
      within(toolbarFor(1)).getByRole("button", { name: "Remove image" }),
    );
    expect(onReplace).toHaveBeenCalledExactlyOnceWith(1);
    expect(onRemove).toHaveBeenCalledExactlyOnceWith(1);
  });
});

describe("CollectionGrid caption editing", () => {
  async function startEditing(list: CollectionItem[], index: number) {
    const ctx = setup(list);
    await ctx.user.click(
      within(toolbarFor(index)).getByRole("button", {
        name: "Edit image caption",
      }),
    );
    return ctx;
  }

  it("swaps the toolbar's buttons for a caption field", async () => {
    await startEditing(items("a", "b"), 0);
    expect(screen.getByRole("textbox", { name: "Image caption" })).toBeDefined();
    // Only the edited cell loses its buttons; the other toolbar is untouched.
    expect(screen.getAllByRole("toolbar")).toHaveLength(1);
  });

  it("seeds the field with the caption already written", async () => {
    const ctx = setup([{ src: "a", caption: "Existing" }]);
    await ctx.user.click(
      screen.getByRole("button", { name: "Edit image caption" }),
    );
    expect(
      (screen.getByRole("textbox", { name: "Image caption" }) as HTMLInputElement)
        .value,
    ).toBe("Existing");
  });

  it("commits on Enter and closes the field", async () => {
    const { user, onEditCaption } = await startEditing(items("a"), 0);
    await user.type(
      screen.getByRole("textbox", { name: "Image caption" }),
      "A caption{Enter}",
    );
    expect(onEditCaption).toHaveBeenCalledExactlyOnceWith(0, "A caption");
    expect(screen.queryByRole("textbox", { name: "Image caption" })).toBeNull();
  });

  it("stores a cleared caption as nothing at all", async () => {
    const ctx = setup([{ src: "a", caption: "Existing" }]);
    await ctx.user.click(
      screen.getByRole("button", { name: "Edit image caption" }),
    );
    await ctx.user.clear(screen.getByRole("textbox", { name: "Image caption" }));
    await ctx.user.keyboard("{Enter}");
    expect(ctx.onEditCaption).toHaveBeenCalledExactlyOnceWith(0, undefined);
  });

  it("discards the draft on Escape", async () => {
    const { user, onEditCaption } = await startEditing(items("a"), 0);
    await user.type(
      screen.getByRole("textbox", { name: "Image caption" }),
      "Never mind{Escape}",
    );
    expect(onEditCaption).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Image caption" })).toBeNull();
  });

  // Clicking away is a commit, not a cancel — losing typing to a stray click
  // is the worse failure.
  it("commits on blur", async () => {
    const { user, onEditCaption } = await startEditing(items("a"), 0);
    await user.type(
      screen.getByRole("textbox", { name: "Image caption" }),
      "Typed then left",
    );
    await user.tab();
    expect(onEditCaption).toHaveBeenCalledExactlyOnceWith(0, "Typed then left");
  });

  // The editor is pinned to the IMAGE, not the slot: featuring it mid-edit
  // moves it to another cell, and removing it must not strand the field on
  // whatever slides into that slot.
  it("follows its image when the collection is reordered", async () => {
    const list = items("a", "b");
    const { rerender } = render(
      <CollectionGrid
        items={list}
        onFeature={vi.fn()}
        onEditCaption={vi.fn()}
        onReplace={vi.fn()}
        onRemove={vi.fn()}
        onAddImage={vi.fn()}
      />,
    );
    await userEvent.setup().click(
      within(toolbarFor(1)).getByRole("button", { name: "Edit image caption" }),
    );

    rerender(
      <CollectionGrid
        items={items("b", "a")}
        onFeature={vi.fn()}
        onEditCaption={vi.fn()}
        onReplace={vi.fn()}
        onRemove={vi.fn()}
        onAddImage={vi.fn()}
      />,
    );

    // "b" is now slot 0, so slot 1 ("a") keeps its buttons and slot 0 edits.
    expect(screen.getByRole("toolbar", { name: "Image 2 actions" })).toBeDefined();
    expect(screen.queryByRole("toolbar", { name: "Image 1 actions" })).toBeNull();
  });

  it("closes itself when its image is removed", async () => {
    const list = items("a", "b");
    const props = {
      onFeature: vi.fn(),
      onEditCaption: vi.fn(),
      onReplace: vi.fn(),
      onRemove: vi.fn(),
      onAddImage: vi.fn(),
    };
    const { rerender } = render(<CollectionGrid items={list} {...props} />);
    await userEvent.setup().click(
      within(toolbarFor(1)).getByRole("button", { name: "Edit image caption" }),
    );

    rerender(<CollectionGrid items={items("a")} {...props} />);
    expect(screen.queryByRole("textbox", { name: "Image caption" })).toBeNull();
  });
});
