import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { ColorInput } from "../color-input";
import { Field } from "../field";

afterEach(cleanup);

function Host({ initial = "#FF0000FF" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <Field size="sm">
      <Field.Label>Colour 1</Field.Label>
      <ColorInput value={value} onValueChange={setValue} />
    </Field>
  );
}

const swatch = () => screen.getByRole("button", { name: /edit colour/i });

describe("the swatch as a trigger", () => {
  it("opens the picker and says so", () => {
    render(<Host />);
    expect(swatch().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(swatch());
    expect(swatch().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("dialog", { name: /color picker/i })).toBeTruthy();
  });

  it("closes on a second press rather than reopening under itself", () => {
    render(<Host />);
    fireEvent.click(swatch());
    fireEvent.pointerDown(swatch());
    fireEvent.click(swatch());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // The picker used to take its vertical position from `anchor(top)` against
  // this swatch, which TRACKED it: scrolling the properties rail dragged the
  // panel along with the row. It now opens where the swatch was and holds
  // there, so the position is a number read once rather than a live anchor.
  it("pins itself where the swatch stood when it opened", () => {
    render(<Host />);
    // jsdom measures everything at zero, so the assertion is about WHERE the
    // number comes from, not what it is: a `top` written inline at all means
    // the panel is no longer following anything.
    vi.spyOn(
      HTMLButtonElement.prototype,
      "getBoundingClientRect",
    ).mockReturnValue({ ...new DOMRect(), top: 240 } as DOMRect);

    fireEvent.click(swatch());
    expect(screen.getByRole("dialog").style.top).toBe("240px");
    // And the swatch claims no anchor of its own any more, so two pickers in
    // one rail cannot collide over the name.
    expect(swatch().style.getPropertyValue("anchor-name")).toBe("");
  });

  it("hands focus to the picker, which is otherwise outside the tab order", () => {
    render(<Host />);
    fireEvent.click(swatch());
    expect(document.activeElement).toBe(
      screen.getByRole("slider", { name: /saturation and brightness/i }),
    );
  });

  it("gives focus back to the swatch when the picker closes", () => {
    render(<Host />);
    fireEvent.click(swatch());
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(swatch());
  });

  it("stays open while its own format menu is used — that menu portals outside it", () => {
    render(<Host />);
    fireEvent.click(swatch());
    const format = screen.getByRole("button", { name: /colour format/i });

    fireEvent.pointerDown(format);
    fireEvent.click(format);
    const option = screen.getByRole("option", { name: "RGB" });

    // The press that picks the option lands OUTSIDE the picker's own container.
    fireEvent.pointerDown(option);
    fireEvent.click(option);

    expect(screen.queryByRole("dialog", { name: /color picker/i })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Red" })).toBeTruthy();
  });
});

describe("one value, two ends", () => {
  it("shows an edit made in the picker back in the field", () => {
    render(<Host initial="#FF0000FF" />);
    fireEvent.click(swatch());
    fireEvent.change(screen.getByRole("textbox", { name: "Hex" }), {
      target: { value: "00FF80" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));

    expect(
      (screen.getByRole("textbox", { name: /opacity/i }) as HTMLInputElement)
        .value,
    ).toBe("100");
    const fieldHex = screen.getByLabelText("Colour 1") as HTMLInputElement;
    expect(fieldHex.value).toBe("00FF80");
  });

  it("carries an edit made in the field into the picker", () => {
    render(<Host initial="#FF0000FF" />);
    fireEvent.change(screen.getByLabelText("Colour 1"), {
      target: { value: "0000FF" },
    });
    fireEvent.click(swatch());

    fireEvent.click(screen.getByRole("button", { name: /colour format/i }));
    fireEvent.click(screen.getByRole("option", { name: "HSB" }));
    expect(
      (screen.getByRole("textbox", { name: "Hue, degrees" }) as HTMLInputElement)
        .value,
    ).toBe("240");
  });
});

describe("disabled", () => {
  it("cannot be opened", () => {
    render(
      <Field size="sm">
        <Field.Label>Colour 1</Field.Label>
        <ColorInput value="#FF0000FF" onValueChange={vi.fn()} disabled />
      </Field>,
    );
    expect((swatch() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(swatch());
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
