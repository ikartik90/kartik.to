import { describe, expect, it } from "vitest";
import { isVideoSource, sourceExtension } from "@/utils/media-source";

describe("sourceExtension", () => {
  it("lowercases whatever case the file was named in", () => {
    expect(sourceExtension("CLIP.MP4")).toBe("mp4");
  });

  it("reads past a query and a hash on a CDN url", () => {
    expect(sourceExtension("https://cdn.example.com/media/uuid-clip.mp4?v=2")).toBe(
      "mp4",
    );
    expect(sourceExtension("https://cdn.example.com/a.png#frag")).toBe("png");
  });

  it("is empty for a key with no extension, dotted directories and all", () => {
    expect(sourceExtension("https://cdn.example.com/v1.2/shot")).toBe("");
  });
});

describe("isVideoSource", () => {
  it("recognises an mp4 wherever it is spelled", () => {
    expect(isVideoSource("demo.mp4")).toBe(true);
    expect(isVideoSource("https://cdn.example.com/media/uuid-demo.MP4?v=2")).toBe(
      true,
    );
  });

  // The reverse of `formatCanCarryAlpha`'s bias, and for the same reason:
  // an unknown source renders as a picture, which is what every source in
  // every document written before mp4 support actually is.
  it("is false for pictures and for anything it cannot name", () => {
    for (const src of ["a.png", "a.gif", "a.svg", "a.webp", "a.jpg", "a"]) {
      expect(isVideoSource(src)).toBe(false);
    }
  });
});
