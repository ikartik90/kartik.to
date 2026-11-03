import { cleanup, fireEvent, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FILTER_STORIES } from "../ds-filter";
import { renderStories } from "./story-harness";

afterEach(cleanup);

describe("the Filter page's examples", () => {
  it("keeps the page's components, in its order", () => {
    renderStories(FILTER_STORIES);
    expect([...document.querySelectorAll("[data-ds-story]")].map((story) => story.getAttribute("aria-label"))).toEqual([
      "Range Type",
      "Range Selector",
      "Bulk Select",
      "Date Selector",
    ]);
  });

  it("shows each component by its Figma properties", () => {
    const { titles } = renderStories(FILTER_STORIES);
    expect(titles("Range Type")).toEqual(["Data range type"]);
    expect(titles("Range Selector")).toEqual(["State"]);
    expect(titles("Bulk Select")).toEqual(["State", "Size", "Is subtle"]);
    expect(titles("Date Selector")).toEqual(["State"]);
  });
});

describe("Range Type", () => {
  it("moves its range by itself", () => {
    const { preview } = renderStories(FILTER_STORIES);
    fireEvent.keyDown(within(preview("Range Type")).getAllByRole("slider")[1], { key: "ArrowRight" });
    expect(within(preview("Range Type")).getAllByRole("slider").map((slider) => slider.getAttribute("aria-valuenow"))).toEqual(["2", "4"]);
  });

});

describe("Range Selector", () => {
  it("counts the range moved to by itself", async () => {
    const { preview, user } = renderStories(FILTER_STORIES);
    const trigger = () => within(preview("Range Selector")).getAllByRole("button")[0];
    expect(trigger().textContent).toBe("Rating2–3");
    await user.click(trigger());
    fireEvent.keyDown(within(preview("Range Selector")).getAllByRole("slider")[1], { key: "ArrowRight" });
    expect(trigger().textContent).toBe("Rating2–4");
  });

});

describe("Bulk Select", () => {
  it("ticks its checkbox by itself, and shows Active with its menu open", async () => {
    const { preview, user } = renderStories(FILTER_STORIES);
    expect(within(preview("Bulk Select", "State")).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Offered",
      "Accepted",
      "Waitlist",
    ]);
    const box = within(preview("Bulk Select")).getByRole("checkbox", { name: "Select all" });
    await user.click(box);
    expect(box.getAttribute("aria-checked")).toBe("true");
  });
});

describe("Date Selector", () => {
  it("steps between the days it has by itself", async () => {
    const { preview, user } = renderStories(FILTER_STORIES);
    await user.click(within(preview("Date Selector")).getByRole("button", { name: "Previous day" }));
    expect(within(preview("Date Selector")).getByRole("button", { expanded: false }).textContent).toBe("Yesterday");
    expect(within(preview("Date Selector")).getByRole<HTMLButtonElement>("button", { name: "Previous day" }).disabled).toBe(true);
  });

  it("writes its parts, the day held by the selector", () => {
    const { code } = renderStories(FILTER_STORIES);
    expect(code("Date Selector")).toBe(
      [
        'import { DateSelector } from "@/components/ui/date-selector"',
        "",
        "export function DateSelectorDemo() {",
        "  return (",
        '    <div className="h-[17.5rem]">',
        '      <DateSelector defaultDay="today">',
        '        <DateSelector.Previous aria-label="Previous day" />',
        "        <DateSelector.Date />",
        '        <DateSelector.Next aria-label="Next day" />',
        '        <DateSelector.Calendar today="2023-11-03" />',
        "      </DateSelector>",
        "    </div>",
        "  )",
        "}",
      ].join("\n"),
    );
  });
});

