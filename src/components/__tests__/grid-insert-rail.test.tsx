// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GridInsertRail } from "../grid-insert-rail";

describe("GridInsertRail", () => {
  afterEach(cleanup);

  // The name has to say WHERE, not just "add": a grid in edit mode puts one of
  // these on both sides of every card, so a screen reader hearing "Add" a dozen
  // times over has been told nothing.
  it("names the insertion point it opens", () => {
    render(
      <GridInsertRail side="before" label="Add before Palette" onInsert={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Add before Palette" })).toBeTruthy();
  });

  it("reports which edge it sits on, which is what places it", () => {
    const { container, rerender } = render(
      <GridInsertRail side="before" label="a" onInsert={vi.fn()} />,
    );
    expect(container.firstElementChild?.getAttribute("data-side")).toBe("before");

    rerender(<GridInsertRail side="after" label="a" onInsert={vi.fn()} />);
    expect(container.firstElementChild?.getAttribute("data-side")).toBe("after");
  });

  it("calls back when the insertion point is taken", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    render(<GridInsertRail side="after" label="Add after Palette" onInsert={onInsert} />);
    await user.click(screen.getByRole("button", { name: "Add after Palette" }));
    expect(onInsert).toHaveBeenCalledOnce();
  });

  // The lines are decoration either side of the button. A screen reader that
  // announced them would be reading out the gap between two cards.
  it("keeps its rules out of the accessibility tree", () => {
    const { container } = render(
      <GridInsertRail side="before" label="a" onInsert={vi.fn()} />,
    );
    const rules = container.querySelectorAll("[aria-hidden='true']");
    expect(rules.length).toBe(2);
  });
});
