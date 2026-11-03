import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InlineTableRecord } from "../cards";
import { Card, Typography } from "../ui";

afterEach(cleanup);

const BRAMPTON = "CCLS, 250 First Gulf Boulevard, Brampton, ON";
const MISSISSAUGA = "Canada Cartage, 6090 White Hart Lane, Mississauga, ON";

/** A team record as Figma draws one: picked from its name, marked Selected while it is. */
function Team({ name, ...props }: { name: string; value?: string; defaultSelected?: boolean }) {
  return (
    <InlineTableRecord {...props}>
      <InlineTableRecord.Cell fill selects>
        <Typography variant="body">{name}</Typography>
        <InlineTableRecord.Selected>
          <span>Selected</span>
        </InlineTableRecord.Selected>
      </InlineTableRecord.Cell>
    </InlineTableRecord>
  );
}

const pressed = (name: RegExp) => screen.getByRole("button", { name }).getAttribute("aria-pressed");

describe("the inline table record", () => {
  it("names its parts as the code view prints them", () => {
    expect(InlineTableRecord.displayName).toBe("InlineTableRecord");
    for (const part of ["Cell", "Description", "Selected"] as const)
      expect(InlineTableRecord[part].displayName).toBe(`InlineTableRecord.${part}`);
  });

  it("is one button when it opens something, its cells and words spans inside it", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <InlineTableRecord onClick={onOpen}>
        <InlineTableRecord.Cell fill align="end">
          <Typography variant="body">String Value</Typography>
          <Typography tag="p" variant="metadata">Subcontent</Typography>
          <InlineTableRecord.Description>
            <Typography variant="metadata">Hint</Typography>
          </InlineTableRecord.Description>
        </InlineTableRecord.Cell>
      </InlineTableRecord>,
    );
    const record = screen.getByRole("button", { name: /String Value/ });
    expect(record.querySelector("div, p, button")).toBeNull();
    await user.click(record);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("makes a cell its own button, pressed while it's picked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <InlineTableRecord>
        <InlineTableRecord.Cell fill aria-pressed onClick={onSelect}>
          <Typography variant="body">{BRAMPTON}</Typography>
        </InlineTableRecord.Cell>
        <InlineTableRecord.Cell>
          <InlineTableRecord.Description>
            <Typography variant="metadata">Hint</Typography>
          </InlineTableRecord.Description>
        </InlineTableRecord.Cell>
      </InlineTableRecord>,
    );
    const cell = screen.getByRole("button", { name: BRAMPTON });
    expect(cell.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Hint").tagName).toBe("P");
    await user.click(cell);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("is picked from its selecting cell, holding it from defaultSelected", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Team name={BRAMPTON} defaultSelected />
        <Team name={MISSISSAUGA} />
      </>,
    );
    expect(pressed(/Brampton/)).toBe("true");
    expect(pressed(/Mississauga/)).toBe("false");
    expect(screen.getAllByText("Selected")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /Mississauga/ }));
    expect(pressed(/Mississauga/)).toBe("true");
    await user.click(screen.getByRole("button", { name: /Mississauga/ }));
    expect(pressed(/Mississauga/)).toBe("true");
    expect(screen.getAllByText("Selected")).toHaveLength(2);
  });

  it("is one of its card's records picked at a time, by its value", async () => {
    const user = userEvent.setup();
    render(
      <Card defaultValue={BRAMPTON}>
        <Card.Records>
          <Team name={BRAMPTON} value={BRAMPTON} />
          <Team name={MISSISSAUGA} value={MISSISSAUGA} />
        </Card.Records>
      </Card>,
    );
    expect(pressed(/Brampton/)).toBe("true");
    expect(pressed(/Mississauga/)).toBe("false");

    await user.click(screen.getByRole("button", { name: /Mississauga/ }));
    expect(pressed(/Brampton/)).toBe("false");
    expect(pressed(/Mississauga/)).toBe("true");
    expect(screen.getAllByText("Selected")).toHaveLength(1);
  });

  it("rows a line's words with what follows them, their metadata at its end, until words of their own", () => {
    render(
      <InlineTableRecord>
        <InlineTableRecord.Cell fill>
          <Typography variant="metadata">Team</Typography>
          <Typography variant="body">{BRAMPTON}</Typography>
          <span>Pill</span>
          <Typography variant="metadata">Part Time</Typography>
          <Typography tag="p" variant="metadata">Subcontent</Typography>
          <InlineTableRecord.Description>
            <Typography variant="metadata">Hint</Typography>
          </InlineTableRecord.Description>
        </InlineTableRecord.Cell>
      </InlineTableRecord>,
    );
    const cell = screen.getByText(BRAMPTON).closest("[data-line]")!.parentElement!;
    expect([...cell.children].map((part) => part.textContent)).toEqual(["Team", `${BRAMPTON}PillPart Time`, "Subcontent", "Hint"]);
    expect(screen.getByText("Part Time").hasAttribute("data-meta")).toBe(true);
    expect(screen.getByText("Team").hasAttribute("data-meta")).toBe(false);
    expect(screen.getByText("Hint").tagName).toBe("P");
  });

  it("clamps a description to its first lines until Show more", async () => {
    const user = userEvent.setup();
    render(
      <InlineTableRecord.Description clamp>
        <Typography variant="metadata">As a Janitor</Typography>
      </InlineTableRecord.Description>,
    );
    expect(screen.getByText("As a Janitor").hasAttribute("data-open")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByText("As a Janitor").hasAttribute("data-open")).toBe(true);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });
});
