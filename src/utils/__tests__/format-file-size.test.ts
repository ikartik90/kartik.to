import { describe, it, expect } from "vitest";
import { formatFileSize, formatImageType } from "../format-file-size";

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(269 * 1024)).toBe("269 KB");
  });
});

describe("formatImageType", () => {
  it("labels gif types", () => {
    expect(formatImageType("image/gif")).toBe("GIF Image");
  });
});
