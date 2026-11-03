import { cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CTA_STORIES } from "../ds-cta";
import { renderStories } from "./story-harness";

afterEach(cleanup);

describe("the CTA page's examples", () => {
  it("shows a button by each of Figma's properties", () => {
    const { titles } = renderStories(CTA_STORIES);
    expect(titles("Button")).toEqual(["Size", "Emphasis", "Tone", "State"]);
    expect(titles("Link")).toEqual(["State"]);
    // An icon button is a button at size icon.
    expect(CTA_STORIES.map((story) => story.id)).toEqual(["Button", "Link"]);
  });

  it("shows the disabled state beside the default, which hovers and presses by itself", () => {
    const { preview } = renderStories(CTA_STORIES);
    const buttons = within(preview("Button", "State")).getAllByRole<HTMLButtonElement>("button");
    expect(buttons.map((button) => button.disabled)).toEqual([false, true, true, true, false, true]);
    expect(preview("Button", "State").querySelector("[data-hover], [data-active]")).toBeNull();
  });

  it("fills the cell of a tone made for a surface with that surface", () => {
    const { preview } = renderStories(CTA_STORIES);
    const cells = [...preview("Button", "Tone").querySelectorAll<HTMLElement>("[data-cell]")];
    expect(cells.map((cell) => cell.dataset.ground)).toEqual([undefined, undefined, "warning", undefined, undefined]);
    // Tones nothing uses aren't shown.
    expect(preview("Button", "Tone").querySelector("[data-tone=special], [data-tone=onboarding], [data-tone=dark]")).toBeNull();
    expect(preview("Button", "Tone").textContent).not.toContain("Destructive Tertiary Button");
  });

  it("writes each example as the code that draws it", () => {
    const { code } = renderStories(CTA_STORIES);
    expect(code("Button", "Size")).toBe(
      [
        'import { EditIcon } from "@/components/icons"',
        'import { Button } from "@/components/ui/button"',
        'import { Tooltip } from "@/components/ui/tooltip"',
        "",
        "export function ButtonSize() {",
        "  return (",
        "    <>",
        '      <Button size="large">Confirm hours</Button>',
        '      <Button size="small">Add note</Button>',
        '      <Button size="icon" aria-label="Edit timecard">',
        "        <EditIcon aria-hidden />",
        "        <Tooltip>Edit timecard</Tooltip>",
        "      </Button>",
        "    </>",
        "  )",
        "}",
      ].join("\n"),
    );
    // The surface a tone is made for is the page's, not the code's.
    expect(code("Button", "Tone")).not.toContain("bg-");
  });
});
