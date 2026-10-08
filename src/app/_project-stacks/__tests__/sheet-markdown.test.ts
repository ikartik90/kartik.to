import { describe, expect, it } from "vitest";
import { projectMarkdown } from "../sheet-markdown";

describe("projectMarkdown", () => {
  const shift = projectMarkdown("shift-scheduling")!;
  const onboarding = projectMarkdown("onboarding")!;

  it("opens with the card's title and sentence, then the section's headline", () => {
    expect(shift).toMatch(
      /^# Shift scheduling\n\n## Made posted schedules extendable and cut scheduling clicks by 81%\n\nAt Spotwork, I led the rebuild of the staffing management platform/,
    );
  });

  it("links each clip by what it shows", () => {
    expect(shift).toContain(
      "[Video: A video depicting the new shift posting experience.](https://pub-3f00bf1204d54dbe88e07be7288fe49c.r2.dev/media/b43a6d5b-b8b0-4563-a997-2485086fd046-new-shift-redesign.mp4)",
    );
  });

  it("heads each section with its caption over its statement", () => {
    expect(shift).toContain(
      "## Business fit\n\n### Repeat shifts were a critical lever of our business\n\nCompanies posting shifts regularly signalled high trust",
    );
    expect(onboarding).toContain(
      "## North Star\n\n### Get the right customer from signup to first shift with zero friction.",
    );
    expect(shift).toContain(
      "## Takeaway\n\n### Speed has to leave room for exceptions\n\nRecurrence was efficient but rigid.",
    );
  });

  it("lists the reasons and the gap's points by their titles", () => {
    expect(shift).toContain("- **Duplicate work**: Each extension had staffing managers redraft the shift");
    expect(shift).toContain("- **Echoed in support requests**: Support requests and back-channel feedback");
    expect(onboarding).toContain("- **Firewall blocked sales-qualified leads**: Company network firewalls quarantined");
  });

  it("puts each card's paragraphs under its title, the highlighted words strong", () => {
    expect(onboarding).toContain(
      "## Put Sales in charge of customer activations\n\nWith email verification gone, unverified customers could still post shifts, and a **default made us liable to pay the worker**.\n\nSales brought in",
    );
    expect(shift.replaceAll("**", "")).not.toContain("*");
  });

  it("gives the concepts, then the prompts they were counted on, the fewest clicks strong, and each one's verdict", () => {
    expect(shift).toContain(
      "## Concept testing\n\n### I prototyped two concepts to make scheduling more efficient\n\n#### Concept 1: Recurrence\n\nRecurrence came from calendar and meeting apps",
    );
    expect(shift).toContain(
      "| Scheduling prompt | Old calendar | Recurrence | Drag to select |\n| --- | --- | --- | --- |\n| 100 consecutive days from 7 October 2025 | 103 | 12 | **11** |",
    );
    expect(shift).toContain("| Every Tuesday and Thursday in November 2025 | 8 | **4** | **4** |");
    expect(shift).toContain("| All days in Q2 2025, excluding Good Friday | 92 | Not possible | **3** |");
    expect(shift).toContain(
      "A drag counts as two clicks, and every change of month as one.\n\n- Recurrence: Rejected\n- Drag to select: Approved",
    );
  });

  it("states the outcome as its metric over what it means", () => {
    expect(shift).toContain("## 81% fewer clicks to pick shift dates\n\nDragging across the calendar");
    expect(onboarding).toContain(
      "## 78% fifth‑shift retention, up 16 points\n\nA smoother onboarding process **improved perceived ease‑of‑use",
    );
  });

  it("says where the page has a demo or a figure to see", () => {
    expect(shift).toContain("_Interactive demo on the page_");
    expect(onboarding).toContain("_Figure on the page: A two-by-two grid of allowed above blocked");
  });

  it("is none for a project whose sheet isn't ready, or no project", () => {
    expect(projectMarkdown("check-ins")).toBeNull();
    expect(projectMarkdown("nope")).toBeNull();
  });

  it("ends with a newline", () => {
    expect(shift.endsWith("\n")).toBe(true);
    expect(shift.endsWith("\n\n")).toBe(false);
  });
});
