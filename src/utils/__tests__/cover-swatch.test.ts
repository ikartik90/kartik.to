import { describe, expect, it } from "vitest";
import { coverSwatch } from "../cover-swatch";

describe("coverSwatch", () => {
  // The ramp in the order it was authored — a preset is recognised by its
  // colours before anything else about it.
  it("lays the ramp out as one diagonal", () => {
    expect(
      coverSwatch({ colors: ["#2E6BFFFF", "#FFD9A0FF"], colorBack: undefined }),
    ).toBe("linear-gradient(135deg, #2E6BFFFF, #FFD9A0FF)");
  });

  // The ground is the last layer of the shorthand, which is where CSS allows a
  // colour — it shows through wherever the ramp is translucent.
  it("puts the shader's ground behind it", () => {
    expect(
      coverSwatch({ colors: ["#2E6BFFFF", "#FFD9A0FF"], colorBack: "#12042BFF" }),
    ).toBe("linear-gradient(135deg, #2E6BFFFF, #FFD9A0FF), #12042BFF");
  });

  // A one-stop gradient is not a gradient at all — CSS rejects it — so the
  // single colour is stated twice rather than special-cased into a flat fill,
  // which would give the tile two shapes to be in.
  it("survives a cover tuned down to one colour", () => {
    expect(coverSwatch({ colors: ["#FFFFFFFF"], colorBack: undefined })).toBe(
      "linear-gradient(135deg, #FFFFFFFF, #FFFFFFFF)",
    );
  });

  // A mesh gradient has no ground and, in principle, a cover could reach here
  // mid-edit with an empty ramp. Neither is a reason to emit invalid CSS.
  it("falls back to nothing paintable rather than to broken CSS", () => {
    expect(coverSwatch({ colors: [], colorBack: undefined })).toBe("transparent");
    expect(coverSwatch({ colors: [], colorBack: "#12042BFF" })).toBe("#12042BFF");
  });
});
