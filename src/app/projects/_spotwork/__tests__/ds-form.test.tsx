import { cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PEOPLE } from "../data";
import { FORM_PRIMITIVES, FORM_STORIES, SEARCH } from "../ds-form";
import { CHOICES, WORKING_CONDITIONS } from "../presets";
import { renderStories } from "./story-harness";

afterEach(cleanup);

const IDS = [
  "Checkbox",
  "Radio Button",
  "Switch",
  "Text Input",
  "Text Area",
  "Dropdown",
  "List Item",
  "Type-ahead",
  "Date Picker",
  "Calendar",
  "Time Picker",
  "Search",
  "Multiselect",
  "Tags Field",
];

// Checkbox, Switch and List Item are listed under Primitives, Search under Filter; the page's order is the form's.
const render = (ids = IDS) =>
  renderStories(
    ids.map((id) => [...FORM_STORIES, ...FORM_PRIMITIVES, SEARCH].find((story) => story.id === id)!).filter(Boolean),
  );
const checked = (control: HTMLElement) => control.getAttribute("aria-checked");

describe("the Form page's fields", () => {
  it("shows each by its Figma properties", () => {
    const { titles } = render();
    expect(IDS.map((id) => [id, titles(id)])).toEqual([
      ["Checkbox", ["State", "Size"]],
      ["Radio Button", ["State", "Size"]],
      ["Switch", ["Is disabled", "Size"]],
      ["Text Input", ["State", "Prefix & suffix", "Size"]],
      ["Text Area", ["State", "Is resizable"]],
      ["Dropdown", ["State", "Size", "Multiple"]],
      ["List Item", ["State", "Size", "Dropdown item", "Type-ahead item", "Popover menu item", "Bulk select item", "Sidebar item"]],
      ["Type-ahead", ["State", "Size", "Create option"]],
      ["Date Picker", ["State", "Size", "Select"]],
      ["Calendar", ["View type", "Size", "Drag to select", "Date range type"]],
      ["Time Picker", ["State", "Time difference"]],
      ["Search", ["Size"]],
      ["Multiselect", ["State", "Disabled option"]],
      ["Tags Field", ["State"]],
    ]);
  });

  it("writes each example as the code that draws it", () => {
    const { code } = render();
    // The workers come from the store, not from pictures in the code.
    const typeAhead = code("Type-ahead");
    expect(typeAhead).not.toContain("@/assets");
    expect(typeAhead).toContain('import type { Worker } from "@/domain/worker"');
    expect(typeAhead).toContain("export function TypeAheadDemo({ workers }: { workers: Worker[] }) {");
    expect(typeAhead).toContain(
      [
        "          {workers.map((worker) => (",
        "            <TypeAhead.Item key={worker.id} value={worker.id}>",
        '              <Avatar src={worker.face} size="medium" />',
        '              <Typography variant="bodyLarge">{worker.name}</Typography>',
        '              <Typography variant="metadata" color="subdued">',
        "                {worker.profile.phone}",
        "              </Typography>",
        "            </TypeAhead.Item>",
        "          ))}",
      ].join("\n"),
    );
    expect(code("Calendar", "Date range type")).toContain('select="range"');
    expect(code("Checkbox", "Size")).toContain('<Checkbox defaultChecked size="small" />');
    expect(code("Dropdown", "State")).toContain('<Dropdown defaultValue="Florida, USA (305) 703-0177" defaultOpen>');
    expect(code("Checkbox")).toContain(
      ['    <Field orientation="horizontal">', "      <Checkbox defaultChecked />", "      <Field.Content>"].join("\n"),
    );
    expect(typeAhead).toContain('<TypeAhead defaultValue="maria">');
    expect(code("Calendar", "View type")).toContain('defaultView="month"');
    // In its parts, as the portfolio's Calendar is.
    expect(code("Calendar")).toContain(
      [
        "      <Calendar.PeriodList>",
        "        <Calendar.Prev>",
        "          <ChevronLeftIcon aria-hidden />",
        "        </Calendar.Prev>",
        "        <Calendar.Period>",
        "          <Calendar.Month />",
        "          <Calendar.Week>",
        "            <Calendar.Day />",
        "          </Calendar.Week>",
        "          <Calendar.Grid>",
        "            <Calendar.Date />",
        "          </Calendar.Grid>",
        "        </Calendar.Period>",
        "        <Calendar.Next>",
      ].join("\n"),
    );
    expect(code("Multiselect")).toContain('import { Multiselect } from "@/components/ui/multiselect"');
    expect(code("Multiselect")).toContain(WORKING_CONDITIONS[0]);
    expect(code("Multiselect")).toContain("<Pill>Working condition</Pill>");
    expect(code("Tags Field")).toContain('import { TagsField } from "@/components/ui/tags-field"');
  });
});

describe("Atoms/Form/Checkbox and Radio Button", () => {
  it("toggle, or are picked, by themselves when pressed", async () => {
    const { preview, user } = render();
    const box = within(preview("Checkbox")).getByRole("checkbox");
    await user.click(box);
    expect(checked(box)).toBe("false");
    const small = within(preview("Checkbox", "Size")).getAllByRole("checkbox")[1];
    await user.click(small);
    expect(checked(small)).toBe("false");
    const radio = within(preview("Radio Button", "Size")).getAllByRole("radio")[1];
    expect(radio.getAttribute("data-size")).toBe("small");
    await user.click(radio);
    expect(checked(radio)).toBe("true");
  });

  it("show the disabled, warning and error states beside the default", () => {
    const { preview } = render();
    const boxes = within(preview("Checkbox", "State")).getAllByRole<HTMLButtonElement>("checkbox");
    expect(boxes.map((box) => [box.disabled, box.getAttribute("data-tone")])).toEqual([
      [false, null],
      [true, null],
      [false, "warning"],
      [false, "alert"],
    ]);
  });
});

describe("Atoms/Form/Switch", () => {
  it("toggles by itself when pressed, and is disabled beside it", async () => {
    const { preview, user } = render();
    const toggle = within(preview("Switch")).getByRole("switch");
    expect(checked(toggle)).toBe("true");
    await user.click(toggle);
    expect(checked(toggle)).toBe("false");
    const pair = within(preview("Switch", "Is disabled")).getAllByRole<HTMLButtonElement>("switch");
    expect(pair.map((each) => each.disabled)).toEqual([false, true]);
  });
});

describe("Molecules/Form/Text Input and Text Area", () => {
  it("is small for a table cell or a filter", async () => {
    const { preview, user } = render();
    const [, small] = within(preview("Text Input", "Size")).getAllByRole<HTMLInputElement>("textbox");
    expect(small.parentElement!.getAttribute("data-size")).toBe("small");
    await user.clear(small);
    await user.type(small, "2.4");
    expect(small.value).toBe("2.4");
  });

  it("hold what's typed in them", async () => {
    const { preview, user } = render();
    const field = within(preview("Text Input")).getByRole<HTMLInputElement>("textbox");
    await user.type(field, "!");
    expect(field.value).toBe("Yousuf Hamedani!");
    const box = within(preview("Text Area")).getByRole<HTMLTextAreaElement>("textbox");
    await user.type(box, "!");
    expect(box.value).toBe("Tried contacting on cell. No response. Will retry in 15.!");
  });

  it("draw a text area's resize handle only while it's resizable", () => {
    const { preview } = render();
    const boxes = within(preview("Text Area", "Is resizable")).getAllByRole("textbox");
    expect(boxes.map((box) => box.parentElement!.querySelector("svg") !== null)).toEqual([true, false]);
  });
});

describe("Molecules/Form/Dropdown and its List Item", () => {
  it("shows the Active state open, and takes the item picked by itself", async () => {
    const { preview, user } = render();
    const states = preview("Dropdown", "State");
    expect(within(states).getByRole("listbox", { name: "Sending Phone Number" })).toBeTruthy();
    const field = within(preview("Dropdown")).getByRole("button", { name: /Sending Phone Number/ });
    await user.click(field);
    await user.click(within(preview("Dropdown")).getAllByRole("option")[1]);
    expect(field.getAttribute("aria-expanded")).toBe("false");
    await user.click(field);
    const options = within(preview("Dropdown")).getAllByRole("option");
    expect(options.map((option) => option.getAttribute("aria-selected"))).toEqual(["false", "true"]);
  });

  it("is small for a filter or a table cell, and picks several with their count on its box", async () => {
    const { preview, user } = render();
    const [, small] = within(preview("Dropdown", "Size")).getAllByRole("button");
    expect(small.textContent).toBe("Florida, USA (305) 703-0177");
    await user.click(small);
    expect(within(preview("Dropdown", "Size")).getAllByRole("option").map((option) => option.getAttribute("data-size"))).toEqual(
      Array(2).fill("small"),
    );
    const several = preview("Dropdown", "Multiple");
    const status = within(several).getByRole("button", { name: /Status/ });
    expect(status.textContent).toBe("Status2");
    await user.click(within(several).getByRole("option", { name: /Confirmed/ }));
    expect(status.textContent).toBe("Status3");
    expect(within(several).getByRole("option", { name: /Absent/ }).getAttribute("data-tone")).toBe("alert");
  });

  it("selects a list item by itself when pressed", async () => {
    const { preview, user } = render();
    const item = within(preview("List Item")).getByRole("option");
    expect(item.querySelector("img")).not.toBeNull();
    expect(item.querySelector("[data-words] > [data-typography=metadata]")!.textContent).toBe(Object.values(PEOPLE)[0].profile.phone);
    expect(item.getAttribute("aria-selected")).toBe("false");
    await user.click(item);
    expect(item.getAttribute("aria-selected")).toBe("true");
    const states = within(preview("List Item", "State")).getAllByRole("option");
    expect(states.map((each) => [each.getAttribute("aria-selected"), each.hasAttribute("data-hover")])).toEqual([
      ["false", false],
      ["false", true],
      ["true", false],
    ]);
    const sizes = within(preview("List Item", "Size")).getAllByRole("option");
    expect(sizes.map((each) => each.getAttribute("data-size"))).toEqual([null, "small"]);
  });

  it("shows under Usage, one example each, the items of the components that hold it, in them", () => {
    const { story, preview, code } = render();
    const usage = within(story("List Item")).getByRole("region", { name: "Usage" });
    const uses: [string, string, string, string][] = [
      ["Dropdown item", "Dropdown", "listbox", "option"],
      ["Type-ahead item", "TypeAhead", "listbox", "option"],
      ["Popover menu item", "PopoverMenu", "menu", "menuitem"],
      ["Bulk select item", "BulkSelect", "menu", "menuitem"],
      ["Sidebar item", "Sidebar", "navigation", "button"],
    ];
    expect(within(usage).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(
      uses.map(([title]) => title),
    );
    for (const [title, owner, list, item] of uses) {
      const shell = within(within(preview("List Item", title)).getByRole(list));
      expect(shell.getAllByRole(item).length).toBeGreaterThan(1);
      const printed = code("List Item", title);
      expect(printed).toMatch(new RegExp(`<${owner}[ >]`));
      expect(printed).toContain(`<${owner}.Item`);
      expect(printed).not.toContain("<ListItem");
      expect(printed).not.toContain('type="menu"');
    }
  });
});

describe("Molecules/Form/Date Picker and Calendar", () => {
  it("shows the Active state open, and takes the day picked by itself", async () => {
    const { preview, user } = render();
    expect(within(preview("Date Picker", "State")).getByRole("dialog", { name: "Shift Date" })).toBeTruthy();
    const field = within(preview("Date Picker")).getByRole("button", { name: "Shift Date" });
    expect(field.textContent).toBe("11/12/2023");
    await user.click(field);
    await user.click(within(preview("Date Picker")).getByRole("button", { name: /15 November/ }));
    expect(field.textContent).toBe("11/15/2023");
  });

  it("is small for a filter or a table cell, and takes a range from its presets", async () => {
    const { preview, user } = render();
    const [, small] = within(preview("Date Picker", "Size")).getAllByRole("button");
    expect(small.textContent).toBe("11/12/2023");
    const select = preview("Date Picker", "Select");
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["Last 7 days", "Last 14 days", "Custom"]);
    await user.click(within(select).getByRole("option", { name: "Last 7 days" }));
    expect(within(select).getByRole("button", { name: "11/4/2023 – 11/10/2023" })).toBeTruthy();
  });

  it("picks a day on the view by itself, and shows its Month view beside its Date view", async () => {
    const { preview, user } = render();
    const view = preview("Calendar");
    await user.click(within(view).getByRole("button", { name: /15 November/ }));
    expect(within(view).getByRole("button", { pressed: true }).textContent).toBe("15");
    const types = preview("Calendar", "View type");
    expect(within(types).getAllByRole("listbox", { name: "Year" })).toHaveLength(1);
    const ranges = [...preview("Calendar", "Date range type").querySelectorAll("[data-cell]")];
    expect(ranges.map((cell) => within(cell as HTMLElement).getAllByRole("button", { pressed: true }).length)).toEqual([1, 7, 2]);
  });
});

describe("Molecules/Form/Time Picker v2", () => {
  it("shows the Active state open, and takes the time picked by itself", async () => {
    // Alone: naming its 96 rows walks the page once per row and label in jsdom, seconds on the whole Form page.
    const { preview, user } = render(["Time Picker"]);
    const states = preview("Time Picker", "State");
    const fields = within(states).getAllByRole<HTMLInputElement>("combobox");
    expect(fields.map((field) => field.value)).toEqual(Array(5).fill("11:47 PM"));
    await user.click(within(states).getByRole("option", { name: "11:30 PM" }));
    expect(fields[4].value).toBe("11:30 PM");
  });
});

describe("Calendar's drag to select", () => {
  it("shows the shift form's three months, its weekdays picked, and picks a day pressed from the keyboard", async () => {
    const { preview, user } = render();
    const strip = preview("Calendar", "Drag to select");
    const picked = () => strip.querySelectorAll("[aria-pressed=true], [aria-selected=true]").length;
    expect(picked()).toBe(10);
    const day = within(strip).getByRole("button", { name: "Monday, 20 November, 2023" });
    day.focus();
    await user.keyboard("{Enter}");
    expect(picked()).toBe(11);
  });
});

describe("Search and Type-ahead", () => {
  it("is a search box by default, taking what's typed and clearing it", async () => {
    const { preview, user } = render();
    const box = within(preview("Search"));
    const search = box.getByRole<HTMLInputElement>("searchbox", { name: "Search..." });
    await user.type(search, "Ada");
    expect(search.value).toBe("Ada");
    await user.click(box.getByRole("button", { name: "Clear" }));
    expect(search.value).toBe("");
    expect(box.queryByRole("combobox")).toBeNull();
  });

  it("shows the Active state open on what's typed, its workers each with a face and phone number", async () => {
    const { preview, story, user } = render();
    const options = within(preview("Type-ahead", "State")).getAllByRole("option");
    const matching = Object.values(PEOPLE)
      .slice(0, 6)
      .filter((person) => person.name.toLowerCase().includes("ma"));
    expect(options.map((option) => [option.querySelector("img") !== null, option.textContent])).toEqual(
      matching.map((person) => [true, `${person.name}${person.profile.phone}`]),
    );
    // A press elsewhere on the page, as landing on it from the sidebar is, leaves the state shown.
    await user.click(within(story("Type-ahead")).getByRole("heading", { level: 1 }));
    expect(within(preview("Type-ahead", "State")).getByRole("listbox")).toBeTruthy();
  });

  it("starts on a worker picked, and takes the suggestion picked by itself", async () => {
    const { preview, user } = render();
    const typeAhead = () => within(preview("Type-ahead"));
    const input = typeAhead().getByRole<HTMLInputElement>("combobox");
    expect(input.value).toBe(Object.values(PEOPLE)[0].name);
    await user.clear(input);
    await user.click(typeAhead().getAllByRole("option")[1]);
    expect(input.value).toBe(Object.values(PEOPLE)[1].name);
    expect(typeAhead().queryByRole("listbox")).toBeNull();
  });

  it("is Atoms/Context Search at size small, a search box taking what's typed", async () => {
    const { preview, user } = render();
    const size = within(preview("Search", "Size"));
    const [large, search] = size.getAllByRole<HTMLInputElement>("searchbox", { name: "Search..." });
    expect(large).toBeTruthy();
    await user.type(search, "Ada");
    expect(search.value).toBe("Ada");
  });
});

describe("Atoms/Form/Multiselect", () => {
  it("lists two skills and a requirement of each kind, each with its kind's pill, and ticks one by itself", async () => {
    const { preview, user } = render();
    const table = within(preview("Multiselect")).getByRole("table", { name: "Skills & requirements" });
    const rows = within(table).getAllByRole("row").slice(1);
    const kinds = ["skill", "equipment", "physical", "certificates", "conditions"];
    expect(rows.map((row) => row.children[1].textContent)).toEqual([
      ...CHOICES.filter(({ kind }) => kind === "skill").slice(0, 2).map(({ name }) => name),
      ...kinds.slice(1).map((kind) => CHOICES.find((choice) => choice.kind === kind)!.name),
    ]);
    expect(rows.map((row) => row.children[2].textContent)).toEqual(["Skill", "Skill", "Equipment", "Physical", "Certificate", "Working condition"]);
    const boxes = within(table).getAllByRole("checkbox");
    await user.click(boxes[1]);
    expect(boxes.map((box) => box.getAttribute("aria-checked"))).toEqual(["false", "true", "false", "false", "false", "false"]);
  });

  it("rings its alert and its warning as a field's box does", () => {
    const { preview } = render();
    const boxes = within(preview("Multiselect", "State")).getAllByRole("table").map((table) => table.parentElement!);
    expect(boxes.map((box) => box.getAttribute("data-state"))).toEqual([null, "alert", "warning"]);
  });

  it("keeps a team's mandatory requirements ticked and disabled", () => {
    const { preview } = render();
    const boxes = within(preview("Multiselect", "Disabled option")).getAllByRole("checkbox");
    expect(boxes.map((box) => [box.getAttribute("aria-checked"), (box as HTMLButtonElement).disabled])).toEqual([
      ["false", false],
      ["false", false],
      ["true", true],
      ["true", true],
      ["false", false],
      ["false", false],
    ]);
  });
});
