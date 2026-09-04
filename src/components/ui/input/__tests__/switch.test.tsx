import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Field } from "../field";
import { Switch } from "../switch";

afterEach(cleanup);

describe("Switch", () => {
  it("exposes switch role, takes its Field.Label as the accessible name, and is off by default", () => {
    render(
      <Field>
        <Switch />
        <Field.Label>Wi-Fi</Field.Label>
      </Field>,
    );
    const sw = screen.getByRole("switch", { name: "Wi-Fi" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
  });

  // See Button: WebKit's default tab order skips a bare <button>, so every
  // control drawn as one states its own place in it.
  it("states its own place in the tab order", () => {
    render(
      <Field>
        <Switch />
        <Field.Label>Wi-Fi</Field.Label>
      </Field>,
    );
    expect(
      screen.getByRole("switch", { name: "Wi-Fi" }).getAttribute("tabindex"),
    ).toBe("0");
  });

  it("toggles aria-checked and reports each change when uncontrolled", () => {
    const onCheckedChange = vi.fn();
    render(
      <Field>
        <Switch onCheckedChange={onCheckedChange} />
        <Field.Label>Wi-Fi</Field.Label>
      </Field>,
    );
    const sw = screen.getByRole("switch");

    fireEvent.click(sw);
    expect(sw.getAttribute("aria-checked")).toBe("true");
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(sw);
    expect(sw.getAttribute("aria-checked")).toBe("false");
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it("honors defaultChecked", () => {
    render(
      <Field>
        <Switch defaultChecked />
        <Field.Label>Wi-Fi</Field.Label>
      </Field>,
    );
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });

  it("is controlled by `checked` — a click reports intent but never self-updates", () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(
      <Field>
        <Switch checked={false} onCheckedChange={onCheckedChange} />
        <Field.Label>Wi-Fi</Field.Label>
      </Field>,
    );
    const sw = screen.getByRole("switch");

    fireEvent.click(sw);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(sw.getAttribute("aria-checked")).toBe("false"); // parent still owns state

    rerender(
      <Field>
        <Switch checked onCheckedChange={onCheckedChange} />
        <Field.Label>Wi-Fi</Field.Label>
      </Field>,
    );
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });

  it("links a Field.Hint through aria-describedby, and omits it when there is none", () => {
    const { rerender } = render(
      <Field>
        <Switch />
        <Field.Label>Wi-Fi</Field.Label>
        <Field.Hint>Connect automatically</Field.Hint>
      </Field>,
    );
    const sw = screen.getByRole("switch");
    const id = sw.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)?.textContent).toBe(
      "Connect automatically",
    );

    rerender(
      <Field>
        <Switch />
        <Field.Label>Wi-Fi</Field.Label>
      </Field>,
    );
    expect(sw.getAttribute("aria-describedby")).toBeNull();
  });

  it("throws when rendered outside <Field>", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Switch />)).toThrow(/must be used within <Field>/);
    spy.mockRestore();
  });
});
