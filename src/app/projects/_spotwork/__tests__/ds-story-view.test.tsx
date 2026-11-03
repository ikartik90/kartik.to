import { cleanup, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Variants, columnsFor, defineStory } from "../ds-story";
import { Div } from "../ds-tailwind";
import { renderStories } from "./story-harness";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Counter({ label }: { label: string }) {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{`${label} ${count}`}</button>;
}

const STORY = defineStory({
  id: "Sample",
  figma: "Atoms/Sample",
  examples: [
    { render: () => <Counter label="Count" /> },
    {
      title: "Size",
      ground: "dark",
      render: () => (
        <Div tw="flex items-center gap-(--sw-gap-xl)">
          <Counter label="Large" />
          <Counter label="Small" />
        </Div>
      ),
    },
  ],
});

describe("a component's page", () => {
  it("heads it with its name alone, over its examples: the first untitled, the rest by property", () => {
    const { story, titles } = renderStories([STORY]);
    const region = story("Sample");
    expect(within(region).getByRole("heading", { level: 1 }).textContent).toBe("Sample");
    expect(region.textContent).not.toContain("Atoms/Sample");
    expect(titles("Sample")).toEqual(["Size"]);
    expect(region.querySelectorAll("[data-example]")).toHaveLength(2);
  });

  it("shows each example working, on the ground it's drawn on", async () => {
    const { preview, user } = renderStories([STORY]);
    await user.click(within(preview("Sample", "Size")).getByRole("button", { name: "Large 0" }));
    expect(within(preview("Sample", "Size")).getByRole("button", { name: "Large 1" })).toBeTruthy();
    expect(preview("Sample", "Size").dataset.ground).toBe("dark");
  });

  it("puts each example's code, as a file, under it, folded until it's shown in full", async () => {
    const { example, code, showCode } = renderStories([STORY]);
    expect(code("Sample", "Size")).toBe(
      [
        'import { Counter } from "@/components/ui/counter"',
        "",
        "export function SampleSize() {",
        "  return (",
        '    <div className="flex items-center gap-(--sw-gap-xl)">',
        '      <Counter label="Large" />',
        '      <Counter label="Small" />',
        "    </div>",
        "  )",
        "}",
      ].join("\n"),
    );
    expect(code("Sample")).toContain("export function SampleDemo()");
    const box = example("Sample", "Size").querySelector("[data-code]")!;
    expect(box.hasAttribute("data-open")).toBe(false);
    await showCode("Sample", "Size");
    expect(box.hasAttribute("data-open")).toBe(true);
    // The code is only a demo's, so there's nothing to copy.
    expect(within(box as HTMLElement).queryByRole("button")).toBeNull();
  });
});

const VARIANTS = defineStory({
  id: "Sample",
  figma: "Atoms/Sample",
  examples: [
    {
      title: "State",
      render: () => (
        <Variants>
          <Counter label="Default" />
          <Counter label="Disabled" />
          <Counter label="Warning" />
          <Counter label="Error" />
        </Variants>
      ),
    },
  ],
});

describe("an example's variants", () => {
  it("puts each in a cell of its own, the cells divided between them only", () => {
    const { preview } = renderStories([VARIANTS]);
    const cells = [...preview("Sample", "State").querySelectorAll<HTMLElement>("[data-variants] > [data-cell]")];
    expect(cells.map((cell) => cell.textContent)).toEqual(["Default 0", "Disabled 0", "Warning 0", "Error 0"]);
    // Two by two, rather than three with one left alone.
    expect(cells.map((cell) => [cell.hasAttribute("data-row-end"), cell.hasAttribute("data-last-row")])).toEqual([
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ]);
    expect(cells.some((cell) => cell.hasAttribute("data-fills-row"))).toBe(false);
  });

  it("runs a short last row's last cell to the row's end, as wide as it's drawn", () => {
    const FIVE = defineStory({
      id: "Sample",
      figma: "Atoms/Sample",
      examples: [
        {
          title: "State",
          render: () => (
            <Variants>
              {["Default", "Hover", "Pressed", "Disabled", "Open"].map((label) => (
                <Counter key={label} label={label} />
              ))}
            </Variants>
          ),
        },
      ],
    });
    const { preview } = renderStories([FIVE]);
    const cells = [...preview("Sample", "State").querySelectorAll<HTMLElement>("[data-variants] > [data-cell]")];
    // Three across, the last row two.
    expect(cells.map((cell) => cell.hasAttribute("data-fills-row"))).toEqual([false, false, false, false, true]);
  });

  it("writes the variants alone in the code, the cells being the page's", () => {
    const { code } = renderStories([VARIANTS]);
    expect(code("Sample", "State")).toContain(
      ["  return (", "    <>", '      <Counter label="Default" />', '      <Counter label="Disabled" />'].join("\n"),
    );
    expect(code("Sample", "State")).not.toContain("Variants");
  });

  it("goes three across where every variant fits a third of the floor, else two, else one, and never past their count", () => {
    expect(columnsFor([200, 300, 250, 100, 100], 1000)).toBe(3);
    // Four go two by two rather than leave one alone on a row.
    expect(columnsFor([200, 300, 250, 100], 1000)).toBe(2);
    expect(columnsFor([200, 400, 250], 1000)).toBe(2);
    expect(columnsFor([200, 600], 1000)).toBe(1);
    expect(columnsFor([100, 100], 1000)).toBe(2);
    expect(columnsFor([100], 1000)).toBe(1);
  });
});
