import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Curve } from "../fade";
import { CurveEditor } from "../curve-editor";

afterEach(cleanup);

function setup(curve: Curve = [0.22, 1, 0.36, 1]) {
  const onCurveChange = vi.fn();
  render(<CurveEditor curve={curve} onCurveChange={onCurveChange} />);
  return { user: userEvent.setup(), onCurveChange };
}

describe("a curve editor", () => {
  it("names each control point by where it sits, and shows the curve's numbers", () => {
    setup();
    expect(screen.getByRole("button", { name: "First control point: x 0.22, y 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Second control point: x 0.36, y 1" })).toBeTruthy();
    expect(screen.getByText("0.22, 1, 0.36, 1")).toBeTruthy();
  });

  it("moves a control point by 0.01 with the arrow keys, and by 0.1 with Shift, within 0 to 1", async () => {
    const { user, onCurveChange } = setup();
    screen.getByRole("button", { name: /First control point/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onCurveChange).toHaveBeenLastCalledWith([0.23, 1, 0.36, 1]);
    await user.keyboard("{ArrowUp}");
    expect(onCurveChange).toHaveBeenLastCalledWith([0.22, 1, 0.36, 1]);
    screen.getByRole("button", { name: /Second control point/ }).focus();
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(onCurveChange).toHaveBeenLastCalledWith([0.22, 1, 0.36, 0.9]);
  });
});
