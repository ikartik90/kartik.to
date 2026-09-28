// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CollectionNode } from "@/domain/nodes";
import { CarouselPropertiesPanel } from "../carousel-properties-panel";

afterEach(() => cleanup());

const ITEMS: CollectionNode["items"] = [
  { type: "media", kind: "image", src: "/a.jpg", caption: "First" },
];

function setup(over: Partial<CollectionNode> = {}) {
  const block: CollectionNode = { type: "collection", items: ITEMS, ...over };
  const onChange = vi.fn<(block: CollectionNode) => void>();
  render(
    <CarouselPropertiesPanel
      block={block}
      onChange={onChange}
      onDismiss={vi.fn()}
    />,
  );
  return { onChange, user: userEvent.setup() };
}

const option = (name: string) => screen.getByRole("option", { name });
const selected = (name: string) => option(name).getAttribute("aria-selected");
const toggle = (name: string) => screen.getByRole("switch", { name });
const styles = () => screen.queryByRole("listbox", { name: "Caption style" });

describe("CarouselPropertiesPanel", () => {
  it("is titled for the carousel", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Carousel properties" });
    expect(dialog.textContent).toContain("Carousel properties");
  });

  it("offers the size, the lightbox, then the slides' captions", () => {
    setup();
    const panel = screen.getByRole("dialog");
    const size = within(panel).getByRole("listbox", { name: "Size" });
    expect(
      within(size)
        .getAllByRole("option")
        .map((each) => each.textContent),
    ).toEqual(["Small", "Medium", "Large"]);
    expect(within(panel).getAllByRole("switch")).toHaveLength(2);
    expect(
      toggle("Open slides in lightbox").compareDocumentPosition(
        toggle("Show captions on carousel slides"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  describe("the size", () => {
    it("is medium on a carousel that has none", () => {
      setup();
      expect(selected("Medium")).toBe("true");
    });

    it("shows the size the carousel has", () => {
      setup({ size: "large" });
      expect(selected("Large")).toBe("true");
    });

    it("writes a size", async () => {
      const { user, onChange } = setup();
      await user.click(option("Small"));
      expect(onChange).toHaveBeenLastCalledWith({
        type: "collection",
        items: ITEMS,
        size: "small",
      });
    });

    it("writes medium as no size at all", async () => {
      const { user, onChange } = setup({ size: "large" });
      await user.click(option("Medium"));
      expect(onChange).toHaveBeenLastCalledWith({
        type: "collection",
        items: ITEMS,
      });
    });
  });

  describe("the lightbox", () => {
    it("is on unless the carousel turns it off", () => {
      setup();
      expect(
        toggle("Open slides in lightbox").getAttribute("aria-checked"),
      ).toBe("true");
    });

    it("is off once turned off", () => {
      setup({ lightbox: false });
      expect(
        toggle("Open slides in lightbox").getAttribute("aria-checked"),
      ).toBe("false");
    });

    it("turns off", async () => {
      const { user, onChange } = setup();
      await user.click(toggle("Open slides in lightbox"));
      expect(onChange).toHaveBeenLastCalledWith({
        type: "collection",
        items: ITEMS,
        lightbox: false,
      });
    });

    it("turns back on as no setting at all", async () => {
      const { user, onChange } = setup({ lightbox: false });
      await user.click(toggle("Open slides in lightbox"));
      expect(onChange).toHaveBeenLastCalledWith({
        type: "collection",
        items: ITEMS,
      });
    });
  });

  describe("the slides' captions", () => {
    it("are off unless the carousel shows them", () => {
      setup();
      expect(
        toggle("Show captions on carousel slides").getAttribute("aria-checked"),
      ).toBe("false");
    });

    it("turn on", async () => {
      const { user, onChange } = setup();
      await user.click(toggle("Show captions on carousel slides"));
      expect(onChange).toHaveBeenLastCalledWith({
        type: "collection",
        items: ITEMS,
        showCaptions: true,
      });
    });

    it("turn off as no setting at all, keeping their style for next time", async () => {
      const { user, onChange } = setup({
        showCaptions: true,
        captionStyle: "paragraph",
      });
      await user.click(toggle("Show captions on carousel slides"));
      expect(onChange).toHaveBeenLastCalledWith({
        type: "collection",
        items: ITEMS,
        captionStyle: "paragraph",
      });
    });
  });

  describe("the captions' style", () => {
    it("is offered only while the slides show their captions", () => {
      setup();
      expect(styles()).toBeNull();
    });

    it("offers caption, paragraph and subheading beneath the captions' switch", () => {
      setup({ showCaptions: true });
      expect(
        within(styles()!)
          .getAllByRole("option")
          .map((each) => each.getAttribute("aria-label")),
      ).toEqual(["Caption", "Paragraph", "Subheading"]);
      expect(
        toggle("Show captions on carousel slides").compareDocumentPosition(
          styles()!,
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("is named by a visible label", () => {
      setup({ showCaptions: true });
      const labelId = styles()!.getAttribute("aria-labelledby")!;
      expect(document.getElementById(labelId)!.textContent).toBe(
        "Caption style",
      );
      expect(styles()!.hasAttribute("aria-label")).toBe(false);
    });

    it("shows the carousel's style", () => {
      setup({ showCaptions: true, captionStyle: "subheading" });
      expect(selected("Subheading")).toBe("true");
    });

    it("writes a style for every slide at once", async () => {
      const { user, onChange } = setup({ showCaptions: true });
      await user.click(option("Paragraph"));
      expect(onChange).toHaveBeenLastCalledWith({
        type: "collection",
        items: ITEMS,
        showCaptions: true,
        captionStyle: "paragraph",
      });
    });

    it("writes the plain caption as no style at all", async () => {
      const { user, onChange } = setup({
        showCaptions: true,
        captionStyle: "paragraph",
      });
      await user.click(option("Caption"));
      expect(onChange).toHaveBeenLastCalledWith({
        type: "collection",
        items: ITEMS,
        showCaptions: true,
      });
    });
  });
});
