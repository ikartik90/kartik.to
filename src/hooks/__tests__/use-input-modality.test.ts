// @vitest-environment jsdom
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
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

  // Cold start: the mouse has been parked, untouched, since the page loaded, so
  // there is no previous position to compare against. The first event we ever
  // see is the one the engine fires BECAUSE a menu just opened under the cursor
  // — it says where the pointer is, not that the user reached for it.
  it("does not treat the first sighting of the pointer as movement", () => {
    fireEvent.keyDown(document, { key: "/" });
    fireEvent.pointerOver(document, { clientX: 200, clientY: 120 });
    expect(getInputModality()).toBe("keyboard");
    expect(getPointerPosition()).toEqual({ x: 200, y: 120 });
  });

  // The whole point of this module. The engine synthesises pointer events at the
  // UNCHANGED position whenever content scrolls or mounts under a stationary
  // pointer — which is exactly what happens when a menu opens under the cursor
  // or scrolls a row into view. Reading one as "the user reached for the mouse"
  // is what lets the cursor hijack a highlight the keyboard is driving.
  it("ignores a pointer event that did not actually move", () => {
    fireEvent.pointerMove(document, { clientX: 10, clientY: 10 });
    fireEvent.keyDown(document, { key: "ArrowDown" });

    fireEvent.pointerMove(document, { clientX: 10, clientY: 10 });
    expect(getInputModality()).toBe("keyboard");

    fireEvent.pointerOver(document, { clientX: 10, clientY: 10 });
    expect(getInputModality()).toBe("keyboard");
  });

  // `pointerover` precedes the `pointerenter` React derives from it, so the flip
  // has to land on the earlier event — otherwise the first row you move onto is
  // still judged under the stale modality and refuses the highlight.
  it("flips on the boundary event, before an enter would be handled", () => {
    fireEvent.pointerMove(document, { clientX: 10, clientY: 10 });
    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.pointerOver(document, { clientX: 40, clientY: 80 });
    expect(getInputModality()).toBe("pointer");
  });

  it("treats a press as pointer intent even without movement", () => {
    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.pointerDown(document, { clientX: 10, clientY: 10 });
    expect(getInputModality()).toBe("pointer");
  });

  // Shift-clicking a range, cmd-clicking to toggle: the modifier is part of a
  // POINTER gesture, and letting it claim keyboard modality would kill the hover
  // the user is aiming with.
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

  it("marks the document so CSS can gate :hover on the live modality", () => {
    const attr = () => document.documentElement.getAttribute("data-input-modality");
    fireEvent.pointerMove(document, { clientX: 1, clientY: 1 });
    fireEvent.keyDown(document, { key: "a" });
    expect(attr()).toBe("keyboard");
    fireEvent.pointerMove(document, { clientX: 3, clientY: 3 });
    expect(attr()).toBe("pointer");
  });
});
