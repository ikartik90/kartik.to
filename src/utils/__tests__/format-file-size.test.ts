import { describe, it, expect } from "vitest";
import { formatFileSize, formatMediaType } from "../format-file-size";

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(269 * 1024)).toBe("269 KB");
  });
});

describe("formatMediaType", () => {
  it("labels gif types", () => {
    expect(formatMediaType("image/gif")).toBe("GIF Image");
  });

  it("names a clip as a video, not an image", () => {
    expect(formatMediaType("video/mp4")).toBe("MP4 Video");
  });
});
