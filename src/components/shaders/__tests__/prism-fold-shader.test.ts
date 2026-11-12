import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { prismFoldFragmentShader } from "../prism-fold-shader";
import {
  DEFAULT_PRISM_FOLD,
  PRISM_FOLD_MAX_COLORS,
  toPrismFoldUniforms,
} from "../prism-fold-uniforms";

/** Each uniform's effective float precision: its own qualifier, else the shader's default. */
function precisions(source: string): Map<string, string> {
  const fallback = /precision\s+(lowp|mediump|highp)\s+float/.exec(source)?.[1] ?? "highp";
  return new Map(
    [...source.matchAll(/uniform\s+(?:(lowp|mediump|highp)\s+)?\w+\s+(u_\w+)/g)].map(
      ([, qualifier, name]) => [name, qualifier ?? fallback],
    ),
  );
}

describe("prismFoldFragmentShader", () => {
  it("is a complete program, not a truncated template literal", () => {
    expect(prismFoldFragmentShader.startsWith("#version 300 es")).toBe(true);
    expect(prismFoldFragmentShader).toContain("void main()");
    expect(prismFoldFragmentShader).toContain("fragColor =");
    expect(prismFoldFragmentShader.trimEnd().endsWith("}")).toBe(true);
  });

  it("declares every uniform the conversion sends it", () => {
    const uniforms = toPrismFoldUniforms(DEFAULT_PRISM_FOLD);

    for (const name of Object.keys(uniforms)) {
      if (name === "u_colors") {
        expect(prismFoldFragmentShader).toContain(
          `uniform vec4 u_colors[${PRISM_FOLD_MAX_COLORS}]`,
        );
        continue;
      }
      expect(
        new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`).test(prismFoldFragmentShader),
        name,
      ).toBe(true);
    }
  });

  it("declares each uniform it shares with Paper's vertex shader at the same precision", () => {
    // Not in the package's exports, so read from its folder; a mismatch fails to link.
    const dist = dirname(createRequire(import.meta.url).resolve("@paper-design/shaders"));
    const vertex = readFileSync(join(dist, "vertex-shader.js"), "utf8");
    const vertexUniforms = precisions(vertex);
    const fragmentUniforms = precisions(prismFoldFragmentShader);

    const shared = [...fragmentUniforms.keys()].filter((name) => vertexUniforms.has(name));
    expect(shared).toContain("u_pixelRatio");
    for (const name of shared) {
      expect(fragmentUniforms.get(name), name).toBe(vertexUniforms.get(name));
    }
  });

  it("actually reads every uniform it declares", () => {
    const declared = [
      ...prismFoldFragmentShader.matchAll(/uniform\s+(?:(?:lowp|mediump|highp)\s+)?\w+\s+(u_\w+)/g),
    ].map((match) => match[1]);

    expect(declared.length).toBeGreaterThan(0);
    for (const name of declared) {
      const uses = prismFoldFragmentShader.split(name).length - 1;
      expect(uses, `${name} is declared but never read`).toBeGreaterThan(1);
    }
  });
});
