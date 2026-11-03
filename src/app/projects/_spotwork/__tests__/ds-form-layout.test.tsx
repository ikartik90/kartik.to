import { cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FORM_NAVIGATION, FORM_PRIMITIVES, FORM_STORIES } from "../ds-form";
import { renderStories } from "./story-harness";

afterEach(cleanup);

const TITLES: Record<string, string[]> = {
  "Hint Text": ["Type"],
  Stepper: ["State"],
  "Segmented Control": ["Segment layout", "Size"],
  "Form Navigation": ["State"],
};

// Form Navigation is listed under Navigation.
const render = () => renderStories([...FORM_STORIES, ...FORM_PRIMITIVES, FORM_NAVIGATION].filter((story) => story.id in TITLES));
const pressed = (button: HTMLElement) => button.getAttribute("aria-pressed");

describe("the Form page's layout and organism examples", () => {
  it("shows each component by each of Figma's properties, and leaves out typography and card content", () => {
    const { titles } = render();
    for (const [id, expected] of Object.entries(TITLES)) expect(titles(id), id).toEqual(expected);
    expect(FORM_STORIES.map((story) => story.id)).not.toContain("Plaintext");
    expect(FORM_STORIES.map((story) => story.id)).not.toContain("Address & Location");
    expect(FORM_STORIES.map((story) => story.id)).not.toContain("Week Day Select");
    expect(FORM_STORIES.map((story) => story.id)).not.toContain("Schedule Overrides");
  });

  it("shows the form's steps together, one done, one in progress and one to come", () => {
    const { preview } = render();
    const steps = within(preview("Form Navigation")).getAllByRole("button");
    expect(steps.map((step) => [step.textContent, step.getAttribute("aria-current")])).toEqual([
      ["Step 1Shift planning", null],
      ["Step 2Shift information", "step"],
      ["Step 3Review shift summary", null],
    ]);
  });

  it("shows the hint's types, its pill on Autowidth", () => {
    const { preview } = render();
    expect(preview("Hint Text").textContent).toBe("(UTC-4) Eastern Daylight Time-13m (-1 Day)");
    const types = [...preview("Hint Text", "Type").querySelectorAll("[data-cell] > [data-field] > [data-hint] > *")];
    expect(types.map((hint) => [hint.textContent, hint.getAttribute("data-tone")])).toEqual([
      ["(UTC-4) Eastern Daylight Time-13m (-1 Day)", null],
      ["This is who the workers would report to when they arrive on the site", null],
      ["15 minutes late", "warning"],
      ["Enter a time like 3:07 PM", "alert"],
    ]);
  });

  it("steps the stepper by itself, a break's 15 minutes at a time, and tints each state's hint", async () => {
    const { preview, user } = render();
    const stepper = within(preview("Stepper"));
    expect(stepper.getByText("30")).toBeTruthy();
    await user.click(stepper.getByRole("button", { name: "More" }));
    expect(stepper.getByText("45")).toBeTruthy();
    const hints = within(preview("Stepper", "State")).getAllByText("In minutes");
    expect(hints.map((hint) => hint.getAttribute("data-tone"))).toEqual([null, "alert", "warning"]);
  });

  it("presses the segment pressed", async () => {
    const { preview, user } = render();
    const segments = within(within(preview("Segmented Control")).getByRole("group", { name: "Break Type" })).getAllByRole("button");
    expect(segments.map(pressed)).toEqual(["false", "true"]);
    await user.click(segments[0]);
    expect(segments.map(pressed)).toEqual(["true", "false"]);
  });

  it("shows the segmented control small, as a filter has it", () => {
    const { preview } = render();
    const [, small] = within(preview("Segmented Control", "Size")).getAllByRole("group");
    expect(small.getAttribute("data-size")).toBe("small");
  });
});
