import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { Field } from "../field";
import { Slider } from "../slider";

// jsdom lays nothing out, so the track has no width to map a pointer onto.
// Give it the drawn geometry — a 140px ruler starting at x=8 (Figma 842:7179) —
// so a clientX means the same thing here as it does in the browser.
const TRACK_LEFT = 8;
const TRACK_WIDTH = 140;

function layoutTrack() {
  const track = screen.getByRole("slider");
  track.getBoundingClientRect = () =>
    ({
      left: TRACK_LEFT,
      right: TRACK_LEFT + TRACK_WIDTH,
      top: 0,
      bottom: 28,
      width: TRACK_WIDTH,
      height: 28,
      x: TRACK_LEFT,
      y: 0,
      toJSON: () => {},
    }) as DOMRect;
  return track;
}

/** clientX of a 0–1 position along the laid-out track. */
const atRatio = (ratio: number) => TRACK_LEFT + ratio * TRACK_WIDTH;

// jsdom implements no pointer capture at all. Model the real contract — capture
// makes hasPointerCapture true until released — because "is this pointer
// captured?" is exactly what the drag handler branches on.
beforeEach(() => {
  const captured = new WeakMap<Element, Set<number>>();
  Element.prototype.setPointerCapture = function (id: number) {
    const ids = captured.get(this) ?? new Set<number>();
    ids.add(id);
    captured.set(this, ids);
  };
  Element.prototype.releasePointerCapture = function (id: number) {
    captured.get(this)?.delete(id);
  };
  Element.prototype.hasPointerCapture = function (id: number) {
    return captured.get(this)?.has(id) ?? false;
  };
});

afterEach(() => cleanup());

describe("Slider", () => {
  it("publishes its range and value on the control", () => {
    render(
      <Field size="sm">
        <Slider min={0} max={100} defaultValue={40} />
      </Field>,
    );
    const track = screen.getByRole("slider");
    expect(track.getAttribute("aria-valuemin")).toBe("0");
    expect(track.getAttribute("aria-valuemax")).toBe("100");
    expect(track.getAttribute("aria-valuenow")).toBe("40");
    expect(track.getAttribute("aria-valuetext")).toBe("40");
    expect(track.getAttribute("aria-orientation")).toBe("horizontal");
  });

  it("associates the field's label and hint, which htmlFor cannot reach", () => {
    render(
      <Field size="sm">
        <Field.Label>Opacity</Field.Label>
        <Slider defaultValue={50} />
        <Field.Hint>Percent of full strength</Field.Hint>
      </Field>,
    );
    const track = screen.getByRole("slider");
    const labelledBy = track.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe("Opacity");
    const describedBy = track.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe(
      "Percent of full strength",
    );
  });

  it("omits aria-describedby when the field has no hint", () => {
    render(
      <Field size="sm">
        <Field.Label>Opacity</Field.Label>
        <Slider defaultValue={50} />
      </Field>,
    );
    expect(screen.getByRole("slider").getAttribute("aria-describedby")).toBeNull();
  });

  it("starts at min when no value is given", () => {
    render(
      <Field size="sm">
        <Slider min={20} max={60} />
      </Field>,
    );
    expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("20");
  });

  it("snaps a defaultValue that is off the step grid", () => {
    render(
      <Field size="sm">
        <Slider min={0} max={100} step={10} defaultValue={43} />
      </Field>,
    );
    expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("40");
  });

  describe("keyboard", () => {
    const setup = (props = {}) => {
      const onValueChange = vi.fn();
      render(
        <Field size="sm">
          <Slider
            min={0}
            max={100}
            step={5}
            defaultValue={50}
            onValueChange={onValueChange}
            {...props}
          />
        </Field>,
      );
      return { track: screen.getByRole("slider"), onValueChange };
    };

    it("moves one step per arrow, in both axes", () => {
      const { track, onValueChange } = setup();
      fireEvent.keyDown(track, { key: "ArrowRight" });
      expect(track.getAttribute("aria-valuenow")).toBe("55");
      fireEvent.keyDown(track, { key: "ArrowDown" });
      expect(track.getAttribute("aria-valuenow")).toBe("50");
      fireEvent.keyDown(track, { key: "ArrowLeft" });
      expect(track.getAttribute("aria-valuenow")).toBe("45");
      fireEvent.keyDown(track, { key: "ArrowUp" });
      expect(track.getAttribute("aria-valuenow")).toBe("50");
      expect(onValueChange.mock.calls.map(([v]) => v)).toEqual([55, 50, 45, 50]);
    });

    it("jumps ten steps on Page keys and to the ends on Home/End", () => {
      const { track } = setup();
      fireEvent.keyDown(track, { key: "PageUp" });
      expect(track.getAttribute("aria-valuenow")).toBe("100");
      fireEvent.keyDown(track, { key: "PageDown" });
      expect(track.getAttribute("aria-valuenow")).toBe("50");
      fireEvent.keyDown(track, { key: "Home" });
      expect(track.getAttribute("aria-valuenow")).toBe("0");
      fireEvent.keyDown(track, { key: "End" });
      expect(track.getAttribute("aria-valuenow")).toBe("100");
    });

    it("clamps at the ends without reporting a change", () => {
      const { track, onValueChange } = setup({ defaultValue: 100 });
      fireEvent.keyDown(track, { key: "ArrowRight" });
      expect(track.getAttribute("aria-valuenow")).toBe("100");
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it("claims the keys it acts on, so the page cannot scroll under the field", () => {
      const { track } = setup();
      const moved = fireEvent.keyDown(track, { key: "ArrowRight" });
      // fireEvent returns false once a handler has called preventDefault.
      expect(moved).toBe(false);
      const ignored = fireEvent.keyDown(track, { key: "a" });
      expect(ignored).toBe(true);
    });
  });

  describe("pointer", () => {
    it("jumps to the value under a click", () => {
      const onValueChange = vi.fn();
      render(
        <Field size="sm">
          <Slider
            min={0}
            max={100}
            step={10}
            defaultValue={0}
            onValueChange={onValueChange}
          />
        </Field>,
      );
      const track = layoutTrack();
      fireEvent.pointerDown(track, { clientX: atRatio(0.75), button: 0 });
      expect(onValueChange).toHaveBeenCalledWith(80);
      expect(track.getAttribute("aria-valuenow")).toBe("80");
    });

    it("tracks a drag, including past the ends", () => {
      render(
        <Field size="sm">
          <Slider min={0} max={100} step={10} defaultValue={0} />
        </Field>,
      );
      const track = layoutTrack();
      fireEvent.pointerDown(track, { clientX: atRatio(0.5), pointerId: 1, button: 0 });
      expect(track.getAttribute("aria-valuenow")).toBe("50");
      fireEvent.pointerMove(track, { clientX: atRatio(0.2), pointerId: 1 });
      expect(track.getAttribute("aria-valuenow")).toBe("20");
      // Dragged well past the left end — the value stops, the handler does not.
      fireEvent.pointerMove(track, { clientX: -400, pointerId: 1 });
      expect(track.getAttribute("aria-valuenow")).toBe("0");
    });

    it("ignores a hover — a move only counts once the pointer is captured", () => {
      render(
        <Field size="sm">
          <Slider min={0} max={100} step={10} defaultValue={0} />
        </Field>,
      );
      const track = layoutTrack();
      fireEvent.pointerMove(track, { clientX: atRatio(0.9), pointerId: 1 });
      expect(track.getAttribute("aria-valuenow")).toBe("0");
    });

    it("ignores a non-primary button", () => {
      render(
        <Field size="sm">
          <Slider min={0} max={100} step={10} defaultValue={0} />
        </Field>,
      );
      const track = layoutTrack();
      fireEvent.pointerDown(track, { clientX: atRatio(0.75), button: 2 });
      expect(track.getAttribute("aria-valuenow")).toBe("0");
    });
  });

  describe("controlled", () => {
    it("reports changes without moving itself", () => {
      const onValueChange = vi.fn();
      render(
        <Field size="sm">
          <Slider value={30} step={10} onValueChange={onValueChange} />
        </Field>,
      );
      const track = screen.getByRole("slider");
      fireEvent.keyDown(track, { key: "ArrowRight" });
      expect(onValueChange).toHaveBeenCalledWith(40);
      expect(track.getAttribute("aria-valuenow")).toBe("30");
    });

    it("holds a value handed to it off the step grid on the grid", () => {
      render(
        <Field size="sm">
          <Slider value={43} step={10} />
        </Field>,
      );
      expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("40");
    });
  });

  describe("disabled", () => {
    it("leaves the tab order and refuses input", () => {
      const onValueChange = vi.fn();
      render(
        <Field size="sm">
          <Slider defaultValue={50} onValueChange={onValueChange} disabled />
        </Field>,
      );
      const track = layoutTrack();
      expect(track.getAttribute("tabindex")).toBe("-1");
      expect(track.getAttribute("aria-disabled")).toBe("true");
      fireEvent.keyDown(track, { key: "ArrowRight" });
      fireEvent.pointerDown(track, { clientX: atRatio(1), button: 0 });
      expect(onValueChange).not.toHaveBeenCalled();
      expect(track.getAttribute("aria-valuenow")).toBe("50");
    });
  });

  describe("marks", () => {
    it("draws the requested number of ticks, spread end to end", () => {
      const { container } = render(
        <Field size="sm">
          <Slider ticks={5} defaultValue={0} />
        </Field>,
      );
      const ticks = [...container.querySelectorAll("[class*='tick']")];
      expect(ticks).toHaveLength(5);
      expect(ticks.map((t) => (t as HTMLElement).style.left)).toEqual([
        "0%",
        "25%",
        "50%",
        "75%",
        "100%",
      ]);
    });

    it("places the thumb at the value's position along the track", () => {
      const { container } = render(
        <Field size="sm">
          <Slider min={0} max={200} step={50} defaultValue={150} />
        </Field>,
      );
      const thumb = container.querySelector<HTMLElement>("[data-slider-thumb]");
      expect(thumb?.style.left).toBe("75%");
    });
  });

  describe("composition", () => {
    it("renders the readout beside the track by default", () => {
      render(
        <Field size="sm">
          <Slider min={0} max={100} step={1} defaultValue={100} />
        </Field>,
      );
      expect(screen.queryByText("100")).not.toBeNull();
    });

    it("lets children replace the default arrangement", () => {
      render(
        <Field size="sm">
          <Slider defaultValue={100}>
            <Slider.Track />
          </Slider>
        </Field>,
      );
      expect(screen.queryByRole("slider")).not.toBeNull();
      expect(screen.queryByText("100")).toBeNull();
    });

    it("refuses to render a part outside a Slider", () => {
      const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() =>
        render(
          <Field size="sm">
            <Field.Frame>
              <Slider.Output />
            </Field.Frame>
          </Field>,
        ),
      ).toThrow(/must be used within <Slider>/);
      quiet.mockRestore();
    });
  });
});
