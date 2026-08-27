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

  it("claims the CSS anchor only while open, so two pickers can never share it", () => {
    render(<Host />);
    // `anchor-name` is newer than the DOM typings, so it is read off the
    // declaration by name rather than as a property.
    const anchorName = () => swatch().style.getPropertyValue("anchor-name");
    expect(anchorName()).toBe("");
    fireEvent.click(swatch());
    expect(anchorName()).toBe("--color-picker");
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
