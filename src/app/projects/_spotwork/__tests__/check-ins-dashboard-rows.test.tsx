import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CheckInsApp } from "../check-ins-app";
import { shiftStart } from "../data";

afterEach(cleanup);

describe("the Check-Ins dashboard's rows", () => {
  function open() {
    const user = userEvent.setup();
    render(<CheckInsApp anchor={shiftStart(new Date())} width={1440} height={900} initialPage="dashboard" />);
    const table = () => screen.getByRole("table", { name: "Check-Ins" });
    const body = () => within(table()).getAllByRole("rowgroup").at(-1)!;
    const rows = () => within(body()).getAllByRole("row");
    const names = () => rows().map((row) => row.dataset.worker!);
    const row = (name: string) => rows().find((r) => r.dataset.worker === name)!;
    const box = (name: string) => within(row(name)).getByRole("checkbox", { name });
    const picked = () => rows().filter((r) => within(r).getByRole("checkbox").getAttribute("aria-checked") === "true").map((r) => r.dataset.worker);
    const sheet = () => screen.queryByRole("dialog", { name: /\S/, description: undefined })?.getAttribute("aria-label") ?? null;
    return { user, names, row, box, picked, sheet };
  }

  /** The press on a row's cells a person makes, away from its controls. */
  const pressRow = (user: ReturnType<typeof userEvent.setup>, name: string, row: (name: string) => HTMLElement) =>
    user.click(within(row(name)).getAllByRole("cell")[1]);

  it("picks a row and opens its sheet when it's pressed, and closes the sheet and unpicks it when it's pressed again", async () => {
    const { user, names, row, picked, sheet } = open();
    const [first] = names();
    await pressRow(user, first, row);
    expect(picked()).toEqual([first]);
    expect(sheet()).toBe(first);
    await pressRow(user, first, row);
    expect(picked()).toEqual([]);
    expect(sheet()).toBeNull();
  });

  it("closes the sheet when another row's checkbox is picked, both rows then picked", async () => {
    const { user, names, row, box, picked, sheet } = open();
    const [first, second] = names();
    await pressRow(user, first, row);
    await user.click(box(second));
    expect(sheet()).toBeNull();
    expect(picked()).toEqual([first, second]);
  });

  it("leaves a pressed row alone picked, its sheet open, when several are picked", async () => {
    const { user, names, row, box, picked, sheet } = open();
    const [first, second, third] = names();
    await user.click(box(first));
    await user.click(box(second));
    expect(picked()).toEqual([first, second]);
    await pressRow(user, third, row);
    expect(picked()).toEqual([third]);
    expect(sheet()).toBe(third);
  });

  it("closes the sheet and unpicks its row when that row's own checkbox is unpicked", async () => {
    const { user, names, row, box, picked, sheet } = open();
    const [first] = names();
    await pressRow(user, first, row);
    await user.click(box(first));
    expect(picked()).toEqual([]);
    expect(sheet()).toBeNull();
  });

  it("marks every picked row, the one with its sheet open among them, for the table to fill", async () => {
    const { user, names, row, box } = open();
    const [first, second, third] = names();
    const marked = () => [first, second, third].map((name) => row(name).hasAttribute("data-picked"));
    expect(marked()).toEqual([false, false, false]);
    await user.click(box(first));
    await user.click(box(second));
    expect(marked()).toEqual([true, true, false]);
    await pressRow(user, third, row);
    expect(marked()).toEqual([false, false, true]);
    expect(row(third).hasAttribute("data-sheet")).toBe(true);
  });

  it("leaves its row picked when the sheet is closed", async () => {
    const { user, names, row, picked, sheet } = open();
    const [first] = names();
    await pressRow(user, first, row);
    await user.click(within(screen.getByRole("dialog", { name: first })).getByRole("button", { name: "Close" }));
    expect(sheet()).toBeNull();
    expect(picked()).toEqual([first]);
  });
});
