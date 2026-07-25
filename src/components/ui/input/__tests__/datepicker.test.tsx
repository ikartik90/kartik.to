import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { DatePicker, type DatePickerProps } from "../datepicker";
import { Field } from "../field";

const TODAY = Temporal.PlainDate.from("2026-12-11");

afterEach(cleanup);

function renderDatePicker(props: Partial<DatePickerProps> = {}) {
  return render(
    <Field>
      <Field.Label>Trip date</Field.Label>
      <DatePicker today={TODAY} {...props} />
      <Field.Hint>Pick a day</Field.Hint>
    </Field>,
  );
}

function trigger(): HTMLButtonElement {
  const el = screen
    .getAllByRole("button")
    .find((b) => b.getAttribute("aria-haspopup") === "dialog");
  if (!el) throw new Error("trigger not found");
  return el as HTMLButtonElement;
}

describe("field composition", () => {
  it("throws when used outside <Field>", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<DatePicker today={TODAY} />)).toThrow(
      /must be used within <Field>/,
    );
    spy.mockRestore();
  });

  it("associates the field label with the trigger", () => {
    renderDatePicker({ defaultValue: TODAY });
    // Field.Label's htmlFor targets the trigger's controlId.
    const label = screen.getByText("Trip date") as HTMLLabelElement;
    expect(label.htmlFor).toBe(trigger().id);
  });
});

describe("collapsed trigger", () => {
  it("shows the formatted value and no popover", () => {
    renderDatePicker({ defaultValue: TODAY });
    expect(trigger().textContent).toBe("11/12/2026");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the placeholder when empty", () => {
    renderDatePicker({ placeholder: "Pick a date" });
    expect(trigger().textContent).toBe("Pick a date");
  });
});

describe("opening", () => {
  it("opens a dialog with the calendar and moves focus into the search", () => {
    renderDatePicker({ defaultValue: TODAY });
    fireEvent.click(trigger());

    const dialog = screen.getByRole("dialog");
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(within(dialog).getByRole("grid")).toBeTruthy();
    expect(within(dialog).getAllByRole("gridcell")).toHaveLength(42);
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
  });

  it("opens from the calendar icon / frame padding, not only the value text", () => {
    renderDatePicker({ defaultValue: TODAY });
    // The decorative calendar icon is pointer-events:none; the whole frame must
    // be the open target, else the icon does nothing.
    const icon = trigger().parentElement!.querySelector("[aria-hidden]");
    fireEvent.click(icon!);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("selecting a date", () => {
  it("fires onValueChange, closes, restores focus, and updates the trigger", () => {
    const onValueChange = vi.fn();
    renderDatePicker({ defaultValue: TODAY, onValueChange });
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("gridcell", { name: "December 5, 2026" }));

    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange.mock.calls[0][0].toString()).toBe("2026-12-05");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger().textContent).toBe("05/12/2026");
    expect(document.activeElement).toBe(trigger());
  });

  it("respects controlled value (parent owns state)", () => {
    const onValueChange = vi.fn();
    renderDatePicker({ value: TODAY, onValueChange });
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("gridcell", { name: "December 5, 2026" }));
    expect(onValueChange).toHaveBeenCalledOnce();
    // Parent didn't update `value`, so the trigger still shows the old date.
    expect(trigger().textContent).toBe("11/12/2026");
  });
});

describe("dismissing", () => {
  it("closes on Escape and restores focus to the trigger", () => {
    renderDatePicker({ defaultValue: TODAY });
    fireEvent.click(trigger());
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });
});

describe("search", () => {
  const openAndType = (value: string) => {
    fireEvent.click(trigger());
    fireEvent.input(screen.getByRole("searchbox"), { target: { value } });
  };

  it("moves the calendar to the typed date but leaves the popover open and unselected", () => {
    const onValueChange = vi.fn();
    renderDatePicker({ defaultValue: TODAY, onValueChange });
    openAndType("05/01/2027");

    expect(screen.getByText("January 2027")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(trigger().textContent).toBe("11/12/2026");
  });

  it("commits the typed date on Enter, closing and restoring focus", () => {
    const onValueChange = vi.fn();
    renderDatePicker({ defaultValue: TODAY, onValueChange });
    openAndType("05/01/2027");
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });

    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange.mock.calls[0][0].toString()).toBe("2027-01-05");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger().textContent).toBe("05/01/2027");
    expect(document.activeElement).toBe(trigger());
  });

  it("discards a typed date on Escape", () => {
    const onValueChange = vi.fn();
    renderDatePicker({ defaultValue: TODAY, onValueChange });
    openAndType("05/01/2027");
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger().textContent).toBe("11/12/2026");
  });

  it("formats and parses through one shared `format` pattern", () => {
    const onValueChange = vi.fn();
    renderDatePicker({
      defaultValue: TODAY,
      onValueChange,
      format: "MM-DD-YYYY",
    });
    expect(trigger().textContent).toBe("12-11-2026");

    openAndType("05-01-2027");
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(onValueChange.mock.calls[0][0].toString()).toBe("2027-05-01");
    expect(trigger().textContent).toBe("05-01-2027");
  });
});
