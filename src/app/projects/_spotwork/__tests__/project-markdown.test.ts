import { describe, expect, it } from "vitest";
import { ABOUT } from "../about-stories";
import { SIDEBAR } from "../copy";
import { projectMarkdown } from "../project-markdown";

const lines = (id: string) => projectMarkdown(id)!.split("\n").filter(Boolean);

describe("projectMarkdown", () => {
  it("opens with the card's title and sentence", () => {
    expect(lines("check-ins").slice(0, 2)).toEqual([
      "# Check-ins and time tracking",
      "Rebuilt check-ins and time tracking, cutting attendance disputes by 65%",
    ]);
  });

  it("tells the About sheet's story, a heading per card over its paragraphs, the highlighted words strong", () => {
    const md = lines("check-ins");
    const [first] = ABOUT["check-ins"].sections;
    const at = md.indexOf(`## ${first.heading}`);
    expect(at).toBeGreaterThan(1);
    expect(md.slice(at + 1, at + 1 + first.body.length)).toEqual(
      first.body.map((paragraph) => paragraph.replace(/\*([^*]+)\*/g, "**$1**")),
    );
    expect(md.join("\n")).not.toMatch(/(^|[^*])\*[^*]/);
  });

  it("heads a card that has an eyebrow with it, over the card's heading", () => {
    const md = lines("activation-and-retention");
    const at = md.indexOf(`## ${SIDEBAR.eyebrows.onboarding}`);
    expect(md[at + 1]).toBe(`### ${SIDEBAR.headings.onboarding}`);
  });

  it("names the demos the page plays from a card", () => {
    const [demo] = ABOUT["activation-and-retention"].sections[2].demos!;
    expect(lines("activation-and-retention")).toContain(`_Interactive demo on the page: ${demo.label}_`);
  });

  it("states the outcome as its metric over what it means, then the role and the year", () => {
    const md = lines("design-system");
    expect(md).toContain("## 1.5× release frequency, up 9 releases");
    expect(md.slice(-2)).toEqual([
      "- **Role**: Product design, Design engineering, Design system management",
      "- **Year**: 2024–25",
    ]);
  });

  it("is none for anything but a project, and ends with a newline", () => {
    expect(projectMarkdown("onboarding")).toBeNull();
    expect(projectMarkdown("constructor")).toBeNull();
    expect(projectMarkdown("check-ins")!.endsWith("\n")).toBe(true);
  });
});
