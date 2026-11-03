import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CheckInsApp } from "../check-ins-app";
import { shiftStart } from "../data";

afterEach(cleanup);

describe("the Activations page's rows", () => {
  function open() {
    const user = userEvent.setup();
    render(<CheckInsApp anchor={shiftStart(new Date())} width={1440} height={900} initialPage="activations" />);
    const rows = () => within(screen.getByRole("table", { name: "Companies" })).getAllByRole("row").slice(1);
    return { user, rows, sheet: () => screen.queryByRole("dialog", { name: "Company settings" }) };
  }

  it("opens a row's sheet when it's pressed, and closes it when the same row is pressed again", async () => {
    const { user, rows, sheet } = open();
    const row = () => rows()[0];
    expect(row().hasAttribute("data-sheet")).toBe(false);
    await user.click(within(row()).getAllByRole("cell")[1]);
    expect(sheet()).not.toBeNull();
    expect(row().hasAttribute("data-sheet")).toBe(true);
    await user.click(within(row()).getAllByRole("cell")[1]);
    expect(sheet()).toBeNull();
    expect(row().hasAttribute("data-sheet")).toBe(false);
  });

  it("moves the sheet to another row when that one is pressed", async () => {
    const { user, rows, sheet } = open();
    await user.click(within(rows()[0]).getAllByRole("cell")[1]);
    await user.click(within(rows()[1]).getAllByRole("cell")[1]);
    expect(sheet()).not.toBeNull();
    expect(rows()[0].hasAttribute("data-sheet")).toBe(false);
    expect(rows()[1].hasAttribute("data-sheet")).toBe(true);
  });
});
