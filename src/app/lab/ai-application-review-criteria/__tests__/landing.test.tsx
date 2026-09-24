// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CRITERIA } from "../harness-data";
import { Landing } from "../landing";

afterEach(cleanup);

// The job as the recruiter finds it (Figma 94:4840): three criteria already
// running. `new-logo` is the one they add in the edit dialog, and adding it is
// what the rest of the prototype tests.
const STARTING = [
  "Full Sales Cycle Experience",
  "CRM & Sales Ops",
  "Closed Large Deals",
];

function criteriaList() {
  return screen.getByRole("list", { name: "AI-assisted application review" });
}

describe("landing", () => {
  it("names the job", () => {
    render(<Landing />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Account Executive",
    );
  });

  it("lists the job's criteria in order, with each prompt from the fixture", () => {
    render(<Landing />);
    const items = within(criteriaList()).getAllByRole("listitem");

    expect(items.map((item) => item.querySelector("h4")?.textContent)).toEqual(
      STARTING,
    );
    for (const [i, title] of STARTING.entries()) {
      const criterion = CRITERIA.find((c) => c.title === title);
      expect(items[i].textContent).toContain(criterion?.prompt);
    }
  });

  it("does not list the criterion the recruiter has yet to add", () => {
    render(<Landing />);
    expect(screen.queryByText("New Logo Acquisition")).toBeNull();
  });

  it("says the review is up to date, and offers to edit it", () => {
    render(<Landing />);
    expect(screen.getByText("Up to date")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
  });

  it("marks AI features as the section on screen", () => {
    render(<Landing />);
    expect(document.querySelector('[aria-current="page"]')?.textContent).toBe(
      "AI features",
    );
  });
});
