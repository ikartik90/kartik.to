import { describe, expect, it } from "vitest";
import { cosmicTrackFragmentShader } from "../cosmic-track-shader";
import {
  COSMIC_TRACK_MAX_COLORS,
  DEFAULT_COSMIC_TRACK,
  toCosmicTrackUniforms,
} from "../cosmic-track-uniforms";

describe("cosmicTrackFragmentShader", () => {
  it("is a complete program, not a truncated template literal", () => {
    expect(cosmicTrackFragmentShader.startsWith("#version 300 es")).toBe(true);
    expect(cosmicTrackFragmentShader).toContain("void main()");
    expect(cosmicTrackFragmentShader).toContain("fragColor = vec4(color, opacity)");
    expect(cosmicTrackFragmentShader.trimEnd().endsWith("}")).toBe(true);
  });

  it("declares every uniform the conversion sends it", () => {
    const uniforms = toCosmicTrackUniforms(DEFAULT_COSMIC_TRACK);

    for (const name of Object.keys(uniforms)) {
      const declaration =
        name === "u_colors"
          ? `uniform vec4 u_colors[${COSMIC_TRACK_MAX_COLORS}]`
          : new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`);

      if (typeof declaration === "string") {
        expect(cosmicTrackFragmentShader, name).toContain(declaration);
      } else {
        expect(declaration.test(cosmicTrackFragmentShader), name).toBe(true);
      }
    }
  });

  it("actually READS every uniform it declares", () => {
    const declared = [
      ...cosmicTrackFragmentShader.matchAll(/uniform\s+\w+\s+(u_\w+)/g),
    ].map((match) => match[1]);

    expect(declared.length).toBeGreaterThan(0);

    for (const name of declared) {
      const uses = cosmicTrackFragmentShader.split(name).length - 1;
      expect(uses, `${name} is declared but never read`).toBeGreaterThan(1);
    }
  });
});
