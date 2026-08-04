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
      <OptionList.Listbox>{optionEls()}</OptionList.Listbox>
    </OptionList>
  );
}

// The full list — filter row on top, like the combobox popover.
function searchTree(props: ListProps = {}) {
  return (
    <OptionList {...props}>
      <Field.Search placeholder="Search…" />
      <OptionList.Listbox>{optionEls()}</OptionList.Listbox>
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
  it("renders standalone with no <Field> (toolbar / slash-menu case)", () => {
    // The Field read is optional now: no Field → no throw, and the listbox
    // simply carries no aria-labelledby/-describedby (nothing to label).
    render(bareTree());
    const listbox = screen.getByRole("listbox");
    expect(listbox.getAttribute("aria-labelledby")).toBeNull();
    expect(listbox.getAttribute("aria-describedby")).toBeNull();
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

describe("toolbar", () => {
  it("renders role=toolbar with an accessible name, standalone (no Field)", () => {
    render(
      <OptionList direction="inline">
        <OptionList.Toolbar aria-label="Format selection">
          <OptionList.Option aria-label="Bold">B</OptionList.Option>
        </OptionList.Toolbar>
      </OptionList>,
    );
    expect(
      screen.getByRole("toolbar", { name: "Format selection" }),
    ).toBeTruthy();
  });

  it("makes a `pressed` option a toggle and a bare one a plain action", () => {
    render(
      <OptionList direction="inline">
        <OptionList.Toolbar aria-label="Format">
          <OptionList.Option value="bold" pressed aria-label="Bold">
            B
          </OptionList.Option>
          <OptionList.Divider />
          <OptionList.Option aria-label="Edit link">E</OptionList.Option>
        </OptionList.Toolbar>
      </OptionList>,
    );
    // The toggle advertises its pressed state…
    expect(
      screen.getByRole("button", { name: "Bold", pressed: true }),
    ).toBeTruthy();
    // …the plain action carries no aria-pressed…
    expect(
      screen.getByRole("button", { name: "Edit link" }).getAttribute("aria-pressed"),
    ).toBeNull();
    // …and toolbar buttons are not listbox options.
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("fires the option's onClick and preserves the editor selection", () => {
    const onClick = vi.fn();
    render(
      <OptionList direction="inline">
        <OptionList.Toolbar aria-label="Format">
          <OptionList.Option aria-label="Bold" onClick={onClick}>
            B
          </OptionList.Option>
        </OptionList.Toolbar>
      </OptionList>,
    );
    const bold = screen.getByRole("button", { name: "Bold" });
    fireEvent.click(bold);
    expect(onClick).toHaveBeenCalledOnce();
    // mousedown is prevented so the press can't collapse the editor selection —
    // fireEvent returns false when a handler called preventDefault.
    expect(fireEvent.mouseDown(bold)).toBe(false);
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
          <OptionList.Listbox>
            <OptionList.Option value="apple" label="Apple">
              <svg data-testid="apple-icon" />
              Apple
            </OptionList.Option>
          </OptionList.Listbox>
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
    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange.mock.calls[0][0]).toBe("banana");
  });

  // Multi-select consumers decide their own policy (toggle vs replace) from the
  // modifier keys, so the originating event has to reach them.
  it("hands onValueChange the originating event, modifiers intact", () => {
    const onValueChange = vi.fn();
    renderBare({ onValueChange });
    fireEvent.click(screen.getByRole("option", { name: "Banana" }), {
      shiftKey: true,
    });
    expect(onValueChange.mock.calls[0][1]?.shiftKey).toBe(true);
  });

  it("calls a consumer's own onClick on a listbox option", () => {
    const onClick = vi.fn();
    render(
      <OptionList>
        <OptionList.Listbox>
          <OptionList.Option value="apple" onClick={onClick}>
            Apple
          </OptionList.Option>
        </OptionList.Listbox>
      </OptionList>,
    );
    fireEvent.click(screen.getByRole("option", { name: "Apple" }));
    expect(onClick).toHaveBeenCalledOnce();
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

describe("multi-selection (selectedValues)", () => {
  it("marks every member of the set as selected", () => {
    renderBare({ selectedValues: ["apple", "mango"] });
    for (const name of ["Apple", "Mango"]) {
      expect(
        screen.getByRole("option", { name }).getAttribute("aria-selected"),
      ).toBe("true");
    }
    expect(
      screen.getByRole("option", { name: "Banana" }).getAttribute("aria-selected"),
    ).toBe("false");
  });

  it("announces the listbox as multi-selectable", () => {
    renderBare({ selectedValues: ["apple"] });
    expect(
      screen.getByRole("listbox").getAttribute("aria-multiselectable"),
    ).toBe("true");
  });

  // `value` keeps working — it degrades from "the selection" to "the anchor",
  // the row the highlight and any single-target side panel follow.
  it("leaves the anchor out of the painted selection when it is not a member", () => {
    renderBare({ value: "grapes", selectedValues: ["apple"] });
    expect(
      screen.getByRole("option", { name: "Grapes" }).getAttribute("aria-selected"),
    ).toBe("false");
    expect(
      screen.getByRole("option", { name: "Apple" }).getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("stays single-select, and single-selectable, without the prop", () => {
    renderBare({ value: "grapes" });
    expect(
      screen.getByRole("option", { name: "Grapes" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen.getByRole("listbox").getAttribute("aria-multiselectable"),
    ).toBeNull();
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
          <OptionList.Listbox>
            <OptionList.Option value="apple" label="Apple">
              <svg />
              Apple
            </OptionList.Option>
            <OptionList.Option value="mango" label="Mango">
              <svg />
              Mango
            </OptionList.Option>
          </OptionList.Listbox>
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
          <OptionList.Listbox>{optionEls()}</OptionList.Listbox>
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
    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange.mock.calls[0][0]).toBe("avocado");
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

describe("externalKeys (slash-menu — focus stays outside the list)", () => {
  function renderExternal(props: ListProps = {}) {
    const onValueChange = vi.fn();
    render(
      <OptionList onValueChange={onValueChange} {...props}>
        <OptionList.Listbox externalKeys loop>
          {optionEls()}
        </OptionList.Listbox>
      </OptionList>,
    );
    return onValueChange;
  }
  const pressDoc = (key: string) => fireEvent.keyDown(document, { key });
  const activeValue = () =>
    screen
      .getAllByRole("option")
      .find((o) => o.hasAttribute("data-active"))
      ?.getAttribute("data-value");

  it("moves the highlight via a document keydown, focus never entering the list", () => {
    renderExternal();
    expect(activeValue()).toBe("apple"); // defaults to the first enabled option
    pressDoc("ArrowDown");
    pressDoc("ArrowDown");
    expect(activeValue()).toBe("banana");
    expect(document.activeElement).toBe(document.body); // focus stayed put
  });

  it("commits the highlighted option on Enter", () => {
    const onValueChange = renderExternal();
    pressDoc("ArrowDown"); // apple -> avocado
    pressDoc("Enter");
    expect(onValueChange.mock.calls[0][0]).toBe("avocado");
  });

  it("wraps with loop — ArrowUp from the first lands on the last enabled option", () => {
    renderExternal();
    expect(activeValue()).toBe("apple");
    pressDoc("ArrowUp");
    expect(activeValue()).toBe("mango"); // jackfruit is disabled, so last enabled is mango
  });
});

describe("pointer highlight", () => {
  const activeText = () => document.querySelector("[data-active]")?.textContent;
  const option = (name: string) => screen.getByRole("option", { name });

  it("moves the highlight onto the hovered option", () => {
    renderBare();
    fireEvent.pointerEnter(option("Banana"));
    expect(activeText()).toBe("Banana");
  });

  it("releases the highlight when the pointer leaves the option", () => {
    renderBare();
    const banana = option("Banana");
    fireEvent.pointerEnter(banana);
    expect(activeText()).toBe("Banana");

    // Pointer moves off the row into the list's empty area (relatedTarget is
    // the list, not another option) — the row must not stay lit.
    fireEvent.pointerLeave(banana, { relatedTarget: banana.parentElement });
    expect(activeText()).not.toBe("Banana");
  });

  it("falls back to the selected row once the pointer leaves", () => {
    renderBare({ value: "mango" });
    const banana = option("Banana");
    fireEvent.pointerEnter(banana);
    expect(activeText()).toBe("Banana");

    fireEvent.pointerLeave(banana, { relatedTarget: banana.parentElement });
    expect(activeText()).toBe("Mango");
  });

  it("hands the highlight straight over when moving between options", () => {
    renderBare();
    const banana = option("Banana");
    const grapes = option("Grapes");
    fireEvent.pointerEnter(banana);
    // Leaving straight onto another option: that option's enter takes over, so
    // the highlight must never blank out in between.
    fireEvent.pointerLeave(banana, { relatedTarget: grapes });
    fireEvent.pointerEnter(grapes);
    expect(activeText()).toBe("Grapes");
  });

  it("releases the highlight when the pointer crosses into another list", () => {
    render(
      <>
        <Field>{bareTree()}</Field>
        <Field>
          <OptionList>
            <OptionList.Listbox>
              <OptionList.Option value="edit">Edit</OptionList.Option>
            </OptionList.Listbox>
          </OptionList>
        </Field>
      </>,
    );
    const banana = screen.getByRole("option", { name: "Banana" });
    const edit = screen.getByRole("option", { name: "Edit" });
    fireEvent.pointerEnter(banana);
    expect(banana.hasAttribute("data-active")).toBe(true);

    // A row in a DIFFERENT list carries data-value too, but it cannot take over
    // this list's highlight — so this row must still release.
    fireEvent.pointerLeave(banana, { relatedTarget: edit });
    expect(banana.hasAttribute("data-active")).toBe(false);
  });

  it("keeps a keyboard highlight when the pointer leaves a different row", () => {
    renderSearch();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    expect(activeText()).toBe("Avocado");

    // The pointer was resting elsewhere; leaving that row must not steal the
    // keyboard's highlight (it's what Enter would commit).
    const banana = option("Banana");
    fireEvent.pointerLeave(banana, { relatedTarget: banana.parentElement });
    expect(activeText()).toBe("Avocado");
  });
});
