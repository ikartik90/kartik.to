import { describe, expect, it } from "vitest";
import {
  LISTED_PROJECTS,
  PROJECT_CARDS,
  movedTo,
  projectCard,
  projectParams,
  projectPath,
  projectPreviewPath,
} from "../project-cards";

describe("the homepage's projects", () => {
  it("are the design system, check-ins and activation, in the cards' order", () => {
    expect(PROJECT_CARDS.map((card) => card.id)).toEqual(["design-system", "check-ins", "activation-and-retention"]);
  });

  it("open at their own address, under the copy the homepage is served at", () => {
    expect(projectPath("check-ins")).toBe("/projects/check-ins");
    expect(projectPath("check-ins", "/dive")).toBe("/dive/projects/check-ins");
  });

  it("are each built ahead as a page at their address, the old addresses left to redirect on request", () => {
    expect(projectParams()).toEqual([{ id: "design-system" }, { id: "check-ins" }, { id: "activation-and-retention" }]);
  });

  it("each have a link preview of their own", () => {
    expect(projectPreviewPath("design-system")).toBe("/og/projects/design-system.png");
  });

  it("are found by their id, and nothing else is", () => {
    expect(projectCard("check-ins")?.title).toBe("Check-ins and time tracking");
    expect(projectCard("onboarding")).toBeUndefined();
    expect(projectCard("constructor")).toBeUndefined();
  });

  it("send the old onboarding and shift scheduling addresses to activation and retention, which tells both", () => {
    expect(movedTo("onboarding")).toBe("activation-and-retention");
    expect(movedTo("shift-scheduling")).toBe("activation-and-retention");
    expect(movedTo("check-ins")).toBeUndefined();
    expect(movedTo("constructor")).toBeUndefined();
  });

  it("are listed for the sitemap and llms.txt at their addresses, with their sentences", () => {
    expect(LISTED_PROJECTS).toEqual(
      PROJECT_CARDS.map((card) => ({ title: card.title, summary: card.sentence, path: `/projects/${card.id}` })),
    );
  });
});
