// @vitest-environment jsdom
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { markSyntheticPointer } from "@/utils/synthetic-pointer";
import {
  getInputModality,
  getPointerPosition,
  resetInputModality,
} from "../use-input-modality";

beforeEach(resetInputModality);

describe("input modality", () => {
  it("starts on pointer, so hover behaves normally before any input", () => {
    expect(getInputModality()).toBe("pointer");
  });

  it("switches to keyboard on a keypress", () => {
    fireEvent.keyDown(document, { key: "/" });
    expect(getInputModality()).toBe("keyboard");
  });

  it("switches back to pointer once the pointer actually moves", () => {
    fireEvent.pointerMove(document, { clientX: 10, clientY: 10 });
    fireEvent.keyDown(document, { key: "/" });
    fireEvent.pointerMove(document, { clientX: 11, clientY: 10 });
    expect(getInputModality()).toBe("pointer");
  });

  it("does not treat the first sighting of the pointer as movement", () => {
    fireEvent.keyDown(document, { key: "/" });
    fireEvent.pointerOver(document, { clientX: 200, clientY: 120 });
    expect(getInputModality()).toBe("keyboard");
    expect(getPointerPosition()).toEqual({ x: 200, y: 120 });
  });

  it("ignores a pointer event that did not actually move", () => {
    fireEvent.pointerMove(document, { clientX: 10, clientY: 10 });
    fireEvent.keyDown(document, { key: "ArrowDown" });

    fireEvent.pointerMove(document, { clientX: 10, clientY: 10 });
    expect(getInputModality()).toBe("keyboard");

    fireEvent.pointerOver(document, { clientX: 10, clientY: 10 });
    expect(getInputModality()).toBe("keyboard");
  });

  it("flips on the boundary event, before an enter would be handled", () => {
    fireEvent.pointerMove(document, { clientX: 10, clientY: 10 });
    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.pointerOver(document, { clientX: 40, clientY: 80 });
    expect(getInputModality()).toBe("pointer");
  });

  it("does not let a demo's stand-in cursor claim the pointer", () => {
    fireEvent.pointerMove(document, { clientX: 10, clientY: 10 });
    fireEvent.keyDown(document, { key: "Enter" });

    for (const type of ["pointermove", "pointerdown"]) {
      document.dispatchEvent(
        markSyntheticPointer(
          new MouseEvent(type, { clientX: 400, clientY: 300, bubbles: true }),
        ),
      );
      expect(getInputModality()).toBe("keyboard");
    }
    expect(getPointerPosition()).toEqual({ x: 10, y: 10 });
  });

  it("treats a press as pointer intent even without movement", () => {
    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.pointerDown(document, { clientX: 10, clientY: 10 });
    expect(getInputModality()).toBe("pointer");
  });

  it("does not let a bare modifier key claim the keyboard", () => {
    fireEvent.pointerMove(document, { clientX: 10, clientY: 10 });
    for (const key of ["Shift", "Meta", "Control", "Alt"]) {
      fireEvent.keyDown(document, { key });
      expect(getInputModality()).toBe("pointer");
    }
  });

  it("records the pointer position, for opening a menu under the cursor", () => {
    fireEvent.pointerMove(document, { clientX: 42, clientY: 7 });
    expect(getPointerPosition()).toEqual({ x: 42, y: 7 });
  });

  it("forgets where the pointer is once it leaves the window", () => {
    fireEvent.pointerMove(document, { clientX: 40, clientY: 60 });
    expect(getPointerPosition()).toEqual({ x: 40, y: 60 });

    fireEvent.pointerLeave(document.documentElement);
    expect(getPointerPosition()).toBeNull();
  });

  it("has it back the moment the pointer returns", () => {
    fireEvent.pointerMove(document, { clientX: 40, clientY: 60 });
    fireEvent.pointerLeave(document.documentElement);
    fireEvent.pointerMove(document, { clientX: 12, clientY: 34 });

    expect(getPointerPosition()).toEqual({ x: 12, y: 34 });
  });

  it("ignores a crossing between elements inside the page", () => {
    const inner = document.createElement("div");
    document.body.appendChild(inner);
    fireEvent.pointerMove(document, { clientX: 40, clientY: 60 });

    fireEvent.pointerLeave(inner);

    expect(getPointerPosition()).toEqual({ x: 40, y: 60 });
    inner.remove();
  });

  it("does not change the modality when the pointer leaves", () => {
    fireEvent.pointerMove(document, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(document, { clientX: 20, clientY: 20 });
    expect(getInputModality()).toBe("pointer");

    fireEvent.pointerLeave(document.documentElement);

    expect(getInputModality()).toBe("pointer");
  });

  it("marks the document so CSS can gate :hover on the live modality", () => {
    const attr = () => document.documentElement.getAttribute("data-input-modality");
    fireEvent.pointerMove(document, { clientX: 1, clientY: 1 });
    fireEvent.keyDown(document, { key: "a" });
    expect(attr()).toBe("keyboard");
    fireEvent.pointerMove(document, { clientX: 3, clientY: 3 });
    expect(attr()).toBe("pointer");
  });
});
