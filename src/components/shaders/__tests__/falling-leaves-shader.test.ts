import { describe, expect, it } from "vitest";
import { ditheringFragmentShader } from "@paper-design/shaders";
import { fallingLeavesFragmentShader } from "../falling-leaves-shader";
import { MAX_LEAVES, MAX_WORD_LINES, leafFrameUniforms, leafSettingUniforms, type LeafSettings } from "../falling-leaves";

const SETTINGS: LeafSettings = {
  count: 14,
  size: 100,
  depth: 0.5,
  fall: 56,
  sway: 36,
  tumble: 1,
  tumblePace: 0.56,
  wind: 100,
  density: 0.8,
  veins: 0.45,
  inks: ["--colors-brand-orange", "--colors-brand-pink"],
  inkStrength: 1,
  behindWords: { density: 0.32, ink: 0.6, margin: 40 },
};

const sent = {
  ...leafSettingUniforms(SETTINGS, ["rgb(255, 171, 111)", "rgb(255, 77, 151)"], "data:image/png;base64,"),
  ...leafFrameUniforms({ place: [], look: [] }, []),
};

describe("fallingLeavesFragmentShader", () => {
  it("is Paper's dithering program with the leaves spliced in, whole", () => {
    expect(fallingLeavesFragmentShader.startsWith("#version 300 es")).toBe(true);
    expect(fallingLeavesFragmentShader).toContain("void main()");
    expect(fallingLeavesFragmentShader).toContain("leafField(leafAt);");
    expect(fallingLeavesFragmentShader.trimEnd().endsWith("}")).toBe(true);
    expect(fallingLeavesFragmentShader.length).toBeGreaterThan(ditheringFragmentShader.length);
  });

  it("declares every uniform the leaves send it, the arrays at the sizes they're padded to", () => {
    for (const name of Object.keys(sent)) {
      expect(new RegExp(`uniform\\s+\\w+\\s+${name}(\\[\\d+\\])?\\s*;`).test(fallingLeavesFragmentShader), name).toBe(true);
    }
    expect(fallingLeavesFragmentShader).toContain(`uniform vec4 u_leaf[${MAX_LEAVES}];`);
    expect(fallingLeavesFragmentShader).toContain(`uniform vec4 u_leafLook[${MAX_LEAVES}];`);
    expect(fallingLeavesFragmentShader).toContain(`uniform vec4 u_words[${MAX_WORD_LINES}];`);
  });

  it("reads every leaf and word uniform it declares", () => {
    const declared = [...fallingLeavesFragmentShader.matchAll(/uniform\s+\w+\s+(u_(?:leaf|word)\w*)/g)].map((match) => match[1]);
    expect(declared.length).toBe(Object.keys(sent).length);
    for (const name of declared) {
      const uses = fallingLeavesFragmentShader.split(new RegExp(`\\b${name}\\b`)).length - 1;
      expect(uses, `${name} is declared but never read`).toBeGreaterThan(1);
    }
  });

  it("shows the pattern through the cells a leaf leaves empty, not the canvas", () => {
    expect(fallingLeavesFragmentShader).toContain("res = step(.5, patternShape + patternDither);");
  });
});
