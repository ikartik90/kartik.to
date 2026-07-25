import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OptionList, type OptionListProps } from "../option-list";
import { Field } from "../field";
import type { OptionItem } from "@/utils/option-filter";

const OPTIONS: OptionItem[] = [
  { value: "apple", label: "Apple" },
  { value: "avocado", label: "Avocado" },
  { value: "banana", label: "Banana" },
  { value: "grapes", label: "Grapes" },
  { value: "jackfruit", label: "Jackfruit", disabled: true },
  { value: "lychee", label: "Lychee" },
  { value: "mango", label: "Mango" },
];

type ListProps = Partial<Omit<OptionListProps, "children">>;

// Options are authored as children now — one <OptionList.Option> per item.
function optionEls() {
  return OPTIONS.map((o) => (
    <OptionList.Option key={o.value} value={o.value} disabled={o.disabled}>
      {o.label}
    </OptionList.Option>
  ));
}

// A bare list (no Field.Search) — selection/keyboard without the filter row.
function bareTree(props: ListProps = {}) {
  return (
    <OptionList {...props}>
      <OptionList.Options>{optionEls()}</OptionList.Options>
    </OptionList>
  );
}

// The full list — filter row on top, like the combobox popover.
function searchTree(props: ListProps = {}) {
  return (
    <OptionList {...props}>
      <Field.Search placeholder="Search…" />
      <OptionList.Options>{optionEls()}</OptionList.Options>
    </OptionList>
  );
}

const renderBare = (props?: ListProps) =>
  render(<Field>{bareTree(props)}</Field>);
const renderSearch = (props?: ListProps) =>
  render(<Field>{searchTree(props)}</Field>);

const type = (value: string) =>
  fireEvent.input(screen.getByRole("combobox"), { target: { value } });

afterEach(cleanup);

describe("field wiring", () => {
  it("throws when used outside <Field>", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(bareTree())).toThrow(/must be used within <Field>/);
    spy.mockRestore();
  });

  it("labels the listbox via Field.Label / Field.Hint", () => {
    render(
      <Field>
        <Field.Label>Fruit</Field.Label>
        {bareTree()}
        <Field.Hint>Pick one</Field.Hint>
      </Field>,
    );
    const listbox = screen.getByRole("listbox");
    const labelId = listbox.getAttribute("aria-labelledby");
    const hintId = listbox.getAttribute("aria-describedby");
    expect(document.getElementById(labelId!)?.textContent).toBe("Fruit");
    expect(document.getElementById(hintId!)?.textContent).toBe("Pick one");
  });

  it("omits the associations when no label/hint is present", () => {
    renderBare();
    const listbox = screen.getByRole("listbox");
    expect(listbox.getAttribute("aria-labelledby")).toBeNull();
    expect(listbox.getAttribute("aria-describedby")).toBeNull();
  });
});

describe("composition", () => {
  it("renders one option button per authored Option child", () => {
    renderBare();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(OPTIONS.length);
    expect(options.map((o) => o.textContent)).toEqual(
      OPTIONS.map((o) => o.label),
    );
  });

  it("marks a disabled option as an unselectable button", () => {
    renderBare();
    const jackfruit = screen.getByRole("option", {
      name: "Jackfruit",
    }) as HTMLButtonElement;
    expect(jackfruit.disabled).toBe(true);
  });

  it("renders an Option's rich children (e.g. an icon beside the label)", () => {
    render(
      <Field>
        <OptionList>
          <OptionList.Options>
            <OptionList.Option value="apple" label="Apple">
              <svg data-testid="apple-icon" />
              Apple
            </OptionList.Option>
          </OptionList.Options>
        </OptionList>
      </Field>,
    );
    const option = screen.getByRole("option", { name: "Apple" });
    expect(within(option).getByTestId("apple-icon")).toBeTruthy();
  });
});

describe("selection", () => {
  it("reflects the controlled value via aria-selected", () => {
    renderBare({ value: "grapes" });
    expect(
      screen.getByRole("option", { name: "Grapes" }).getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("fires onValueChange with the clicked option's value", () => {
    const onValueChange = vi.fn();
    renderBare({ onValueChange });
    fireEvent.click(screen.getByRole("option", { name: "Banana" }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("banana");
  });

  it("updates the selection when uncontrolled", () => {
    renderBare({ defaultValue: "apple" });
    fireEvent.click(screen.getByRole("option", { name: "Mango" }));
    expect(
      screen.getByRole("option", { name: "Mango" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen.getByRole("option", { name: "Apple" }).getAttribute("aria-selected"),
    ).toBe("false");
  });

  it("does not fire for a disabled option", () => {
    const onValueChange = vi.fn();
    renderBare({ onValueChange });
    fireEvent.click(screen.getByRole("option", { name: "Jackfruit" }));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("search filter", () => {
  it("narrows the list to the matching options as you type", () => {
    renderSearch();
    // "a" hits every label but Lychee — disabled Jackfruit still renders, it's
    // just unselectable.
    type("a");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Apple",
      "Avocado",
      "Banana",
      "Grapes",
      "Jackfruit",
      "Mango",
    ]);
  });

  it("shows the empty row when nothing matches", () => {
    renderSearch({ emptyLabel: "No fruit" });
    type("zzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No fruit")).toBeTruthy();
  });

  it("restores the full list when the query is cleared", () => {
    renderSearch();
    type("man");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    type("");
    expect(screen.getAllByRole("option")).toHaveLength(OPTIONS.length);
  });

  it("filters by an explicit label prop, not the rich children text", () => {
    render(
      <Field>
        <OptionList>
          <Field.Search placeholder="Search…" />
          <OptionList.Options>
            <OptionList.Option value="apple" label="Apple">
              <svg />
              Apple
            </OptionList.Option>
            <OptionList.Option value="mango" label="Mango">
              <svg />
              Mango
            </OptionList.Option>
          </OptionList.Options>
        </OptionList>
      </Field>,
    );
    type("man");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option").textContent).toContain("Mango");
  });

  it("leaves a consumer's own Field.Search handlers intact", () => {
    const onValueChange = vi.fn();
    render(
      <Field>
        <OptionList>
          <Field.Search onValueChange={onValueChange} />
          <OptionList.Options>{optionEls()}</OptionList.Options>
        </OptionList>
      </Field>,
    );
    type("man");
    // The consumer's handler ran…
    expect(onValueChange).toHaveBeenCalledWith("man");
    // …and the built-in filtering still narrowed the list alongside it.
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });
});

describe("keyboard from the search", () => {
  const arrow = (key: "ArrowDown" | "ArrowUp") =>
    fireEvent.keyDown(screen.getByRole("combobox"), { key });
  const enter = () =>
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
  const active = () => document.querySelector("[data-active]")?.textContent;

  it("moves the highlight with the arrow keys, skipping disabled options", () => {
    renderSearch();
    // Default highlight is the first option.
    expect(active()).toBe("Apple");
    arrow("ArrowDown");
    expect(active()).toBe("Avocado");
    arrow("ArrowDown");
    expect(active()).toBe("Banana");
    arrow("ArrowDown");
    expect(active()).toBe("Grapes");
    // Jackfruit is disabled — the highlight skips over it.
    arrow("ArrowDown");
    expect(active()).toBe("Lychee");
  });

  it("clamps the highlight at the ends of the list", () => {
    renderSearch();
    arrow("ArrowUp");
    expect(active()).toBe("Apple");
  });

  it("mirrors the highlight through aria-activedescendant", () => {
    renderSearch();
    arrow("ArrowDown");
    const highlighted = document.querySelector("[data-active]")!;
    expect(screen.getByRole("combobox").getAttribute("aria-activedescendant")).toBe(
      highlighted.id,
    );
  });

  it("commits the highlighted option on Enter", () => {
    const onValueChange = vi.fn();
    renderSearch({ onValueChange });
    arrow("ArrowDown"); // Avocado
    enter();
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("avocado");
  });

  it("re-resolves the highlight to the first survivor after a fresh query", () => {
    renderSearch();
    arrow("ArrowDown");
    arrow("ArrowDown");
    expect(active()).toBe("Banana");
    type("man");
    expect(active()).toBe("Mango");
  });
});

describe("roving tabstop", () => {
  it("keeps a single tabbable option — the highlight", () => {
    renderBare({ value: "mango" });
    const tabbable = screen
      .getAllByRole("option")
      .filter((o) => o.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0].textContent).toBe("Mango");
  });

  it("roves button focus with the arrow keys when focus is in the list", () => {
    renderBare();
    const listbox = screen.getByRole("listbox");
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    // First option was the highlight; ArrowDown moves it to the second and
    // focuses that button.
    const avocado = screen.getByRole("option", { name: "Avocado" });
    expect(document.activeElement).toBe(avocado);
    expect(within(listbox).getByRole("option", { name: "Avocado" })).toBe(avocado);
  });
});
