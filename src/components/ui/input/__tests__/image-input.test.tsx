// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { field } from "../../../../../styled-system/recipes";
import { Field } from "../field";
import { ImageInput, type ImageInputProps } from "../image-input";

afterEach(() => cleanup());

const PICTURE =
  "https://cdn.example.com/media/550e8400-e29b-41d4-a716-446655440000-rajat-saxena.png";
const CLIP =
  "https://cdn.example.com/media/550e8400-e29b-41d4-a716-446655440000-demo.mp4";
const DOCUMENT =
  "https://cdn.example.com/media/550e8400-e29b-41d4-a716-446655440000-cv.pdf";

function renderInput(props: Partial<ImageInputProps> = {}) {
  const onPick = vi.fn();
  render(
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

  it("wears the field's own control typography, at the field's size", () => {
    renderInput({ src: PICTURE });

    const name = screen.getByText("rajat-saxena.png");
    for (const className of field({ size: "sm" }).control.split(" ")) {
      expect(name.className).toContain(className);
    }
  });

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

  it("puts the replace chip beside the field, not inside it", () => {
    renderInput({ src: PICTURE });

    const frame = document.querySelector(
      `.${field({ size: "sm" }).frame.split(" ")[0]}`,
    );
    const replace = screen.getByRole("button", { name: "Replace picture" });

    expect(frame).not.toBeNull();
    expect(frame!.contains(replace)).toBe(false);
    expect(replace.parentElement).toBe(frame!.parentElement);
  });
});
