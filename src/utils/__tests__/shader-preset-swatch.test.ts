import { describe, expect, it } from "vitest";
import { shaderPresetSwatch } from "../shader-preset-swatch";

describe("shaderPresetSwatch", () => {
  it("lays the ramp out as one diagonal", () => {
    expect(
      shaderPresetSwatch({ colors: ["#2E6BFFFF", "#FFD9A0FF"], colorBack: undefined }),
    ).toBe("linear-gradient(135deg, #2E6BFFFF, #FFD9A0FF)");
  });

  it("puts the shader's ground behind it", () => {
    expect(
      shaderPresetSwatch({ colors: ["#2E6BFFFF", "#FFD9A0FF"], colorBack: "#12042BFF" }),
    ).toBe("linear-gradient(135deg, #2E6BFFFF, #FFD9A0FF), #12042BFF");
  });

  it("survives a preset tuned down to one colour", () => {
    expect(shaderPresetSwatch({ colors: ["#FFFFFFFF"], colorBack: undefined })).toBe(
      "linear-gradient(135deg, #FFFFFFFF, #FFFFFFFF)",
    );
  });

  it("falls back to nothing paintable rather than to broken CSS", () => {
    expect(shaderPresetSwatch({ colors: [], colorBack: undefined })).toBe("transparent");
    expect(shaderPresetSwatch({ colors: [], colorBack: "#12042BFF" })).toBe("#12042BFF");
  });
});
