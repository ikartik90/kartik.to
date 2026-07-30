import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Field } from "../field";
import { Checkbox } from "../checkbox";

afterEach(cleanup);

describe("Checkbox", () => {
  it("exposes checkbox role, takes its Field.Label as the accessible name, and is off by default", () => {
    render(
      <Field>
        <Checkbox />
        <Field.Label>Remember me</Field.Label>
      </Field>,
    );
    const box = screen.getByRole("checkbox", { name: "Remember me" });
    expect(box.getAttribute("aria-checked")).toBe("false");
  });

  it("toggles aria-checked and reports each change when uncontrolled", () => {
    const onCheckedChange = vi.fn();
    render(
      <Field>
        <Checkbox onCheckedChange={onCheckedChange} />
        <Field.Label>Remember me</Field.Label>
      </Field>,
    );
    const box = screen.getByRole("checkbox");

    fireEvent.click(box);
    expect(box.getAttribute("aria-checked")).toBe("true");
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(box);
    expect(box.getAttribute("aria-checked")).toBe("false");
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it("honors defaultChecked", () => {
    render(
      <Field>
        <Checkbox defaultChecked />
        <Field.Label>Remember me</Field.Label>
      </Field>,
    );
    expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("is controlled by `checked` — a click reports intent but never self-updates", () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(
      <Field>
        <Checkbox checked={false} onCheckedChange={onCheckedChange} />
        <Field.Label>Remember me</Field.Label>
      </Field>,
    );
    const box = screen.getByRole("checkbox");

    fireEvent.click(box);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(box.getAttribute("aria-checked")).toBe("false"); // parent still owns state

    rerender(
      <Field>
        <Checkbox checked onCheckedChange={onCheckedChange} />
        <Field.Label>Remember me</Field.Label>
      </Field>,
    );
    expect(box.getAttribute("aria-checked")).toBe("true");
  });

  it("links a Field.Hint through aria-describedby, and omits it when there is none", () => {
    const { rerender } = render(
      <Field>
        <Checkbox />
        <Field.Label>Remember me</Field.Label>
        <Field.Hint>Stay signed in on this device</Field.Hint>
      </Field>,
    );
    const box = screen.getByRole("checkbox");
    const id = box.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)?.textContent).toBe(
      "Stay signed in on this device",
    );

    rerender(
      <Field>
        <Checkbox />
        <Field.Label>Remember me</Field.Label>
      </Field>,
    );
    expect(box.getAttribute("aria-describedby")).toBeNull();
  });

  it("throws when rendered outside <Field>", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Checkbox />)).toThrow(/must be used within <Field>/);
    spy.mockRestore();
  });
});
