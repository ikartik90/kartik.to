import { describe, it, expect } from "vitest";
import { filenameToLabel } from "../filename-to-label";

describe("filenameToLabel", () => {
  it("title-cases kebab-case filenames", () => {
    expect(filenameToLabel("chart-demo")).toBe("Chart Demo");
  });

  it("title-cases snake_case filenames", () => {
    expect(filenameToLabel("line_chart")).toBe("Line Chart");
  });

  it("title-cases a single word", () => {
    expect(filenameToLabel("placeholder")).toBe("Placeholder");
  });
});
