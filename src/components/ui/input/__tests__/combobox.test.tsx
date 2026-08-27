import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Combobox, type ComboboxProps } from "../combobox";
import { Field } from "../field";
import type { OptionItem } from "@/utils/option-filter";

const OPTIONS: OptionItem[] = [
  { value: "apple", label: "Apple" },
  { value: "avocado", label: "Avocado" },
  { value: "banana", label: "Banana" },
  { value: "grapes", label: "Grapes" },
  { value: "mango", label: "Mango" },
];

afterEach(cleanup);

function renderCombobox(props: Partial<Omit<ComboboxProps, "children">> = {}) {
  return render(
    <Field>
      <Field.Label>Fruit</Field.Label>
      <Combobox {...props}>
        {OPTIONS.map((o) => (
          <Combobox.Option key={o.value} value={o.value}>
            {o.label}
          </Combobox.Option>
        ))}
      </Combobox>
      <Field.Hint>Pick one</Field.Hint>
    </Field>,
  );
}

function trigger(): HTMLButtonElement {
  const el = screen
    .getAllByRole("button")
    .find((b) => b.getAttribute("aria-haspopup") === "listbox");
  if (!el) throw new Error("trigger not found");
  return el as HTMLButtonElement;
}

describe("field composition", () => {
  it("throws when used outside <Field>", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <Combobox>
          <Combobox.Option value="apple">Apple</Combobox.Option>
        </Combobox>,
      ),
    ).toThrow(/must be used within <Field>/);
    spy.mockRestore();
  });

  it("associates the field label with the trigger", () => {
    renderCombobox({ defaultValue: "grapes" });
    const label = screen.getByText("Fruit") as HTMLLabelElement;
    expect(label.htmlFor).toBe(trigger().id);
  });
});

describe("collapsed trigger", () => {
  it("shows the selected option's label and no popover", () => {
    renderCombobox({ defaultValue: "grapes" });
    // The label comes from the authored children even though the popover (and
    // its option list) is closed and unmounted.
    expect(trigger().textContent).toBe("Grapes");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("shows the placeholder when nothing is selected", () => {
    renderCombobox({ placeholder: "Pick a fruit" });
    expect(trigger().textContent).toBe("Pick a fruit");
  });

  it("shows the placeholder when the value has no matching option", () => {
    renderCombobox({ value: "durian", placeholder: "Pick a fruit" });
    expect(trigger().textContent).toBe("Pick a fruit");
  });
});

describe("opening", () => {
  it("opens the popover with the listbox and moves focus into the search", () => {
    renderCombobox({ defaultValue: "grapes" });
    fireEvent.click(trigger());

    const dialog = screen.getByRole("dialog");
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(within(dialog).getByRole("listbox")).toBeTruthy();
    expect(within(dialog).getAllByRole("option")).toHaveLength(OPTIONS.length);
    expect(document.activeElement).toBe(screen.getByRole("combobox"));
  });

  it("opens from the chevron / frame padding, not only the value text", () => {
    renderCombobox({ defaultValue: "grapes" });
    // The decorative chevron icon is pointer-events:none; the whole frame must
    // be the open target.
    const icon = trigger().parentElement!.querySelector("[aria-hidden]");
    fireEvent.click(icon!);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("selecting an option", () => {
  it("fires onValueChange, closes, restores focus, and updates the trigger", () => {
    const onValueChange = vi.fn();
    renderCombobox({ defaultValue: "grapes", onValueChange });
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("option", { name: "Mango" }));

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("mango");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger().textContent).toBe("Mango");
    expect(document.activeElement).toBe(trigger());
  });

  it("respects a controlled value (parent owns state)", () => {
    const onValueChange = vi.fn();
    renderCombobox({ value: "grapes", onValueChange });
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("option", { name: "Mango" }));

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("mango");
    // Parent didn't update `value`, so the trigger still shows the old label.
    expect(trigger().textContent).toBe("Grapes");
  });
});

describe("dismissing", () => {
  it("closes on Escape and restores focus to the trigger", () => {
    renderCombobox({ defaultValue: "grapes" });
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
    fireEvent.input(screen.getByRole("combobox"), { target: { value } });
  };

  it("filters the options in the open popover", () => {
    renderCombobox();
    openAndType("man");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option").textContent).toBe("Mango");
  });

  it("commits the highlighted option on Enter, closing and restoring focus", () => {
    const onValueChange = vi.fn();
    renderCombobox({ onValueChange });
    openAndType("man");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("mango");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger().textContent).toBe("Mango");
    expect(document.activeElement).toBe(trigger());
  });
});

describe("search={false}", () => {
  it("opens the listbox with no search box, for a menu too short to filter", () => {
    renderCombobox({ search: false });
    fireEvent.click(trigger());
    expect(screen.getByRole("listbox")).toBeTruthy();
    // The dressed search input takes role=combobox, not searchbox — see the
    // OptionList root. Its absence is what "no search" means here.
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("moves focus onto the selected option instead, so the keyboard still has somewhere to land", () => {
    renderCombobox({ search: false, defaultValue: "grapes" });
    fireEvent.click(trigger());
    expect(document.activeElement).toBe(
      screen.getByRole("option", { name: "Grapes" }),
    );
  });

  it("falls back to the first option when nothing is selected", () => {
    renderCombobox({ search: false });
    fireEvent.click(trigger());
    expect(document.activeElement).toBe(
      screen.getByRole("option", { name: "Apple" }),
    );
  });

  it("still selects on click, closes, and restores focus to the trigger", () => {
    const onValueChange = vi.fn();
    renderCombobox({ search: false, onValueChange });
    fireEvent.click(trigger());
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Banana"));
    expect(onValueChange).toHaveBeenCalledWith("banana");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });
});

describe("size", () => {
  it("opens a small list for a small field, so the menu keeps the field's pitch", () => {
    render(
      <Field size="sm">
        <Field.Label>Fruit</Field.Label>
        <Combobox>
          {OPTIONS.map((o) => (
            <Combobox.Option key={o.value} value={o.value}>
              {o.label}
            </Combobox.Option>
          ))}
        </Combobox>
      </Field>,
    );
    fireEvent.click(trigger());
    expect(screen.getByRole("listbox").className).toMatch(/size_sm/);
  });

  it("keeps the base list for the field sizes that have no small counterpart", () => {
    renderCombobox();
    fireEvent.click(trigger());
    expect(screen.getByRole("listbox").className).toMatch(/size_md/);
  });
});
