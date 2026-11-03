import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LOGOS } from "../data";
import { Avatar } from "../data-table";
import { Card, Typography, glyph } from "../ui";

afterEach(cleanup);

const PARTS = ["Header", "Content", "Actions", "Records", "Section", "Footer", "Press"] as const;

describe("the card", () => {
  it("names its parts as the code view prints them", () => {
    expect(Card.displayName).toBe("Card");
    for (const part of PARTS) expect(Card[part].displayName).toBe(`Card.${part}`);
  });

  it("has no parts that open or close it", () => {
    for (const part of ["Toggle", "Expanded", "Collapsed", "Value"]) expect(Card).not.toHaveProperty(part);
  });

  it("holds whatever goes in its slot", () => {
    render(
      <Card role="listitem" aria-label="Slot">
        <p>Anything</p>
      </Card>,
    );
    expect(within(screen.getByRole("listitem", { name: "Slot" })).getByText("Anything")).toBeTruthy();
  });

  it("heads itself with a title at the level asked, its subcontent and actions beside it", () => {
    render(
      <Card>
        <Card.Header>
          <Card.Content>
            <Typography tag="h2" variant="subheading">Forklift Operator</Typography>
            <Typography tag="p" variant="metadata" className={glyph.subdued}>$20.50/hour</Typography>
          </Card.Content>
          <Card.Actions>
            <button type="button">Edit</button>
          </Card.Actions>
        </Card.Header>
      </Card>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Forklift Operator" })).toBeTruthy();
    expect(screen.getByText("$20.50/hour")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
  });

  it("titles itself at level 3 unless told otherwise", () => {
    render(<Typography tag="h3" variant="heading">Day Shift M/W/F</Typography>);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Day Shift M/W/F");
  });
});

describe("the company avatar", () => {
  it("shows the company's logo square, beside the words that name it", () => {
    const { container } = render(<Avatar type="company" src={LOGOS.Stalco} />);
    expect(container.firstElementChild!.getAttribute("data-type")).toBe("company");
    expect(screen.getByRole("presentation").getAttribute("width")).toBe("55");
  });
});
