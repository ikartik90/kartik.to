import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { TagsField } from "../tags-field";
import { Field } from "../ui";
import { keyed } from "./story-harness";

afterEach(cleanup);

const OPTIONS = ["Licensed", "Loading", "Reach Truck", "Warehouse"];

function setup(initial: string[] = [], props: { disabled?: boolean } = {}) {
  const user = userEvent.setup();
  const changes: string[][] = [];
  function Harness() {
    const [tags, setTags] = useState(initial);
    return (
      <Field disabled={props.disabled}>
        <Field.Label>Tags</Field.Label>
        <TagsField
          options={OPTIONS}
          value={tags}
          onChange={(next) => {
            changes.push(next);
            setTags(next);
          }}
        />
      </Field>
    );
  }
  render(<Harness />);
  const input = () => screen.getByRole<HTMLInputElement>("combobox", { name: "Tags" });
  const chips = () => within(screen.getByRole("group", { name: "Tags" })).queryAllByText(/./).map((chip) => chip.textContent);
  const listed = () => screen.queryAllByRole("option").map((option) => option.textContent);
  return { user, input, chips, listed, changes };
}

describe("the tags field", () => {
  it("shows its tags as chips, each taken away by its cross", async () => {
    const { user, chips, changes } = setup(["Licensed", "Warehouse"]);
    expect(chips()).toEqual(["Licensed", "Warehouse"]);
    await user.click(screen.getByRole("button", { name: "Remove Licensed" }));
    expect(changes).toEqual([["Warehouse"]]);
    expect(chips()).toEqual(["Warehouse"]);
  });

  it("suggests the tags not yet added whose words hold what's typed, and adds the one picked", async () => {
    const { user, input, chips, listed } = setup(["Warehouse"]);
    await user.type(input(), "l");
    expect(listed()).toEqual(["Licensed", "Loading", 'Create "l" tag']);
    await user.click(screen.getByRole("option", { name: "Loading" }));
    expect(chips()).toEqual(["Warehouse", "Loading"]);
    expect(input().value).toBe("");
    expect(document.activeElement).toBe(input());
  });

  it("offers to create a tag from what's typed unless a tag is already called that", async () => {
    const { user, input, chips, listed } = setup();
    await user.type(input(), "reach truck");
    expect(listed()).toEqual(["Reach Truck"]);
    await user.clear(input());
    await user.type(input(), "Night Shift");
    expect(listed()).toEqual(['Create "Night Shift" tag']);
    await user.click(screen.getByRole("option", { name: 'Create "Night Shift" tag' }));
    expect(chips()).toEqual(["Night Shift"]);
    await user.type(input(), "night shift");
    expect(listed()).toEqual([]);
  });

  it("adds the first suggestion on Enter, and takes the last tag away on Backspace in an empty box", async () => {
    const { user, input, chips } = setup(["Licensed"]);
    await user.type(input(), "ware{Enter}");
    expect(chips()).toEqual(["Licensed", "Warehouse"]);
    await user.type(input(), "Dock{Enter}");
    expect(chips()).toEqual(["Licensed", "Warehouse", "Dock"]);
    await user.keyboard("{Backspace}");
    expect(chips()).toEqual(["Licensed", "Warehouse"]);
  });

  it("moves through its suggestions with the arrow keys and adds the one reached on Enter", async () => {
    const { user, input, chips } = setup();
    await user.click(input());
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(keyed(input())).toBe("Reach Truck");
    await user.keyboard("{Enter}");
    expect(chips()).toEqual(["Reach Truck"]);
  });

  it("can't be typed in or have its tags taken away while disabled", () => {
    const { input } = setup(["Licensed"], { disabled: true });
    expect(input().disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Remove Licensed" }).disabled).toBe(true);
  });
});
