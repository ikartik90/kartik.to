import { describe, expect, it } from "vitest";
import { cosmicTrackFragmentShader } from "../cosmic-track-shader";
import {
  COSMIC_TRACK_MAX_COLORS,
  DEFAULT_COSMIC_TRACK,
  toCosmicTrackUniforms,
} from "../cosmic-track-uniforms";

// The GLSL itself cannot run here — jsdom has no WebGL — but the SOURCE is just
// a string, and two failure modes are visible in it. Both are silent at
// runtime, which is what makes them worth a test:
//
//   • a stray pair of backticks in a GLSL comment closes the template literal
//     early and TRUNCATES the shader (it has happened three times);
//   • a uniform added to the conversion but never declared here is ignored by
//     the compiler, so the control renders and simply does nothing.

describe("cosmicTrackFragmentShader", () => {
  it("is a complete program, not a truncated template literal", () => {
    expect(cosmicTrackFragmentShader.startsWith("#version 300 es")).toBe(true);
    expect(cosmicTrackFragmentShader).toContain("void main()");
    // The final statement of main(), so anything cut short fails here.
    expect(cosmicTrackFragmentShader).toContain("fragColor = vec4(color, opacity)");
    expect(cosmicTrackFragmentShader.trimEnd().endsWith("}")).toBe(true);
  });

  it("declares every uniform the conversion sends it", () => {
    const uniforms = toCosmicTrackUniforms(DEFAULT_COSMIC_TRACK);

    for (const name of Object.keys(uniforms)) {
      // `u_colors` is declared as a sized array rather than a bare float.
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
    // A uniform that is declared but never used is stripped by the compiler and
    // its control goes dead — the same symptom as a missing declaration.
    const declared = [
      ...cosmicTrackFragmentShader.matchAll(/uniform\s+\w+\s+(u_\w+)/g),
    ].map((match) => match[1]);

    expect(declared.length).toBeGreaterThan(0);

    for (const name of declared) {
      const uses = cosmicTrackFragmentShader.split(name).length - 1;
      // One occurrence is the declaration itself; a used uniform has more.
      expect(uses, `${name} is declared but never read`).toBeGreaterThan(1);
    }
  });
});
