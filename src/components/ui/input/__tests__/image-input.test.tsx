// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { field } from "../../../../../styled-system/recipes";
import { Field } from "../field";
import { ImageInput, type ImageInputProps } from "../image-input";

afterEach(() => cleanup());

/** A library URL — uuid-stamped key and all, as every stored file has. */
const PICTURE =
  "https://cdn.example.com/media/550e8400-e29b-41d4-a716-446655440000-rajat-saxena.png";
const CLIP =
  "https://cdn.example.com/media/550e8400-e29b-41d4-a716-446655440000-demo.mp4";
const DOCUMENT =
  "https://cdn.example.com/media/550e8400-e29b-41d4-a716-446655440000-cv.pdf";

function renderInput(props: Partial<ImageInputProps> = {}) {
  const onPick = vi.fn();
  render(
    // The rail's own wrapper — `PropertiesPanel.Control` is a `Field` with a
    // label, and this control composes into it exactly as ColorInput does.
    <Field size="sm">
      <Field.Label>Image</Field.Label>
      <ImageInput noun="picture" onPick={onPick} {...props} />
    </Field>,
  );
  return onPick;
}

describe("ImageInput", () => {
  it("names the file it holds, not the key it is stored under", () => {
    renderInput({ src: PICTURE });
    expect(screen.getByText("rajat-saxena.png")).toBeDefined();
  });

  it("draws the picture it holds", () => {
    renderInput({ src: PICTURE });
    expect(document.querySelector("img")?.getAttribute("src")).toBe(PICTURE);
  });

  // The field is the big target and the obvious one: you press the thing you
  // want to change.
  it("opens the library from the field itself", async () => {
    const user = userEvent.setup();
    const onPick = renderInput({ src: PICTURE });

    await user.click(screen.getByRole("button", { name: "Change picture" }));
    expect(onPick).toHaveBeenCalledOnce();
  });

  it("opens the library from the replace button beside it", async () => {
    const user = userEvent.setup();
    const onPick = renderInput({ src: PICTURE });

    await user.click(screen.getByRole("button", { name: "Replace picture" }));
    expect(onPick).toHaveBeenCalledOnce();
  });

  // An empty slot has nothing to replace, so the button that would say so is
  // not drawn — the field itself is the whole control, and it asks.
  it("stands alone when the slot is empty, and asks", () => {
    renderInput();

    expect(screen.getByRole("button", { name: "Add picture" })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Replace/ })).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });

  it("takes the noun it was given into both labels", () => {
    renderInput({ src: DOCUMENT, kind: "document", noun: "document" });

    expect(screen.getByRole("button", { name: "Change document" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Replace document" })).toBeDefined();
  });

  // The slot holds whatever the library holds, and a card's cover is routinely
  // a clip. An `<img>` pointed at an mp4 is a broken thumbnail in the one place
  // you look to check which file is in the slot.
  it("draws a clip with a video element, never a broken picture", () => {
    renderInput({ src: CLIP, kind: "video" });

    expect(document.querySelector("video")).not.toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });

  it("draws a clip's still when there is one", () => {
    const poster = "https://cdn.example.com/posters/uuid-demo.jpg";
    renderInput({ src: CLIP, kind: "video", poster });

    expect(document.querySelector("video")?.getAttribute("poster")).toBe(poster);
  });

  // Nothing draws a PDF: the glyph stands in for it, as it does in the insert
  // dialog, and the name below is what says which file this is.
  it("draws no picture for a document, only its name", () => {
    renderInput({ src: DOCUMENT, kind: "document", noun: "document" });

    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("video")).toBeNull();
    expect(screen.getByText("cv.pdf")).toBeDefined();
  });

  it("refuses both controls when disabled", () => {
    renderInput({ src: PICTURE, disabled: true });

    const field = screen.getByRole("button", { name: "Change picture" });
    const replace = screen.getByRole("button", { name: "Replace picture" });
    expect((field as HTMLButtonElement).disabled).toBe(true);
    expect((replace as HTMLButtonElement).disabled).toBe(true);
  });

  // -------------------------------------------------------------------------
  // The name is SET by the field, not by itself. Written as a style of its own
  // it had no typography at all, so it took the page's 16px and stood in a rail
  // of 14px values as a visibly bigger, looser line — and it would not have
  // followed the field's `size` either.
  // -------------------------------------------------------------------------
  it("wears the field's own control typography, at the field's size", () => {
    renderInput({ src: PICTURE });

    const name = screen.getByText("rajat-saxena.png");
    for (const className of field({ size: "sm" }).control.split(" ")) {
      expect(name.className).toContain(className);
    }
  });

  // The same attribute an empty text input is written with, so "Add picture"
  // is the placeholder tone rather than a tone of its own — and shifts with the
  // field when it is engaged, as every other prompt in the family does.
  it("asks in the family's placeholder tone when the slot is empty", () => {
    renderInput();
    expect(screen.getByText("Add picture").hasAttribute("data-placeholder")).toBe(
      true,
    );

    cleanup();
    renderInput({ src: PICTURE });
    expect(
      screen.getByText("rajat-saxena.png").hasAttribute("data-placeholder"),
    ).toBe(false);
  });
});
