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

  // The ramp is DENSE — a colour lands in the first gap, never in the seventh —
  // so exactly one cell may offer to add, and the rest must not look like they
  // could take one.
  it("offers to add on the first empty cell and on no other", () => {
    renderGrid({ onAdd: noop });
    expect(screen.getByRole("button", { name: "Add a colour" })).toBeTruthy();

    const inert = screen
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("disabled"));
    // Ten cells, two filled, one addable — the other seven take nothing.
    expect(inert).toHaveLength(7);
  });

  it("appends through onAdd", async () => {
    const onAdd = vi.fn();
    renderGrid({ onAdd });
    await userEvent.click(screen.getByRole("button", { name: "Add a colour" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  // A full ramp has nowhere to put another colour, so the affordance goes
  // rather than becoming a button that declines.
  it("offers no add once the ramp is full", () => {
    renderGrid({ capacity: 2, onAdd: noop });
    expect(screen.queryByRole("button", { name: "Add a colour" })).toBeNull();
  });

  it("opens the picker on the colour that was pressed", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Colour 2" }));

    const picker = screen.getByRole("dialog", { name: "Color picker" });
    expect(picker).toBeTruthy();
    // The hex box reads the colour of the cell that opened it, not the first.
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

  // Removal moved into the picker when the count slider went; the last colour
  // is the floor the schema already enforces, so the control must not offer it.
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

// A panel holds several of these, and a one-cell grid sitting under a section
// called Edge must not announce a second "Colour 1" for the ramp's first stop.
describe("ColorSwatchGrid, single cell", () => {
  it("names its one swatch after the row rather than by position", () => {
    renderGrid({ capacity: 1, values: ["#FFFFFFFF"], ariaLabel: "Edge colour" });
    expect(screen.getByRole("button", { name: "Edge colour" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Colour 1" })).toBeNull();
  });
});
