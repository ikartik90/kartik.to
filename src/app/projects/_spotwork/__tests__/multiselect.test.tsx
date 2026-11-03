import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Multiselect } from "../multiselect";
import { Field, Pill } from "../ui";

afterEach(cleanup);

const SKILLS = ["Assembly", "Forklift", "Packing"];

function setup(props: { tone?: "warning" | "alert" } = {}) {
  const user = userEvent.setup();
  const values: string[][] = [];
  function Harness() {
    const [value, setValue] = useState<string[]>([]);
    return (
      <Field {...props}>
        <Field.Label>Skills</Field.Label>
        <Multiselect
          placeholder="Find a skill..."
          value={value}
          onChange={(next) => {
            values.push(next);
            setValue(next);
          }}
        >
          {SKILLS.map((skill) => (
            <Multiselect.Option key={skill}>
              {skill}
              <Pill>Skill</Pill>
            </Multiselect.Option>
          ))}
          <Multiselect.Option value="cook">Line Cook</Multiselect.Option>
        </Multiselect>
        <Field.HintText>Select at least one skill</Field.HintText>
      </Field>
    );
  }
  render(<Harness />);
  const table = () => screen.getByRole("table", { name: "Skills" });
  const rows = () => within(table()).getAllByRole("row").slice(1);
  const boxes = () => within(table()).getAllByRole("checkbox");
  const box = () => table().closest("[data-multiselect]")!;
  return { user, values, rows, boxes, box };
}

describe("Multiselect", () => {
  it("lists its options as rows under a search, each its checkbox, its words and its pill", () => {
    const { rows } = setup();
    expect(rows().map((row) => [...row.children].map((cell) => cell.textContent))).toEqual([
      ["", "Assembly", "Skill"],
      ["", "Forklift", "Skill"],
      ["", "Packing", "Skill"],
      ["", "Line Cook"],
    ]);
    expect(rows().map((row) => within(row).getByRole("checkbox").getAttribute("aria-label"))).toEqual([...SKILLS, "Line Cook"]);
    const search = screen.getByRole("searchbox", { name: "Skills" });
    expect(search.getAttribute("placeholder")).toBe("Find a skill...");
    expect(search.getAttribute("aria-describedby")).toBe(screen.getByText("Select at least one skill").closest("[id]")!.id);
  });

  it("names its search, not its checkboxes, by its field's label", async () => {
    const { user } = setup();
    await user.click(screen.getByText("Skills"));
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
    expect(screen.getAllByLabelText("Skills")).toEqual([screen.getByRole("table"), screen.getByRole("searchbox")]);
  });

  it("picks an option by its value, its words by default, and lets it go", async () => {
    const { user, values, boxes } = setup();
    await user.click(screen.getByRole("checkbox", { name: "Forklift" }));
    await user.click(screen.getByRole("checkbox", { name: "Line Cook" }));
    expect(values.at(-1)).toEqual(["Forklift", "cook"]);
    expect(boxes().map((each) => each.getAttribute("aria-checked"))).toEqual(["false", "true", "false", "true"]);
    await user.click(screen.getByRole("checkbox", { name: "Forklift" }));
    expect(values.at(-1)).toEqual(["cook"]);
  });

  it("picks an option when its row is pressed away from its checkbox, and lets it go when it's pressed again", async () => {
    const { user, values, boxes } = setup();
    await user.click(screen.getByText("Forklift"));
    expect(values).toEqual([["Forklift"]]);
    expect(boxes().map((each) => each.getAttribute("aria-checked"))).toEqual(["false", "true", "false", "false"]);
    await user.click(screen.getByText("Forklift"));
    expect(values.at(-1)).toEqual([]);
    await user.click(screen.getAllByText("Skill")[0]);
    expect(values.at(-1)).toEqual(["Assembly"]);
  });

  it("marks the rows of the options picked, for the table to fill", async () => {
    const { user, rows } = setup();
    await user.click(screen.getByText("Packing"));
    expect(rows().map((row) => row.hasAttribute("data-picked"))).toEqual([false, false, true, false]);
  });

  it("picks an option once when its checkbox is pressed, its row not pressing again", async () => {
    const { user, values } = setup();
    await user.click(screen.getByRole("checkbox", { name: "Packing" }));
    expect(values).toEqual([["Packing"]]);
  });

  it("narrows its rows to what's searched in their words, not their pills'", async () => {
    const { user, rows } = setup();
    await user.type(screen.getByRole("searchbox"), "IN");
    expect(rows().map((row) => row.children[1].textContent)).toEqual(["Packing", "Line Cook"]);
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "skill");
    expect(rows()).toEqual([]);
  });

  it("holds the options picked when not given them, from its default", async () => {
    const user = userEvent.setup();
    const values: string[][] = [];
    render(
      <Multiselect aria-label="Skills" defaultValue={["Packing"]} onChange={(next) => values.push(next)}>
        {SKILLS.map((skill) => (
          <Multiselect.Option key={skill}>{skill}</Multiselect.Option>
        ))}
      </Multiselect>,
    );
    const ticked = () => screen.getAllByRole("checkbox").map((each) => each.getAttribute("aria-checked"));
    expect(ticked()).toEqual(["false", "false", "true"]);
    await user.click(screen.getByRole("checkbox", { name: "Assembly" }));
    expect(ticked()).toEqual(["true", "false", "true"]);
    expect(values).toEqual([["Packing", "Assembly"]]);
    expect(screen.getByRole("searchbox", { name: "Skills" })).toBeTruthy();
  });

  it("keeps a disabled option as it's held, its row disabled throughout", async () => {
    const user = userEvent.setup();
    const values: string[][] = [];
    render(
      <Multiselect aria-label="Requirements" defaultValue={["Gloves"]} onChange={(next) => values.push(next)}>
        <Multiselect.Option disabled>
          Gloves
          <Pill>Equipment</Pill>
        </Multiselect.Option>
        <Multiselect.Option>Hard Hat</Multiselect.Option>
      </Multiselect>,
    );
    const gloves = screen.getByRole("checkbox", { name: "Gloves" });
    expect(gloves.getAttribute("aria-checked")).toBe("true");
    expect(gloves).toHaveProperty("disabled", true);
    await user.click(gloves);
    await user.click(screen.getByText("Gloves"));
    expect(values).toEqual([]);
    expect(gloves.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Equipment").closest("[data-tone]")!.getAttribute("data-tone")).toBe("disabled");
    await user.click(screen.getByRole("checkbox", { name: "Hard Hat" }));
    expect(values).toEqual([["Gloves", "Hard Hat"]]);
  });

  it("is a field's box: Active while anything in it has focus, else in its field's tone, its hint too", () => {
    const { box, boxes } = setup();
    expect(box().getAttribute("data-state")).toBeNull();
    fireEvent.focus(screen.getByRole("searchbox"));
    expect(box().getAttribute("data-state")).toBe("active");
    fireEvent.blur(screen.getByRole("searchbox"), { relatedTarget: boxes()[0] });
    fireEvent.focus(boxes()[0]);
    expect(box().getAttribute("data-state")).toBe("active");
    fireEvent.blur(boxes()[0]);
    expect(box().getAttribute("data-state")).toBeNull();
    cleanup();
    setup({ tone: "alert" });
    expect(box().getAttribute("data-state")).toBe("alert");
    expect(screen.getByText("Select at least one skill").getAttribute("data-tone")).toBe("alert");
  });

  it("names its parts for the code view", () => {
    expect(Multiselect.displayName).toBe("Multiselect");
    expect([Field.Label, Multiselect.Option, Field.HintText].map((part) => part.displayName)).toEqual([
      "Field.Label",
      "Multiselect.Option",
      "Field.HintText",
    ]);
  });
});
