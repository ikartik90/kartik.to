import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Avatar } from "../data-table";
import { Search, TypeAhead } from "../search";
import { Field, Typography, glyph } from "../ui";
import { keyed } from "./story-harness";
import face from "../assets/faces/placeholder-female.png";

afterEach(cleanup);

const OPTIONS = [
  { value: "maria", label: "Maria Franci" },
  { value: "aspen", label: "Aspen Curtis" },
  { value: "disha", label: "Disha Patil" },
];

function setup(start: string | null = null) {
  const user = userEvent.setup();
  const values: (string | null)[] = [];
  function Harness() {
    const [value, setValue] = useState(start);
    return (
      <Field>
        <Field.Label>Label</Field.Label>
        <TypeAhead
          value={value}
          onChange={(next) => {
            values.push(next);
            setValue(next);
          }}
        >
          {OPTIONS.map((option) => (
            <TypeAhead.Item key={option.value} value={option.value}>
              <Typography variant="bodyLarge">{option.label}</Typography>
              <Typography variant="metadata" className={glyph.subdued}>CCLS Pool</Typography>
            </TypeAhead.Item>
          ))}
        </TypeAhead>
        <Field.HintText>Hint text</Field.HintText>
      </Field>
    );
  }
  render(<Harness />);
  const input = screen.getByRole("combobox", { name: "Label" });
  const shown = () => screen.queryAllByRole("option").map((option) => option.textContent);
  return { user, input, values, shown };
}

describe("the type-ahead search", () => {
  it("suggests every option once focused, each over its subcontent", async () => {
    const { user, input, shown } = setup();
    expect(screen.getByText("Hint text")).toBeTruthy();
    await user.click(input);
    expect(screen.getByRole("listbox", { name: "Label" })).toBeTruthy();
    expect(shown()).toEqual(["Maria FranciCCLS Pool", "Aspen CurtisCCLS Pool", "Disha PatilCCLS Pool"]);
  });

  it("narrows its suggestions to what's typed, by their names alone", async () => {
    const { user, input, shown } = setup();
    await user.type(input, "pat");
    expect(shown()).toEqual(["Disha PatilCCLS Pool"]);
    await user.clear(input);
    await user.type(input, "ccls");
    expect(shown()).toEqual([]);
  });

  it("narrows them by its owner's own test when given one, as a worker's phone number", async () => {
    const user = userEvent.setup();
    const phones: Record<string, string> = { maria: "4375550101", aspen: "9055550118", disha: "6475550142" };
    render(
      <Field>
        <Field.Label>Label</Field.Label>
        <TypeAhead matches={(value, typed) => phones[value].includes(typed)}>
          {OPTIONS.map((option) => (
            <TypeAhead.Item key={option.value} value={option.value}>
              <Typography variant="bodyLarge">{option.label}</Typography>
            </TypeAhead.Item>
          ))}
        </TypeAhead>
      </Field>,
    );
    await user.type(screen.getByRole("combobox", { name: "Label" }), "6");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Disha Patil"]);
  });

  it("takes the suggestion picked, showing its name", async () => {
    const { user, input, values } = setup();
    await user.type(input, "asp");
    await user.click(screen.getByRole("option", { name: /Aspen Curtis/ }));
    expect(values.at(-1)).toBe("aspen");
    expect((input as HTMLInputElement).value).toBe("Aspen Curtis");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("starts with the name of the option it holds", () => {
    const { input } = setup("disha");
    expect((input as HTMLInputElement).value).toBe("Disha Patil");
  });

  it("shows the name of an option its owner picks from outside", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState<string | null>("maria");
      return (
        <>
          <button type="button" onClick={() => setValue("aspen")}>Pick Aspen</button>
          <Field>
            <Field.Label>Label</Field.Label>
            <TypeAhead value={value} onChange={setValue}>
              {OPTIONS.map((option) => (
                <TypeAhead.Item key={option.value} value={option.value}>
                  <Typography variant="bodyLarge">{option.label}</Typography>
                </TypeAhead.Item>
              ))}
            </TypeAhead>
          </Field>
        </>
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Pick Aspen" }));
    expect(screen.getByRole<HTMLInputElement>("combobox", { name: "Label" }).value).toBe("Aspen Curtis");
  });

  it("takes the first suggestion on Enter", async () => {
    const { user, input, values } = setup();
    await user.type(input, "ma{Enter}");
    expect(values.at(-1)).toBe("maria");
  });

  it("moves through its suggestions with the arrow keys, keeping the focus in its box, and takes the one reached on Enter", async () => {
    const { user, input, values } = setup();
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(keyed(input)).toBe("Aspen CurtisCCLS Pool");
    await user.keyboard("{ArrowUp}");
    expect(keyed(input)).toBe("Maria FranciCCLS Pool");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(values.at(-1)).toBe("aspen");
    expect((input as HTMLInputElement).value).toBe("Aspen Curtis");
    expect(document.activeElement).toBe(input);
  });

  it("lets go of the suggestion reached once it's typed in", async () => {
    const { user, input, values } = setup();
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    await user.keyboard("a");
    expect(keyed(input)).toBeNull();
    await user.keyboard("{Enter}");
    expect(values.at(-1)).toBe("maria");
  });

  it("clears what's typed and its pick from the cross", async () => {
    const { user, input, values } = setup("maria");
    await user.click(input);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect((input as HTMLInputElement).value).toBe("");
    expect(values.at(-1)).toBeNull();
  });

  it("holds the suggestion picked when not given a value, from its default", async () => {
    const user = userEvent.setup();
    render(
      <Field>
        <Field.Label>Label</Field.Label>
        <TypeAhead defaultValue="maria">
          {OPTIONS.map((option) => (
            <TypeAhead.Item key={option.value} value={option.value}>
              <Typography variant="bodyLarge">{option.label}</Typography>
            </TypeAhead.Item>
          ))}
        </TypeAhead>
      </Field>,
    );
    const input = screen.getByRole<HTMLInputElement>("combobox", { name: "Label" });
    expect(input.value).toBe("Maria Franci");
    await user.clear(input);
    expect(screen.getAllByRole("option").map((option) => option.getAttribute("aria-selected"))).toEqual(["false", "false", "false"]);
    await user.click(screen.getByRole("option", { name: "Aspen Curtis" }));
    expect(input.value).toBe("Aspen Curtis");
    await user.tab();
    await user.click(input);
    expect(screen.getByRole("option", { selected: true }).textContent).toBe("Aspen Curtis");
  });

  it("shows an option's avatar before its name", () => {
    render(
      <Field>
        <Field.Label>Label</Field.Label>
        <TypeAhead value={null} onChange={() => {}} defaultOpen>
          <TypeAhead.Item value="1">
            <Avatar src={face} size="medium" />
            <Typography variant="bodyLarge">String value</Typography>
          </TypeAhead.Item>
        </TypeAhead>
      </Field>,
    );
    const option = screen.getByRole("option");
    expect(option.firstElementChild!.querySelector("img")).not.toBeNull();
    expect(option.textContent).toBe("String value");
  });

  it("is Active while it's focused, before it has anything to suggest", async () => {
    const user = userEvent.setup();
    render(
      <Field>
        <Field.Label>Label</Field.Label>
        <TypeAhead value={null} onChange={() => {}} />
      </Field>,
    );
    const state = () => screen.getByRole("combobox").closest("[data-box]")!.getAttribute("data-state");
    expect(state()).toBeNull();
    await user.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(state()).toBe("active");
    await user.tab();
    expect(state()).toBeNull();
  });

  it("holds its Active look without suggestions, and takes its tone", () => {
    render(
      <Field data-active="">
        <Field.Label>Label</Field.Label>
        <TypeAhead value={null} onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByRole("combobox").closest("[data-state]")!.getAttribute("data-state")).toBe("active");
    cleanup();
    render(
      <Field tone="warning">
        <Field.Label>Label</Field.Label>
        <TypeAhead value={null} onChange={() => {}} />
        <Field.HintText>Warning text</Field.HintText>
      </Field>,
    );
    expect(screen.getByText("Warning text").getAttribute("data-tone")).toBe("warning");
  });

  it("names its parts for the code view", () => {
    expect(Search.displayName).toBe("Search");
    expect(TypeAhead.displayName).toBe("TypeAhead");
    expect([Field, Field.Label, TypeAhead.Item, Field.HintText].map((part) => part.displayName)).toEqual([
      "Field",
      "Field.Label",
      "TypeAhead.Item",
      "Field.HintText",
    ]);
  });
});

describe("the small type-ahead", () => {
  const TAGS = ["Weekends", "Forklift", "AM"];
  function setup(props: { tone?: "alert" } = {}) {
    const user = userEvent.setup();
    const values: (string | null)[] = [];
    function Harness() {
      const [value, setValue] = useState<string | null>(null);
      return (
        <TypeAhead
          size="small"
          creates="tag"
          aria-label="Tag name"
          value={value}
          onChange={(next) => {
            values.push(next);
            setValue(next);
          }}
          {...props}
        >
          {TAGS.map((tag) => (
            <TypeAhead.Item key={tag} value={tag}>
              <Typography variant="metadata">{tag}</Typography>
            </TypeAhead.Item>
          ))}
        </TypeAhead>
      );
    }
    render(<Harness />);
    const input = screen.getByRole<HTMLInputElement>("combobox", { name: "Tag name" });
    const shown = () => screen.queryAllByRole("option").map((option) => option.textContent);
    return { user, input, values, shown };
  }

  it("is an inline input's box, its suggestions a filter's small items", async () => {
    const { user, input } = setup();
    expect(input.closest("[data-box]")!.getAttribute("data-size")).toBe("small");
    await user.click(input);
    expect(screen.getAllByRole("option").map((option) => option.getAttribute("data-size"))).toEqual(["small", "small", "small"]);
  });

  it("offers last to create what's typed, unless it names one of its items", async () => {
    const { user, input, shown } = setup();
    await user.type(input, "week");
    expect(shown()).toEqual(["Weekends", 'Create "week" tag']);
    await user.clear(input);
    await user.type(input, "weekends");
    expect(shown()).toEqual(["Weekends"]);
  });

  it("holds what's typed, or the item it names", async () => {
    const { user, input, values } = setup();
    await user.type(input, "forklift");
    expect(values.at(-1)).toBe("Forklift");
    await user.clear(input);
    await user.type(input, "Pallet jack");
    expect(values.at(-1)).toBe("Pallet jack");
  });

  it("takes what's typed from its create suggestion, and on Enter", async () => {
    const { user, input, values } = setup();
    await user.type(input, "pallet");
    await user.click(screen.getByRole("option", { name: 'Create "pallet" tag' }));
    expect(input.value).toBe("pallet");
    expect(values.at(-1)).toBe("pallet");
    expect(screen.queryByRole("listbox")).toBeNull();
    await user.clear(input);
    await user.type(input, "Dock{Enter}");
    expect(input.value).toBe("Dock");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("takes its tone outside a field", () => {
    const { input } = setup({ tone: "alert" });
    expect(input.closest("[data-box]")!.getAttribute("data-state")).toBe("alert");
  });
});
