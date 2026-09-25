import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColorSwatchGrid } from "../color-swatch-grid";

afterEach(() => cleanup());

const noop = () => {};

function renderGrid(props: Partial<Parameters<typeof ColorSwatchGrid>[0]> = {}) {
  return render(
    <ColorSwatchGrid
      ariaLabel="Ramp"
      capacity={10}
      values={["#FFAB6FFF", "#FF4D97FF"]}
      onValueChange={noop}
      {...props}
    />,
  );
}

describe("ColorSwatchGrid", () => {
  it("draws one cell per unit of capacity, whatever the ramp holds", () => {
    renderGrid();
    expect(screen.getAllByRole("button")).toHaveLength(10);
  });

  it("names a filled cell by its position in the ramp", () => {
    renderGrid();
    expect(screen.getByRole("button", { name: "Colour 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Colour 2" })).toBeTruthy();
  });

  it("offers to add on every empty cell", () => {
    renderGrid({ onAdd: noop });
    expect(screen.getAllByRole("button", { name: "Add a colour" })).toHaveLength(
      8,
    );

    const inert = screen
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("disabled"));
    expect(inert).toHaveLength(0);
  });

  it("appends through onAdd", async () => {
    const onAdd = vi.fn();
    renderGrid({ onAdd });
    const cells = screen.getAllByRole("button", { name: "Add a colour" });
    await userEvent.click(cells[0]);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("appends once from any empty cell, not into the cell pressed", async () => {
    const onAdd = vi.fn();
    renderGrid({ onAdd });
    const cells = screen.getAllByRole("button", { name: "Add a colour" });
    await userEvent.click(cells.at(-1)!);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("opens the picker on the colour an empty cell just added", async () => {
    function Harness() {
      const [values, setValues] = useState(["#FFAB6FFF", "#FF4D97FF"]);
      return (
        <ColorSwatchGrid
          ariaLabel="Ramp"
          capacity={10}
          values={values}
          onValueChange={noop}
          onAdd={() => setValues((v) => [...v, "#00FF00FF"])}
        />
      );
    }
    render(<Harness />);
    const blanks = screen.getAllByRole("button", { name: "Add a colour" });
    await userEvent.click(blanks.at(-1)!);

    expect(screen.getByRole("dialog", { name: "Color picker" })).toBeTruthy();
    expect(screen.getByDisplayValue("00FF00")).toBeTruthy();
  });

  it("offers no add once the ramp is full", () => {
    renderGrid({ capacity: 2, onAdd: noop });
    expect(screen.queryByRole("button", { name: "Add a colour" })).toBeNull();
  });

  it("opens the picker on the colour that was pressed", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Colour 2" }));

    const picker = screen.getByRole("dialog", { name: "Color picker" });
    expect(picker).toBeTruthy();
    expect(screen.getByDisplayValue("FF4D97")).toBeTruthy();
  });

  it("reports an edit against the index that was opened", async () => {
    const onValueChange = vi.fn();
    renderGrid({ onValueChange });
    await userEvent.click(screen.getByRole("button", { name: "Colour 1" }));
    await userEvent.clear(screen.getByDisplayValue("FFAB6F"));
    await userEvent.type(screen.getByLabelText(/hex/i), "00FF00");

    expect(onValueChange).toHaveBeenCalled();
    expect(onValueChange.mock.calls.at(-1)?.[0]).toBe(0);
  });

  it("offers removal in the picker, except on the last colour", async () => {
    const onRemove = vi.fn();
    const { unmount } = renderGrid({ onRemove });
    await userEvent.click(screen.getByRole("button", { name: "Colour 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove colour" }));
    expect(onRemove).toHaveBeenCalledWith(1);

    unmount();
    cleanup();
    renderGrid({ values: ["#FFAB6FFF"], onRemove });
    await userEvent.click(screen.getByRole("button", { name: "Colour 1" }));
    expect(screen.queryByRole("button", { name: "Remove colour" })).toBeNull();
  });

  it("closes the picker once the colour it was editing is gone", async () => {
    const onRemove = vi.fn();
    renderGrid({ onRemove });
    await userEvent.click(screen.getByRole("button", { name: "Colour 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove colour" }));
    expect(screen.queryByRole("dialog", { name: "Color picker" })).toBeNull();
  });
});

describe("ColorSwatchGrid, single cell", () => {
  it("names its one swatch after the row rather than by position", () => {
    renderGrid({ capacity: 1, values: ["#FFFFFFFF"], ariaLabel: "Edge colour" });
    expect(screen.getByRole("button", { name: "Edge colour" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Colour 1" })).toBeNull();
  });
});
