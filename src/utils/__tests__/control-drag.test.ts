import { describe, it, expect, afterEach } from "vitest";
import {
  CONTROL_DRAG_ATTR,
  beginControlDrag,
  endControlDrag,
} from "../control-drag";

const dragging = () => document.documentElement.hasAttribute(CONTROL_DRAG_ATTR);

afterEach(() => {
  // Module state outlives a test; release every id.
  for (let id = 0; id < 8; id++) endControlDrag(id);
});

describe("control-drag", () => {
  it("marks the document while a drag is running", () => {
    expect(dragging()).toBe(false);
    beginControlDrag(1);
    expect(dragging()).toBe(true);
    endControlDrag(1);
    expect(dragging()).toBe(false);
  });

  it("holds the mark until the LAST pointer lets go", () => {
    beginControlDrag(1);
    beginControlDrag(2);
    endControlDrag(1);
    expect(dragging()).toBe(true);
    endControlDrag(2);
    expect(dragging()).toBe(false);
  });

  it("ignores an id it never took", () => {
    beginControlDrag(1);
    endControlDrag(99);
    expect(dragging()).toBe(true);
  });

  it("takes the same id once", () => {
    beginControlDrag(1);
    beginControlDrag(1);
    endControlDrag(1);
    expect(dragging()).toBe(false);
  });
});
