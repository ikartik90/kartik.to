import { describe, expect, it } from "vitest";
import { filterOptions, type OptionItem } from "../option-filter";

const OPTIONS: OptionItem[] = [
  { value: "apple", label: "Apple" },
  { value: "avocado", label: "Avocado" },
  { value: "banana", label: "Banana" },
  { value: "grapes", label: "Grapes" },
  { value: "passion-fruit", label: "Passion Fruit" },
];

describe("filterOptions", () => {
  it("returns every option for an empty or whitespace query", () => {
    expect(filterOptions(OPTIONS, "")).toEqual(OPTIONS);
    expect(filterOptions(OPTIONS, "   ")).toEqual(OPTIONS);
  });

  it("keeps options whose label contains the query, case-insensitively", () => {
    expect(filterOptions(OPTIONS, "ap").map((o) => o.value)).toEqual([
      "apple",
      "grapes",
    ]);
    expect(filterOptions(OPTIONS, "AVOCADO").map((o) => o.value)).toEqual([
      "avocado",
    ]);
  });

  it("matches anywhere in the label, not just the start", () => {
    expect(filterOptions(OPTIONS, "fruit").map((o) => o.value)).toEqual([
      "passion-fruit",
    ]);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(filterOptions(OPTIONS, "  banana  ").map((o) => o.value)).toEqual([
      "banana",
    ]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterOptions(OPTIONS, "zzz")).toEqual([]);
  });

  it("preserves the original order of the matches", () => {
    expect(filterOptions(OPTIONS, "a").map((o) => o.value)).toEqual([
      "apple",
      "avocado",
      "banana",
      "grapes",
      "passion-fruit",
    ]);
  });
});
