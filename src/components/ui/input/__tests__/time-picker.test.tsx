import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { TimePicker, type TimePickerProps } from "../time-picker";
import { Field } from "../field";

const at = (iso: string) => Temporal.PlainTime.from(iso);

afterEach(cleanup);

function renderTimePicker(props: Partial<TimePickerProps> = {}) {
  return render(
    <Field>
      <Field.Label>Shift start</Field.Label>
      <TimePicker {...props} />
      <Field.Hint>Local time</Field.Hint>
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

const rows = () => screen.getAllByRole("option");
// OptionList re-roles a dropped-in Field.Search as the listbox's `combobox`
// input (it drives the highlight through aria-activedescendant), so the
// type-ahead answers to that role rather than to `searchbox`.
const search = () => screen.getByRole("combobox") as HTMLInputElement;
const rowNames = () => rows().map((r) => r.textContent);

describe("field composition", () => {
  it("throws when used outside <Field>", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TimePicker />)).toThrow(/must be used within <Field>/);
    spy.mockRestore();
  });

  it("associates the field label with the trigger", () => {
    renderTimePicker({ defaultValue: at("00:00") });
    const label = screen.getByText("Shift start") as HTMLLabelElement;
    expect(label.htmlFor).toBe(trigger().id);
  });
});

describe("collapsed trigger", () => {
  it("shows the formatted value and no popover", () => {
    renderTimePicker({ defaultValue: at("00:00") });
    expect(trigger().textContent).toBe("12:00 AM");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // See Button: WebKit's default tab order skips a bare <button>.
  it("states its own place in the tab order", () => {
    renderTimePicker();
    expect(trigger().getAttribute("tabindex")).toBe("0");
  });

  it("shows the placeholder when empty", () => {
    renderTimePicker({ placeholder: "Pick a time" });
    expect(trigger().textContent).toBe("Pick a time");
  });

  it("honours a 24-hour format", () => {
    renderTimePicker({ defaultValue: at("13:30"), format: "HH:mm" });
    expect(trigger().textContent).toBe("13:30");
  });
});

describe("opening", () => {
  it("opens a dialog on the day's slots and moves focus into the search", () => {
    renderTimePicker({ defaultValue: at("00:00") });
    fireEvent.click(trigger());

    const dialog = screen.getByRole("dialog");
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(within(dialog).getAllByRole("option")).toHaveLength(48);
    expect(document.activeElement).toBe(search());
  });

  it("opens from the clock icon / frame padding, not only the value text", () => {
    renderTimePicker({ defaultValue: at("00:00") });
    const icon = trigger().parentElement!.querySelector("[aria-hidden]");
    fireEvent.click(icon!);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  // The design shows the current value in the search strip — but as a READING
  // of the field, not as a filter, so the whole day is still there behind it.
  it("seeds the search with the value without filtering by it", () => {
    renderTimePicker({ defaultValue: at("13:30") });
    fireEvent.click(trigger());
    expect(search().value).toBe("1:30 PM");
    expect(rows()).toHaveLength(48);
  });

  it("marks the current value as the selected row", () => {
    renderTimePicker({ defaultValue: at("13:30") });
    fireEvent.click(trigger());
    const selected = rows().filter(
      (r) => r.getAttribute("aria-selected") === "true",
    );
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toBe("1:30 PM");
  });
});

describe("the day's slots", () => {
  it("runs midnight to midnight on the half hour, unanchored", () => {
    renderTimePicker();
    fireEvent.click(trigger());
    const names = rowNames();
    expect(names[0]).toBe("12:00 AM");
    expect(names[1]).toBe("12:30 AM");
    expect(names[24]).toBe("12:00 PM");
    expect(names.at(-1)).toBe("11:30 PM");
  });

  it("honours the step", () => {
    renderTimePicker({ step: 60 });
    fireEvent.click(trigger());
    expect(rows()).toHaveLength(24);
    expect(rowNames()[1]).toBe("1:00 AM");
  });

  it("lists a 24-hour clock when asked", () => {
    renderTimePicker({ format: "HH:mm" });
    fireEvent.click(trigger());
    expect(rowNames()[0]).toBe("00:00");
    expect(rowNames().at(-1)).toBe("23:30");
  });

  it("carries no duration and no day rule when unanchored", () => {
    renderTimePicker();
    fireEvent.click(trigger());
    expect(screen.queryByText(/hours?$/)).toBeNull();
    expect(screen.queryByText("Next Day")).toBeNull();
  });
});

// The Figma's list: anchored at 3:00 PM, 11:00 PM reads "+8 hours" and the day
// rolls over at 12:00 AM.
describe("the time difference", () => {
  const openAnchored = (props: Partial<TimePickerProps> = {}) => {
    renderTimePicker({ differenceFrom: at("15:00"), ...props });
    fireEvent.click(trigger());
  };

  it("runs the list forward from the anchor", () => {
    openAnchored();
    expect(rowNames()[0]).toBe("3:30 PM+30 mins");
    expect(rows()).toHaveLength(48);
  });

  it("names each row's distance from the anchor", () => {
    openAnchored();
    const eleven = screen.getByRole("option", { name: /^11:00 PM/ });
    expect(eleven.textContent).toBe("11:00 PM+8 hours");
    expect(
      screen.getByRole("option", { name: /^11:30 PM/ }).textContent,
    ).toBe("11:30 PM+8.5 hours");
    expect(
      screen.getByRole("option", { name: /^12:00 AM/ }).textContent,
    ).toBe("12:00 AM+9 hours");
  });

  it("rules the crossing into the next day exactly once, before midnight's row", () => {
    openAnchored();
    const rule = screen.getByText("Next Day");
    expect(screen.getAllByText("Next Day")).toHaveLength(1);
    expect(rule.nextElementSibling?.textContent).toBe("12:00 AM+9 hours");
  });

  it("lets the rule be renamed for the deployment", () => {
    openAnchored({ nextDayLabel: "Tomorrow" });
    expect(screen.getByText("Tomorrow")).toBeTruthy();
    expect(screen.queryByText("Next Day")).toBeNull();
  });

  // A row read aloud has neither the rule above it nor the column beside it.
  it("carries the day and the duration into the row's accessible name", () => {
    openAnchored();
    expect(
      screen.getByRole("option", { name: "12:00 AM, Next Day, +9 hours" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "11:00 PM, +8 hours" }),
    ).toBeTruthy();
  });

  it("closes the list a full day out", () => {
    openAnchored();
    expect(rowNames().at(-1)).toBe("3:00 PM+24 hours");
  });
});

describe("selecting a time", () => {
  it("fires onValueChange, closes, restores focus, and updates the trigger", () => {
    const onValueChange = vi.fn();
    renderTimePicker({ defaultValue: at("00:00"), onValueChange });
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("option", { name: "1:30 PM" }));

    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange.mock.calls[0][0].toString()).toBe("13:30:00");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger().textContent).toBe("1:30 PM");
    expect(document.activeElement).toBe(trigger());
  });

  it("respects a controlled value (parent owns state)", () => {
    const onValueChange = vi.fn();
    renderTimePicker({ value: at("00:00"), onValueChange });
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("option", { name: "1:30 PM" }));
    expect(onValueChange).toHaveBeenCalledOnce();
    // The parent didn't update `value`, so the trigger holds the old time.
    expect(trigger().textContent).toBe("12:00 AM");
  });
});

describe("dismissing", () => {
  it("closes on Escape and restores focus to the trigger", () => {
    renderTimePicker({ defaultValue: at("00:00") });
    fireEvent.click(trigger());
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });
});

describe("type-ahead", () => {
  const openAndType = (value: string, props: Partial<TimePickerProps> = {}) => {
    renderTimePicker(props);
    fireEvent.click(trigger());
    fireEvent.input(search(), { target: { value } });
  };

  it("narrows the list to the matching times", () => {
    openAndType("11:3");
    expect(rowNames()).toEqual(["11:30 AM", "11:30 PM"]);
  });

  it("matches the meridiem too", () => {
    openAndType("11:30 pm");
    expect(rowNames()).toEqual(["11:30 PM"]);
  });

  it("says so when nothing matches", () => {
    openAndType("99:99");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No results")).toBeTruthy();
  });

  // The rule belongs to the rows it precedes: with none of them left, it is
  // labelling nothing.
  it("drops the day rule when no row past midnight survives", () => {
    openAndType("11:00 pm", { differenceFrom: at("15:00") });
    expect(rowNames()).toEqual(["11:00 PM+8 hours"]);
    expect(screen.queryByText("Next Day")).toBeNull();
  });

  it("keeps the day rule when a row past midnight survives", () => {
    openAndType("12:00", { differenceFrom: at("15:00") });
    expect(screen.getByText("Next Day")).toBeTruthy();
  });
});

describe("type-ahead on clock rules", () => {
  it("does not let a query match mid-number", () => {
    renderTimePicker();
    fireEvent.click(trigger());
    fireEvent.input(search(), { target: { value: "2:30 am" } });
    expect(rowNames()).toEqual(["2:30 AM"]);
  });

  it("commits the time that was typed", () => {
    const onValueChange = vi.fn();
    renderTimePicker({ onValueChange });
    fireEvent.click(trigger());
    fireEvent.input(search(), { target: { value: "2:30 am" } });
    fireEvent.keyDown(search(), { key: "Enter" });
    expect(onValueChange.mock.calls[0][0].toString()).toBe("02:30:00");
  });

  it("still finds every half hour, and every afternoon", () => {
    renderTimePicker({ step: 60 });
    fireEvent.click(trigger());
    fireEvent.input(search(), { target: { value: "pm" } });
    expect(rows()).toHaveLength(12);
  });
});
