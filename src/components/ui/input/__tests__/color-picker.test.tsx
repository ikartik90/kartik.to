import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { ColorPicker } from "../color-picker";

afterEach(cleanup);

/** The picker is controlled; a host that echoes the value back is the real case. */
function Host({
  initial = "#FF0000FF",
  onValueChange,
}: {
  initial?: string;
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <ColorPicker
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange?.(next);
      }}
    />
  );
}

const channel = (name: string | RegExp) =>
  screen.getByRole("textbox", { name }) as HTMLInputElement;

function pickFormat(label: string) {
  fireEvent.click(screen.getByRole("button", { name: /colour format/i }));
  fireEvent.click(screen.getByRole("option", { name: label }));
}

describe("opening", () => {
  it("never emits a value just for being opened", () => {
    const onValueChange = vi.fn();
    // FFAB6F is deliberately a colour integer HSB cannot name exactly: a
    // picker that seeded its state by round-tripping through HSB and pushed
    // the result back would shift it by a digit before anything was touched.
    render(<Host initial="#FFAB6FFF" onValueChange={onValueChange} />);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(channel("Hex").value).toBe("FFAB6F");
  });

  it("shows hex and opacity by default", () => {
    render(<Host initial="#FFAB6F80" />);
    expect(channel("Hex").value).toBe("FFAB6F");
    expect(channel("Opacity, percent").value).toBe("50");
  });
});

describe("colour format", () => {
  it("switches the fields to the three RGB channels", () => {
    render(<Host initial="#FFAB6FFF" />);
    pickFormat("RGB");
    expect(channel("Red").value).toBe("255");
    expect(channel("Green").value).toBe("171");
    expect(channel("Blue").value).toBe("111");
    expect(screen.queryByRole("textbox", { name: "Hex" })).toBeNull();
  });

  it("switches the fields to hue, saturation and brightness", () => {
    render(<Host initial="#00FF00FF" />);
    pickFormat("HSB");
    expect(channel("Hue, degrees").value).toBe("120");
    expect(channel("Saturation, percent").value).toBe("100");
    expect(channel("Brightness, percent").value).toBe("100");
  });

  it("keeps the opacity field across a format change — it is not one of the channels", () => {
    render(<Host initial="#FF000040" />);
    expect(channel("Opacity, percent").value).toBe("25");
    pickFormat("HSB");
    expect(channel("Opacity, percent").value).toBe("25");
  });
});

describe("typing a channel", () => {
  it("emits the recombined colour from a hex", () => {
    const onValueChange = vi.fn();
    render(<Host onValueChange={onValueChange} />);
    fireEvent.change(channel("Hex"), { target: { value: "00FF80" } });
    expect(onValueChange).toHaveBeenLastCalledWith("#00FF80FF");
  });

  it("emits from an RGB channel, leaving the other two alone", () => {
    const onValueChange = vi.fn();
    render(<Host initial="#FF0000FF" onValueChange={onValueChange} />);
    pickFormat("RGB");
    fireEvent.change(channel("Green"), { target: { value: "128" } });
    expect(onValueChange).toHaveBeenLastCalledWith("#FF8000FF");
  });

  it("emits from an HSB channel", () => {
    const onValueChange = vi.fn();
    render(<Host initial="#FF0000FF" onValueChange={onValueChange} />);
    pickFormat("HSB");
    fireEvent.change(channel("Hue, degrees"), { target: { value: "120" } });
    expect(onValueChange).toHaveBeenLastCalledWith("#00FF00FF");
  });

  it("holds the alpha while a channel is edited", () => {
    const onValueChange = vi.fn();
    render(<Host initial="#FF000080" onValueChange={onValueChange} />);
    fireEvent.change(channel("Hex"), { target: { value: "0000FF" } });
    expect(onValueChange).toHaveBeenLastCalledWith("#0000FF80");
  });

  it("emits the alpha alone from the opacity field", () => {
    const onValueChange = vi.fn();
    render(<Host initial="#FFAB6FFF" onValueChange={onValueChange} />);
    fireEvent.change(channel("Opacity, percent"), { target: { value: "50" } });
    expect(onValueChange).toHaveBeenLastCalledWith("#FFAB6F80");
  });
});

describe("holding the hue", () => {
  // The whole reason the picker keeps its own HSB rather than deriving it from
  // the colour each render: a grey has no hue to read back, so a picker that
  // re-derived would drop the author at 0° the moment they reached black — and
  // dragging back out of the corner would come back RED, whatever they were on.
  it("keeps the hue through a colour that has none", () => {
    render(<Host initial="#00FF00FF" />);
    pickFormat("HSB");
    expect(channel("Hue, degrees").value).toBe("120");

    fireEvent.change(channel("Brightness, percent"), { target: { value: "0" } });
    expect(channel("Hue, degrees").value).toBe("120");

    fireEvent.change(channel("Brightness, percent"), { target: { value: "100" } });
    expect(channel("Hue, degrees").value).toBe("120");
  });

  it("keeps it through a black typed straight into the hex field", () => {
    render(<Host initial="#0000FFFF" />);
    pickFormat("HSB");
    expect(channel("Hue, degrees").value).toBe("240");
    pickFormat("Hex");

    fireEvent.change(channel("Hex"), { target: { value: "000000" } });
    pickFormat("HSB");
    expect(channel("Hue, degrees").value).toBe("240");
  });

  it("takes the hue of a colour that does have one", () => {
    render(<Host initial="#0000FFFF" />);
    fireEvent.change(channel("Hex"), { target: { value: "00FF00" } });
    pickFormat("HSB");
    expect(channel("Hue, degrees").value).toBe("120");
  });
});

describe("the ramps", () => {
  it("moves the hue while holding saturation and brightness", () => {
    // Half-bright, half-saturated red — a colour whose S and B are obvious if
    // the hue ramp tramples them on its way past.
    render(<Host initial="#804040FF" />);
    pickFormat("HSB");
    expect(channel("Saturation, percent").value).toBe("50");
    expect(channel("Brightness, percent").value).toBe("50");

    fireEvent.keyDown(screen.getByRole("slider", { name: /hue/i }), {
      key: "PageUp",
    });

    expect(channel("Hue, degrees").value).toBe("10");
    expect(channel("Saturation, percent").value).toBe("50");
    expect(channel("Brightness, percent").value).toBe("50");
  });

  it("moves the alpha while holding the colour", () => {
    const onValueChange = vi.fn();
    render(<Host initial="#FFAB6FFF" onValueChange={onValueChange} />);
    fireEvent.keyDown(screen.getByRole("slider", { name: /opacity/i }), {
      key: "Home",
    });
    expect(onValueChange).toHaveBeenLastCalledWith("#FFAB6F00");
  });
});

describe("the map", () => {
  it("reads a press as a saturation/brightness coordinate", () => {
    const onValueChange = vi.fn();
    render(<Host initial="#FF0000FF" onValueChange={onValueChange} />);
    const map = screen.getByRole("slider", { name: /saturation and brightness/i });
    // jsdom lays nothing out, so the plane has to be given a size.
    map.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;
    map.setPointerCapture = vi.fn();
    map.hasPointerCapture = vi.fn(() => true);

    // Halfway across, a quarter down: saturation 50, brightness 75.
    fireEvent.pointerDown(map, { button: 0, clientX: 100, clientY: 50 });
    expect(onValueChange).toHaveBeenLastCalledWith("#BF6060FF");
  });

  it("takes the arrow keys, so the plane is reachable without a pointer", () => {
    const onValueChange = vi.fn();
    render(<Host initial="#FF0000FF" onValueChange={onValueChange} />);
    const map = screen.getByRole("slider", { name: /saturation and brightness/i });
    // Full saturation already, so left is the only axis with anywhere to go.
    fireEvent.keyDown(map, { key: "ArrowLeft" });
    expect(onValueChange).toHaveBeenLastCalledWith("#FF0303FF");
  });
});

describe("closing", () => {
  it("fires onClose from the header chip", () => {
    const onClose = vi.fn();
    render(
      <ColorPicker value="#FF0000FF" onValueChange={vi.fn()} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
