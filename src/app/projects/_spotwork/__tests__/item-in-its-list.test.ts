import { ESLint } from "eslint";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../../../..");
const eslint = new ESLint({ cwd: ROOT });

/** The rule's messages for `code`, as a file of the prototype's. */
async function lint(code: string) {
  const [result] = await eslint.lintText(code, { filePath: resolve(__dirname, "../fixture.tsx") });
  return result.messages.filter((message) => message.ruleId === "sw-curie/item-in-its-list").map((message) => message.message);
}

describe("the item-in-its-list lint rule", () => {
  it("flags an item written inside another list", async () => {
    expect(await lint("export const x = <PopoverMenu label='More'><Dropdown.Item>Add note</Dropdown.Item></PopoverMenu>;")).toEqual([
      "Dropdown.Item must be used inside Dropdown, not PopoverMenu.",
    ]);
    expect(await lint("export const x = <Sidebar label='Main'><Sidebar.Group><TypeAhead.Item>Shifts</TypeAhead.Item></Sidebar.Group></Sidebar>;")).toEqual([
      "TypeAhead.Item must be used inside TypeAhead, not Sidebar.",
    ]);
  });

  it("knows every component's own parts", async () => {
    expect(await lint("export const x = <Dropdown defaultValue=''><Multiselect.Option>Forklift</Multiselect.Option></Dropdown>;")).toEqual([
      "Multiselect.Option must be used inside Multiselect, not Dropdown.",
    ]);
    expect(await lint("export const x = <Multiselect><NotesAndHistory.Toggle>Notes</NotesAndHistory.Toggle></Multiselect>;")).toEqual([
      "NotesAndHistory.Toggle must be used inside NotesAndHistory, not Multiselect.",
    ]);
    expect(await lint("export const x = <TypeAhead><Sidebar.GroupLabel>Admin</Sidebar.GroupLabel></TypeAhead>;")).toEqual([
      "Sidebar.GroupLabel must be used inside Sidebar, not TypeAhead.",
    ]);
    expect(
      await lint(
        "export const x = <NotesAndHistory><NotesAndHistory.Toggle>Notes</NotesAndHistory.Toggle></NotesAndHistory>;",
      ),
    ).toEqual([]);
  });

  it("knows Field's label and hint text, and passes them through its content", async () => {
    expect(await lint("export const x = <Dropdown defaultValue=''><Field.Label>Status</Field.Label></Dropdown>;")).toEqual([
      "Field.Label must be used inside Field, not Dropdown.",
    ]);
    expect(await lint("export const x = <Multiselect><Field.HintText>Pick one</Field.HintText></Multiselect>;")).toEqual([
      "Field.HintText must be used inside Field, not Multiselect.",
    ]);
    expect(
      await lint(
        "export const x = <Field orientation='horizontal'><Checkbox /><Field.Content><Field.Label>Temp to hire</Field.Label><Field.HintText>Full-time</Field.HintText></Field.Content></Field>;",
      ),
    ).toEqual([]);
  });

  it("passes an item in its own list, nested in another or not, and one built away from any list", async () => {
    expect(await lint("export const x = <Sidebar label='Main'><Sidebar.Group><Sidebar.Item>Shifts</Sidebar.Item></Sidebar.Group></Sidebar>;")).toEqual([]);
    expect(await lint("export const x = <PopoverMenu label='More'><div><Dropdown><Dropdown.Item>One</Dropdown.Item></Dropdown></div></PopoverMenu>;")).toEqual([]);
    expect(await lint("export const items = [<Dropdown.Item key='a'>One</Dropdown.Item>];")).toEqual([]);
  });
});
