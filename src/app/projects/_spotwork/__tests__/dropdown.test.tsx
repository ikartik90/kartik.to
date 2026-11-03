import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dropdown, ListItem } from "../dropdown";
import { Field, Typography } from "../ui";
import { keyed } from "./story-harness";

afterEach(cleanup);

const OPTIONS = ["Florida, USA (305) 703-0177", "Ontario, Canada (647) 555-0100"];

function setup(props: { disabled?: boolean; defaultOpen?: boolean; tone?: "warning" | "alert" } = {}) {
  const user = userEvent.setup();
  const picked: string[] = [];
  function Harness() {
    const [value, setValue] = useState(OPTIONS[0]);
    return (
      <Field tone={props.tone} disabled={props.disabled}>
        <Field.Label>Sending Phone Number</Field.Label>
        <Dropdown
          value={value}
          onChange={(next) => {
            picked.push(next);
            setValue(next);
          }}
          defaultOpen={props.defaultOpen}
        >
          {OPTIONS.map((option) => (
            <Dropdown.Item key={option}><Typography variant="bodyLarge">{option}</Typography></Dropdown.Item>
          ))}
        </Dropdown>
        <Field.HintText>Pick one</Field.HintText>
      </Field>
    );
  }
  render(<Harness />);
  const field = () => screen.getByRole("button", { name: /Sending Phone Number/ });
  return { user, picked, field };
}

describe("the dropdown", () => {
  it("shows its value, closed, between its label and its hint", () => {
    const { field } = setup();
    expect(field().textContent).toBe(OPTIONS[0]);
    expect(field().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect([...field().closest("[data-field]")!.children].map((part) => part.textContent)).toEqual([
      "Sending Phone Number",
      OPTIONS[0],
      "Pick one",
    ]);
  });

  it("lists its items when pressed, the current one selected", async () => {
    const { user, field } = setup();
    await user.click(field());
    expect(screen.getByRole("listbox", { name: "Sending Phone Number" })).toBeTruthy();
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(OPTIONS);
    expect(options.map((option) => option.getAttribute("aria-selected"))).toEqual(["true", "false"]);
  });

  it("takes the item picked and closes", async () => {
    const { user, picked, field } = setup();
    await user.click(field());
    await user.click(screen.getByRole("option", { name: OPTIONS[1] }));
    expect(picked).toEqual([OPTIONS[1]]);
    expect(field().textContent).toBe(OPTIONS[1]);
    expect(field().getAttribute("aria-expanded")).toBe("false");
  });

  it("scrolls only its own list to the item reached, never the boxes round it", async () => {
    const scrolled = vi.fn();
    const option = (node: HTMLElement) => node.getAttribute("role") === "option";
    const at = (node: HTMLElement) => [...node.parentElement!.querySelectorAll(":scope > [role=option]")].indexOf(node);
    const props = {
      scrollIntoView: { configurable: true, value: scrolled },
      offsetTop: { configurable: true, get(this: HTMLElement) { return option(this) ? at(this) * 40 : 0; } },
      offsetHeight: { configurable: true, get(this: HTMLElement) { return option(this) ? 40 : 0; } },
      clientHeight: { configurable: true, get(this: HTMLElement) { return this.getAttribute("role") === "listbox" ? 50 : 0; } },
    };
    Object.defineProperties(HTMLElement.prototype, props);
    try {
      const { user, field } = setup();
      field().focus();
      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
      expect(keyed(field())).toBe(OPTIONS[1]);
      expect(screen.getByRole("listbox").scrollTop).toBe(30);
      expect(scrolled).not.toHaveBeenCalled();
    } finally {
      for (const name of Object.keys(props)) Reflect.deleteProperty(HTMLElement.prototype, name);
    }
  });

  it("moves through its items with the arrow keys, keeping the focus on its box, and takes the one reached on Enter", async () => {
    const { user, picked, field } = setup();
    field().focus();
    await user.keyboard("{ArrowDown}");
    expect(field().getAttribute("aria-expanded")).toBe("true");
    expect(keyed(field())).toBeNull();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(keyed(field())).toBe(OPTIONS[1]);
    expect(screen.getByRole("option", { name: OPTIONS[1] }).hasAttribute("data-keyed")).toBe(true);
    await user.keyboard("{ArrowUp}");
    expect(keyed(field())).toBe(OPTIONS[0]);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(picked).toEqual([OPTIONS[1]]);
    expect(field().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(field());
  });

  it("moves on from the item under the pointer, and takes the one reached on Space", async () => {
    const { user, picked, field } = setup();
    await user.click(field());
    await user.hover(screen.getByRole("option", { name: OPTIONS[1] }));
    await user.keyboard("{ArrowUp}");
    expect(keyed(field())).toBe(OPTIONS[0]);
    await user.keyboard("{ArrowDown} ");
    expect(picked).toEqual([OPTIONS[1]]);
  });

  it("closes on a press outside it", async () => {
    const { user, field } = setup();
    await user.click(field());
    fireEvent.pointerDown(document.body);
    expect(field().getAttribute("aria-expanded")).toBe("false");
  });

  it("can open with its list showing", () => {
    setup({ defaultOpen: true });
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("doesn't open while disabled", async () => {
    const { user, field } = setup({ disabled: true });
    await user.click(field());
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("gives its hint its tone", () => {
    setup({ tone: "warning" });
    expect(screen.getByText("Pick one").getAttribute("data-tone")).toBe("warning");
  });

  it("selects only the first of items alike, and shows an item's words for its value", () => {
    render(
      <Dropdown value="b" onChange={() => {}} defaultOpen>
        <Dropdown.Item value="a"><Typography variant="bodyLarge">String value</Typography></Dropdown.Item>
        <Dropdown.Item value="b"><Typography variant="bodyLarge">Picked</Typography></Dropdown.Item>
        <Dropdown.Item value="b"><Typography variant="bodyLarge">Picked</Typography></Dropdown.Item>
      </Dropdown>,
    );
    expect(screen.getAllByRole("option").map((option) => option.getAttribute("aria-selected"))).toEqual([
      "false",
      "true",
      "false",
    ]);
    expect(screen.getByRole("button", { expanded: true }).textContent).toBe("Picked");
  });

  it("holds the item picked when not given a value, from its default", async () => {
    const onChange = vi.fn();
    render(
      <Field>
        <Field.Label>Label</Field.Label>
        <Dropdown defaultValue="1" onChange={onChange}>
          <Dropdown.Item value="1"><Typography variant="bodyLarge">First</Typography></Dropdown.Item>
          <Dropdown.Item value="2"><Typography variant="bodyLarge">Second</Typography></Dropdown.Item>
        </Dropdown>
      </Field>,
    );
    const field = screen.getByRole("button", { name: /Label/ });
    expect(field.textContent).toBe("First");
    await userEvent.click(field);
    await userEvent.click(screen.getByRole("option", { name: "Second" }));
    expect(field.textContent).toBe("Second");
    expect(onChange).toHaveBeenCalledWith("2");
  });
});

describe("a list's dividers", () => {
  it("are their own rows, between items only", async () => {
    render(
      <Dropdown defaultOpen>
        <Dropdown.Item><Typography variant="bodyLarge">One</Typography></Dropdown.Item>
        <Dropdown.Item><Typography variant="bodyLarge">Two</Typography></Dropdown.Item>
        <Dropdown.Item><Typography variant="bodyLarge">Three</Typography></Dropdown.Item>
      </Dropdown>,
    );
    const rows = [...screen.getByRole("listbox").children].map((row) => row.tagName);
    expect(rows).toEqual(["BUTTON", "HR", "BUTTON", "HR", "BUTTON"]);
  });
});

describe("ListItem", () => {
  it("stands alone in a list, selected or not, its status after its words", async () => {
    const onClick = vi.fn();
    render(
      <div role="listbox">
        <ListItem selected onClick={onClick}>
          <Typography variant="bodyLarge">String value</Typography>
          <ListItem.Status>
            <b>Active</b>
          </ListItem.Status>
        </ListItem>
      </div>,
    );
    const item = screen.getByRole("option");
    expect(item.getAttribute("aria-selected")).toBe("true");
    expect([...item.children].map((part) => part.tagName)).toEqual(["SPAN", "DIV"]);
    expect(item.firstElementChild!.textContent).toBe("String value");
    await userEvent.click(item);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("takes its first Typography as its words and the next as the caption under them, its value and box showing the words alone", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown defaultValue="">
        <Dropdown.Item>
          <Typography variant="bodyLarge">Maria Franci</Typography>
          <Typography variant="metadata">+1 (647) 555-0142</Typography>
        </Dropdown.Item>
      </Dropdown>,
    );
    const box = screen.getByRole("button");
    await user.click(box);
    const words = screen.getByRole("option").querySelector("[data-words]")!;
    expect([...words.children].map((part) => [part.textContent, part.getAttribute("data-typography")])).toEqual([
      ["Maria Franci", "bodyLarge"],
      ["+1 (647) 555-0142", "metadata"],
    ]);
    await user.click(screen.getByRole("option"));
    expect(box.textContent).toBe("Maria Franci");
  });

  it("is a menu's item when told, as a sidebar's and a context menu's are", () => {
    render(
      <ListItem type="menu">
        <Typography variant="body">Shifts</Typography>
      </ListItem>,
    );
    expect(screen.getByRole("option").getAttribute("data-type")).toBe("menu");
  });

  it("is selected when pressed, standing alone without being told", async () => {
    render(<ListItem><Typography variant="bodyLarge">String value</Typography></ListItem>);
    const item = screen.getByRole("option");
    expect(item.getAttribute("aria-selected")).toBe("false");
    await userEvent.click(item);
    expect(item.getAttribute("aria-selected")).toBe("true");
  });

  it("names its parts for the code view", () => {
    expect(Dropdown.displayName).toBe("Dropdown");
    expect([Field.Label, ListItem, ListItem.Status, Dropdown.Item, Field.HintText].map((part) => part.displayName)).toEqual([
      "Field.Label",
      "ListItem",
      "ListItem.Status",
      "Dropdown.Item",
      "Field.HintText",
    ]);
  });
});
