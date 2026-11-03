/* eslint-disable sw-curie/item-in-its-list -- these tests put items in the wrong lists on purpose. */
import { cleanup, render } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dropdown } from "../dropdown";
import { BulkSelect } from "../filters";
import { PopoverMenu } from "../navigation";
import { Multiselect } from "../multiselect";
import { TypeAhead } from "../search";
import { Sidebar } from "../sidebar";
import { NotesAndHistory } from "../timecard";
import { Typography } from "../ui";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const PARTS: [ComponentType<{ children: ReactNode }> & { displayName?: string }, string][] = [
  [Dropdown.Item, "Dropdown"],
  [TypeAhead.Item, "TypeAhead"],
  [Multiselect.Option, "Multiselect"],
  [NotesAndHistory.Toggle, "NotesAndHistory"],
  [Sidebar.GroupLabel, "Sidebar.Group"],
  [PopoverMenu.Item, "PopoverMenu"],
  [BulkSelect.Item, "BulkSelect"],
  [Sidebar.Item, "Sidebar"],
];

describe("each component's own part", () => {
  it("refuses to stand alone, out of the component that holds it", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [Part, owner] of PARTS)
      expect(() =>
        render(
          <Part>
            <Typography variant="body">Timesheets</Typography>
          </Part>,
        ),
      ).toThrow(new Error(`${Part.displayName} must be used inside ${owner}`));
  });

  it("refuses another list's place", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <Sidebar label="Main">
          <Dropdown.Item>
            <Typography variant="body">Timesheets</Typography>
          </Dropdown.Item>
        </Sidebar>,
      ),
    ).toThrow("Dropdown.Item must be used inside Dropdown");
    expect(() =>
      render(
        <BulkSelect defaultOpen>
          <PopoverMenu.Item>
            <Typography variant="body">Add note</Typography>
          </PopoverMenu.Item>
        </BulkSelect>,
      ),
    ).toThrow("PopoverMenu.Item must be used inside PopoverMenu");
  });

  it("is refused by every other list even while that list is shut", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const words = <Typography variant="body">Timesheets</Typography>;
    expect(() => render(<Dropdown defaultValue="">{<PopoverMenu.Item>{words}</PopoverMenu.Item>}</Dropdown>)).toThrow(
      "PopoverMenu.Item must be used inside PopoverMenu",
    );
    expect(() =>
      render(
        <TypeAhead>
          <Sidebar.Item>{words}</Sidebar.Item>
        </TypeAhead>,
      ),
    ).toThrow("Sidebar.Item must be used inside Sidebar");
    expect(() =>
      render(
        <PopoverMenu.Root>
          <PopoverMenu label="More actions">
            <Dropdown.Item>{words}</Dropdown.Item>
          </PopoverMenu>
        </PopoverMenu.Root>,
      ),
    ).toThrow("Dropdown.Item must be used inside Dropdown");
    expect(() =>
      render(
        <BulkSelect>
          <TypeAhead.Item>{words}</TypeAhead.Item>
        </BulkSelect>,
      ),
    ).toThrow("TypeAhead.Item must be used inside TypeAhead");
  });

  it("is refused where its own component isn't the one holding it", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <Sidebar label="Main">
          <Sidebar.GroupLabel>
            <Typography variant="metadataStrong">Admin</Typography>
          </Sidebar.GroupLabel>
        </Sidebar>,
      ),
    ).toThrow("Sidebar.GroupLabel must be used inside Sidebar.Group");
    expect(() =>
      render(
        <Multiselect>
          <NotesAndHistory.Toggle>Notes & History</NotesAndHistory.Toggle>
        </Multiselect>,
      ),
    ).toThrow("NotesAndHistory.Toggle must be used inside NotesAndHistory");
  });
});
